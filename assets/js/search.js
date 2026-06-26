/**
 * Department of Water — Dispatch Booking System
 * Search Dispatch Page Logic
 */
(async function () {
  const profile = await DoWAuth.requireAuth({ redirectTo: 'login.html' });
  if (!profile) return;

  const isAdmin = profile.role === 'admin';
  const navItems = [
    { key: 'dashboard', label: 'Dashboard',     icon: '⊞', href: 'dashboard.html' },
    { key: 'book',      label: 'Book Dispatch', icon: '＋', href: 'book.html' },
    { key: 'search',    label: 'Search',        icon: '⌕', href: 'search.html' },
  ];
  if (isAdmin) navItems.push({ key: 'admin', label: 'Admin Panel', icon: '⚙', href: 'admin/index.html', admin: true });

  DoWUI.renderShell({ profile, activeKey: 'search', navItems, pageTitle: 'Search Dispatch Numbers' });

  DoWUI.setPageContent(`
    <div class="page-title-row">
      <div>
        <h1>${isAdmin ? 'Search All Dispatch Numbers' : 'My Dispatch Numbers'}</h1>
        <p class="page-subtitle">${isAdmin
          ? 'Search and filter all dispatch bookings across the department.'
          : 'Search and filter your own dispatch bookings.'}</p>
      </div>
    </div>

    <div id="alert-box" hidden></div>

    <div class="card">
      <form id="search-form">
        <div class="form-grid">
          <div class="field span-2">
            <label for="q">Search</label>
            <input type="search" id="q" placeholder="Dispatch number, subject, recipient, or requested by…" />
          </div>
          <div class="field">
            <label for="filter-fy">Financial Year</label>
            <select id="filter-fy"><option value="">All Years</option></select>
          </div>
          <div class="field">
            <label for="filter-status">Status</label>
            <select id="filter-status">
              <option value="">All Statuses</option>
              <option>Reserved</option><option>Approved</option>
              <option>Used</option><option>Expired</option><option>Cancelled</option>
            </select>
          </div>
          <div class="field">
            <label for="filter-division">Division</label>
            <select id="filter-division"><option value="">All Divisions</option></select>
          </div>
          <div class="field">
            <label for="filter-file-index">File Index</label>
            <select id="filter-file-index"><option value="">All File Indexes</option></select>
          </div>
        </div>
        <div style="margin-top:1.25rem;display:flex;gap:.75rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary">Search</button>
          <button type="button" class="btn btn-secondary" id="reset-btn">Reset Filters</button>
        </div>
      </form>
    </div>

    <div class="card">
      <div class="card__header">
        <h2 id="results-count">Results</h2>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Dispatch No.</th>
              <th>Division</th>
              <th>File Index</th>
              <th>Subject</th>
              <th>Recipient</th>
              <th>Requested By</th>
              <th>Status</th>
              <th>Booked On</th>
              <th>Expires</th>
            </tr>
          </thead>
          <tbody id="results-body">
            <tr><td colspan="9"><div class="empty-state">Loading…</div></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `);

  const alertBox = document.getElementById('alert-box');

  await window.supabaseClient.rpc('expire_overdue_bookings');
  await loadFilterOptions();
  await runSearch();

  document.getElementById('search-form').addEventListener('submit', e => { e.preventDefault(); runSearch(); });
  document.getElementById('reset-btn').addEventListener('click', () => {
    document.getElementById('search-form').reset();
    // Re-set default FY
    const fyEl = document.getElementById('filter-fy');
    const currentFY = DoWUI.getFinancialYear();
    if ([...fyEl.options].some(o => o.value === currentFY)) fyEl.value = currentFY;
    runSearch();
  });

  async function loadFilterOptions() {
    try {
      const [fyRes, divRes, fiRes] = await Promise.all([
        window.supabaseClient.from('bookings').select('financial_year').order('financial_year', { ascending: false }),
        window.supabaseClient.from('divisions').select('id,name').order('name'),
        window.supabaseClient.from('file_indexes').select('id,code,description').order('code'),
      ]);
      if (!fyRes.error) {
        const years = [...new Set(fyRes.data.map(r => r.financial_year))];
        const fyEl  = document.getElementById('filter-fy');
        const cur   = DoWUI.getFinancialYear();
        years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; fyEl.appendChild(o); });
        if (years.includes(cur)) fyEl.value = cur;
      }
      if (!divRes.error) {
        const el = document.getElementById('filter-division');
        divRes.data.forEach(d => { const o = document.createElement('option'); o.value = d.id; o.textContent = d.name; el.appendChild(o); });
      }
      if (!fiRes.error) {
        const el = document.getElementById('filter-file-index');
        fiRes.data.forEach(f => { const o = document.createElement('option'); o.value = f.id; o.textContent = `${f.code} — ${f.description}`; el.appendChild(o); });
      }
    } catch (err) { console.error('Filter load error:', err); }
  }

  async function runSearch() {
    DoWUI.clearAlert(alertBox);
    const resultsBody  = document.getElementById('results-body');
    const resultsCount = document.getElementById('results-count');
    resultsBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Searching…</div></td></tr>`;

    const q          = document.getElementById('q').value.trim();
    const fy         = document.getElementById('filter-fy').value;
    const status     = document.getElementById('filter-status').value;
    const divisionId = document.getElementById('filter-division').value;
    const fileIndexId= document.getElementById('filter-file-index').value;

    try {
      let query = window.supabaseClient
        .from('bookings')
        .select('id,full_dispatch_number,division_name,file_index_code,subject,recipient,requested_by,status,created_at,expires_at')
        .order('created_at', { ascending: false })
        .limit(300);

      if (!isAdmin)   query = query.eq('booked_by', profile.id);
      if (fy)         query = query.eq('financial_year', fy);
      if (status)     query = query.eq('status', status);
      if (divisionId) query = query.eq('division_id', divisionId);
      if (fileIndexId)query = query.eq('file_index_id', fileIndexId);
      if (q) {
        const escaped = q.replace(/%/g, '\\%').replace(/,/g, '\\,');
        query = query.or(
          `full_dispatch_number.ilike.%${escaped}%,subject.ilike.%${escaped}%,` +
          `recipient.ilike.%${escaped}%,requested_by.ilike.%${escaped}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      resultsCount.textContent = `Results (${data.length})`;
      if (!data.length) {
        resultsBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">No matching dispatch numbers found.</div></td></tr>`;
        return;
      }
      resultsBody.innerHTML = data.map(b => `
        <tr>
          <td class="dispatch-number-cell">${DoWUI.escapeHtml(b.full_dispatch_number)}</td>
          <td>${DoWUI.escapeHtml(b.division_name)}</td>
          <td>${DoWUI.escapeHtml(b.file_index_code)}</td>
          <td>${DoWUI.escapeHtml(b.subject)}</td>
          <td>${DoWUI.escapeHtml(b.recipient)}</td>
          <td>${DoWUI.escapeHtml(b.requested_by)}</td>
          <td>${DoWUI.statusBadge(b.status)}</td>
          <td>${DoWUI.formatDate(b.created_at)}</td>
          <td>${b.status === 'Reserved' ? DoWUI.formatDate(b.expires_at) : '—'}</td>
        </tr>`).join('');
    } catch (err) {
      console.error(err);
      DoWUI.showAlert(alertBox, 'Search failed: ' + err.message, 'error');
      resultsBody.innerHTML = `<tr><td colspan="9"><div class="empty-state">Could not load results.</div></td></tr>`;
    }
  }
})();

