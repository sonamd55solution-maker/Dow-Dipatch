/**
 * Department of Water — Dispatch Booking System
 * Shared UI Utilities — Sidebar Layout Edition
 *
 * Renders the sidebar + topbar shell and provides helpers
 * (status badges, date formatting, alerts) reused across pages.
 */

const DoWUI = (function () {

  const EMBLEM_SVG = `<img src="data:image/jpeg;base64,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" alt="Bhutan National Emblem" style="width:26px;height:26px;object-fit:contain;border-radius:50%;display:block" />`;

  /**
   * Build the full app shell: sidebar + topbar + page-content wrapper.
   *
   * @param {Object} opts
   *   profile    – user profile object (full_name, role)
   *   activeKey  – nav item key to mark active
   *   navItems   – array of { key, label, icon, href, badge? }
   *   pageTitle  – title shown in topbar
   *   basePath   – relative path prefix for hrefs ('' or '../')
   */
  function renderShell({ profile, activeKey, navItems, pageTitle, basePath = '' }) {
    document.body.innerHTML = ''; // clear loader

    const initials = profile.full_name
      .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const roleLabel = profile.role === 'admin' ? 'Admin' : 'Staff';

    const navHtml = navItems.map(item => {
      const badge = item.badge != null
        ? `<span class="nav-link__badge" id="badge-${item.key}">${item.badge}</span>` : '';
      return `<a href="${item.href}"
          class="nav-link${item.key === activeKey ? ' active' : ''}"
          data-nav-key="${item.key}">
          <span class="nav-link__icon">${item.icon}</span>
          ${escapeHtml(item.label)}
          ${badge}
        </a>`;
    }).join('');

    // Build admin section separately
    const adminItems = navItems.filter(i => i.admin);
    const staffItems = navItems.filter(i => !i.admin);
    const adminSectionHtml = adminItems.length && profile.role === 'admin'
      ? `<div class="nav-section">Administration</div>${adminItems.map(item => {
          const badge = item.badge != null
            ? `<span class="nav-link__badge" id="badge-${item.key}">${item.badge}</span>` : '';
          return `<a href="${item.href}"
              class="nav-link${item.key === activeKey ? ' active' : ''}"
              data-nav-key="${item.key}">
              <span class="nav-link__icon">${item.icon}</span>
              ${escapeHtml(item.label)}${badge}
            </a>`;
        }).join('')}` : '';

    const staffSectionHtml = `<div class="nav-section">Main</div>${staffItems.map(item => {
      const badge = item.badge != null
        ? `<span class="nav-link__badge" id="badge-${item.key}">${item.badge}</span>` : '';
      return `<a href="${item.href}"
          class="nav-link${item.key === activeKey ? ' active' : ''}"
          data-nav-key="${item.key}">
          <span class="nav-link__icon">${item.icon}</span>
          ${escapeHtml(item.label)}${badge}
        </a>`;
    }).join('')}`;

    document.body.innerHTML = `
      <div class="app-shell">

        <!-- SIDEBAR -->
        <aside class="sidebar" id="app-sidebar">
          <div class="sidebar__brand">
            <div class="sidebar__emblem">${EMBLEM_SVG}</div>
            <div class="sidebar__brand-text">
              <div class="sidebar__org">MoENR · Bhutan</div>
              <div class="sidebar__name">DoW Dispatch</div>
            </div>
          </div>

          <div class="sidebar__user">
            <div class="user-avatar">${escapeHtml(initials)}</div>
            <div class="user-info">
              <div class="user-info__name">${escapeHtml(profile.full_name)}</div>
              <div class="user-info__role">${roleLabel}</div>
            </div>
          </div>

          <nav class="sidebar__nav">
            ${staffSectionHtml}
            ${adminSectionHtml}
          </nav>

          <div class="sidebar__footer">
            <button class="sidebar__logout" id="logout-btn">
              ⏻ &nbsp;Log Out
            </button>
          </div>
        </aside>

        <!-- MAIN -->
        <div class="main-area">
          <div class="topbar">
            <div class="topbar__left">
              <button class="menu-toggle" id="menu-toggle">☰</button>
              <div class="topbar__title" id="topbar-title">${escapeHtml(pageTitle)}</div>
              <div class="topbar__sub">Department of Water &nbsp;·&nbsp; Ministry of Energy &amp; Natural Resources</div>
            </div>
            <div class="topbar__right">
              <span class="live-badge">Live</span>
            </div>
          </div>

          <div class="page-content" id="page-content">
            <!-- page body injected here -->
          </div>

          <footer class="app-footer">
            Department of Water, Ministry of Energy &amp; Natural Resources, Bhutan
          </footer>
        </div>
      </div>
    `;

    // Mobile sidebar toggle
    document.getElementById('menu-toggle')?.addEventListener('click', () => {
      document.getElementById('app-sidebar')?.classList.toggle('open');
    });
    // Close sidebar on nav click (mobile)
    document.querySelectorAll('.nav-link').forEach(a => {
      a.addEventListener('click', () => {
        document.getElementById('app-sidebar')?.classList.remove('open');
      });
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
      DoWAuth.logout(`${basePath}login.html`);
    });
  }

  // ---- Legacy header renderer (for pages that do not use shell) ----
  function renderHeader({ profile, activeKey, navItems, basePath = '' }) {
    const mount = document.getElementById('app-header');
    if (!mount) return;
    const navHtml = navItems.map(item =>
      `<a href="${item.href}" class="${item.key === activeKey ? 'active' : ''}">${item.label}</a>`
    ).join('');
    const roleLabel = profile.role === 'admin' ? 'Admin' : 'Staff';
    mount.innerHTML = `
      <header class="app-header" style="background:linear-gradient(90deg,var(--accent-blue-dark),var(--accent-blue) 40%,var(--accent-blue-dark));color:#fff;padding:.7rem 1.5rem;display:flex;align-items:center;justify-content:space-between;box-shadow:0 2px 20px rgba(10,122,219,.25);border-bottom:1px solid var(--border-glow);position:sticky;top:0;z-index:50;flex-wrap:wrap;gap:.75rem;">
        <div style="display:flex;align-items:center;gap:.75rem">
          <div style="width:40px;height:40px;border-radius:8px;background:rgba(255,255,255,.25);border:2px solid rgba(255,255,255,.5);display:flex;align-items:center;justify-content:center">${EMBLEM_SVG.replace('22px','24px')}</div>
          <div>
            <div style="font-family:var(--font-mono);font-size:.6rem;letter-spacing:.18em;text-transform:uppercase;color:rgba(220,240,255,.85)">Ministry of Energy &amp; Natural Resources</div>
            <div style="font-family:var(--font-display);font-size:1.1rem;font-weight:700;letter-spacing:.05em">DoW Dispatch Booking System</div>
          </div>
        </div>
        <nav style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap">
          ${navHtml}
          <span style="font-family:var(--font-mono);color:#fff;letter-spacing:.06em;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.5);border-radius:20px;padding:.25rem .75rem;font-size:.58rem;text-transform:uppercase">● Live</span>
          <div style="display:flex;align-items:center;gap:.6rem;font-family:var(--font-mono);font-size:.76rem;padding-left:.75rem;margin-left:.25rem;border-left:1px solid rgba(255,255,255,.3)">
            <span style="font-weight:700">${escapeHtml(profile.full_name)}</span>
            <span style="font-size:.6rem;text-transform:uppercase;background:rgba(255,255,255,.2);border:1px solid rgba(255,255,255,.4);padding:.18rem .5rem;border-radius:20px">${roleLabel}</span>
            <button id="logout-btn" style="font-family:var(--font-display);background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.35);color:#fff;padding:.4rem .8rem;border-radius:6px;cursor:pointer;font-size:.82rem;font-weight:600">Log Out</button>
          </div>
        </nav>
      </header>`;
    document.getElementById('logout-btn')?.addEventListener('click', () => {
      DoWAuth.logout(`${basePath}login.html`);
    });
  }

  function escapeHtml(str) {
    const d = document.createElement('div');
    d.textContent = str ?? '';
    return d.innerHTML;
  }

  function statusBadge(status) {
    const map = {
      Reserved: 'badge-reserved', Approved: 'badge-approved',
      Used: 'badge-used', Expired: 'badge-expired', Cancelled: 'badge-cancelled',
    };
    return `<span class="badge ${map[status] || 'badge-reserved'}">${escapeHtml(status)}</span>`;
  }

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }

  function formatDateTime(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
      + ', ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
  }

  function getFinancialYear(date = new Date()) {
    const y = date.getFullYear(), m = date.getMonth() + 1;
    return m >= 7 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }

  function showAlert(containerEl, message, type = 'error') {
    if (!containerEl) return;
    containerEl.innerHTML = `<div class="alert alert-${type}">${escapeHtml(message)}</div>`;
    containerEl.hidden = false;
    containerEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function clearAlert(containerEl) {
    if (!containerEl) return;
    containerEl.innerHTML = '';
    containerEl.hidden = true;
  }

  /** Inject HTML into the page-content div (used by shell pages). */
  function setPageContent(html) {
    const el = document.getElementById('page-content');
    if (el) el.innerHTML = html;
  }

  /** Update topbar title. */
  function setTitle(title) {
    const el = document.getElementById('topbar-title');
    if (el) el.textContent = title;
  }

  return {
    renderShell, renderHeader,
    escapeHtml, statusBadge,
    formatDate, formatDateTime,
    getFinancialYear,
    showAlert, clearAlert,
    setPageContent, setTitle,
  };
})();

