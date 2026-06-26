/**
 * Department of Water — Dispatch Booking System
 * Dashboard Page Logic
 */
(async function () {
  const profile = await DoWAuth.requireAuth({ redirectTo: 'login.html' });
  if (!profile) return;

  const isAdmin = profile.role === 'admin';

  /* ---- Build nav items ---- */
  const navItems = [
    { key: 'dashboard', label: 'Dashboard',      icon: '⊞',  href: 'dashboard.html' },
    { key: 'book',      label: 'Book Dispatch',  icon: '＋',  href: 'book.html' },
    { key: 'search',    label: 'Search',         icon: '⌕',  href: 'search.html' },
  ];
  if (isAdmin) {
    navItems.push(
      { key: 'admin',   label: 'Admin Panel',    icon: '⚙',  href: 'admin/index.html', admin: true },
    );
  }

  /* ---- Render sidebar shell ---- */
  DoWUI.renderShell({
    profile,
    activeKey: 'dashboard',
    navItems,
    pageTitle: 'Dashboard',
    basePath: '',
  });

  /* ---- Inject page HTML ---- */
  DoWUI.setPageContent(`
    <div class="page-title-row">
      <div>
        <h1 id="welcome-heading">Welcome</h1>
        <p class="page-subtitle" id="subtitle-fy">Department of Water — Dispatch Number Booking System</p>
      </div>
      <a href="book.html" class="btn btn-primary">+ Book Dispatch Number</a>
    </div>

    <div id="alert-box" hidden></div>
    <div class="stat-grid" id="stat-grid">
      <div class="stat-card"><div class="label">Loading…</div><div class="value">—</div></div>
    </div>

    <div class="card">
      <div class="card__header">
        <h2 id="recent-heading">Recent Bookings</h2>
        <a href="search.html" style="font-size:.85rem;color:var(--accent-blue)">View All →</a>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dispatch No.</th>
              <th>Division</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Booked On</th>
            </tr>
          </thead>
          <tbody id="recent-bookings-body">
            <tr><td colspan="5"><div class="empty-state">Loading…</div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `);

  const alertBox = document.getElementById('alert-box');
  const currentFY = DoWUI.getFinancialYear();

  document.getElementById('welcome-heading').textContent = `Welcome, ${profile.full_name}`;
  document.getElementById('subtitle-fy').textContent =
    `Financial Year ${currentFY} — Department of Water`;
  document.getElementById('recent-heading').textContent =
    isAdmin ? 'Recent Bookings — All Staff' : 'Your Recent Bookings';

  await loadStats();
  await loadRecentBookings();

  /* ---- Stats ---- */
  async function loadStats() {
    const grid = document.getElementById('stat-grid');
    try {
      await window.supabaseClient.rpc('expire_overdue_bookings');

      let q = window.supabaseClient
        .from('bookings')
        .select('status, financial_year');
      if (!isAdmin) q = q.eq('booked_by', profile.id);

      const { data, error } = await q;
      if (error) throw error;

      const fy = data.filter(r => r.financial_year === currentFY);
      const total    = fy.length;
      const reserved = fy.filter(r => r.status === 'Reserved').length;
      const approved = fy.filter(r => r.status === 'Approved').length;
      const used     = fy.filter(r => r.status === 'Used').length;
      const expired  = fy.filter(r => r.status === 'Expired').length;
      const cancelled= fy.filter(r => r.status === 'Cancelled').length;

      const scope = isAdmin ? 'Total Bookings' : 'Your Bookings';

      grid.innerHTML = `
        <div class="stat-card">
          <div class="label">${scope} (FY ${currentFY})</div>
          <div class="value">${total}</div>
          <div class="stat-sub">All dispatches</div>
        </div>
        <div class="stat-card is-success">
          <div class="label">Approved</div>
          <div class="value">${approved}</div>
          <div class="stat-sub">Ready to dispatch</div>
        </div>
        <div class="stat-card">
          <div class="label">Reserved</div>
          <div class="value">${reserved}</div>
          <div class="stat-sub">Pending approval</div>
        </div>
        <div class="stat-card">
          <div class="label">Used</div>
          <div class="value">${used}</div>
          <div class="stat-sub">Dispatched</div>
        </div>
        <div class="stat-card is-warning">
          <div class="label">Expired</div>
          <div class="value">${expired}</div>
          <div class="stat-sub">Past 7-day window</div>
        </div>
        <div class="stat-card is-danger">
          <div class="label">Cancelled</div>
          <div class="value">${cancelled}</div>
          <div class="stat-sub">Withdrawn</div>
        </div>
      `;
    } catch (err) {
      console.error(err);
      grid.innerHTML = `<div class="alert alert-error">Could not load statistics: ${DoWUI.escapeHtml(err.message)}</div>`;
    }
  }

  /* ---- Recent bookings table ---- */
  async function loadRecentBookings() {
    const tbody = document.getElementById('recent-bookings-body');
    try {
      let q = window.supabaseClient
        .from('bookings')
        .select('full_dispatch_number, division_name, subject, status, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!isAdmin) q = q.eq('booked_by', profile.id);

      const { data, error } = await q;
      if (error) throw error;

      if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5">
          <div class="empty-state">No bookings yet.
            <a href="book.html">Book your first dispatch number →</a>
          </div></td></tr>`;
        return;
      }
      tbody.innerHTML = data.map(b => `
        <tr>
          <td class="dispatch-number-cell">${DoWUI.escapeHtml(b.full_dispatch_number)}</td>
          <td>${DoWUI.escapeHtml(b.division_name)}</td>
          <td>${DoWUI.escapeHtml(b.subject)}</td>
          <td>${DoWUI.statusBadge(b.status)}</td>
          <td>${DoWUI.formatDate(b.created_at)}</td>
        </tr>`).join('');
    } catch (err) {
      console.error(err);
      tbody.innerHTML = `<tr><td colspan="5">
        <div class="alert alert-error">Could not load bookings: ${DoWUI.escapeHtml(err.message)}</div>
      </td></tr>`;
    }
  }
})();
