// Data layer: published JSON + local draft (localStorage) used for admin preview
export const DATA_URL = 'data/site.json';
export const DRAFT_KEY = 'am-portfolio-draft';
export const MODES = ['eng', 'media'];

let cache = null;

export async function fetchPublished() {
  const res = await fetch(`${DATA_URL}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${DATA_URL} (${res.status})`);
  return res.json();
}

export function getDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
export function hasDraft() { return !!localStorage.getItem(DRAFT_KEY); }
export function saveDraft(data) {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
  cache = data;
}
export function clearDraft() { localStorage.removeItem(DRAFT_KEY); cache = null; }

/** Loads site data. A local draft (admin preview) takes priority over the published file. */
export async function loadData() {
  if (cache) return cache;
  const draft = getDraft();
  if (draft) { cache = draft; return draft; }
  cache = await fetchPublished();
  return cache;
}

export const publishedProjects = (data, field) =>
  data.projects.filter((p) => p.published !== false && (!field || p.field === field));

export const otherMode = (m) => (m === 'eng' ? 'media' : 'eng');

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function slugify(s = '') {
  return String(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || `project-${Date.now()}`;
}

export async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function formatDate(d) {
  if (!d) return '';
  const [y, m] = String(d).split('-');
  if (!m) return y;
  const date = new Date(+y, +m - 1, 1);
  return date.toLocaleDateString('en', { month: 'short', year: 'numeric' });
}

/** Detects video providers and returns embed info, or null for images. */
export function parseMedia(url = '') {
  const u = String(url).trim();
  let m;
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/))) {
    return { type: 'video', provider: 'youtube', embed: `https://www.youtube-nocookie.com/embed/${m[1]}?autoplay=1&rel=0`, thumb: `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` };
  }
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
    return { type: 'video', provider: 'vimeo', embed: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, thumb: null };
  }
  if ((m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]+)/))) {
    return { type: 'video', provider: 'drive', embed: `https://drive.google.com/file/d/${m[1]}/preview`, thumb: null };
  }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u)) return { type: 'video', provider: 'file', embed: u, thumb: null };
  return { type: 'image', url: u };
}

export function hostOf(url) {
  try { return new URL(url, location.href).hostname.replace(/^www\./, ''); } catch { return url; }
}

export function downloadJSON(data, filename = 'site.json') {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}
