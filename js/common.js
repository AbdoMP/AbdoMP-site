// Shared UI: mode/theme state, header, footer, cards, toasts, reveal
import { icon } from './icons.js';
import { escapeHtml as esc, safeUrl } from './markdown.js';
import { hasDraft, clearDraft, formatDate } from './store.js';

const root = document.documentElement;
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------------- Mode & theme ---------------- */
export const getMode = () => root.dataset.mode || 'eng';
export const getTheme = () => root.dataset.theme || 'dark';

/** Runs fn inside a circular "color wipe" view transition from origin {x,y}. */
export function wipe(fn, origin) {
  if (!document.startViewTransition || reduceMotion()) { fn(); return; }
  const x = origin?.x ?? innerWidth / 2;
  const y = origin?.y ?? innerHeight / 2;
  const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const vt = document.startViewTransition(fn);
  vt.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 750, easing: 'cubic-bezier(.65,0,.35,1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
}

export function setMode(mode, { origin, persist = true, animate = true, updateUrl = true } = {}) {
  if (mode !== 'eng' && mode !== 'media') return;
  const apply = () => {
    root.dataset.mode = mode;
    if (persist) localStorage.setItem('am-mode', mode);
    if (updateUrl) {
      const url = new URL(location.href);
      url.searchParams.set('mode', mode);
      history.replaceState(null, '', url);
    }
    syncSwitches();
    window.dispatchEvent(new CustomEvent('modechange', { detail: { mode } }));
  };
  if (animate && mode !== getMode()) wipe(apply, origin); else apply();
}

export function setTheme(theme, origin) {
  wipe(() => {
    root.dataset.theme = theme;
    localStorage.setItem('am-theme', theme);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#061a33' : '#ECF0F1');
  }, origin);
}

function syncSwitches() {
  const mode = getMode();
  document.querySelectorAll('.mode-switch__opt').forEach((b) => {
    b.setAttribute('aria-checked', String(b.dataset.mode === mode));
    b.tabIndex = b.dataset.mode === mode ? 0 : -1;
  });
}

export function modeSwitchHTML(content, size = 'big', id = '') {
  const m = content.modes;
  const opt = (key, ico) => `
    <button type="button" role="radio" class="mode-switch__opt" data-mode="${key}" id="${id}-${key}" aria-checked="false">
      <span class="mode-switch__icon">${icon(ico)}</span>
      <span class="mode-switch__text">
        <span class="mode-switch__label">${esc(m[key].label)}</span>
        <span class="mode-switch__sub">${esc(m[key].short || '')}</span>
      </span>
    </button>`;
  return `<div class="mode-switch mode-switch--${size}" role="radiogroup" aria-label="Choose portfolio" id="${id}">
    <span class="mode-switch__thumb" aria-hidden="true"></span>${opt('eng', 'eng')}${opt('media', 'media')}</div>`;
}

/** Wires click + arrow-key handling for a mode switch. onPick overrides default behaviour. */
export function bindModeSwitch(el, onPick) {
  if (!el) return;
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-switch__opt');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    onPick ? onPick(btn.dataset.mode, origin) : setMode(btn.dataset.mode, { origin });
  });
  el.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    const next = getMode() === 'eng' ? 'media' : 'eng';
    const btn = el.querySelector(`[data-mode="${next}"]`);
    btn.click(); btn.focus();
  });
  syncSwitches();
}

/* ---------------- Header ---------------- */
export function renderHeader(data, { page = 'home' } = {}) {
  const c = data.content;
  const pre = page === 'home' ? '' : 'index.html';
  const links = [['work', 'Work'], ['about', 'About'], ['contact', 'Contact']];
  const header = document.getElementById('site-header');
  header.innerHTML = `
    <div class="container header-inner">
      <a class="brand" href="index.html" id="brand-link" aria-label="${esc(c.name)} — home">
        <span class="logo-mark" aria-hidden="true"></span>
        <span class="brand-name">${esc(c.name.split(' ')[0])}<span>.</span></span>
      </a>
      <nav class="nav" id="main-nav" aria-label="Primary">
        ${links.map(([id, l]) => `<a href="${pre}#${id}" id="nav-${id}" data-section="${id}">${l}</a>`).join('')}
      </nav>
      <div class="header-actions">
        ${modeSwitchHTML(c, 'compact', 'header-switch')}
        <button class="btn btn--icon btn--ghost theme-toggle" id="theme-toggle" type="button" aria-label="Toggle light/dark mode">
          ${icon('sun')}${icon('moon')}
        </button>
        <a class="btn btn--primary btn--sm cv-btn" id="cv-btn" target="_blank" rel="noopener">${icon('download')}<span>CV</span></a>
        <button class="btn btn--icon btn--ghost menu-toggle" id="menu-toggle" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="mobile-menu">
          <span class="bars"><span></span><span></span><span></span></span>
        </button>
      </div>
    </div>
    <div class="mobile-menu" id="mobile-menu">
      ${links.map(([id, l]) => `<a class="mobile-link" href="${pre}#${id}" id="mnav-${id}">${l}</a>`).join('')}
      <a class="btn btn--primary cv-btn" id="cv-btn-mobile" target="_blank" rel="noopener">${icon('download')}<span class="cv-text">Download CV</span></a>
    </div>`;

  // CV link follows mode
  const updateCV = () => {
    const mode = getMode();
    const conf = c.modes[mode];
    header.querySelectorAll('.cv-btn').forEach((a) => {
      a.href = safeUrl(conf.cvUrl || '#');
      a.title = `Download ${conf.label} CV`;
      const t = a.querySelector('.cv-text');
      if (t) t.textContent = `Download ${conf.label} CV`;
    });
  };
  updateCV();
  window.addEventListener('modechange', updateCV);

  // Theme
  header.querySelector('#theme-toggle').addEventListener('click', (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    setTheme(getTheme() === 'dark' ? 'light' : 'dark', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  });

  // Mobile menu
  const toggle = header.querySelector('#menu-toggle');
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setMenu(!document.body.classList.contains('menu-open')));
  header.querySelectorAll('.mobile-menu a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  addEventListener('keydown', (e) => e.key === 'Escape' && setMenu(false));

  // Scrolled state
  const onScroll = () => header.classList.toggle('is-scrolled', scrollY > 10);
  onScroll();
  addEventListener('scroll', onScroll, { passive: true });

  return header;
}

/* ---------------- Footer ---------------- */
export function socialLinksHTML(socials = []) {
  return socials.filter((s) => s.url).map((s) => `
    <a class="social" href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener" aria-label="${esc(s.label)}" title="${esc(s.label)}">${icon(s.icon || 'globe')}</a>`).join('');
}

export function renderFooter(data) {
  const c = data.content;
  const el = document.getElementById('site-footer');
  el.innerHTML = `
    <div class="container">
      <div class="footer-top">
        <a href="index.html" aria-label="Home"><span class="logo-full footer-logo" aria-hidden="true"></span></a>
        <div class="socials">${socialLinksHTML(c.socials)}</div>
      </div>
      <div class="footer-bottom">
        <span>© ${new Date().getFullYear()} ${esc(c.name)}. Designed &amp; built with care.</span>
        <a href="admin.html" class="admin-lock" id="admin-lock" aria-label="Admin login" title="Admin">${icon('lock')}</a>
      </div>
    </div>`;
}

/* ---------------- Draft banner ---------------- */
export function renderDraftBanner() {
  if (!hasDraft()) return;
  const b = document.createElement('div');
  b.className = 'draft-banner';
  b.innerHTML = `<span class="dot"></span><span>Previewing local draft</span>
    <a class="btn btn--sm" href="admin.html" id="draft-admin">Admin</a>
    <button class="btn btn--sm btn--ghost" id="draft-discard" type="button">Exit preview</button>`;
  document.body.appendChild(b);
  b.querySelector('#draft-discard').addEventListener('click', () => {
    if (confirm('Discard the local draft and view the published site? Unexported admin changes will be lost.')) { clearDraft(); location.reload(); }
  });
}

/* ---------------- Cards ---------------- */
export function cardHTML(p, { cross = false, modes } = {}) {
  const label = modes?.[p.field]?.label || (p.field === 'eng' ? 'Engineering' : 'Multimedia');
  const href = `project.html?id=${encodeURIComponent(p.id)}`;
  return `
  <a class="card ${cross ? 'is-cross' : ''}" data-field="${p.field}" href="${href}" id="card-${esc(p.id)}" aria-label="Open project: ${esc(p.title)}">
    <div class="card__media">
      ${p.thumbnail ? `<img src="${esc(safeUrl(p.thumbnail))}" alt="" loading="lazy" decoding="async">` : ''}
      <span class="card__field"><i></i>${esc(label)}</span>
      ${p.date ? `<span class="card__date">${esc(formatDate(p.date))}</span>` : ''}
    </div>
    <div class="card__body">
      <div class="tags">${(p.tags || []).slice(0, 4).map((t) => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <h3 class="card__title">${esc(p.title)}</h3>
      <p class="card__summary">${esc(p.summary || '')}</p>
      <span class="card__cta">Open project ${icon('arrowRight')}</span>
    </div>
  </a>`;
}

/* ---------------- Toast ---------------- */
export function toast(msg, ico = 'checkCircle', ms = 3200) {
  let wrap = document.querySelector('.toast-wrap');
  if (!wrap) { wrap = document.createElement('div'); wrap.className = 'toast-wrap'; wrap.setAttribute('role', 'status'); wrap.setAttribute('aria-live', 'polite'); document.body.appendChild(wrap); }
  const t = document.createElement('div');
  t.className = 'toast';
  t.innerHTML = `${icon(ico)}<span>${esc(msg)}</span>`;
  wrap.appendChild(t);
  setTimeout(() => { t.classList.add('is-leaving'); setTimeout(() => t.remove(), 320); }, ms);
}

/* ---------------- Reveal on scroll ---------------- */
let io;
export function observeReveal(scope = document) {
  if (!io) {
    io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  }
  scope.querySelectorAll('.reveal:not(.is-visible)').forEach((el) => io.observe(el));
}

export function bgFxHTML() {
  return `
  <div class="bg-fx" aria-hidden="true">
    <div class="bg-fx__layer bg-fx__eng">
      <svg viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
        <path class="trace" d="M0 180 H300 L360 240 H720 L780 180 H1440"/>
        <path class="trace" d="M200 900 V620 L260 560 V320 L320 260 H520"/>
        <path class="trace" d="M1440 520 H1120 L1060 460 H860 L800 520 V900"/>
        <path class="trace" d="M1240 0 V140 L1180 200 V380 L1120 440"/>
        <path class="trace-static" d="M0 180 H300 L360 240 H720 L780 180 H1440"/>
        <path class="trace-static" d="M200 900 V620 L260 560 V320 L320 260 H520"/>
        <path class="trace-static" d="M1440 520 H1120 L1060 460 H860 L800 520 V900"/>
        <path class="trace-static" d="M1240 0 V140 L1180 200 V380 L1120 440"/>
        <circle class="node" cx="520" cy="260" r="4"/><circle class="node" cx="1120" cy="440" r="4"/>
        <circle class="node" cx="360" cy="240" r="3"/><circle class="node" cx="860" cy="460" r="3"/>
      </svg>
    </div>
    <div class="bg-fx__layer bg-fx__media">
      <div class="blob blob--1"></div><div class="blob blob--2"></div><div class="blob blob--3"></div>
      <div class="grain"></div>
    </div>
  </div>`;
}

export function loadError(err) {
  console.error(err);
  document.getElementById('main').innerHTML = `
    <div class="container not-found">
      <div>
        <p class="eyebrow">Error</p>
        <h1 class="h-lg">Couldn't load content</h1>
        <p class="lead">${esc(err.message)}</p>
        <p class="muted">If you opened this file directly, run it through a local web server (e.g. <code>npx serve</code>).</p>
      </div>
    </div>`;
}
