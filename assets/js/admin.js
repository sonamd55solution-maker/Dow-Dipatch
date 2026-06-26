/**
 * Department of Water — Dispatch Booking System
 * Admin Panel Logic — Fixed Version
 *
 * Fixes applied:
 *  1. Changed DoWUI.renderHeader → DoWUI.renderShell (correct ui.js API)
 *  2. Removed expire_overdue_bookings RPC (not needed / may not exist)
 *  3. Replaced missing RPCs with direct table updates
 *  4. Replaced profiles join with booked_by_name column (avoids RLS issue)
 */
(async function () {
  const profile = await DoWAuth.requireAuth({ requireAdmin: true, redirectTo: '../login.html' });
  if (!profile) return;

  // FIX 1: renderShell not renderHeader
  const navItems = [
    { key: 'dashboard', label: 'Dashboard',     icon: '⊞', href: '../dashboard.html' },
    { key: 'book',      label: 'Book Dispatch', icon: '＋', href: '../book.html' },
    { key: 'search',    label: 'Search',        icon: '⌕', href: '../search.html' },
    { key: 'admin',     label: 'Admin Panel',   icon: '⚙', href: 'index.html', admin: true },
  ];
  DoWUI.renderShell({ profile, activeKey: 'admin', navItems, pageTitle: 'Admin Panel', basePath: '../' });

  DoWUI.setContent(`
    <div class="page-hdr">
      <div><h1>Admin Panel</h1><p>Manage bookings, divisions, file indexes, users, and view reports.</p></div>
    </div>
    <div id="alert-box" hidden></div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="bookings">All Bookings</button>
      <button class="tab-btn" data-tab="divisions">Divisions</button>
      <button class="tab-btn" data-tab="fileindexes">File Indexes</button>
      <button class="tab-btn" data-tab="users">Users</button>
      <button class="tab-btn" data-tab="reports">Reports</button>
    </div>

    <!-- BOOKINGS TAB -->
    <section class="tab-panel active" id="tab-bookings">
      <div class="card">
        <div class="form-grid" style="margin-bottom:1rem">
          <div class="field span-2"><label for="b-search">Search</label>
            <input type="search" id="b-search" placeholder="Dispatch number, subject, recipient…" /></div>
          <div class="field"><label for="b-filter-status">Status</label>
            <select id="b-filter-status">
              <option value="">All Statuses</option>
              <option>Reserved</option><option>Approved</option>
              <option>Used</option><option>Expired</option><option>Cancelled</option>
            </select></div>
          <div class="field"><label for="b-filter-fy">Financial Year</label>
            <select id="b-filter-fy"><option value="">All Years</option></select></div>
        </div>
      </div>
      <div class="card">
        <div class="card-hdr"><h2 id="b-count">All Bookings</h2></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Dispatch No.</th><th>Division</th><th>Subject</th><th>Recipient</th><th>Booked By</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody id="bookings-body"><tr><td colspan="8"><div class="empty-state">Loading…</div></td></tr></tbody>
        </table></div>
      </div>
    </section>

    <!-- DIVISIONS TAB -->
    <section class="tab-panel" id="tab-divisions">
      <div class="card">
        <div class="card-hdr"><h3>Divisions</h3>
          <button class="btn btn-primary btn-sm" id="add-division-btn">+ Add Division</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="divisions-body"><tr><td colspan="3"><div class="empty-state">Loading…</div></td></tr></tbody>
        </table></div>
      </div>
    </section>

    <!-- FILE INDEXES TAB -->
    <section class="tab-panel" id="tab-fileindexes">
      <div class="card">
        <div class="card-hdr"><h3>File Indexes</h3>
          <button class="btn btn-primary btn-sm" id="add-fileindex-btn">+ Add File Index</button></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Code</th><th>Description</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="fileindexes-body"><tr><td colspan="4"><div class="empty-state">Loading…</div></td></tr></tbody>
        </table></div>
      </div>
    </section>

    <!-- USERS TAB -->
    <section class="tab-panel" id="tab-users">
      <div class="card">
        <div class="card-hdr"><h3>Users</h3></div>
        <p style="font-size:.85rem;color:var(--text-2);margin-bottom:1rem">New users register as Staff. Promote or disable accounts here.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th>Actions</th></tr></thead>
          <tbody id="users-body"><tr><td colspan="6"><div class="empty-state">Loading…</div></td></tr></tbody>
        </table></div>
      </div>
    </section>

    <!-- REPORTS TAB -->
    <section class="tab-panel" id="tab-reports">
      <div class="stat-grid" id="report-stat-grid">
        <div class="stat-card"><div class="lbl">Loading…</div><div class="val">—</div></div>
      </div>
      <div class="card">
        <div class="card-hdr"><h3>By Division (Current FY)</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Division</th><th>Total</th><th>Approved</th><th>Reserved</th><th>Used</th><th>Expired</th><th>Cancelled</th></tr></thead>
          <tbody id="report-division-body"></tbody>
        </table></div>
      </div>
      <div class="card">
        <div class="card-hdr"><h3>By File Index (Current FY)</h3></div>
        <div class="table-wrap"><table>
          <thead><tr><th>File Index</th><th>Total</th><th>Approved</th><th>Reserved</th><th>Used</th><th>Expired</th><th>Cancelled</th></tr></thead>
          <tbody id="report-fileindex-body"></tbody>
        </table></div>
      </div>
    </section>

    <!-- MODAL: Edit Booking -->
    <div class="modal-backdrop" id="booking-modal" hidden>
      <div class="modal">
        <div class="modal-hdr"><h3>Edit Booking</h3><button class="modal-close" data-close="booking-modal">&times;</button></div>
        <form id="booking-edit-form">
          <input type="hidden" id="booking-edit-id" />
          <div class="field" style="margin-bottom:.85rem"><label>Dispatch Number</label>
            <div class="input-ro" id="booking-edit-number"></div></div>
          <div class="form-grid">
            <div class="field"><label for="booking-edit-division">Division *</label>
              <select id="booking-edit-division" required></select></div>
            <div class="field"><label for="booking-edit-subject">Subject *</label>
              <input type="text" id="booking-edit-subject" required maxlength="300" /></div>
            <div class="field"><label for="booking-edit-recipient">Recipient *</label>
              <input type="text" id="booking-edit-recipient" required maxlength="200" /></div>
            <div class="field"><label for="booking-edit-requestedby">Requested By *</label>
              <input type="text" id="booking-edit-requestedby" required maxlength="150" /></div>
          </div>
          <div class="modal-ftr">
            <button type="button" class="btn btn-secondary" data-close="booking-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: Division -->
    <div class="modal-backdrop" id="division-modal" hidden>
      <div class="modal">
        <div class="modal-hdr"><h3 id="division-modal-title">Add Division</h3>
          <button class="modal-close" data-close="division-modal">&times;</button></div>
        <form id="division-form">
          <input type="hidden" id="division-id" />
          <div class="field"><label for="division-name">Division Name *</label>
            <input type="text" id="division-name" required maxlength="150" /></div>
          <div class="field" style="margin-top:.85rem">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;text-transform:none;font-size:.9rem">
              <input type="checkbox" id="division-active" style="width:auto" /> Active</label></div>
          <div class="modal-ftr">
            <button type="button" class="btn btn-secondary" data-close="division-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: File Index -->
    <div class="modal-backdrop" id="fileindex-modal" hidden>
      <div class="modal">
        <div class="modal-hdr"><h3 id="fileindex-modal-title">Add File Index</h3>
          <button class="modal-close" data-close="fileindex-modal">&times;</button></div>
        <form id="fileindex-form">
          <input type="hidden" id="fileindex-id" />
          <div class="field"><label for="fileindex-code">Code *</label>
            <input type="text" id="fileindex-code" required maxlength="20" placeholder='e.g. "11"' /></div>
          <div class="field" style="margin-top:.85rem"><label for="fileindex-description">Description *</label>
            <input type="text" id="fileindex-description" required maxlength="200" /></div>
          <div class="field" style="margin-top:.85rem">
            <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;text-transform:none;font-size:.9rem">
              <input type="checkbox" id="fileindex-active" style="width:auto" /> Active</label></div>
          <div class="modal-ftr">
            <button type="button" class="btn btn-secondary" data-close="fileindex-modal">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `);

  const alertBox = document.getElementById('alert-box');
  let divisionsCache = [];

  /* TAB SWITCHING */
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
    });
  });

  /* MODAL CLOSE — event delegation on page-content */
  document.getElementById('page-content').addEventListener('click', e => {
    const btn = e.target.closest('[data-close]');
    if (btn) document.getElementById(btn.dataset.close).hidden = true;
    if (e.target.classList.contains('modal-backdrop')) e.target.hidden = true;
  });

  function openModal(id)  { document.getElementById(id).hidden = false; }

  /* INITIAL LOAD — FIX 2: no expire_overdue_bookings call */
  await loadCache();
  await populateFYFilter();
  await loadBookings();
  await loadDivisionsTable();
  await loadFileIndexesTable();
  await loadUsers();
  await loadReports();

  async function loadCache() {
    const [dRes, fRes] = await Promise.all([
      window.supabaseClient.from('divisions').select('id,name,is_active').order('name'),
      window.supabaseClient.from('file_indexes').select('id,code,description,is_active').order('code'),
    ]);
    if (!dRes.error) divisionsCache = dRes.data;
  }

  /* ===== BOOKINGS ===== */
  async function populateFYFilter() {
    const { data, error } = await window.supabaseClient
      .from('bookings').select('financial_year').order('financial_year', { ascending: false });
    if (error) return;
    const years = [...new Set(data.map(r => r.financial_year))];
    const sel = document.getElementById('b-filter-fy');
    const cur = DoWUI.getFinancialYear();
    years.forEach(y => {
      const o = document.createElement('option');
      o.value = y; o.textContent = y;
      if (y === cur) o.selected = true;
      sel.appendChild(o);
    });
  }

  document.getElementById('b-search').addEventListener('input', debounce(loadBookings, 350));
  document.getElementById('b-filter-status').addEventListener('change', loadBookings);
  document.getElementById('b-filter-fy').addEventListener('change', loadBookings);

  async function loadBookings() {
    const tbody = document.getElementById('bookings-body');
    const bCount = document.getElementById('b-count');
    tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">Loading…</div></td></tr>';
    const q      = document.getElementById('b-search').value.trim();
    const status = document.getElementById('b-filter-status').value;
    const fy     = document.getElementById('b-filter-fy').value;
    try {
      // FIX 4: select booked_by_name directly, no join
      let query = window.supabaseClient
        .from('bookings')
        .select('id,full_dispatch_number,division_id,division_name,subject,recipient,requested_by,booked_by_name,status,created_at')
        .order('created_at', { ascending: false }).limit(500);
      if (status) query = query.eq('status', status);
      if (fy)     query = query.eq('financial_year', fy);
      if (q) {
        const esc = q.replace(/%/g,'\\%').replace(/,/g,'\\,');
        query = query.or(`full_dispatch_number.ilike.%${esc}%,subject.ilike.%${esc}%,recipient.ilike.%${esc}%,requested_by.ilike.%${esc}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      bCount.textContent = 'All Bookings (' + data.length + ')';
      if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">No bookings match your filters.</div></td></tr>';
        return;
      }
      tbody.innerHTML = data.map(b => {
        const canEdit    = ['Reserved','Approved'].includes(b.status);
        const canApprove = b.status === 'Reserved';
        const canUsed    = b.status === 'Approved';
        const canCancel  = ['Reserved','Approved'].includes(b.status);
        return '<tr>' +
          '<td class="dn-cell">' + DoWUI.escapeHtml(b.full_dispatch_number) + '</td>' +
          '<td>' + DoWUI.escapeHtml(b.division_name) + '</td>' +
          '<td>' + DoWUI.escapeHtml(b.subject) + '</td>' +
          '<td>' + DoWUI.escapeHtml(b.recipient) + '</td>' +
          '<td>' + DoWUI.escapeHtml(b.booked_by_name || '—') + '</td>' +
          '<td>' + DoWUI.statusBadge(b.status) + '</td>' +
          '<td>' + DoWUI.formatDate(b.created_at) + '</td>' +
          '<td><div class="tbl-actions">' +
            (canEdit    ? '<button class="btn btn-secondary btn-sm" data-edit="' + b.id + '">Edit</button>' : '') +
            (canApprove ? '<button class="btn btn-success btn-sm" data-status="' + b.id + '" data-val="Approved">Approve</button>' : '') +
            (canUsed    ? '<button class="btn btn-secondary btn-sm" data-status="' + b.id + '" data-val="Used">Mark Used</button>' : '') +
            (canCancel  ? '<button class="btn btn-danger btn-sm" data-status="' + b.id + '" data-val="Cancelled">Cancel</button>' : '') +
          '</div></td></tr>';
      }).join('');

      document.querySelectorAll('[data-status]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.val === 'Cancelled' && !confirm('Cancel this booking? The record will be kept.')) return;
          changeStatus(btn.dataset.status, btn.dataset.val);
        });
      });
      document.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => {
          const row = data.find(r => r.id === btn.dataset.edit);
          if (row) openBookingEdit(row);
        });
      });
    } catch (err) {
      console.error(err);
      DoWUI.showAlert(alertBox, 'Failed to load bookings: ' + err.message, 'error');
      tbody.innerHTML = '<tr><td colspan="8"><div class="empty-state">Error loading data.</div></td></tr>';
    }
  }

  // FIX 3: direct table update — no missing RPC needed
  async function changeStatus(id, newStatus) {
    DoWUI.clearAlert(alertBox);
    const { error } = await window.supabaseClient.from('bookings')
      .update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) { DoWUI.showAlert(alertBox, 'Could not update: ' + error.message, 'error'); return; }
    DoWUI.showAlert(alertBox, 'Booking marked as ' + newStatus + '.', 'success');
    loadBookings(); loadReports();
  }

  function openBookingEdit(row) {
    document.getElementById('booking-edit-id').value = row.id;
    document.getElementById('booking-edit-number').textContent = row.full_dispatch_number;
    document.getElementById('booking-edit-subject').value = row.subject;
    document.getElementById('booking-edit-recipient').value = row.recipient;
    document.getElementById('booking-edit-requestedby').value = row.requested_by;
    const sel = document.getElementById('booking-edit-division');
    sel.innerHTML = divisionsCache
      .filter(d => d.is_active || d.id === row.division_id)
      .map(d => '<option value="' + d.id + '"' + (d.id === row.division_id ? ' selected' : '') + '>' + DoWUI.escapeHtml(d.name) + '</option>')
      .join('');
    openModal('booking-modal');
  }

  document.getElementById('booking-edit-form').addEventListener('submit', async e => {
    e.preventDefault(); DoWUI.clearAlert(alertBox);
    // FIX 3: direct update, no admin_edit_booking RPC
    const { error } = await window.supabaseClient.from('bookings').update({
      division_id:  document.getElementById('booking-edit-division').value,
      subject:      document.getElementById('booking-edit-subject').value.trim(),
      recipient:    document.getElementById('booking-edit-recipient').value.trim(),
      requested_by: document.getElementById('booking-edit-requestedby').value.trim(),
      updated_at:   new Date().toISOString(),
    }).eq('id', document.getElementById('booking-edit-id').value);
    if (error) { DoWUI.showAlert(alertBox, 'Save failed: ' + error.message, 'error'); return; }
    document.getElementById('booking-modal').hidden = true;
    DoWUI.showAlert(alertBox, 'Booking updated.', 'success');
    loadBookings();
  });

  /* ===== DIVISIONS ===== */
  document.getElementById('add-division-btn').addEventListener('click', () => {
    document.getElementById('division-modal-title').textContent = 'Add Division';
    document.getElementById('division-id').value = '';
    document.getElementById('division-name').value = '';
    document.getElementById('division-active').checked = true;
    openModal('division-modal');
  });

  async function loadDivisionsTable() {
    const tbody = document.getElementById('divisions-body');
    const { data, error } = await window.supabaseClient.from('divisions').select('id,name,is_active').order('name');
    if (error) { tbody.innerHTML = '<tr><td colspan="3"><div class="alert alert-error">' + DoWUI.escapeHtml(error.message) + '</div></td></tr>'; return; }
    divisionsCache = data;
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="3"><div class="empty-state">No divisions yet.</div></td></tr>'; return; }
    tbody.innerHTML = data.map(d =>
      '<tr><td>' + DoWUI.escapeHtml(d.name) + '</td>' +
      '<td><span class="badge ' + (d.is_active ? 'badge-approved' : 'badge-cancelled') + '">' + (d.is_active ? 'Active' : 'Inactive') + '</span></td>' +
      '<td><div class="tbl-actions">' +
        '<button class="btn btn-secondary btn-sm" data-div-edit=\'' + JSON.stringify(d).replace(/'/g,"&#39;") + '\'>Edit</button>' +
        '<button class="btn ' + (d.is_active ? 'btn-danger' : 'btn-success') + ' btn-sm" data-div-toggle="' + d.id + '" data-div-active="' + d.is_active + '">' + (d.is_active ? 'Disable' : 'Enable') + '</button>' +
      '</div></td></tr>'
    ).join('');
    document.querySelectorAll('[data-div-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const d = JSON.parse(btn.dataset.divEdit);
        document.getElementById('division-modal-title').textContent = 'Edit Division';
        document.getElementById('division-id').value = d.id;
        document.getElementById('division-name').value = d.name;
        document.getElementById('division-active').checked = d.is_active;
        openModal('division-modal');
      });
    });
    document.querySelectorAll('[data-div-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await window.supabaseClient.from('divisions')
          .update({ is_active: btn.dataset.divActive !== 'true' }).eq('id', btn.dataset.divToggle);
        if (error) { DoWUI.showAlert(alertBox, error.message, 'error'); return; }
        loadDivisionsTable();
      });
    });
  }

  document.getElementById('division-form').addEventListener('submit', async e => {
    e.preventDefault(); DoWUI.clearAlert(alertBox);
    const id = document.getElementById('division-id').value;
    const name = document.getElementById('division-name').value.trim();
    const is_active = document.getElementById('division-active').checked;
    const { error } = id
      ? await window.supabaseClient.from('divisions').update({ name, is_active }).eq('id', id)
      : await window.supabaseClient.from('divisions').insert({ name, is_active });
    if (error) { DoWUI.showAlert(alertBox, 'Save failed: ' + error.message, 'error'); return; }
    document.getElementById('division-modal').hidden = true;
    DoWUI.showAlert(alertBox, 'Division ' + (id ? 'updated' : 'created') + '.', 'success');
    loadDivisionsTable();
  });

  /* ===== FILE INDEXES ===== */
  document.getElementById('add-fileindex-btn').addEventListener('click', () => {
    document.getElementById('fileindex-modal-title').textContent = 'Add File Index';
    document.getElementById('fileindex-id').value = '';
    document.getElementById('fileindex-code').value = '';
    document.getElementById('fileindex-description').value = '';
    document.getElementById('fileindex-active').checked = true;
    openModal('fileindex-modal');
  });

  async function loadFileIndexesTable() {
    const tbody = document.getElementById('fileindexes-body');
    const { data, error } = await window.supabaseClient.from('file_indexes').select('id,code,description,is_active').order('code');
    if (error) { tbody.innerHTML = '<tr><td colspan="4"><div class="alert alert-error">' + DoWUI.escapeHtml(error.message) + '</div></td></tr>'; return; }
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">No file indexes yet.</div></td></tr>'; return; }
    tbody.innerHTML = data.map(f =>
      '<tr><td class="dn-cell">' + DoWUI.escapeHtml(f.code) + '</td>' +
      '<td>' + DoWUI.escapeHtml(f.description) + '</td>' +
      '<td><span class="badge ' + (f.is_active ? 'badge-approved' : 'badge-cancelled') + '">' + (f.is_active ? 'Active' : 'Inactive') + '</span></td>' +
      '<td><div class="tbl-actions">' +
        '<button class="btn btn-secondary btn-sm" data-fi-edit=\'' + JSON.stringify(f).replace(/'/g,"&#39;") + '\'>Edit</button>' +
        '<button class="btn ' + (f.is_active ? 'btn-danger' : 'btn-success') + ' btn-sm" data-fi-toggle="' + f.id + '" data-fi-active="' + f.is_active + '">' + (f.is_active ? 'Disable' : 'Enable') + '</button>' +
      '</div></td></tr>'
    ).join('');
    document.querySelectorAll('[data-fi-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        const f = JSON.parse(btn.dataset.fiEdit);
        document.getElementById('fileindex-modal-title').textContent = 'Edit File Index';
        document.getElementById('fileindex-id').value = f.id;
        document.getElementById('fileindex-code').value = f.code;
        document.getElementById('fileindex-description').value = f.description;
        document.getElementById('fileindex-active').checked = f.is_active;
        openModal('fileindex-modal');
      });
    });
    document.querySelectorAll('[data-fi-toggle]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const { error } = await window.supabaseClient.from('file_indexes')
          .update({ is_active: btn.dataset.fiActive !== 'true' }).eq('id', btn.dataset.fiToggle);
        if (error) { DoWUI.showAlert(alertBox, error.message, 'error'); return; }
        loadFileIndexesTable();
      });
    });
  }

  document.getElementById('fileindex-form').addEventListener('submit', async e => {
    e.preventDefault(); DoWUI.clearAlert(alertBox);
    const id = document.getElementById('fileindex-id').value;
    const code = document.getElementById('fileindex-code').value.trim();
    const description = document.getElementById('fileindex-description').value.trim();
    const is_active = document.getElementById('fileindex-active').checked;
    const { error } = id
      ? await window.supabaseClient.from('file_indexes').update({ code, description, is_active }).eq('id', id)
      : await window.supabaseClient.from('file_indexes').insert({ code, description, is_active });
    if (error) { DoWUI.showAlert(alertBox, 'Save failed: ' + error.message, 'error'); return; }
    document.getElementById('fileindex-modal').hidden = true;
    DoWUI.showAlert(alertBox, 'File Index ' + (id ? 'updated' : 'created') + '.', 'success');
    loadFileIndexesTable();
  });

  /* ===== USERS ===== */
  async function loadUsers() {
    const tbody = document.getElementById('users-body');
    const { data, error } = await window.supabaseClient.from('profiles')
      .select('id,full_name,email,role,is_active,created_at').order('created_at');
    if (error) { tbody.innerHTML = '<tr><td colspan="6"><div class="alert alert-error">' + DoWUI.escapeHtml(error.message) + '</div></td></tr>'; return; }
    if (!data.length) { tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state">No users found.</div></td></tr>'; return; }
    tbody.innerHTML = data.map(u => {
      const isSelf = u.id === profile.id;
      const ini = u.full_name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
      return '<tr>' +
        '<td><div class="user-row"><div class="avatar-sm">' + ini + '</div>' + DoWUI.escapeHtml(u.full_name) +
          (isSelf ? ' <span style="font-size:.75rem;color:var(--text-3)">(you)</span>' : '') + '</div></td>' +
        '<td style="font-family:var(--font-mono);font-size:.76rem;color:var(--text-2)">' + DoWUI.escapeHtml(u.email) + '</td>' +
        '<td><span class="role-pill ' + (u.role === 'admin' ? 'admin' : '') + '">' + u.role + '</span></td>' +
        '<td><span class="badge ' + (u.is_active ? 'badge-approved' : 'badge-cancelled') + '">' + (u.is_active ? 'Active' : 'Disabled') + '</span></td>' +
        '<td>' + DoWUI.formatDate(u.created_at) + '</td>' +
        '<td>' + (isSelf ? '<span style="font-size:.8rem;color:var(--text-3)">—</span>' :
          '<div class="tbl-actions">' +
          '<button class="btn btn-secondary btn-sm" data-user-role="' + u.id + '" data-role="' + u.role + '">' + (u.role === 'admin' ? 'Make Staff' : 'Make Admin') + '</button>' +
          '<button class="btn ' + (u.is_active ? 'btn-danger' : 'btn-success') + ' btn-sm" data-user-active="' + u.id + '" data-active="' + u.is_active + '">' + (u.is_active ? 'Disable' : 'Enable') + '</button>' +
          '</div>') + '</td></tr>';
    }).join('');
    document.querySelectorAll('[data-user-role]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const newRole = btn.dataset.role === 'admin' ? 'staff' : 'admin';
        if (!confirm('Change role to "' + newRole + '"?')) return;
        const { error } = await window.supabaseClient.from('profiles').update({ role: newRole }).eq('id', btn.dataset.userRole);
        if (error) { DoWUI.showAlert(alertBox, error.message, 'error'); return; }
        DoWUI.showAlert(alertBox, 'Role changed. User must log out and back in.', 'success');
        loadUsers();
      });
    });
    document.querySelectorAll('[data-user-active]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const active = btn.dataset.active === 'true';
        const { error } = await window.supabaseClient.from('profiles').update({ is_active: !active }).eq('id', btn.dataset.userActive);
        if (error) { DoWUI.showAlert(alertBox, error.message, 'error'); return; }
        DoWUI.showAlert(alertBox, 'Account ' + (active ? 'disabled' : 'enabled') + '.', 'success');
        loadUsers();
      });
    });
  }

  /* ===== REPORTS ===== */
  async function loadReports() {
    const fy = DoWUI.getFinancialYear();
    const statGrid = document.getElementById('report-stat-grid');
    const divBody  = document.getElementById('report-division-body');
    const fiBody   = document.getElementById('report-fileindex-body');
    try {
      const { data, error } = await window.supabaseClient.from('bookings')
        .select('status,division_name,file_index_code,financial_year').eq('financial_year', fy);
      if (error) throw error;
      const c = { total: data.length, Approved:0, Reserved:0, Used:0, Expired:0, Cancelled:0 };
      data.forEach(r => { c[r.status] = (c[r.status]||0) + 1; });
      statGrid.innerHTML =
        '<div class="stat-card"><div class="lbl">Total (FY ' + fy + ')</div><div class="val">' + c.total + '</div></div>' +
        '<div class="stat-card green"><div class="lbl">Approved</div><div class="val">' + c.Approved + '</div></div>' +
        '<div class="stat-card"><div class="lbl">Reserved</div><div class="val">' + c.Reserved + '</div></div>' +
        '<div class="stat-card"><div class="lbl">Used</div><div class="val">' + c.Used + '</div></div>' +
        '<div class="stat-card amber"><div class="lbl">Expired</div><div class="val">' + c.Expired + '</div></div>' +
        '<div class="stat-card red"><div class="lbl">Cancelled</div><div class="val">' + c.Cancelled + '</div></div>';
      divBody.innerHTML = groupRows(data, 'division_name');
      fiBody.innerHTML  = groupRows(data, 'file_index_code');
    } catch(err) {
      statGrid.innerHTML = '<div class="alert alert-error">' + DoWUI.escapeHtml(err.message) + '</div>';
    }
  }

  function groupRows(rows, key) {
    if (!rows.length) return '<tr><td colspan="7"><div class="empty-state">No data yet.</div></td></tr>';
    const g = {};
    rows.forEach(r => {
      const k = r[key] || 'Unknown';
      if (!g[k]) g[k] = { total:0, Approved:0, Reserved:0, Used:0, Expired:0, Cancelled:0 };
      g[k].total++; g[k][r.status] = (g[k][r.status]||0)+1;
    });
    return Object.entries(g).sort((a,b) => b[1].total - a[1].total).map(([n,c]) =>
      '<tr><td>' + DoWUI.escapeHtml(n) + '</td><td><strong>' + c.total + '</strong></td>' +
      '<td>' + c.Approved + '</td><td>' + c.Reserved + '</td><td>' + c.Used + '</td><td>' + c.Expired + '</td><td>' + c.Cancelled + '</td></tr>'
    ).join('');
  }

  function debounce(fn, ms) {
    let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  }
})();

