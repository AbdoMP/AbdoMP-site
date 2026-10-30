// Project Details Page Controller: Markdown description, Steps timeline, Gallery with Lightbox & Video embed, Cross-field recommendations
import { loadData, shuffle, parseMedia, hostOf, otherMode } from './store.js';
import {
  renderHeader,
  renderFooter,
  renderDraftBanner,
  cardHTML,
  observeReveal,
  bgFxHTML,
  loadError,
  setMode
} from './common.js';
import { icon } from './icons.js';
import { escapeHtml as esc, safeUrl, md } from './markdown.js';

let siteData = null;
let currentProject = null;
let lightboxItems = [];
let currentLbIndex = 0;

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

  // Find project by ID
  const params = new URLSearchParams(window.location.search);
  const projectId = params.get('id');

  currentProject = (siteData.projects || []).find((p) => p.id === projectId);

  if (!currentProject) {
    renderNotFound();
    return;
  }

  // Automatically align current page mode with project's field
  setMode(currentProject.field, { persist: false, animate: false, updateUrl: false });

  // Render header & footer
  renderHeader(siteData, { page: 'project' });
  renderFooter(siteData);
  renderDraftBanner();

  // Set page meta title
  document.title = `${currentProject.title} — ${siteData.content.name}`;

  // Render Project Hero & Content
  renderProjectHero();
  renderProjectBody();
  renderRecommendations();

  // Prepare lightbox
  setupLightbox();

  observeReveal();
}

function renderNotFound() {
  renderHeader(siteData, { page: 'project' });
  renderFooter(siteData);
  const main = document.getElementById('main');
  main.innerHTML = `
    <div class="container not-found">
      <div>
        <p class="eyebrow">404 Not Found</p>
        <h1 class="h-lg">Project not found</h1>
        <p class="lead">The project you are looking for does not exist or has been removed.</p>
        <a href="index.html" class="btn btn--primary" style="margin-top: 1.5rem;">
          ${icon('arrowLeft')} Return to Home
        </a>
      </div>
    </div>
  `;
}

function renderProjectHero() {
  const p = currentProject;
  const hero = document.getElementById('p-hero');
  if (!hero) return;

  const fieldLabel = siteData.content.modes[p.field]?.label || (p.field === 'eng' ? 'Engineering' : 'Multimedia');

  hero.innerHTML = `
    <div class="p-hero__bg" style="background-image: url('${esc(safeUrl(p.thumbnail || ''))}')" aria-hidden="true"></div>
    <div class="container">
      <a href="index.html#work" class="back-link">
        ${icon('arrowLeft')} Back to all projects
      </a>
      <div class="p-meta">
        <span class="p-field"><i></i> ${esc(fieldLabel)}</span>
        ${p.date ? `<span>• Date: ${esc(p.date)}</span>` : ''}
        ${p.published === false ? `<span class="tag tag--muted">Draft Preview</span>` : ''}
      </div>
      <h1 class="p-title">${esc(p.title)}</h1>
      ${p.summary ? `<p class="lead p-summary">${esc(p.summary)}</p>` : ''}
      <div class="tags">
        ${(p.tags || []).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}
      </div>

      ${p.thumbnail ? `
        <div class="p-cover reveal">
          <img src="${esc(safeUrl(p.thumbnail))}" alt="${esc(p.title)} preview" fetchpriority="high">
        </div>
      ` : ''}
    </div>
  `;
}

function renderProjectBody() {
  const p = currentProject;
  const layout = document.getElementById('p-layout');
  if (!layout) return;

  // Build steps timeline HTML if steps exist
  const stepsHTML = (p.steps && p.steps.length > 0) ? `
    <section class="glass p-block reveal">
      <h2><span class="ico">${icon('list')}</span> Process &amp; Key Steps</h2>
      <ol class="steps">
        ${p.steps.map((st) => `
          <li class="step">
            <h3>${esc(st.title)}</h3>
            <p>${esc(st.text)}</p>
          </li>
        `).join('')}
      </ol>
    </section>
  ` : '';

  // Build gallery HTML if items exist
  const galleryItems = p.gallery || [];
  lightboxItems = galleryItems;

  const galleryHTML = galleryItems.length > 0 ? `
    <section class="glass p-block reveal" id="gallery-section">
      <h2><span class="ico">${icon('image')}</span> Media &amp; Visual Gallery</h2>
      <div class="gallery">
        ${galleryItems.map((item, index) => {
          const media = parseMedia(item.url);
          const isVid = media.type === 'video';
          const thumbSrc = isVid ? (media.thumb || p.thumbnail) : item.url;
          return `
            <figure class="gallery-item" data-index="${index}" role="button" tabindex="0" aria-label="View media ${index + 1}">
              ${thumbSrc ? `
                <img src="${esc(safeUrl(thumbSrc))}" alt="${esc(item.caption || p.title)}" loading="lazy">
              ` : `
                <div class="video-ph">${icon('play')}</div>
              `}
              ${isVid ? `
                <div class="play"><span>${icon('play')}</span></div>
              ` : ''}
              ${item.caption ? `<figcaption>${esc(item.caption)}</figcaption>` : ''}
            </figure>
          `;
        }).join('')}
      </div>
    </section>
  ` : '';

  // Build sidebar / metadata block
  const linksHTML = (p.links && p.links.length > 0) ? `
    <div class="glass p-block reveal">
      <h2><span class="ico">${icon('link')}</span> Links &amp; Resources</h2>
      <ul class="link-list">
        ${p.links.map((lnk) => `
          <li>
            <a href="${esc(safeUrl(lnk.url))}" class="link-item" target="_blank" rel="noopener">
              <span class="fav">${icon('external')}</span>
              <span class="txt">
                <span>${esc(lnk.label || 'Project Link')}</span>
                <span class="host">${esc(hostOf(lnk.url))}</span>
              </span>
              <span class="arrow">${icon('arrowUpRight')}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>
  ` : '';

  layout.innerHTML = `
    <div class="container p-layout">
      <div class="p-main">
        <!-- Markdown Description Box -->
        <article class="glass p-block reveal">
          <h2><span class="ico">${icon('file')}</span> Project Overview &amp; Details</h2>
          <div class="prose">
            ${md(p.description || p.summary || 'No detailed description provided.')}
          </div>
        </article>

        <!-- Steps Timeline -->
        ${stepsHTML}

        <!-- Gallery -->
        ${galleryHTML}
      </div>

      <aside class="p-aside">
        <div class="glass p-block reveal">
          <h2>Project Metadata</h2>
          <dl class="info-list">
            <div>
              <dt>Discipline</dt>
              <dd>${esc(p.field === 'eng' ? 'Electrical Engineering' : 'Multimedia Design')}</dd>
            </div>
            ${p.date ? `
              <div>
                <dt>Completed</dt>
                <dd>${esc(p.date)}</dd>
              </div>
            ` : ''}
            <div>
              <dt>Status</dt>
              <dd>${p.published !== false ? 'Published' : 'Draft'}</dd>
            </div>
          </dl>
        </div>

        ${linksHTML}
      </aside>
    </div>
  `;

  // Gallery click handlers
  layout.querySelectorAll('.gallery-item').forEach((fig) => {
    const handler = () => {
      const idx = parseInt(fig.dataset.index, 10);
      openLightbox(idx);
    };
    fig.addEventListener('click', handler);
    fig.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handler();
      }
    });
  });
}

function setupLightbox() {
  let lb = document.getElementById('lightbox');
  if (!lb) {
    lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.className = 'lightbox';
    lb.setAttribute('role', 'dialog');
    lb.setAttribute('aria-modal', 'true');
    lb.setAttribute('aria-label', 'Media Lightbox');
    lb.innerHTML = `
      <div class="lightbox__top">
        <span class="lb-counter" id="lb-counter">1 / 1</span>
        <button type="button" class="lb-btn lb-close" id="lb-close" aria-label="Close lightbox">
          ${icon('x')}
        </button>
      </div>
      <div class="lightbox__stage" id="lb-stage">
        <button type="button" class="lb-btn lb-prev" id="lb-prev" aria-label="Previous item">
          ${icon('chevLeft')}
        </button>
        <div id="lb-media-target"></div>
        <button type="button" class="lb-btn lb-next" id="lb-next" aria-label="Next item">
          ${icon('chevRight')}
        </button>
      </div>
      <div class="lightbox__caption" id="lb-caption"></div>
    `;
    document.body.appendChild(lb);

    lb.querySelector('#lb-close').addEventListener('click', closeLightbox);
    lb.querySelector('#lb-prev').addEventListener('click', () => navigateLightbox(-1));
    lb.querySelector('#lb-next').addEventListener('click', () => navigateLightbox(1));

    lb.addEventListener('click', (e) => {
      if (e.target === lb || e.target.id === 'lb-stage') closeLightbox();
    });

    window.addEventListener('keydown', (e) => {
      if (!lb.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    });
  }
}

function openLightbox(index) {
  if (!lightboxItems || lightboxItems.length === 0) return;
  currentLbIndex = (index + lightboxItems.length) % lightboxItems.length;
  const lb = document.getElementById('lightbox');
  lb.classList.add('is-open');
  document.body.style.overflow = 'hidden';
  renderLightboxCurrent();
}

function closeLightbox() {
  const lb = document.getElementById('lightbox');
  if (lb) lb.classList.remove('is-open');
  const target = document.getElementById('lb-media-target');
  if (target) target.innerHTML = '';
  document.body.style.overflow = '';
}

function navigateLightbox(dir) {
  if (!lightboxItems || lightboxItems.length === 0) return;
  currentLbIndex = (currentLbIndex + dir + lightboxItems.length) % lightboxItems.length;
  renderLightboxCurrent();
}

function renderLightboxCurrent() {
  const item = lightboxItems[currentLbIndex];
  if (!item) return;

  const counter = document.getElementById('lb-counter');
  const target = document.getElementById('lb-media-target');
  const caption = document.getElementById('lb-caption');

  if (counter) counter.textContent = `${currentLbIndex + 1} / ${lightboxItems.length}`;
  if (caption) caption.textContent = item.caption || '';

  const media = parseMedia(item.url);
  if (media.type === 'video') {
    if (media.provider === 'file') {
      target.innerHTML = `
        <div class="frame">
          <video controls autoplay style="width: 100%; height: 100%;">
            <source src="${esc(safeUrl(media.embed))}">
            Your browser does not support video playback.
          </video>
        </div>
      `;
    } else {
      target.innerHTML = `
        <div class="frame">
          <iframe src="${esc(safeUrl(media.embed))}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      `;
    }
  } else {
    target.innerHTML = `<img src="${esc(safeUrl(item.url))}" alt="${esc(item.caption || 'Project visual')}">`;
  }
}

function renderRecommendations() {
  const recoSec = document.getElementById('p-recommendations');
  if (!recoSec) return;

  const otherField = otherMode(currentProject.field);
  const otherLabel = siteData.content.modes[otherField]?.label || (otherField === 'eng' ? 'Engineering' : 'Multimedia');
  const otherColorVar = otherField === 'eng' ? 'var(--brand-green)' : 'var(--brand-pink)';

  // Pick 3 random published projects from the other field
  const pool = (siteData.projects || []).filter((p) => p.field === otherField && p.published !== false && p.id !== currentProject.id);
  const selected = shuffle(pool).slice(0, 3);

  if (selected.length === 0) {
    recoSec.style.display = 'none';
    return;
  }

  recoSec.innerHTML = `
    <div class="container reco" style="--other-accent: ${otherColorVar}">
      <div class="reco-band reveal">
        <div class="reco-head">
          <div>
            <p class="eyebrow">Cross-Disciplinary Bridge</p>
            <h2 class="h-lg">Explore ${esc(otherLabel)} Projects</h2>
            <p class="lead" style="margin: 0;">Notice how principles of systems thinking and visual clarity intersect across both fields.</p>
          </div>
          <a href="index.html?mode=${otherField}#work" class="btn btn--primary">
            View All ${esc(otherLabel)} ${icon('arrowRight')}
          </a>
        </div>
        <div class="project-grid">
          ${selected.map((p) => cardHTML(p, { cross: true, modes: siteData.content.modes })).join('')}
        </div>
      </div>
    </div>
  `;
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
