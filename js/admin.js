// Admin Console: password login, CRUD projects, live card preview, drag to reorder, site content editor, import/export JSON, change password
import {
  loadData,
  saveDraft,
  clearDraft,
  hasDraft,
  sha256,
  downloadJSON,
  slugify,
  parseMedia
} from './store.js';
import {
  renderHeader,
  renderFooter,
  bgFxHTML,
  toast,
  loadError,
  cardHTML
} from './common.js';
import { icon, socialIcons } from './icons.js';
import { escapeHtml as esc, safeUrl } from './markdown.js';

let siteData = null;
let currentTab = 'projects';
let activeEditProject = null;
let dragSrcEl = null;

const AUTH_KEY = 'am-admin-auth';

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

  renderHeader(siteData, { page: 'admin' });
  renderFooter(siteData);

  checkAuthAndRender();
}

function checkAuthAndRender() {
  const isAuth = sessionStorage.getItem(AUTH_KEY) === 'true';
  const main = document.getElementById('main');

  if (!isAuth) {
    renderLoginForm(main);
  } else {
    renderDashboard(main);
  }
}

function renderLoginForm(container) {
  container.innerHTML = `
    <div class="admin-login-wrap">
      <div class="glass login-card reveal is-visible">
        <div class="lock-icon">
          ${icon('lock')}
        </div>
        <h1 class="h-md" style="margin-bottom: .4rem;">Admin Console</h1>
        <p class="muted" style="margin-bottom: 1.5rem; font-size: .9rem;">Enter the password to manage projects and portfolio configuration.</p>
        <form id="admin-login-form" style="display: grid; gap: 1rem;">
          <div class="field" style="text-align: left;">
            <label for="admin-pass">Admin Password</label>
            <input type="password" id="admin-pass" class="input" placeholder="Password (default: admin123)" required autofocus>
          </div>
          <button type="submit" class="btn btn--primary" id="login-btn">
            ${icon('key')} Unlock Admin
          </button>
        </form>
      </div>
    </div>
  `;

  const form = container.querySelector('#admin-login-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const pass = form.querySelector('#admin-pass').value;
    const hash = await sha256(pass);
    const expected = siteData.settings?.passwordHash;

    if (hash === expected) {
      sessionStorage.setItem(AUTH_KEY, 'true');
      toast('Welcome back, Admin', 'checkCircle');
      renderDashboard(container);
    } else {
      toast('Incorrect password. Try again.', 'alert');
      form.querySelector('#admin-pass').value = '';
    }
  });
}

function renderDashboard(container) {
  const isDraft = hasDraft();

  container.innerHTML = `
    <div class="container admin-dash">
      <div class="admin-header-bar">
        <div>
          <p class="eyebrow">Portfolio Manager</p>
          <h1 class="h-lg" style="margin: 0;">Admin Dashboard</h1>
        </div>
        <div style="display: flex; gap: .6rem; flex-wrap: wrap;">
          <button type="button" class="btn btn--sm" id="btn-export-json">
            ${icon('download')} Export site.json
          </button>
          <label class="btn btn--sm btn--ghost" style="cursor: pointer;">
            ${icon('upload')} Import JSON
            <input type="file" id="input-import-json" accept=".json" style="display: none;">
          </label>
          ${isDraft ? `
            <button type="button" class="btn btn--sm btn--danger" id="btn-discard-draft">
              ${icon('refresh')} Revert Draft
            </button>
          ` : ''}
          <button type="button" class="btn btn--sm btn--ghost" id="btn-logout">
            ${icon('logout')} Logout
          </button>
        </div>
      </div>

      <nav class="admin-tabs" aria-label="Admin Sections">
        <button type="button" class="admin-tab ${currentTab === 'projects' ? 'is-active' : ''}" data-tab="projects">
          ${icon('grid')} Projects (${(siteData.projects || []).length})
        </button>
        <button type="button" class="admin-tab ${currentTab === 'content' ? 'is-active' : ''}" data-tab="content">
          ${icon('layout')} Site Content
        </button>
        <button type="button" class="admin-tab ${currentTab === 'password' ? 'is-active' : ''}" data-tab="password">
          ${icon('key')} Change Password
        </button>
      </nav>

      <div id="admin-tab-view"></div>
    </div>

    <!-- Modal for Project Editor -->
    <div class="admin-modal" id="project-modal" role="dialog" aria-modal="true" aria-label="Project Editor">
      <div class="glass admin-modal-box" id="project-modal-content"></div>
    </div>
  `;

  // Attach Top actions
  container.querySelector('#btn-export-json').addEventListener('click', () => {
    downloadJSON(siteData, 'site.json');
    toast('site.json downloaded! Replace data/site.json to publish.', 'download');
  });

  container.querySelector('#input-import-json').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.projects || !parsed.content) throw new Error('Invalid JSON structure');
        siteData = parsed;
        saveDraft(siteData);
        toast('Backup loaded into local draft!', 'checkCircle');
        renderDashboard(container);
      } catch (err) {
        toast(`Import failed: ${err.message}`, 'alert');
      }
    };
    reader.readAsText(file);
  });

  const discardBtn = container.querySelector('#btn-discard-draft');
  if (discardBtn) {
    discardBtn.addEventListener('click', () => {
      if (confirm('Revert all local draft changes and restore published site.json?')) {
        clearDraft();
        location.reload();
      }
    });
  }

  container.querySelector('#btn-logout').addEventListener('click', () => {
    sessionStorage.removeItem(AUTH_KEY);
    checkAuthAndRender();
  });

  // Attach tab switching
  container.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      currentTab = e.currentTarget.dataset.tab;
      container.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('is-active'));
      e.currentTarget.classList.add('is-active');
      renderTabView();
    });
  });

  renderTabView();
}

function renderTabView() {
  const target = document.getElementById('admin-tab-view');
  if (!target) return;

  if (currentTab === 'projects') {
    renderProjectsTab(target);
  } else if (currentTab === 'content') {
    renderContentTab(target);
  } else if (currentTab === 'password') {
    renderPasswordTab(target);
  }
}

/* ---------------- TAB 1: PROJECTS ---------------- */
function renderProjectsTab(container) {
  const projects = siteData.projects || [];

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
      <div>
        <p class="muted" style="margin: 0; font-size: .9rem;">Drag rows to reorder. Changes are saved automatically to your local draft.</p>
      </div>
      <button type="button" class="btn btn--primary btn--sm" id="btn-add-project">
        ${icon('plus')} Add New Project
      </button>
    </div>

    <div class="table-wrap">
      <table class="admin-table" id="projects-table">
        <thead>
          <tr>
            <th style="width: 38px;"></th>
            <th style="width: 72px;">Thumb</th>
            <th>Title &amp; Summary</th>
            <th>Field</th>
            <th>Status</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody id="projects-tbody">
          ${projects.map((p, idx) => `
            <tr draggable="true" data-index="${idx}" data-id="${esc(p.id)}">
              <td>
                <span class="project-row-handle" title="Drag to reorder">${icon('grip')}</span>
              </td>
              <td>
                <div class="cell-thumb">
                  ${p.thumbnail ? `<img src="${esc(safeUrl(p.thumbnail))}" alt="">` : ''}
                </div>
              </td>
              <td>
                <div style="font-weight: 600; color: var(--text);">${esc(p.title)}</div>
                <div class="muted" style="font-size: .82rem; max-width: 420px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                  ${esc(p.summary || '')}
                </div>
              </td>
              <td>
                <span class="tag ${p.field === 'eng' ? '' : 'tag--muted'}">
                  ${p.field === 'eng' ? 'Engineering' : 'Multimedia'}
                </span>
              </td>
              <td>
                <span class="status-badge status-badge--${p.published !== false ? 'published' : 'draft'}">
                  ${p.published !== false ? 'Published' : 'Draft'}
                </span>
              </td>
              <td>
                <div class="table-actions">
                  <a href="project.html?id=${encodeURIComponent(p.id)}" target="_blank" class="btn btn--icon btn--ghost btn--sm" title="Preview project">
                    ${icon('eye')}
                  </a>
                  <button type="button" class="btn btn--icon btn--ghost btn--sm btn-edit-p" data-index="${idx}" title="Edit project">
                    ${icon('edit')}
                  </button>
                  <button type="button" class="btn btn--icon btn--ghost btn--sm btn-dup-p" data-index="${idx}" title="Duplicate project">
                    ${icon('copy')}
                  </button>
                  <button type="button" class="btn btn--icon btn--ghost btn--sm btn--danger btn-del-p" data-index="${idx}" title="Delete project">
                    ${icon('trash')}
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  container.querySelector('#btn-add-project').addEventListener('click', () => {
    openProjectEditor({
      id: `project-${Date.now()}`,
      field: 'eng',
      title: 'Untitled Project',
      thumbnail: 'assets/projects/eng-energy-monitor.jpg',
      tags: ['Engineering'],
      summary: 'Short brief about the new project.',
      description: '## Overview\nDetailed description of what you designed and built.',
      steps: [
        { title: 'Phase 1', text: 'Initial research and design.' }
      ],
      gallery: [],
      links: [],
      published: true,
      date: new Date().toISOString().slice(0, 7)
    }, -1);
  });

  // Table row actions
  container.querySelectorAll('.btn-edit-p').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      openProjectEditor(JSON.parse(JSON.stringify(projects[idx])), idx);
    });
  });

  container.querySelectorAll('.btn-dup-p').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      const dup = JSON.parse(JSON.stringify(projects[idx]));
      dup.id = `${dup.id}-copy-${Date.now().toString().slice(-4)}`;
      dup.title = `${dup.title} (Copy)`;
      projects.splice(idx + 1, 0, dup);
      saveDraft(siteData);
      toast('Project duplicated', 'copy');
      renderProjectsTab(container);
    });
  });

  container.querySelectorAll('.btn-del-p').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index, 10);
      if (confirm(`Are you sure you want to delete "${projects[idx].title}"?`)) {
        projects.splice(idx, 1);
        saveDraft(siteData);
        toast('Project deleted', 'trash');
        renderProjectsTab(container);
      }
    });
  });

  // Drag & drop row reordering
  setupTableDragAndDrop(container.querySelector('#projects-tbody'));
}

function setupTableDragAndDrop(tbody) {
  if (!tbody) return;

  tbody.querySelectorAll('tr').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      dragSrcEl = row;
      row.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', row.innerHTML);
    });

    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    });

    row.addEventListener('dragenter', () => row.classList.add('is-over'));
    row.addEventListener('dragleave', () => row.classList.remove('is-over'));

    row.addEventListener('drop', (e) => {
      e.stopPropagation();
      if (dragSrcEl !== row) {
        const fromIdx = parseInt(dragSrcEl.dataset.index, 10);
        const toIdx = parseInt(row.dataset.index, 10);

        const moved = siteData.projects.splice(fromIdx, 1)[0];
        siteData.projects.splice(toIdx, 0, moved);

        saveDraft(siteData);
        toast('Order updated and saved to draft', 'checkCircle');
        renderTabView();
      }
    });

    row.addEventListener('dragend', () => {
      tbody.querySelectorAll('tr').forEach((r) => {
        r.classList.remove('is-dragging');
        r.classList.remove('is-over');
      });
    });
  });
}

/* ---------------- PROJECT EDITOR MODAL + LIVE PREVIEW ---------------- */
function openProjectEditor(project, projectIndex) {
  activeEditProject = project;
  const modal = document.getElementById('project-modal');
  const box = document.getElementById('project-modal-content');

  const isNew = projectIndex === -1;

  box.innerHTML = `
    <div class="modal-head">
      <div>
        <p class="eyebrow" style="margin-bottom: .2rem;">${isNew ? 'New Entry' : 'Editing'}</p>
        <h2 class="h-md" style="margin: 0;">${isNew ? 'Add Project' : esc(project.title)}</h2>
      </div>
      <button type="button" class="btn btn--icon btn--ghost" id="modal-close" aria-label="Close modal">
        ${icon('x')}
      </button>
    </div>

    <div class="editor-split">
      <!-- Form Controls -->
      <form id="project-edit-form" style="display: grid; gap: 1.25rem;">
        <div class="form-grid-2">
          <div class="field">
            <label for="p-field-select">Specialization Field</label>
            <select id="p-field-select" class="select">
              <option value="eng" ${project.field === 'eng' ? 'selected' : ''}>Engineering</option>
              <option value="media" ${project.field === 'media' ? 'selected' : ''}>Multimedia</option>
            </select>
          </div>
          <div class="field">
            <label for="p-pub-status">Status</label>
            <select id="p-pub-status" class="select">
              <option value="true" ${project.published !== false ? 'selected' : ''}>Published</option>
              <option value="false" ${project.published === false ? 'selected' : ''}>Draft (Hidden from Public)</option>
            </select>
          </div>
        </div>

        <div class="field">
          <label for="p-title-input">Project Title</label>
          <input type="text" id="p-title-input" class="input" value="${esc(project.title)}" required>
        </div>

        <div class="form-grid-2">
          <div class="field">
            <label for="p-id-input">Unique Slug / ID</label>
            <input type="text" id="p-id-input" class="input" value="${esc(project.id)}" required>
          </div>
          <div class="field">
            <label for="p-date-input">Completion Date (YYYY-MM)</label>
            <input type="text" id="p-date-input" class="input" value="${esc(project.date || '')}" placeholder="2026-05">
          </div>
        </div>

        <div class="field">
          <label for="p-thumb-input">Thumbnail Image Path or URL</label>
          <input type="text" id="p-thumb-input" class="input" value="${esc(project.thumbnail || '')}" placeholder="assets/projects/my-image.jpg or https://...">
        </div>

        <div class="field">
          <label for="p-tags-input">Tags (comma-separated)</label>
          <input type="text" id="p-tags-input" class="input" value="${esc((project.tags || []).join(', '))}" placeholder="Embedded, ESP32, PCB">
        </div>

        <div class="field">
          <label for="p-summary-input">Brief Summary (shown on card)</label>
          <textarea id="p-summary-input" class="textarea" rows="2" style="min-height: 80px;">${esc(project.summary || '')}</textarea>
        </div>

        <div class="field">
          <label for="p-desc-input">Detailed Description (Markdown supported)</label>
          <textarea id="p-desc-input" class="textarea" rows="6">${esc(project.description || '')}</textarea>
        </div>

        <!-- Steps Timeline Editor -->
        <div>
          <label style="font-weight: 600; font-size: .85rem; color: var(--text-muted); display: block; margin-bottom: .4rem;">
            Process Steps (optional timeline)
          </label>
          <div id="steps-editor">
            ${(project.steps || []).map((st, i) => `
              <div class="dynamic-row" data-step-i="${i}">
                <div class="inputs">
                  <input type="text" class="input step-t" value="${esc(st.title)}" placeholder="Step title">
                  <input type="text" class="input step-x" value="${esc(st.text)}" placeholder="Step description">
                </div>
                <button type="button" class="btn btn--icon btn--ghost btn--danger del-row-btn">${icon('trash')}</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn--sm btn--ghost" id="btn-add-step" style="margin-top: .4rem;">
            ${icon('plus')} Add Step
          </button>
        </div>

        <!-- Gallery Items Editor -->
        <div>
          <label style="font-weight: 600; font-size: .85rem; color: var(--text-muted); display: block; margin-bottom: .4rem;">
            Gallery Media (Image paths or YouTube / Vimeo links)
          </label>
          <div id="gallery-editor">
            ${(project.gallery || []).map((g, i) => `
              <div class="dynamic-row" data-gal-i="${i}">
                <div class="inputs">
                  <input type="text" class="input gal-u" value="${esc(g.url)}" placeholder="Image URL / YouTube link">
                  <input type="text" class="input gal-c" value="${esc(g.caption || '')}" placeholder="Caption">
                </div>
                <button type="button" class="btn btn--icon btn--ghost btn--danger del-row-btn">${icon('trash')}</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn--sm btn--ghost" id="btn-add-gallery" style="margin-top: .4rem;">
            ${icon('plus')} Add Media Item
          </button>
        </div>

        <!-- Links Editor -->
        <div>
          <label style="font-weight: 600; font-size: .85rem; color: var(--text-muted); display: block; margin-bottom: .4rem;">
            External Links &amp; References
          </label>
          <div id="links-editor">
            ${(project.links || []).map((l, i) => `
              <div class="dynamic-row" data-lnk-i="${i}">
                <div class="inputs">
                  <input type="text" class="input lnk-l" value="${esc(l.label)}" placeholder="Link label (e.g. GitHub Repository)">
                  <input type="text" class="input lnk-u" value="${esc(l.url)}" placeholder="https://...">
                </div>
                <button type="button" class="btn btn--icon btn--ghost btn--danger del-row-btn">${icon('trash')}</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn--sm btn--ghost" id="btn-add-link" style="margin-top: .4rem;">
            ${icon('plus')} Add Link
          </button>
        </div>

        <div style="display: flex; gap: .75rem; margin-top: 1rem;">
          <button type="submit" class="btn btn--primary" id="btn-save-project">
            ${icon('save')} Save Project
          </button>
          <button type="button" class="btn btn--ghost" id="btn-cancel-modal">Cancel</button>
        </div>
      </form>

      <!-- Live Card Preview Sidebar -->
      <aside class="preview-sticky">
        <p class="eyebrow" style="margin-bottom: .5rem;">Live Card Preview</p>
        <div id="live-card-container"></div>
      </aside>
    </div>
  `;

  modal.classList.add('is-open');

  const updateLivePreview = () => {
    const previewObj = {
      id: box.querySelector('#p-id-input').value.trim() || 'preview',
      field: box.querySelector('#p-field-select').value,
      title: box.querySelector('#p-title-input').value.trim() || 'Untitled Project',
      thumbnail: box.querySelector('#p-thumb-input').value.trim(),
      tags: box.querySelector('#p-tags-input').value.split(',').map((t) => t.trim()).filter(Boolean),
      summary: box.querySelector('#p-summary-input').value.trim() || 'Short brief will appear here...',
      date: box.querySelector('#p-date-input').value.trim()
    };
    box.querySelector('#live-card-container').innerHTML = cardHTML(previewObj, { modes: siteData.content.modes });
  };

  updateLivePreview();

  // Listen to input changes for live update
  box.querySelectorAll('input, select, textarea').forEach((el) => {
    el.addEventListener('input', updateLivePreview);
  });

  // Dynamic row adder listeners
  box.querySelector('#btn-add-step').addEventListener('click', () => {
    const wrap = box.querySelector('#steps-editor');
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
      <div class="inputs">
        <input type="text" class="input step-t" placeholder="Step title">
        <input type="text" class="input step-x" placeholder="Step description">
      </div>
      <button type="button" class="btn btn--icon btn--ghost btn--danger del-row-btn">${icon('trash')}</button>
    `;
    wrap.appendChild(row);
  });

  box.querySelector('#btn-add-gallery').addEventListener('click', () => {
    const wrap = box.querySelector('#gallery-editor');
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
      <div class="inputs">
        <input type="text" class="input gal-u" placeholder="Image URL / YouTube link">
        <input type="text" class="input gal-c" placeholder="Caption">
      </div>
      <button type="button" class="btn btn--icon btn--ghost btn--danger del-row-btn">${icon('trash')}</button>
    `;
    wrap.appendChild(row);
  });

  box.querySelector('#btn-add-link').addEventListener('click', () => {
    const wrap = box.querySelector('#links-editor');
    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
      <div class="inputs">
        <input type="text" class="input lnk-l" placeholder="Link label">
        <input type="text" class="input lnk-u" placeholder="https://...">
      </div>
      <button type="button" class="btn btn--icon btn--ghost btn--danger del-row-btn">${icon('trash')}</button>
    `;
    wrap.appendChild(row);
  });

  box.addEventListener('click', (e) => {
    const del = e.target.closest('.del-row-btn');
    if (del) {
      del.closest('.dynamic-row').remove();
    }
  });

  // Close handlers
  const closeModal = () => modal.classList.remove('is-open');
  box.querySelector('#modal-close').addEventListener('click', closeModal);
  box.querySelector('#btn-cancel-modal').addEventListener('click', closeModal);

  // Form submit (save)
  const form = box.querySelector('#project-edit-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const steps = [];
    box.querySelectorAll('#steps-editor .dynamic-row').forEach((r) => {
      const title = r.querySelector('.step-t').value.trim();
      const text = r.querySelector('.step-x').value.trim();
      if (title || text) steps.push({ title, text });
    });

    const gallery = [];
    box.querySelectorAll('#gallery-editor .dynamic-row').forEach((r) => {
      const url = r.querySelector('.gal-u').value.trim();
      const caption = r.querySelector('.gal-c').value.trim();
      if (url) gallery.push({ url, caption });
    });

    const links = [];
    box.querySelectorAll('#links-editor .dynamic-row').forEach((r) => {
      const label = r.querySelector('.lnk-l').value.trim();
      const url = r.querySelector('.lnk-u').value.trim();
      if (url) links.push({ label: label || 'Link', url });
    });

    const updated = {
      id: box.querySelector('#p-id-input').value.trim() || slugify(box.querySelector('#p-title-input').value),
      field: box.querySelector('#p-field-select').value,
      title: box.querySelector('#p-title-input').value.trim(),
      thumbnail: box.querySelector('#p-thumb-input').value.trim(),
      tags: box.querySelector('#p-tags-input').value.split(',').map((t) => t.trim()).filter(Boolean),
      summary: box.querySelector('#p-summary-input').value.trim(),
      description: box.querySelector('#p-desc-input').value.trim(),
      steps,
      gallery,
      links,
      published: box.querySelector('#p-pub-status').value === 'true',
      date: box.querySelector('#p-date-input').value.trim()
    };

    if (isNew) {
      siteData.projects.unshift(updated);
    } else {
      siteData.projects[projectIndex] = updated;
    }

    saveDraft(siteData);
    toast('Project saved to draft!', 'save');
    closeModal();
    renderTabView();
  });
}

/* ---------------- TAB 2: SITE CONTENT ---------------- */
function renderContentTab(container) {
  const c = siteData.content;

  container.innerHTML = `
    <form class="glass" id="content-edit-form" style="padding: clamp(1.5rem, 3vw, 2.5rem); display: grid; gap: 2rem;">
      <!-- Hero text & info -->
      <div>
        <h3 class="h-md">Hero &amp; Profile</h3>
        <div class="form-grid-2" style="margin-top: 1rem;">
          <div class="field">
            <label for="c-name">Full Name</label>
            <input type="text" id="c-name" class="input" value="${esc(c.name)}" required>
          </div>
          <div class="field">
            <label for="c-location">Location</label>
            <input type="text" id="c-location" class="input" value="${esc(c.hero.location || '')}">
          </div>
        </div>
        <div class="form-grid-2" style="margin-top: 1rem;">
          <div class="field">
            <label for="c-greeting">Greeting</label>
            <input type="text" id="c-greeting" class="input" value="${esc(c.hero.greeting || '')}">
          </div>
          <div class="field">
            <label for="c-photo">Hero Photo Path</label>
            <input type="text" id="c-photo" class="input" value="${esc(c.hero.photo || '')}">
          </div>
        </div>
        <div class="field" style="margin-top: 1rem;">
          <label for="c-intro">Hero Bio / Intro</label>
          <textarea id="c-intro" class="textarea" rows="3">${esc(c.hero.intro || '')}</textarea>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid var(--border);">

      <!-- CV Links & Contact -->
      <div>
        <h3 class="h-md">CV Links &amp; Contact</h3>
        <div class="form-grid-2" style="margin-top: 1rem;">
          <div class="field">
            <label for="c-cv-eng">Engineering CV Google Drive Link</label>
            <input type="text" id="c-cv-eng" class="input" value="${esc(c.modes.eng.cvUrl || '')}">
          </div>
          <div class="field">
            <label for="c-cv-media">Multimedia CV Google Drive Link</label>
            <input type="text" id="c-cv-media" class="input" value="${esc(c.modes.media.cvUrl || '')}">
          </div>
        </div>
        <div class="field" style="margin-top: 1rem;">
          <label for="c-email">Contact Email (for mailto form &amp; direct link)</label>
          <input type="email" id="c-email" class="input" value="${esc(c.email || '')}" required>
        </div>
      </div>

      <hr style="border: 0; border-top: 1px solid var(--border);">

      <!-- Mode Perspectives & Bios -->
      <div>
        <h3 class="h-md">Specialization Perspectives</h3>
        <div class="form-grid-2" style="margin-top: 1rem;">
          <div class="field">
            <label for="c-about-eng">Engineering "About Me" (Markdown)</label>
            <textarea id="c-about-eng" class="textarea" rows="5">${esc(c.modes.eng.about || '')}</textarea>
          </div>
          <div class="field">
            <label for="c-about-media">Multimedia "About Me" (Markdown)</label>
            <textarea id="c-about-media" class="textarea" rows="5">${esc(c.modes.media.about || '')}</textarea>
          </div>
        </div>
      </div>

      <div style="display: flex; gap: .75rem;">
        <button type="submit" class="btn btn--primary">
          ${icon('save')} Save Site Content
        </button>
      </div>
    </form>
  `;

  const form = container.querySelector('#content-edit-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();

    c.name = form.querySelector('#c-name').value.trim();
    c.hero.greeting = form.querySelector('#c-greeting').value.trim();
    c.hero.photo = form.querySelector('#c-photo').value.trim();
    c.hero.location = form.querySelector('#c-location').value.trim();
    c.hero.intro = form.querySelector('#c-intro').value.trim();

    c.modes.eng.cvUrl = form.querySelector('#c-cv-eng').value.trim();
    c.modes.media.cvUrl = form.querySelector('#c-cv-media').value.trim();
    c.email = form.querySelector('#c-email').value.trim();

    c.modes.eng.about = form.querySelector('#c-about-eng').value.trim();
    c.modes.media.about = form.querySelector('#c-about-media').value.trim();

    saveDraft(siteData);
    toast('Site content updated and saved to draft!', 'save');
  });
}

/* ---------------- TAB 3: CHANGE PASSWORD ---------------- */
function renderPasswordTab(container) {
  container.innerHTML = `
    <div class="glass" style="max-width: 500px; padding: clamp(1.5rem, 3vw, 2.5rem);">
      <h3 class="h-md" style="margin-bottom: .4rem;">Update Admin Password</h3>
      <p class="muted" style="margin-bottom: 1.5rem; font-size: .9rem;">
        This generates a new SHA-256 hash. Remember to export <code>site.json</code> afterwards to make it permanent.
      </p>
      <form id="change-pass-form" style="display: grid; gap: 1rem;">
        <div class="field">
          <label for="new-pass-1">New Password</label>
          <input type="password" id="new-pass-1" class="input" required minlength="4">
        </div>
        <div class="field">
          <label for="new-pass-2">Confirm New Password</label>
          <input type="password" id="new-pass-2" class="input" required minlength="4">
        </div>
        <button type="submit" class="btn btn--primary">
          ${icon('key')} Update Password
        </button>
      </form>
    </div>
  `;

  const form = container.querySelector('#change-pass-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const p1 = form.querySelector('#new-pass-1').value;
    const p2 = form.querySelector('#new-pass-2').value;

    if (p1 !== p2) {
      toast('Passwords do not match', 'alert');
      return;
    }

    const hash = await sha256(p1);
    if (!siteData.settings) siteData.settings = {};
    siteData.settings.passwordHash = hash;

    saveDraft(siteData);
    toast('Password changed! Be sure to export site.json.', 'checkCircle');
    form.reset();
  });
}

// Initialize when ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
