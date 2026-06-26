/**
 * Department of Water — Dispatch Booking System
 * Book Dispatch Page Logic
 * — Includes Location field
 * — Auto-syncs each new booking to Google Sheets via Apps Script
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

  DoWUI.renderShell({ profile, activeKey: 'book', navItems, pageTitle: 'Book Dispatch Number' });

  DoWUI.setPageContent(`
    <div class="page-title-row">
      <div>
        <h1>Book Dispatch Number</h1>
        <p class="page-subtitle">Fill in the details below. Your dispatch number will be generated automatically.</p>
      </div>
    </div>

    <div id="alert-box" hidden></div>

    <div class="card" id="booking-card">
      <form id="booking-form">
        <div class="form-grid">
          <div class="field">
            <label for="division">Division <span style="color:var(--color-danger)">*</span></label>
            <select id="division" required>
              <option value="">Loading divisions…</option>
            </select>
          </div>
          <div class="field">
            <label for="file-index">File Index <span style="color:var(--color-danger)">*</span></label>
            <select id="file-index" required>
              <option value="">Loading file indexes…</option>
            </select>
          </div>
          <div class="field">
            <label>Financial Year</label>
            <div class="input-readonly" id="fy-display">—</div>
            <span class="hint">Calculated automatically (1 July – 30 June)</span>
          </div>
          <div class="field">
            <label>Dispatch Number</label>
            <div class="input-readonly" id="dispatch-preview">Generated after booking</div>
            <span class="hint">Assigned automatically on submission</span>
          </div>
          <div class="field span-2">
            <label for="subject">Subject <span style="color:var(--color-danger)">*</span></label>
            <input type="text" id="subject" placeholder="Brief subject of the dispatch" required maxlength="300" />
          </div>
          <div class="field">
            <label for="recipient">Recipient <span style="color:var(--color-danger)">*</span></label>
            <input type="text" id="recipient" placeholder="e.g. Dasho Dzongda, Gup Chang Geog" required maxlength="200" />
          </div>
          <div class="field">
            <label for="location">Location <span style="color:var(--color-danger)">*</span></label>
            <input type="text" id="location" placeholder="e.g. Thimphu, Punakha, Different Agencies" required maxlength="100" value="Thimphu" />
          </div>
          <div class="field">
            <label for="requested-by">Requested By <span style="color:var(--color-danger)">*</span></label>
            <input type="text" id="requested-by" placeholder="Name of requesting officer" required maxlength="150" />
          </div>
        </div>
        <div style="margin-top:1.75rem;display:flex;gap:.75rem;flex-wrap:wrap">
          <button type="submit" class="btn btn-primary" id="book-btn">
            <span id="book-btn-text">Book Dispatch</span>
          </button>
          <a href="dashboard.html" class="btn btn-secondary">Cancel</a>
        </div>
      </form>
    </div>

    <!-- Success card -->
    <div class="card" id="success-card" hidden>
      <div style="text-align:center;padding:1.5rem 0">
        <div style="font-size:.8rem;color:var(--color-success);font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.5rem">
          ✓ Dispatch Number Reserved
        </div>
        <div style="font-family:var(--font-mono);font-size:1.5rem;font-weight:700;color:var(--accent-blue-dark);margin-bottom:.75rem"
             id="success-number"></div>
        <p class="text-secondary" style="font-size:.9rem">
          This number is reserved for <strong>7 days</strong>. It will expire automatically if not approved.
        </p>
        <div id="sheets-status" style="margin-top:.75rem;font-size:.82rem;color:var(--text-2)"></div>
        <div style="display:flex;gap:.75rem;justify-content:center;margin-top:1.25rem;flex-wrap:wrap">
          <button class="btn btn-primary" id="book-another-btn">Book Another</button>
          <a href="search.html" class="btn btn-secondary">View My Bookings</a>
        </div>
      </div>
    </div>
  `);

  const alertBox    = document.getElementById('alert-box');
  const form        = document.getElementById('booking-form');
  const successCard = document.getElementById('success-card');
  const bookBtn     = document.getElementById('book-btn');
  const sheetsStatus= document.getElementById('sheets-status');

  document.getElementById('fy-display').textContent = DoWUI.getFinancialYear();

  /* ---- Load dropdowns ---- */
  (async function loadDropdowns() {
    const divSel = document.getElementById('division');
    const fiSel  = document.getElementById('file-index');
    try {
      const [dRes, fRes] = await Promise.all([
        window.supabaseClient.from('divisions').select('id,name').eq('is_active', true).order('name'),
        window.supabaseClient.from('file_indexes').select('id,code,description').eq('is_active', true).order('code'),
      ]);
      if (dRes.error) throw dRes.error;
      if (fRes.error) throw fRes.error;

      divSel.innerHTML = dRes.data.length
        ? `<option value="">Select division…</option>` +
          dRes.data.map(d => `<option value="${d.id}">${DoWUI.escapeHtml(d.name)}</option>`).join('')
        : `<option value="">No divisions available — contact Admin</option>`;

      fiSel.innerHTML = fRes.data.length
        ? `<option value="">Select file index…</option>` +
          fRes.data.map(f => `<option value="${f.id}">${DoWUI.escapeHtml(f.code)} — ${DoWUI.escapeHtml(f.description)}</option>`).join('')
        : `<option value="">No file indexes available — contact Admin</option>`;
    } catch (err) {
      DoWUI.showAlert(alertBox, 'Could not load dropdowns: ' + err.message, 'error');
    }
  })();

  /* ---- Submit ---- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    DoWUI.clearAlert(alertBox);

    const division_id   = document.getElementById('division').value;
    const file_index_id = document.getElementById('file-index').value;
    const subject       = document.getElementById('subject').value.trim();
    const recipient     = document.getElementById('recipient').value.trim();
    const location      = document.getElementById('location').value.trim() || 'Thimphu';
    const requested_by  = document.getElementById('requested-by').value.trim();

    if (!division_id || !file_index_id || !subject || !recipient || !requested_by) {
      DoWUI.showAlert(alertBox, 'Please fill in all required fields.', 'error');
      return;
    }

    setLoading(true);

    // ✅ NOW sends p_location to the database function
    const { data, error } = await window.supabaseClient.rpc('book_dispatch', {
      p_division_id:   division_id,
      p_file_index_id: file_index_id,
      p_subject:       subject,
      p_recipient:     recipient,
      p_requested_by:  requested_by,
      p_location:      location,
    });

    setLoading(false);

    if (error) {
      DoWUI.showAlert(alertBox, 'Booking failed: ' + error.message, 'error');
      return;
    }

    const booking = Array.isArray(data) ? data[0] : data;

    if (!booking || !booking.full_dispatch_number) {
      DoWUI.showAlert(alertBox, 'Booking failed: No dispatch number returned. Please try again.', 'error');
      return;
    }

    document.getElementById('booking-card').hidden = true;
    successCard.hidden = false;
    document.getElementById('success-number').textContent = booking.full_dispatch_number;

    // ---- Auto-sync to Google Sheets (non-blocking) ----
    sheetsStatus.textContent = '⏳ Syncing to Google Sheets…';
    syncToGoogleSheet({
      full_dispatch_number: booking.full_dispatch_number,
      recipient,
      location,
      subject,
      created_at: new Date().toISOString(),
    }).then(result => {
      if (result.success) {
        sheetsStatus.textContent = '✓ Added to Google Sheets (' + result.sheet + ')';
        sheetsStatus.style.color = 'var(--color-success, green)';
      } else {
        sheetsStatus.textContent = '⚠ Google Sheets sync failed — export manually from Admin Panel.';
        sheetsStatus.style.color = 'var(--color-warning, orange)';
        console.warn('Sheets sync error:', result.error);
      }
    }).catch(err => {
      sheetsStatus.textContent = '⚠ Google Sheets sync failed — export manually from Admin Panel.';
      sheetsStatus.style.color = 'var(--color-warning, orange)';
      console.warn('Sheets sync error:', err);
    });
  });

  document.getElementById('book-another-btn').addEventListener('click', () => {
    form.reset();
    document.getElementById('location').value = 'Thimphu';
    document.getElementById('fy-display').textContent = DoWUI.getFinancialYear();
    document.getElementById('dispatch-preview').textContent = 'Generated after booking';
    successCard.hidden = true;
    document.getElementById('booking-card').hidden = false;
    sheetsStatus.textContent = '';
    DoWUI.clearAlert(alertBox);
  });

  function setLoading(on) {
    bookBtn.disabled = on;
    document.getElementById('book-btn-text').textContent = on ? 'Booking…' : 'Book Dispatch';
  }

  /**
   * Send a single booking to Google Sheets via Apps Script Web App.
   * Returns { success, sheet } or { success: false, error }.
   */
  async function syncToGoogleSheet(booking) {
    const url = (typeof GOOGLE_CONFIG !== 'undefined') && GOOGLE_CONFIG.scriptUrl;
    if (!url || url.startsWith('PASTE_')) {
      return { success: false, error: 'Google Script URL not configured in config.js' };
    }
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret:  GOOGLE_CONFIG.secret,
        booking: booking,
      }),
    });
    const json = await res.json();
    if (!json.success) return { success: false, error: json.error };
    const result = json.results && json.results[0];
    return { success: true, sheet: result ? result.sheet : '?' };
  }
})();
