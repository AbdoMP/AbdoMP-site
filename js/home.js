// Home page logic: Hero, big switch, project grid with tag filtering, About/Skills per mode, mailto Contact form
import { loadData, publishedProjects } from './store.js';
import {
  getMode,
  setMode,
  renderHeader,
  renderFooter,
  renderDraftBanner,
  bindModeSwitch,
  modeSwitchHTML,
  cardHTML,
  observeReveal,
  bgFxHTML,
  toast,
  loadError
} from './common.js';
import { icon } from './icons.js';
import { escapeHtml as esc, safeUrl, md } from './markdown.js';

let siteData = null;
let activeTag = 'ALL';

async function init() {
  try {
    siteData = await loadData();
  } catch (err) {
    loadError(err);
    return;
  }

  // Inject background effects
  const bgWrap = document.getElementById('bg-fx-container');
  if (bgWrap) bgWrap.innerHTML = bgFxHTML();

  // Render header & footer
  renderHeader(siteData, { page: 'home' });
  renderFooter(siteData);
  renderDraftBanner();

  // Render Hero
  renderHero();

  // Render Big Switch section
  renderBigSwitch();

  // Render Work (Projects)
  renderWork();

  // Render About & Skills
  renderAbout();

  // Render Contact section
  renderContact();

  // Observe scroll reveals
  observeReveal();

  // Wire intersection observer for showing compact switch in header
  setupCompactSwitchObserver();

  // Listen for mode changes
  window.addEventListener('modechange', () => {
    activeTag = 'ALL';
    updateModeDependentSections();
  });
}

function renderHero() {
  const c = siteData.content;
  const hero = document.getElementById('hero');
  if (!hero) return;

  hero.innerHTML = `
    <div class="container hero-grid">
      <div class="hero-content reveal">
        ${c.hero.available ? `
          <div class="hero-status">
            <span class="live"></span>
            <span>Available for freelance &amp; engineering projects</span>
          </div>
        ` : ''}
        <p class="hero-greeting">${esc(c.hero.greeting || "Hi, I'm")}</p>
        <h1 class="h-xl">
          <span class="name-line">${esc(c.name)}</span>
        </h1>
        <p class="hero-tagline">
          <span class="t-eng">Electrical Engineer</span> <span class="muted">&amp;</span> <span class="t-media">Multimedia Designer</span>
        </p>
        <p class="lead hero-intro">${esc(c.hero.intro || '')}</p>
        <div class="hero-actions">
          <a href="#work" class="btn btn--primary" id="hero-work-btn">
            Explore Work ${icon('arrowRight')}
          </a>
          <a href="#contact" class="btn btn--ghost" id="hero-contact-btn">
            Get in touch
          </a>
        </div>
        <div class="hero-meta">
          <span>${icon('pin')} ${esc(c.hero.location || 'Cairo, Egypt')}</span>
          <span>${icon('database')} 2 Specializations, 1 Mindset</span>
        </div>
      </div>
      <div class="hero-visual reveal">
        <div class="hero-ring"></div>
        <div class="hero-photo">
          <img src="${esc(safeUrl(c.hero.photo || 'assets/hero.jpg'))}" alt="${esc(c.name)}" width="420" height="420">
        </div>
        <div class="float-badge float-badge--eng" title="Hardware &amp; Embedded">
          ${icon('eng')}
          <span>Embedded &amp; Systems</span>
        </div>
        <div class="float-badge float-badge--media" title="Design &amp; Motion">
          ${icon('media')}
          <span>Design &amp; Motion</span>
        </div>
      </div>
    </div>
    <div class="scroll-cue" aria-hidden="true">
      <span></span>
    </div>
  `;
}

function renderBigSwitch() {
  const container = document.getElementById('switch-container');
  if (!container) return;

  container.innerHTML = `
    <div class="container switch-section reveal">
      <p class="eyebrow">Select Specialization</p>
      ${modeSwitchHTML(siteData.content, 'big', 'big-mode-switch')}
      <p class="switch-hint">Switch toggles themes, projects, skills, and the active CV download</p>
    </div>
  `;

  const bigSwitchEl = document.getElementById('big-mode-switch');
  bindModeSwitch(bigSwitchEl);

  // Also bind the compact switch inside the header
  const compactSwitchEl = document.getElementById('header-switch');
  if (compactSwitchEl) {
    bindModeSwitch(compactSwitchEl);
  }
}

function setupCompactSwitchObserver() {
  const bigSwitchSection = document.getElementById('switch-container');
  if (!bigSwitchSection) return;

  const header = document.getElementById('site-header');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      // When big switch is out of view (scrolled past), show the compact switch in header
      if (entry.boundingClientRect.top < 0 && !entry.isIntersecting) {
        header.classList.add('show-compact-switch');
      } else {
        header.classList.remove('show-compact-switch');
      }
    });
  }, { threshold: 0.1 });

  observer.observe(bigSwitchSection);
}

function renderWork() {
  const mode = getMode();
  const conf = siteData.content.modes[mode];
  const workSec = document.getElementById('work');
  if (!workSec) return;

  const projects = publishedProjects(siteData, mode);
  
  // Extract unique tags for this mode
  const tagSet = new Set();
  projects.forEach((p) => (p.tags || []).forEach((t) => tagSet.add(t)));
  const tags = Array.from(tagSet);

  const filtered = activeTag === 'ALL'
    ? projects
    : projects.filter((p) => (p.tags || []).includes(activeTag));

  workSec.innerHTML = `
    <div class="container">
      <div class="work-head reveal">
        <div class="section-head">
          <p class="eyebrow">${esc(conf.label)} Portfolio</p>
          <h2 class="h-lg">${esc(conf.projectsTitle || 'Featured Projects')}</h2>
          <p class="lead">${esc(conf.projectsSubtitle || '')}</p>
        </div>
        <div class="work-count">
          Showing <strong>${filtered.length}</strong> of ${projects.length} projects
        </div>
      </div>

      <div class="filters reveal" role="toolbar" aria-label="Project tag filters">
        <button type="button" class="chip ${activeTag === 'ALL' ? 'is-active' : ''}" data-tag="ALL">
          All Projects <span class="count">${projects.length}</span>
        </button>
        ${tags.map((t) => {
          const count = projects.filter((p) => (p.tags || []).includes(t)).length;
          return `
            <button type="button" class="chip ${activeTag === t ? 'is-active' : ''}" data-tag="${esc(t)}">
              ${esc(t)} <span class="count">${count}</span>
            </button>
          `;
        }).join('')}
      </div>

      <div class="project-grid swap-in" id="project-cards">
        ${filtered.length > 0 ? filtered.map((p) => cardHTML(p, { modes: siteData.content.modes })).join('') : `
          <div class="empty-state" style="grid-column: 1 / -1;">
            <p class="h-md">No projects found</p>
            <p class="muted">No projects match the tag "${esc(activeTag)}" in this portfolio mode.</p>
            <button type="button" class="btn btn--sm" id="reset-tag-btn">Show all projects</button>
          </div>
        `}
      </div>
    </div>
  `;

  // Attach filter events
  workSec.querySelectorAll('.filters .chip').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      activeTag = e.currentTarget.dataset.tag;
      renderWork();
    });
  });

  const resetBtn = workSec.querySelector('#reset-tag-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      activeTag = 'ALL';
      renderWork();
    });
  }

  observeReveal(workSec);
}

function renderAbout() {
  const mode = getMode();
  const conf = siteData.content.modes[mode];
  const aboutSec = document.getElementById('about');
  if (!aboutSec) return;

  aboutSec.innerHTML = `
    <div class="container">
      <div class="section-head reveal">
        <p class="eyebrow">${esc(conf.label)} Perspective</p>
        <h2 class="h-lg">${esc(conf.aboutTitle || 'About Me')}</h2>
      </div>

      <div class="about-grid">
        <div class="about-bio reveal">
          <div class="about-text prose">
            ${md(conf.about || '')}
          </div>
          ${conf.stats && conf.stats.length > 0 ? `
            <div class="stats">
              ${conf.stats.map((s) => `
                <div class="stat">
                  <div class="stat__value grad-text">${esc(s.value)}</div>
                  <div class="stat__label">${esc(s.label)}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>

        <div class="skills reveal">
          ${(conf.skills || []).map((grp, idx) => `
            <div class="glass skill-group">
              <h3>
                <span class="idx">0${idx + 1}.</span>
                <span>${esc(grp.group)}</span>
              </h3>
              <div class="tags">
                ${(grp.items || []).map((item) => `<span class="tag">${esc(item)}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  observeReveal(aboutSec);
}

function renderContact() {
  const c = siteData.content;
  const contactSec = document.getElementById('contact');
  if (!contactSec) return;

  contactSec.innerHTML = `
    <div class="container">
      <div class="section-head section-head--center reveal">
        <p class="eyebrow">Get In Touch</p>
        <h2 class="h-lg">Let's build something remarkable</h2>
        <p class="lead">Have a project in mind, need embedded engineering consulting, or want high-end multimedia production? Drop a message.</p>
      </div>

      <div class="contact-grid">
        <div class="glass contact-info reveal">
          <div>
            <h3 class="h-md" style="margin-bottom: .6rem;">Direct Contact</h3>
            <p class="muted">Feel free to reach out directly via email or connect on social platforms.</p>
          </div>

          <a href="mailto:${esc(c.email || 'hello@example.com')}" class="contact-email" id="direct-email-link">
            ${icon('mail')}
            <span>${esc(c.email || 'hello@example.com')}</span>
          </a>

          <div>
            <p class="eyebrow" style="margin-bottom: .75rem;">Social &amp; Networks</p>
            <div class="socials">
              ${(c.socials || []).map((s) => `
                <a class="social" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener" aria-label="${esc(s.label)}" title="${esc(s.label)}">
                  ${icon(s.icon || 'globe')}
                </a>
              `).join('')}
            </div>
          </div>
        </div>

        <form class="glass contact-form reveal" id="email-contact-form">
          <div class="form-row">
            <div class="field">
              <label for="contact-name">Your Name</label>
              <input type="text" id="contact-name" class="input" placeholder="e.g. Sarah Jenkins" required>
            </div>
            <div class="field">
              <label for="contact-email-input">Your Email</label>
              <input type="email" id="contact-email-input" class="input" placeholder="e.g. sarah@example.com" required>
            </div>
          </div>
          <div class="field">
            <label for="contact-subject">Subject</label>
            <input type="text" id="contact-subject" class="input" placeholder="Project Inquiry / Opportunity" required>
          </div>
          <div class="field">
            <label for="contact-message">Message</label>
            <textarea id="contact-message" class="textarea" rows="4" placeholder="Briefly describe your project, timeline, and requirements..." required></textarea>
          </div>
          <p class="form-note">Clicking Send will open your default email client with your message pre-filled.</p>
          <button type="submit" class="btn btn--primary" id="contact-submit-btn">
            ${icon('send')} Send Message
          </button>
        </form>
      </div>
    </div>
  `;

  // Handle contact form via mailto:
  const form = contactSec.querySelector('#email-contact-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = form.querySelector('#contact-name').value.trim();
    const email = form.querySelector('#contact-email-input').value.trim();
    const subject = form.querySelector('#contact-subject').value.trim();
    const msg = form.querySelector('#contact-message').value.trim();

    const fullSubject = encodeURIComponent(`[Portfolio Inquiry] ${subject} - from ${name}`);
    const fullBody = encodeURIComponent(`Hi Abdulrahman,\n\n${msg}\n\nFrom: ${name} (${email})`);
    const mailtoUrl = `mailto:${c.email || 'hello@example.com'}?subject=${fullSubject}&body=${fullBody}`;

    toast('Opening your email app...', 'send');
    window.location.href = mailtoUrl;
  });

  observeReveal(contactSec);
}

function updateModeDependentSections() {
  renderWork();
  renderAbout();
}

// Initialise when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
