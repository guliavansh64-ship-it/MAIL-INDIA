'use strict';

// =========================================================================
// STRICT SUPER ADMIN AUTHENTICATION GUARD
// Only the designated platform administrator (guliavansh64@gmail.com) is allowed.
// Regular users and any other Gmail accounts are immediately bounced to /admin/login.html.
// =========================================================================
(async function enforceAdminAccessGuard() {
  if (typeof window === 'undefined') return;
  const path = (window.location.pathname || '').toLowerCase();
  if (path.includes('/admin/login') || path.endsWith('/login.html')) {
    return; // Do not guard the login page itself
  }

  try {
    const res = await fetch('/api/admin/auth/session', { credentials: 'same-origin' });
    const data = await res.json().catch(() => null);

    if (!res.ok || !data || !data.authenticated || !data.isAdmin || (data.user?.email || '').toLowerCase() !== 'guliavansh64@gmail.com') {
      const reason = (!data || !data.authenticated)
        ? 'Please authenticate with super administrator credentials.'
        : 'Access Denied: Only the platform administrator (guliavansh64@gmail.com) can access the Super Admin Console. User accounts are strictly barred.';
      window.location.replace('/admin/login.html?error=' + encodeURIComponent(reason));
      return;
    }

    // Set Super Admin identity in sidebar once DOM is ready
    function setupAdminChrome() {
      const emailEl = document.getElementById('side-user-email');
      const avatarEl = document.getElementById('side-user-avatar');
      const credsEl = document.getElementById('side-user-credits');
      if (emailEl) emailEl.textContent = 'guliavansh64@gmail.com';
      if (avatarEl) avatarEl.textContent = '👑';
      if (credsEl) credsEl.textContent = 'Super Administrator';

      const sideUserCard = document.getElementById('side-user-card');
      if (sideUserCard && !document.getElementById('admin-signout-btn')) {
        const outDiv = document.createElement('div');
        outDiv.style.padding = '0 14px 10px';
        outDiv.innerHTML = `
          <button type="button" id="admin-signout-btn" onclick="adminSignOut()" style="width:100%;padding:8px 12px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
            <span>🚪</span> <span>Sign Out of Admin</span>
          </button>
        `;
        sideUserCard.insertAdjacentElement('afterend', outDiv);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', setupAdminChrome);
    } else {
      setupAdminChrome();
    }
  } catch (err) {
    window.location.replace('/admin/login.html?error=' + encodeURIComponent('Could not verify administrator session.'));
  }
})();

// Admin Sign Out Helper
window.adminSignOut = async function() {
  try {
    await fetch('/api/admin/auth/logout', { method: 'POST', credentials: 'same-origin' });
  } catch {}
  if (typeof clearAuthenticationState === 'function') clearAuthenticationState();
  localStorage.removeItem('mb_session');
  window.location.href = '/admin/login.html';
};

let adminMonitorPage = 1;
let adminLogPage = 1;

// Global UID & text copy helper
window.copyUid = window.copyUid || ((uid, btn) => {
  if (navigator?.clipboard?.writeText) {
    navigator.clipboard.writeText(uid);
  } else {
    const t = document.createElement('textarea');
    t.value = uid;
    document.body.appendChild(t);
    t.select();
    document.execCommand('copy');
    document.body.removeChild(t);
  }
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '✓ Copied';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  }
});

// Admin Users
async function initAdminUsers() {
  await initSession();
  const box = document.querySelector('#users-list') || document.querySelector('#admin-users-list');
  const searchInput = document.querySelector('#user-search') || document.querySelector('#users-search');
  if (!box) return;

  let allUsers = [];
  let activeFilter = 'all';

  function renderList() {
    let filtered = allUsers;
    if (activeFilter === 'active') filtered = allUsers.filter(u => u.status === 'active');
    else if (activeFilter === 'suspended') filtered = allUsers.filter(u => u.status === 'suspended');
    else if (activeFilter === 'admin') filtered = allUsers.filter(u => u.admin);

    const q = (searchInput?.value || '').trim().toLowerCase();
    if (q) {
      filtered = filtered.filter(u => 
        (u.uid || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      );
    }

    const statTotal = document.querySelector('#stat-total-users');
    const statActive = document.querySelector('#stat-active-users');
    const statSuspended = document.querySelector('#stat-suspended-users');
    const statAdmins = document.querySelector('#stat-admin-users');
    if (statTotal) statTotal.textContent = allUsers.length;
    if (statActive) statActive.textContent = allUsers.filter(u => u.status === 'active').length;
    if (statSuspended) statSuspended.textContent = allUsers.filter(u => u.status === 'suspended').length;
    if (statAdmins) statAdmins.textContent = allUsers.filter(u => u.admin).length;

    if (box.classList.contains('empty')) box.classList.remove('empty');

    if (!filtered.length) {
      box.innerHTML = `<div class="empty"><div class="empty-icon">👥</div><strong>${allUsers.length ? 'No users match criteria' : 'No user accounts found'}</strong><p class="mg-muted">${allUsers.length ? 'Try clearing your search query or filter.' : 'Registered users will appear here.'}</p></div>`;
      return;
    }

    box.innerHTML = filtered.map(u => {
      const initials = (u.name ? u.name.slice(0, 2) : u.email ? u.email.slice(0, 2) : 'U').toUpperCase();
      const isAdmin = Boolean(u.admin);
      const isActive = u.status === 'active';
      return `
        <div class="user-card" id="user-card-${esc(u.uid)}">
          <div class="user-card-header">
            <div class="user-avatar-circle ${isAdmin ? 'user-avatar-admin' : ''}">${esc(initials)}</div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <strong style="font-size:14px;word-break:break-all">${esc(u.email || u.uid)}</strong>
                ${u.name ? `<span class="mg-muted" style="font-size:12px">(${esc(u.name)})</span>` : ''}
                <span class="badge" style="${isAdmin ? 'background:#fce7f3;color:#db2777' : 'background:#f3f4f6;color:#4b5563'}">${isAdmin ? '👑 Super Admin' : 'Tenant'}</span>
                <span class="badge" style="${isActive ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#dc2626'}">● ${isActive ? 'Active' : 'Suspended'}</span>
              </div>
              <div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:#6b7280">
                <span>UID: <code>${esc(u.uid)}</code></span>
                <button type="button" class="copy-chip" onclick="copyUid('${esc(u.uid)}', this)">📋 Copy</button>
              </div>
            </div>
          </div>
          <div class="user-meta-chips">
            <div class="meta-chip">
              <span>Wallet Balance</span>
              <strong style="color:#6342dc">${Number(u.balance || 0).toLocaleString()} credits</strong>
            </div>
            <div class="meta-chip">
              <span>Credits Consumed</span>
              <strong>${Number(u.consumed || 0).toLocaleString()}</strong>
            </div>
            <div class="meta-chip">
              <span>Rate Limit</span>
              <strong>${u.apiRateLimit || 120}/min</strong>
            </div>
            <div class="meta-chip">
              <span>Registered</span>
              <strong>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Active'}</strong>
            </div>
          </div>
          <div class="user-action-grid">
            <a class="outline" href="/admin/user-details.html?uid=${encodeURIComponent(u.uid)}">🔍 Inspect</a>
            <button class="outline" onclick="adminAdjustCreditsPrompt('${esc(u.uid)}')">⚡ Credits</button>
            <button class="outline" onclick="adminSetLimit('${esc(u.uid)}')">⏱ Limit</button>
            <button class="outline" onclick="adminToggleRole('${esc(u.uid)}', ${isAdmin})">${isAdmin ? 'Demote' : '👑 Admin'}</button>
            <button class="outline" onclick="adminToggleStatus('${esc(u.uid)}', '${isActive ? 'suspended' : 'active'}')">${isActive ? '🔒 Suspend' : '✓ Activate'}</button>
            <button class="outline" style="color:#d9534f;border-color:#f5c6cb" onclick="adminPurgeUser('${esc(u.uid)}')">🗑 Delete</button>
          </div>
        </div>
      `;
    }).join('');
  }

  async function load() {
    try {
      box.innerHTML = '<div class="panel">Loading users from Firebase…</div>';
      const d = await api('/api/admin/users');
      allUsers = d.users || [];
      renderList();
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626"><strong>Admin Access Required:</strong> ${esc(e.message)}</div>`;
    }
  }

  window.filterUserList = type => {
    activeFilter = type;
    document.querySelectorAll('.filter-pill').forEach(p => {
      p.classList.toggle('active', p.getAttribute('data-filter') === type);
    });
    renderList();
  };

  window.copyUid = (uid, btn) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(uid);
    } else {
      const t = document.createElement('textarea');
      t.value = uid;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      document.body.removeChild(t);
    }
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  };

  window.adminAdjustCreditsPrompt = async uid => {
    const amtStr = prompt('Enter credit adjustment (+ to add, - to deduct):', '500');
    if (!amtStr) return;
    const amount = parseInt(amtStr, 10);
    if (isNaN(amount) || amount === 0) {
      alert('Please enter a valid non-zero integer.');
      return;
    }
    const reason = prompt('Mandatory audit reason:', 'Support credit grant') || 'Support adjustment';
    try {
      const operationId = 'adj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      await api('/api/admin/credits/adjust', 'POST', { uid, amount, reason, operationId });
      toast((amount > 0 ? '+' : '') + amount + ' credits adjusted for ' + uid);
      load();
    } catch (e) { toast(e.message); }
  };

  window.adminToggleRole = async (uid, isCurrentlyAdmin) => {
    const nextAdmin = !isCurrentlyAdmin;
    const actionName = nextAdmin ? 'GRANT Administrator access' : 'REVOKE Administrator access';
    if (!confirm(`${actionName} for user ${uid}?`)) return;
    try {
      await api('/api/admin/users/' + encodeURIComponent(uid) + '/role', 'POST', { admin: nextAdmin });
      toast(nextAdmin ? 'User promoted to Administrator' : 'Administrator privileges revoked');
      load();
    } catch (e) { toast(e.message); }
  };

  window.adminSetLimit = async uid => {
    const l = prompt('Enter request limit per minute (1–1000):', '120');
    if (!l) return;
    try {
      await api('/api/admin/users/' + encodeURIComponent(uid) + '/limit', 'POST', { limit: Number(l) });
      toast('Rate limit updated to ' + l + '/min');
      load();
    } catch (e) { toast(e.message); }
  };

  window.adminToggleStatus = async (uid, nextStatus) => {
    const reason = prompt('Reason for account status change (' + nextStatus + '):', 'Administrative update');
    if (!reason) return;
    try {
      await api('/api/admin/users/' + encodeURIComponent(uid) + '/status', 'POST', { status: nextStatus, reason });
      toast('Status changed to ' + nextStatus);
      load();
    } catch (e) { toast(e.message); }
  };

  window.adminPurgeUser = async uid => {
    if (!confirm('Execute GDPR deletion for UID ' + uid + '? All personal data will be permanently wiped.')) return;
    try {
      await api('/api/admin/users/' + encodeURIComponent(uid) + '/delete', 'POST', {});
      toast('User data deleted');
      load();
    } catch (e) { toast(e.message); }
  };

  window.openAddUserModal = () => {
    const m = document.querySelector('#add-user-modal');
    if (m) m.style.display = 'flex';
  };

  window.closeAddUserModal = () => {
    const m = document.querySelector('#add-user-modal');
    if (m) m.style.display = 'none';
  };

  const addUserForm = document.querySelector('#add-user-form');
  if (addUserForm) {
    addUserForm.onsubmit = async e => {
      e.preventDefault();
      const btn = addUserForm.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const email = addUserForm.elements.email.value.trim();
        const name = addUserForm.elements.name.value.trim();
        const credits = Number(addUserForm.elements.credits.value || 100);
        const admin = addUserForm.elements.admin?.checked || false;
        const apiRateLimit = Number(addUserForm.elements.apiRateLimit.value || 120);

        await api('/api/admin/users', 'POST', { email, name, credits, admin, apiRateLimit });
        toast('User account created successfully in Firebase!');
        addUserForm.reset();
        window.closeAddUserModal();
        load();
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    };
  }

  if (searchInput) {
    searchInput.oninput = () => renderList();
  }
  load();
}

// Admin Gmail Sender Pool
async function initAdminSenders() {
  await initSession();
  const listEl = document.querySelector('#sender-list') || document.querySelector('#admin-senders-list');
  const addForm = document.querySelector('#sender-form') || document.querySelector('#add-sender-form');
  const assignForm = document.querySelector('#assignment-form');

  let currentAuthType = 'app_password';
  let currentProvider = 'gmail';

  const PROVIDER_PRESETS = {
    gmail: {
      name: 'Google Workspace / Gmail',
      authType: 'app_password',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      username: '',
      dailyLimit: 500,
      help: 'Generate a 16-character App Password under Google Account -> Security -> 2-Step Verification -> App Passwords.'
    },
    gmail_oauth: {
      name: 'Gmail OAuth 2.0',
      authType: 'oauth2',
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      username: '',
      dailyLimit: 500,
      help: 'Obtain OAuth Client ID, Secret, and Refresh Token via Google Cloud Console with https://mail.google.com/ scope.'
    },
    outlook: {
      name: 'Microsoft Outlook / Office 365',
      authType: 'custom_smtp',
      host: 'smtp.office365.com',
      port: 587,
      secure: false,
      username: '',
      dailyLimit: 5000,
      help: 'Use your full Outlook / Microsoft 365 email address. Use App Password if 2FA is active on your Microsoft account.'
    },
    sendgrid: {
      name: 'SendGrid SMTP',
      authType: 'custom_smtp',
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      username: 'apikey',
      dailyLimit: 10000,
      help: 'Username is literally "apikey". Enter your SendGrid API Key (starts with "SG.") in the Password field.'
    },
    ses: {
      name: 'Amazon SES (Simple Email Service)',
      authType: 'custom_smtp',
      host: 'email-smtp.ap-south-1.amazonaws.com',
      port: 465,
      secure: true,
      username: '',
      dailyLimit: 50000,
      help: 'Use your AWS SES SMTP endpoint (e.g. email-smtp.ap-south-1.amazonaws.com) and IAM SMTP credentials.'
    },
    brevo: {
      name: 'Brevo (Sendinblue)',
      authType: 'custom_smtp',
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      username: '',
      dailyLimit: 10000,
      help: 'Enter your Brevo SMTP login email or username, and your Brevo SMTP Master Key (xsmtpsib-...) in Password.'
    },
    resend: {
      name: 'Resend SMTP',
      authType: 'custom_smtp',
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      username: 'resend',
      dailyLimit: 10000,
      help: 'Username is literally "resend". Enter your Resend API Key (starts with "re_") in the Password field.'
    },
    mailgun: {
      name: 'Mailgun Relay',
      authType: 'custom_smtp',
      host: 'smtp.mailgun.org',
      port: 587,
      secure: false,
      username: '',
      dailyLimit: 10000,
      help: 'Use your Mailgun SMTP credentials (e.g. postmaster@yourdomain.com) and Mailgun SMTP password.'
    },
    postmark: {
      name: 'Postmark Relay',
      authType: 'custom_smtp',
      host: 'smtp.postmarkapp.com',
      port: 587,
      secure: false,
      username: '',
      dailyLimit: 10000,
      help: 'Enter your Postmark Server API Token in both the Username and Password fields.'
    },
    custom_smtp: {
      name: 'Custom SMTP Server',
      authType: 'custom_smtp',
      host: '',
      port: 465,
      secure: true,
      username: '',
      dailyLimit: 1000,
      help: 'Enter your custom SMTP server details, port, security mode, and authentication credentials.'
    }
  };

  window.selectProviderPreset = key => {
    currentProvider = key;
    const p = PROVIDER_PRESETS[key] || PROVIDER_PRESETS.custom_smtp;
    window.switchSenderTab(p.authType);

    document.querySelectorAll('.provider-preset-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-preset') === key);
    });

    const hostInput = document.querySelector('input[name=smtpHost]');
    const portInput = document.querySelector('input[name=smtpPort]');
    const secureInput = document.querySelector('input[name=smtpSecure]');
    const userInput = document.querySelector('input[name=smtpUser]');
    const quotaInput = document.querySelector('input[name=dailyLimit]');
    const helpBox = document.querySelector('#provider-help-box');

    if (hostInput) hostInput.value = p.host || '';
    if (portInput) portInput.value = p.port || 465;
    if (secureInput) secureInput.checked = Boolean(p.secure);
    if (userInput) userInput.value = p.username || '';
    if (quotaInput) quotaInput.value = p.dailyLimit || 500;
    if (helpBox) helpBox.innerHTML = `<strong>${esc(p.name)}:</strong> ${p.help}`;
  };

  window.switchSenderTab = type => {
    currentAuthType = type;
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === type);
    });
    const pApp = document.querySelector('#sender-fields-app-password');
    const pOauth = document.querySelector('#sender-fields-oauth2');
    const pSmtp = document.querySelector('#sender-fields-custom-smtp');
    if (pApp) pApp.style.display = type === 'app_password' ? 'block' : 'none';
    if (pOauth) pOauth.style.display = type === 'oauth2' ? 'block' : 'none';
    if (pSmtp) pSmtp.style.display = type === 'custom_smtp' ? 'block' : 'none';

    const authTypeInput = document.querySelector('#sender-auth-type');
    if (authTypeInput) authTypeInput.value = type;

    if (type === 'app_password') {
      currentProvider = 'gmail';
      document.querySelectorAll('.provider-preset-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-preset') === 'gmail'));
    } else if (type === 'oauth2') {
      currentProvider = 'gmail_oauth';
      document.querySelectorAll('.provider-preset-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-preset') === 'gmail_oauth'));
    }
  };

  async function load() {
    try {
      if (listEl) listEl.innerHTML = '<div class="panel">Loading sender pool from Firebase…</div>';
      const [sRes, uRes] = await Promise.all([
        api('/api/admin/senders'),
        api('/api/admin/users').catch(() => ({ users: [] }))
      ]);
      const senders = sRes.senders || [];
      const users = uRes.users || [];

      const assignSenderSelect = document.querySelector('#assign-sender-id');
      const assignUidSelect = document.querySelector('#assign-uid');
      if (assignSenderSelect) {
        assignSenderSelect.innerHTML = '<option value="">-- Select Sender Account --</option>' +
          senders.filter(s => s.status === 'active' && Number.isFinite(s.verifiedAt) && s.verifiedAt > 0)
            .map(s => `<option value="${esc(s.id)}">${esc(s.email)} (${esc(s.name || s.authType)})</option>`).join('');
      }
      if (assignUidSelect && users.length) {
        assignUidSelect.innerHTML = '<option value="">-- Select Tenant / User --</option>' +
          users.map(u => `<option value="${esc(u.uid)}">${esc(u.email || u.uid)}</option>`).join('');
      }

      if (!listEl) return;
      if (!senders.length) {
        listEl.innerHTML = '<div class="empty">No sender accounts configured in Firebase. Add your Gmail App Password, OAuth 2.0, or SMTP relay above.</div>';
        return;
      }

      listEl.innerHTML = senders.map(s => {
        let typeBadge;
        const prov = s.provider || s.authType;
        if (prov === 'sendgrid') {
          typeBadge = '<span class="badge" style="background:#e0f2fe;color:#0284c7">⚡ SendGrid</span>';
        } else if (prov === 'outlook' || prov === 'office365') {
          typeBadge = '<span class="badge" style="background:#dbeafe;color:#1d4ed8">📮 Outlook 365</span>';
        } else if (prov === 'amazon_ses' || prov === 'ses') {
          typeBadge = '<span class="badge" style="background:#fef3c7;color:#b45309">☁️ Amazon SES</span>';
        } else if (prov === 'brevo' || prov === 'sendinblue') {
          typeBadge = '<span class="badge" style="background:#dcfce7;color:#15803d">🌐 Brevo</span>';
        } else if (prov === 'resend') {
          typeBadge = '<span class="badge" style="background:#f3e8ff;color:#7e22ce">🦄 Resend</span>';
        } else if (prov === 'mailgun') {
          typeBadge = '<span class="badge" style="background:#fee2e2;color:#b91c1c">✉️ Mailgun</span>';
        } else if (prov === 'postmark') {
          typeBadge = '<span class="badge" style="background:#fef9c3;color:#854d0e">📬 Postmark</span>';
        } else if (prov === 'gmail_oauth' || s.authType === 'oauth2') {
          typeBadge = '<span class="badge" style="background:#e0f2fe;color:#0284c7">🔑 Gmail OAuth 2.0</span>';
        } else if (prov === 'gmail' || s.authType === 'app_password') {
          typeBadge = '<span class="badge" style="background:#ede9fe;color:#6342dc">📧 Gmail App Password</span>';
        } else {
          typeBadge = `<span class="badge" style="background:#fef3c7;color:#b45309">⚙️ Custom SMTP (${esc(s.host || 'smtp')}:${esc(s.port || 465)})</span>`;
        }

        const isVerified = Number.isFinite(s.verifiedAt) && s.verifiedAt > 0;
        const isActive = s.status === 'active' && isVerified;
        return `
          <div class="sender-card" id="sender-card-${esc(s.id)}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <strong style="font-size:15px;word-break:break-all">${esc(s.email)}</strong>
                  ${s.name ? `<span class="mg-muted" style="font-size:12px">(${esc(s.name)})</span>` : ''}
                  ${typeBadge}
                  <span class="badge" style="${isActive ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#dc2626'}">● ${isActive ? 'Active' : (isVerified ? 'Paused' : 'Verification required')}</span>
                </div>
                <div style="margin-top:6px;font-size:11px;color:#6b7280;display:flex;gap:12px;flex-wrap:wrap">
                  <span>ID: <code>${esc(s.id)}</code></span>
                  <span>Host: <b>${esc(s.host || 'smtp.gmail.com')}:${esc(s.port || 465)}</b></span>
                  <span>Daily Quota: <b>${esc(s.dailyLimit || 500)}</b>/day</span>
                  <span>Dispatched: <b>${esc(s.usage?.sentToday || s.dailySent || 0)}</b></span>
                  <span>SMTP verified: <b>${isVerified ? new Date(s.verifiedAt).toLocaleString() : 'Not yet'}</b></span>
                  <span>Created: <b>${s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Active'}</b></span>
                </div>
              </div>
            </div>
            <div class="user-action-grid" style="margin-top:12px">
              <button class="outline" onclick="adminVerifySender('${esc(s.id)}')">⚡ Verify SMTP</button>
              <button class="outline" ${isVerified ? '' : 'disabled title="Use Verify SMTP before activating this sender"'} onclick="adminToggleSender('${esc(s.id)}', '${isActive ? 'paused' : 'active'}')">${isActive ? '⏸ Pause' : '▶ Activate'}</button>
              <button class="outline" ${isActive ? '' : 'disabled title="Verify and activate this sender before assigning it"'} onclick="adminAssignSenderPrompt('${esc(s.id)}')">👤 Assign Tenant</button>
              <button class="outline" style="color:#d9534f;border-color:#f5c6cb" onclick="adminDeleteSender('${esc(s.id)}')">🗑 Delete</button>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      if (listEl) listEl.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  window.adminVerifySender = async id => {
    try {
      toast('Verifying SMTP handshake…');
      const r = await api('/api/admin/senders/' + encodeURIComponent(id) + '/verify', 'POST', {});
      if (r.success !== true) throw new Error(r.message || r.error || 'SMTP verification was not confirmed.');
      toast(r.message || 'SMTP credentials verified. The sender is active.', 'success');
      await load();
    } catch (e) { toast('Verification failed: ' + e.message, 'error'); }
  };

  window.adminToggleSender = async (id, nextStatus) => {
    try {
      await api('/api/admin/senders/' + encodeURIComponent(id) + '/status', 'POST', { status: nextStatus });
      toast('Sender status: ' + nextStatus);
      load();
    } catch (e) { toast(e.message); }
  };

  window.adminDeleteSender = async id => {
    if (!confirm('Are you sure you want to permanently delete this sender account?')) return;
    try {
      await api('/api/admin/senders/' + encodeURIComponent(id), 'DELETE');
      toast('Sender deleted successfully');
      load();
    } catch (e) { toast(e.message); }
  };

  window.adminAssignSenderPrompt = async senderId => {
    const uid = prompt('Enter tenant UID to bind this sender account to:');
    if (!uid) return;
    try {
      await api('/api/admin/assignments', 'POST', { uid: uid.trim(), senderId });
      toast('Sender assigned to tenant ' + uid);
    } catch (e) { toast(e.message); }
  };

  if (addForm) {
    addForm.onsubmit = async e => {
      e.preventDefault();
      const btn = addForm.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const email = addForm.elements.email?.value.trim();
        const name = addForm.elements.name?.value.trim() || '';
        const dailyLimit = Number(addForm.elements.dailyLimit?.value || addForm.elements.hourlyLimit?.value || 500);
        const authType = currentAuthType || addForm.elements.authType?.value || 'app_password';
        
        let payload = {
          email,
          name,
          dailyLimit,
          authType,
          provider: currentProvider || authType,
          authorized: true
        };

        if (authType === 'app_password') {
          const rawPass = addForm.elements.appPassword?.value || addForm.elements.password?.value || '';
          const password = rawPass.replace(/\s+/g, '');
          if (!/^[a-z]{16}$/i.test(password)) throw new Error('Enter the 16-letter Google app password. Spaces between the four groups are allowed.');
          payload.password = password;
          payload.host = 'smtp.gmail.com';
          payload.port = 465;
          payload.secure = true;
        } else if (authType === 'oauth2') {
          const clientId = addForm.elements.clientId?.value.trim();
          const clientSecret = addForm.elements.clientSecret?.value.trim();
          const refreshToken = addForm.elements.refreshToken?.value.trim();
          if (!clientId || !clientSecret || !refreshToken) {
            throw new Error('Client ID, Client Secret, and Refresh Token are required for OAuth 2.0.');
          }
          payload.clientId = clientId;
          payload.clientSecret = clientSecret;
          payload.refreshToken = refreshToken;
          payload.host = 'smtp.gmail.com';
          payload.port = 465;
          payload.secure = true;
        } else if (authType === 'custom_smtp') {
          const host = addForm.elements.smtpHost?.value.trim();
          const port = Number(addForm.elements.smtpPort?.value || 465);
          let username = addForm.elements.smtpUser?.value.trim() || '';
          const password = addForm.elements.smtpPassword?.value || '';
          const secure = addForm.elements.smtpSecure?.checked !== false;
          if (!host || !password) throw new Error('SMTP host and password/API key are required.');
          
          if (!username) {
            if (currentProvider === 'sendgrid') username = 'apikey';
            else if (currentProvider === 'resend') username = 'resend';
            else if (currentProvider === 'postmark') username = password;
            else username = email;
          }

          payload.host = host;
          payload.port = port;
          payload.secure = secure;
          payload.username = username;
          payload.password = password;
        }

        await api('/api/admin/senders', 'POST', payload);
        toast('Sender saved and paused. Click Verify SMTP to check the credentials and activate sending.', 'info', 6000);
        addForm.reset();
        switchSenderTab(currentAuthType);
        await load();
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    };
  }

  if (assignForm) {
    assignForm.onsubmit = async e => {
      e.preventDefault();
      const btn = assignForm.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const uid = assignForm.elements.uid?.value.trim() || assignForm.elements.assignUid?.value.trim();
        const senderId = assignForm.elements.senderId?.value.trim() || assignForm.elements.assignSenderId?.value.trim();
        if (!uid || !senderId) throw new Error('Both tenant UID and sender ID are required.');
        await api('/api/admin/assignments', 'POST', { uid, senderId });
        toast('Sender successfully assigned to tenant');
        assignForm.reset();
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    };
  }

  window.connectAdminGmailOAuth = function() {
    toast('Redirecting to Google for 1-Click Gmail authorization…', 'info', 4000);
    const token = window.mbSession?.token || '';
    const endpoint = '/oauth/admin/gmail/connect' + (token ? '?token=' + encodeURIComponent(token) : '');
    const targetUrl = typeof window.getApiUrl === 'function' ? window.getApiUrl(endpoint) : endpoint;
    window.location.href = targetUrl;
  };

  const urlParams = new URLSearchParams(window.location.search);
  const senderConn = urlParams.get('sender_connected');
  if (senderConn === 'success') {
    const email = urlParams.get('email') || 'Gmail account';
    toast(`✅ Gmail account ${email} connected successfully and added to active sender pool!`, 'success', 8000);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  } else if (urlParams.get('error')) {
    toast(`❌ Gmail connection failed: ${urlParams.get('error')}`, 'error', 8000);
    if (window.history && window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  const urlPreset = urlParams.get('preset');
  if (urlPreset && PROVIDER_PRESETS[urlPreset]) {
    selectProviderPreset(urlPreset);
  }

  load();
}

// Admin Email Monitoring
async function initAdminMonitoring() {
  await initSession();
  const box = document.querySelector('#monitor-list');
  const pageEl = document.querySelector('#monitor-page');
  const f = document.querySelector('#monitor-filter');

  async function load() {
    if (!box) return;
    try {
      const params = new URLSearchParams({
        page: String(adminMonitorPage),
        limit: '20',
        search: (f?.elements?.search?.value || f?.value || ''),
        status: (f?.elements?.status?.value || 'all')
      });
      const d = await api('/api/admin/monitoring/emails?' + params);
      if (pageEl) pageEl.textContent = `Page ${d.page} · ${d.total} records`;
      if (!d.emails.length) {
        box.innerHTML = '<div class="empty">No matching email requests in monitoring.</div>';
        return;
      }
      box.innerHTML = d.emails.map(x => `
        <div class="mg-row">
          <div>
            <strong>${esc(x.subject || '(No subject)')}</strong>
            <div class="mg-muted">${esc(x.recipient)} · UID: ${esc(x.uid)} · ${new Date(x.createdAt).toLocaleString()}<br>ID: <code>${esc(x.id)}</code>${x.error ? ' · <span style="color:#dc2626">' + esc(x.error) + '</span>' : ''}</div>
          </div>
          <div class="actions">
            <span class="badge">${esc(x.status)}</span>
            ${x.status === 'unknown' ? `<button class="outline" onclick="adminReconcileJob('${esc(x.uid)}', '${esc(x.id)}')">Reconcile</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  window.adminReconcileJob = async (uid, jobId) => {
    const outcome = prompt('Enter resolved outcome (accepted or failed):', 'failed');
    if (!outcome) return;
    try {
      await api('/api/admin/reconcile/' + encodeURIComponent(jobId), 'POST', {
        uid,
        status: outcome,
        evidence: 'Operator reconciliation'
      });
      toast('Job reconciled as ' + outcome);
      load();
    } catch (e) { toast(e.message); }
  };

  if (f) f.onsubmit = e => { e.preventDefault(); adminMonitorPage = 1; load(); };
  load();
}

// Admin Email Logs
let adminLogAllLogs = [];
let adminLogStatusFilter = 'all';

async function initAdminEmailLogs() {
  await initSession();
  const box = document.querySelector('#admin-logs-list') || document.querySelector('#admin-email-logs-list') || document.querySelector('#logs-list');
  const pageEl = document.querySelector('#admin-log-page');
  const f = document.querySelector('#admin-logs-filter');
  const searchInput = document.querySelector('#admin-logs-search') || (f?.elements?.search);
  const prevBtn = document.querySelector('#admin-log-prev');
  const nextBtn = document.querySelector('#admin-log-next');

  if (!box) return;

  function renderLogs() {
    let list = adminLogAllLogs;
    if (adminLogStatusFilter !== 'all') {
      list = list.filter(x => (x.status || '').toLowerCase() === adminLogStatusFilter);
    }
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter(x => 
        (x.recipient || '').toLowerCase().includes(q) ||
        (x.subject || '').toLowerCase().includes(q) ||
        (x.id || '').toLowerCase().includes(q) ||
        (x.uid || '').toLowerCase().includes(q)
      );
    }

    if (box.classList.contains('empty')) box.classList.remove('empty');

    if (!list.length) {
      box.innerHTML = '<div class="empty"><div class="empty-icon">📬</div><strong>No email transmissions found</strong><p class="mg-muted">No records matched the selected filters.</p></div>';
      return;
    }

    box.innerHTML = list.map(x => {
      const status = (x.status || 'unknown').toLowerCase();
      let icon = '📬';
      let iconCls = 'icon-info';
      let badgeCls = 'badge-info';
      if (status === 'delivered' || status === 'sent') {
        icon = '✓';
        iconCls = 'icon-success';
        badgeCls = 'badge-success';
      } else if (status === 'queued' || status === 'created') {
        icon = '⏳';
        iconCls = 'icon-warn';
        badgeCls = 'badge-warn';
      } else if (status === 'failed' || status === 'bounced' || status === 'rejected') {
        icon = '✕';
        iconCls = 'icon-error';
        badgeCls = 'badge-error';
      }

      const dateStr = x.createdAt ? new Date(x.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';

      return `
        <div class="admin-log-card" id="log-${esc(x.id)}">
          <div class="admin-log-header">
            <div class="admin-log-subject-row">
              <div class="admin-log-icon ${iconCls}">${icon}</div>
              <div style="flex:1;min-width:0">
                <div class="admin-log-subject">${esc(x.subject || '(No Subject)')}</div>
                <div style="font-size:12px;color:#475569;margin-top:2px;display:flex;align-items:center;gap:6px">
                  <span>✉️</span>
                  <strong style="word-break:break-all">${esc(x.recipient || 'N/A')}</strong>
                </div>
              </div>
            </div>
            <span class="badge ${badgeCls}" style="font-size:11px;text-transform:capitalize">● ${esc(status)}</span>
          </div>

          <div class="admin-log-meta">
            <span class="admin-log-meta-item">
              <span style="color:#94a3b8">User:</span>
              <a href="/admin/user-details.html?uid=${encodeURIComponent(x.uid)}" style="color:#6342dc;font-weight:600;text-decoration:none">${esc(x.uid ? x.uid.slice(0, 10) + '…' : 'unknown')}</a>
            </span>
            <span class="admin-log-meta-item">
              <span style="color:#94a3b8">Time:</span>
              <span>${esc(dateStr)}</span>
            </span>
            ${x.provider ? `<span class="admin-log-meta-item"><span style="color:#94a3b8">Relay:</span> <b>${esc(x.provider)}</b></span>` : ''}
          </div>

          <div class="admin-log-id-row">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
              <span>Msg ID:</span>
              <code style="font-size:10px;background:#f8fafc;padding:2px 6px;border-radius:4px;border:1px solid #e2e8f0;word-break:break-all">${esc(x.id)}</code>
              <button type="button" class="copy-chip" onclick="copyUid('${esc(x.id)}', this)">📋 Copy</button>
            </div>
          </div>

          ${x.error ? `<div class="admin-log-error">⚠️ ${esc(x.error)}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  window.filterAdminEmailLogs = function(status) {
    if (status) {
      adminLogStatusFilter = status;
      document.querySelectorAll('#admin-logs-status-filter .filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === status);
      });
    }
    renderLogs();
  };

  async function load() {
    try {
      box.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><strong>Loading global email stream…</strong></div>';
      const q = (searchInput?.value || '').trim();
      const d = await api('/api/admin/logs/emails?' + new URLSearchParams({ page: String(adminLogPage), limit: '25', search: q }));
      adminLogAllLogs = d.logs || [];
      if (pageEl) pageEl.textContent = `Page ${d.page} · ${d.total} total transmissions`;
      if (prevBtn) prevBtn.disabled = (adminLogPage <= 1);
      if (nextBtn) nextBtn.disabled = ((adminLogPage * (d.limit || 25)) >= d.total);
      renderLogs();
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  if (searchInput) {
    searchInput.oninput = () => renderLogs();
  }
  if (f) {
    f.onsubmit = e => { e.preventDefault(); adminLogPage = 1; load(); };
  }
  if (prevBtn) {
    prevBtn.onclick = () => { if (adminLogPage > 1) { adminLogPage--; load(); } };
  }
  if (nextBtn) {
    nextBtn.onclick = () => { adminLogPage++; load(); };
  }

  load();
}

// Admin Keys
async function initAdminKeys() {
  await initSession();
  const box = document.querySelector('#admin-keys-list') || document.querySelector('#key-list');

  async function load() {
    if (!box) return;
    try {
      const d = await api('/api/admin/keys');
      if (!d.keys.length) {
        box.innerHTML = '<div class="empty">No API keys registered across tenants.</div>';
        return;
      }
      box.innerHTML = d.keys.map(k => `
        <div class="mg-row">
          <div>
            <strong>${esc(k.name)}</strong> <code>${esc(k.prefix)}…</code>
            <div class="mg-muted">User UID: ${esc(k.uid)} · Created: ${new Date(k.createdAt).toLocaleDateString()} · Last Used: ${k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : 'Never'}</div>
          </div>
          <div class="actions">
            <span class="badge">${esc(k.status)}</span>
            ${k.status === 'active' ? `<button class="outline" onclick="adminRevokeKey('${esc(k.uid)}', '${esc(k.id)}')">Revoke</button>` : ''}
          </div>
        </div>
      `).join('');
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  window.adminRevokeKey = async (uid, keyId) => {
    if (!confirm('Revoke this user API key?')) return;
    try {
      await api('/api/admin/keys/' + encodeURIComponent(keyId) + '?uid=' + encodeURIComponent(uid), 'DELETE');
      toast('API key revoked');
      load();
    } catch (e) { toast(e.message); }
  };

  load();
}

// Admin Credit Management
async function initAdminCredits() {
  await initSession();
  const form = document.querySelector('#credit-adjust-form');
  const inspectForm = document.querySelector('#inspect-ledger-form');
  const ledgerBox = document.querySelector('#ledger-history-box');
  const rateForm = document.querySelector('#credit-rate-form') || document.querySelector('#rate-card-form');
  const tenantChipsBox = document.querySelector('#credit-tenant-picker');
  const selectedUserBanner = document.querySelector('#credit-selected-user-banner');
  const uidInput = document.querySelector('#adjust-uid') || form?.elements?.uid;
  const creditsInput = document.querySelector('#adjust-credits') || form?.elements?.credits;

  let allUsers = [];

  async function loadTenants() {
    try {
      const d = await api('/api/admin/users');
      allUsers = d.users || [];
      if (tenantChipsBox && allUsers.length) {
        tenantChipsBox.innerHTML = `
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px">Quick Tenant Picker (click to select):</div>
          <div class="filter-pills" style="margin:0">
            ${allUsers.slice(0, 15).map(u => `
              <button type="button" class="filter-pill" onclick="selectCreditUser('${esc(u.uid)}', '${esc(u.email || u.uid)}', ${u.balance || 0})">
                ${esc(u.email || u.uid)} <span style="opacity:0.75">(${Number(u.balance || 0).toLocaleString()} cr)</span>
              </button>
            `).join('')}
          </div>
        `;
      }
    } catch (e) {
      console.warn('Failed to load tenants for credit picker', e);
    }
  }

  window.selectCreditUser = (uid, email, balance) => {
    if (uidInput) uidInput.value = uid;
    const inspectInput = document.querySelector('#inspect-uid');
    if (inspectInput) inspectInput.value = uid;
    if (selectedUserBanner) {
      selectedUserBanner.style.display = 'block';
      selectedUserBanner.innerHTML = `
        <div style="background:#eef2ff;border:1px solid #c7d2fe;padding:10px 14px;border-radius:8px;font-size:13px;color:#3730a3">
          <strong>Selected Tenant:</strong> ${esc(email)} · UID: <code>${esc(uid)}</code><br>
          <strong>Current Balance:</strong> <span style="font-weight:700;color:#4f46e5">${Number(balance || 0).toLocaleString()} credits</span>
        </div>
      `;
    }
    inspectUserLedger(uid);
  };

  window.setAdjustDelta = delta => {
    if (creditsInput) creditsInput.value = delta;
  };

  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const uid = form.elements.uid?.value.trim();
        const amount = Number(form.elements.credits?.value || form.elements.amount?.value || 0);
        const reason = form.elements.reason?.value.trim();
        if (!uid) throw new Error('Please enter or select a User UID.');
        if (!amount || isNaN(amount)) throw new Error('Please enter a valid non-zero credit delta.');
        if (!reason || reason.length < 3) throw new Error('Please enter a mandatory audit reason.');

        const operationId = 'adj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
        await api('/api/admin/credits/adjust', 'POST', { uid, amount, reason, operationId });
        toast((amount > 0 ? '+' : '') + amount + ' credits successfully committed for ' + uid);
        form.elements.reason.value = '';
        inspectUserLedger(uid);
        loadTenants();
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    };
  }

  if (rateForm) {
    rateForm.onsubmit = async e => {
      e.preventDefault();
      const btn = rateForm.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const rate = Number(rateForm.elements.creditRate.value);
        await api('/api/admin/pricing', 'POST', { creditRate: rate });
        toast('Rate card updated: ₹1 = ' + rate + ' credits');
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    };
  }

  async function inspectUserLedger(uid) {
    if (!ledgerBox || !uid) return;
    try {
      ledgerBox.innerHTML = '<div class="panel">Loading double-entry ledger from Firebase…</div>';
      const d = await api('/api/admin/wallets/' + encodeURIComponent(uid));
      const ledger = d.ledger || Object.entries(d.wallet?.ledger || {}).map(([id, item]) => ({ id, ...item }));
      const balance = d.balance ?? d.wallet?.balance ?? 0;
      const consumed = d.consumed ?? d.wallet?.consumed ?? 0;
      const purchased = d.purchased ?? d.wallet?.purchased ?? 0;

      ledgerBox.innerHTML = `
        <div style="background:#f8f7fc;border:1px solid #ebe8f7;padding:14px;border-radius:10px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <div>
              <strong style="font-size:15px;color:#2e2a4a">Wallet: ${esc(uid)}</strong>
              <div class="mg-muted" style="font-size:11px">Purchased: ${Number(purchased).toLocaleString()} · Consumed: ${Number(consumed).toLocaleString()}</div>
            </div>
            <div style="font-size:18px;font-weight:700;color:#6342dc">${Number(balance).toLocaleString()} credits</div>
          </div>
        </div>
        ${ledger.length ? `
          <div style="max-height:350px;overflow:auto;border:1px solid #eeedf5;border-radius:8px">
            ${ledger.map(item => `
              <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 12px;border-bottom:1px solid #f3f2f8;font-size:12px">
                <div>
                  <strong style="color:#2e2a4a">${esc(item.type || 'ADJUSTMENT')}</strong> · <span class="mg-muted">${new Date(item.createdAt || Date.now()).toLocaleString()}</span>
                  <div style="color:#6b7280;margin-top:2px">Reason / Ref: ${esc(item.reason || item.orderId || item.reference || 'N/A')}</div>
                </div>
                <div style="font-weight:700;font-size:13px;white-space:nowrap;color:${(item.credits || item.amount || 0) >= 0 ? '#15803d' : '#dc2626'}">
                  ${(item.credits || item.amount || 0) >= 0 ? '+' : ''}${item.credits || item.amount || 0} cr
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<div class="empty">No financial ledger entries recorded for this user.</div>'}
      `;
    } catch (e) { ledgerBox.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`; }
  }

  if (inspectForm) {
    inspectForm.onsubmit = e => {
      e.preventDefault();
      const uid = inspectForm.elements.uid?.value.trim();
      inspectUserLedger(uid);
    };
  }

  loadTenants();
}

// Admin Payments
let adminPaymentsList = [];
let adminPaymentFilter = 'all';

async function initAdminPayments() {
  await initSession();
  const box = document.querySelector('#payments-list') || document.querySelector('#admin-payments-list');
  const alertBox = document.querySelector('#financial-alert-list');
  const searchInput = document.querySelector('#admin-payment-search');
  if (!box) return;

  function renderPayments() {
    let list = adminPaymentsList;
    if (adminPaymentFilter !== 'all') {
      list = list.filter(p => (p.status || '').toLowerCase() === adminPaymentFilter);
    }
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter(p => 
        (p.orderId || '').toLowerCase().includes(q) ||
        (p.uid || '').toLowerCase().includes(q) ||
        (p.paymentId || '').toLowerCase().includes(q) ||
        (p.provider || '').toLowerCase().includes(q)
      );
    }

    if (box.classList.contains('empty')) box.classList.remove('empty');

    if (!list.length) {
      box.innerHTML = '<div class="empty"><div class="empty-icon">💳</div><strong>No payment transactions found</strong><p class="mg-muted">No records matched your search / filter criteria.</p></div>';
      return;
    }

    box.innerHTML = list.map(p => {
      const status = (p.status || 'unknown').toLowerCase();
      const isCaptured = status === 'captured';
      const isPending = status === 'created' || status === 'pending';
      const isRefunded = status === 'refunded';
      const amountInr = ((p.amountPaise || 0) / 100).toFixed(2);
      const iconCls = isCaptured ? 'tx-icon-captured' : isPending ? 'tx-icon-pending' : 'tx-icon-failed';
      const badgeCls = isCaptured ? 'badge-success' : isPending ? 'badge-warn' : isRefunded ? 'badge-info' : 'badge-error';
      const icon = isCaptured ? '₹' : isPending ? '⏳' : isRefunded ? '↩' : '❌';
      const dateStr = p.createdAt ? new Date(p.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Unknown';
      const providerLabel = (p.provider === 'razorpay' || (p.orderId && p.orderId.startsWith('order_rzp'))) ? '💳 Razorpay' : '⚡ ZetPay UPI';

      return `
        <div class="admin-tx-card" id="tx-${esc(p.orderId)}">
          <div class="admin-tx-head">
            <div class="admin-tx-left">
              <div class="admin-tx-icon ${iconCls}">${icon}</div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span class="admin-tx-order">${esc(p.orderId)}</span>
                  <span class="badge" style="background:#f1f5f9;color:#475569;font-size:11px">${providerLabel}</span>
                  <span class="badge ${badgeCls}">● ${esc(status)}</span>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:3px;display:flex;align-items:center;gap:6px">
                  <span>User:</span>
                  <a href="/admin/user-details.html?uid=${encodeURIComponent(p.uid)}" style="color:#6342dc;font-weight:600;text-decoration:none">${esc(p.uid || 'N/A')}</a>
                </div>
              </div>
            </div>
            <div class="admin-tx-right">
              <div class="admin-tx-inr">₹${amountInr}</div>
              <div class="admin-tx-credits">+${Number(p.credits || 0).toLocaleString()} credits</div>
            </div>
          </div>

          <div class="admin-tx-foot">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span>Date: <b>${esc(dateStr)}</b></span>
              ${p.paymentId ? `<span>Txn: <code style="font-size:10px;background:#f8fafc;padding:1px 5px;border-radius:4px;border:1px solid #e2e8f0">${esc(p.paymentId)}</code></span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:6px">
              <button type="button" class="copy-chip" onclick="copyUid('${esc(p.orderId)}', this)">📋 Order ID</button>
              ${isCaptured ? `<a href="/admin/refunds.html" class="outline" style="font-size:11px;padding:3px 8px;text-decoration:none">Refund</a>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.filterAdminPayments = function(filter) {
    if (filter) {
      adminPaymentFilter = filter;
      document.querySelectorAll('#admin-tx-filter .filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tx === filter);
      });
    }
    renderPayments();
  };

  async function load() {
    try {
      box.innerHTML = '<div class="empty"><div class="empty-icon">💳</div><strong>Loading transaction ledger…</strong></div>';
      const d = await api('/api/admin/payments');
      adminPaymentsList = d.payments || [];

      // Calculate stats
      const capturedList = adminPaymentsList.filter(x => x.status === 'captured');
      const totalRevenue = capturedList.reduce((acc, x) => acc + (x.amountPaise || 0), 0) / 100;
      const totalCredits = capturedList.reduce((acc, x) => acc + (x.credits || 0), 0);

      const statRev = document.querySelector('#stat-total-revenue');
      const statOrders = document.querySelector('#stat-total-orders');
      const statCred = document.querySelector('#stat-total-credits');
      if (statRev) statRev.textContent = `₹${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      if (statOrders) statOrders.textContent = capturedList.length;
      if (statCred) statCred.textContent = Number(totalCredits).toLocaleString();

      renderPayments();

      if (alertBox) {
        const alerts = await api('/api/admin/payments/alerts');
        alertBox.innerHTML = alerts.alerts?.length ? alerts.alerts.map(a => `
          <div style="padding:10px 14px;background:#fef2f2;border:1px solid #fee2e2;border-radius:8px;color:#dc2626;font-size:12px;margin-bottom:8px;display:flex;align-items:center;gap:8px">
            <span>⚠️</span>
            <div><strong>${esc(a.type)}</strong>: Order ${esc(a.orderId)} · ${esc(a.message)}</div>
          </div>
        `).join('') : '<div style="font-size:12px;color:#15803d;padding:8px 12px;background:#f0fdf4;border:1px solid #dcfce7;border-radius:8px;display:flex;align-items:center;gap:6px"><span>✓</span> All payment records reconciled and verified.</div>';
      }
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  load();
}

// Admin Refunds
async function initAdminRefunds() {
  await initSession();
  const box = document.querySelector('#refunds-list') || document.querySelector('#admin-refunds-list');
  if (!box) return;
  try {
    const d = await api('/api/admin/refunds');
    if (!d.refunds.length) {
      box.innerHTML = '<div class="empty">No refund requests recorded.</div>';
      return;
    }
    box.innerHTML = d.refunds.map(r => `
      <div class="mg-row">
        <div>
          <strong>Refund ${esc(r.id)}</strong>
          <div class="mg-muted">Payment: ${esc(r.paymentId)} · Amount: ₹${((r.amountPaise || 0) / 100).toFixed(2)} · User: ${esc(r.uid)}<br>Status: <b>${esc(r.status)}</b> · Recovered Credits: ${esc(r.creditsRecovered || 0)}</div>
        </div>
        <span class="badge">${esc(r.status)}</span>
      </div>
    `).join('');
  } catch (e) { box.textContent = e.message; }
}

// Admin Disputes
async function initAdminDisputes() {
  await initSession();
  const box = document.querySelector('#disputes-list') || document.querySelector('#admin-disputes-list');
  if (!box) return;
  try {
    const d = await api('/api/admin/disputes');
    if (!d.disputes.length) {
      box.innerHTML = '<div class="empty">No chargeback disputes filed.</div>';
      return;
    }
    box.innerHTML = d.disputes.map(x => `
      <div class="mg-row">
        <div>
          <strong>Dispute ${esc(x.id)}</strong>
          <div class="mg-muted">Payment: ${esc(x.paymentId)} · User: ${esc(x.uid)} · Amount: ₹${((x.amountPaise || 0) / 100).toFixed(2)}<br>Status: <b>${esc(x.status)}</b> · Held Credits: ${esc(x.creditsHeld || 0)}</div>
        </div>
        <span class="badge">${esc(x.status)}</span>
      </div>
    `).join('');
  } catch (e) { box.textContent = e.message; }
}

// Admin Reconciliation
async function initAdminReconciliation() {
  await initSession();
  const auditBtn = document.querySelector('#run-audit-btn');
  const resEl = document.querySelector('#audit-result') || document.querySelector('#admin-reconciliation-results');

  async function runAudit() {
    if (!resEl) return;
    resEl.innerHTML = '<div class="panel">Running financial ledger reconciliation audit against Firebase RTDB…</div>';
    try {
      const d = await api('/api/admin/reconciliation/audit', 'POST', {});
      resEl.innerHTML = `
        <div class="panel">
          <h3>Audit Results</h3>
          <p>Total Wallets Checked: <b>${d.walletsAudited || 0}</b> · Total Credits Audited: <b>${d.creditsAudited || 0}</b></p>
          ${d.issues?.length ? `
            <div style="color:#dc2626;margin:12px 0">
              <strong>⚠ Found ${d.issues.length} ledger integrity discrepancies:</strong>
              ${d.issues.map(i => `<div style="padding:6px 0;font-size:11px">User ${esc(i.uid)}: ${esc(i.error)} (Recorded: ${i.recordedBalance}, Expected: ${i.expectedBalance})</div>`).join('')}
            </div>
            <button class="primary" onclick="adminAutoResolveAudit()">Auto-Resolve Discrepancies</button>
          ` : '<div style="color:#15803d;margin-top:10px">✓ All wallet balances and ledger transactions are 100% mathematically consistent.</div>'}
        </div>
      `;
    } catch (e) { resEl.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`; }
  }

  window.adminAutoResolveAudit = async () => {
    try {
      await api('/api/admin/reconciliation/resolve', 'POST', { reason: 'Automated ledger discrepancy resolution' });
      toast('Discrepancies resolved');
      runAudit();
    } catch (e) { toast(e.message); }
  };

  if (auditBtn) auditBtn.onclick = runAudit;
  runAudit();
}

// Admin Queue Monitoring
async function initAdminQueue() {
  await initSession();
  const box = document.querySelector('#queue-box') || document.querySelector('#admin-queue-view');
  if (!box) return;
  try {
    const d = await api('/api/admin/queue/metrics');
    box.innerHTML = `
      <div class="grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="stat"><div class="stat-head"><span class="stat-label">Stuck Processing</span></div><div class="stat-value">${d.stuckProcessing || 0}</div></div>
        <div class="stat"><div class="stat-head"><span class="stat-label">Stuck Queued</span></div><div class="stat-value">${d.stuckQueued || 0}</div></div>
        <div class="stat"><div class="stat-head"><span class="stat-label">Uncertain Outcomes</span></div><div class="stat-value">${d.unknownCount || 0}</div></div>
        <div class="stat"><div class="stat-head"><span class="stat-label">Dead-Letter Queue</span></div><div class="stat-value">${d.dlqCount || 0}</div></div>
      </div>
      <div style="margin-top:20px;display:flex;gap:10px">
        <button class="outline" onclick="adminRecoverStuck()">Recover Stuck Jobs</button>
      </div>
    `;
  } catch (e) { box.textContent = e.message; }

  window.adminRecoverStuck = async () => {
    try {
      const r = await api('/api/admin/queue/recover', 'POST', {});
      toast(`Recovered ${r.recovered || 0} jobs safely.`);
      initAdminQueue();
    } catch (e) { toast(e.message); }
  };
}

// Admin Abuse Monitoring
let adminSuppressionsList = [];

async function initAdminAbuse() {
  await initSession();
  const box = document.querySelector('#suppression-list') || document.querySelector('#admin-suppressions-list');
  const addForm = document.querySelector('#suppress-form');
  const badge = document.querySelector('#suppression-count-badge');
  const searchInput = document.querySelector('#suppress-search');

  function renderSuppressions() {
    if (!box) return;
    const q = (searchInput?.value || '').trim().toLowerCase();
    let list = adminSuppressionsList;
    if (q) {
      list = list.filter(s => 
        (s.recipient || '').toLowerCase().includes(q) ||
        (s.reason || '').toLowerCase().includes(q) ||
        (s.hash || '').toLowerCase().includes(q)
      );
    }

    if (box.classList.contains('empty')) box.classList.remove('empty');

    if (!list.length) {
      box.innerHTML = '<div class="empty"><div class="empty-icon">🛡️</div><strong>Suppression list is clean</strong><p class="mg-muted">No blocked recipients found.</p></div>';
      return;
    }

    box.innerHTML = list.map(s => {
      const target = s.recipient || (s.hash ? s.hash.slice(0, 16) + '…' : 'Unknown');
      const dateStr = s.createdAt ? new Date(s.createdAt).toLocaleDateString() : 'Active';
      return `
        <div class="admin-suppress-card" id="suppress-${esc(s.hash)}">
          <div class="admin-suppress-left">
            <div class="admin-suppress-icon">🚫</div>
            <div style="flex:1;min-width:0">
              <div class="admin-suppress-target">${esc(target)}</div>
              <div class="admin-suppress-meta">
                <span class="admin-suppress-reason-badge">${esc(s.reason || 'manual_admin_suppression')}</span>
                <span>Blocked: ${esc(dateStr)}</span>
                <code style="font-size:10px;background:#f8fafc;padding:1px 4px;border-radius:3px;border:1px solid #e2e8f0">${esc((s.hash || '').slice(0, 10))}…</code>
              </div>
            </div>
          </div>
          <button type="button" class="outline" style="color:#dc2626;border-color:#fecaca;padding:6px 12px;font-size:12px" onclick="adminRemoveSuppression('${esc(s.hash)}')">Unblock</button>
        </div>
      `;
    }).join('');
  }

  window.filterSuppressions = function() {
    renderSuppressions();
  };

  async function load() {
    if (!box) return;
    try {
      box.innerHTML = '<div class="empty"><div class="empty-icon">🛡️</div><strong>Loading suppressions…</strong></div>';
      const d = await api('/api/admin/suppression');
      adminSuppressionsList = d.list || d.suppressions || [];
      if (badge) badge.textContent = `${adminSuppressionsList.length} blocked`;
      renderSuppressions();
    } catch (e) {
      box.innerHTML = `<div class="empty">Administrator sign in required to manage suppressions. <a href="/account.html" class="link">Sign in →</a></div>`;
    }
  }

  window.adminRemoveSuppression = async hash => {
    if (!confirm('Remove suppression for recipient? They will be allowed to receive emails again.')) return;
    try {
      await api('/api/admin/suppression/' + encodeURIComponent(hash), 'DELETE');
      toast('Recipient unblocked successfully');
      load();
    } catch (e) { toast(e.message); }
  };

  if (addForm) {
    addForm.onsubmit = async e => {
      e.preventDefault();
      try {
        const email = (addForm.elements.target?.value || addForm.elements.email?.value || '').trim();
        const reason = (addForm.elements.reason?.value || 'manual_admin_suppression').trim();
        await api('/api/admin/suppression', 'POST', {
          email,
          recipient: email,
          reason
        });
        toast('Recipient suppressed successfully');
        addForm.reset();
        load();
      } catch (err) { toast(err.message); }
    };
  }

  load();
}

// Admin Support Tickets
async function initAdminSupport() {
  await initSession();
  const box = document.querySelector('#admin-support-list') || document.querySelector('#support-list');
  if (!box) return;
  try {
    const d = await api('/api/admin/support/tickets');
    const tickets = d.tickets || [];
    if (!tickets.length) {
      box.innerHTML = '<div class="empty">No tenant support tickets filed.</div>';
      return;
    }
    box.innerHTML = tickets.map(t => {
      const replies = Object.values(t.replies || {});
      const isOpen = t.status === 'open';
      return `
        <div style="padding:16px 0;border-top:1px solid #eeedf5">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
            <strong style="font-size:14px;color:#2e2a4a">${esc(t.subject)}</strong>
            <span class="badge" style="${isOpen ? 'background:#dcfce7;color:#15803d' : 'background:#f3f4f6;color:#6b7280'}">${esc(t.status)}</span>
          </div>
          <p style="margin:8px 0;font-size:13px;color:#4b5563;line-height:1.5">${esc(t.message)}</p>
          <div class="mg-muted" style="font-size:11px">User UID: <code>${esc(t.uid)}</code> · Submitted: ${new Date(t.createdAt).toLocaleString()}${t.closedAt ? ' · Closed: ' + new Date(t.closedAt).toLocaleString() : ''}</div>
          
          ${replies.length ? `
            <div style="background:#f8f7fc;border-left:3px solid #6342dc;padding:8px 12px;border-radius:4px;margin:10px 0;display:grid;gap:6px">
              <strong style="font-size:11px;color:#6342dc">Administrative Responses:</strong>
              ${replies.map(r => `
                <div style="font-size:12px;color:#333">
                  💬 ${esc(r.message)}
                  <span class="mg-muted" style="font-size:10px;margin-left:6px">${new Date(r.createdAt || Date.now()).toLocaleTimeString()}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${isOpen ? `
            <div class="actions" style="margin-top:10px">
              <button class="primary" style="padding:6px 12px;font-size:12px" onclick="adminReplyTicket('${esc(t.uid)}', '${esc(t.id)}')">💬 Reply to Ticket</button>
              <button class="outline" style="padding:6px 12px;font-size:12px" onclick="adminCloseTicket('${esc(t.uid)}', '${esc(t.id)}')">✓ Close Ticket</button>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  } catch (e) {
    box.innerHTML = `<div class="empty">Administrator sign in required to review customer tickets. <a href="/account.html" class="link">Sign in →</a></div>`;
  }

  window.adminReplyTicket = async (uid, id) => {
    const msg = prompt('Enter administrative response to customer:');
    if (!msg || msg.trim().length < 2) return;
    try {
      await api('/api/admin/support/' + encodeURIComponent(uid) + '/' + encodeURIComponent(id) + '/reply', 'POST', { message: msg.trim() });
      toast('Response dispatched to customer');
      initAdminSupport();
    } catch (e) { toast(e.message); }
  };

  window.adminCloseTicket = async (uid, id) => {
    try {
      await api('/api/admin/support/tickets/' + encodeURIComponent(id) + '/close?uid=' + encodeURIComponent(uid), 'POST', {});
      toast('Ticket closed');
      initAdminSupport();
    } catch (e) { toast(e.message); }
  };
}

// Admin Settings
// Admin System Settings
window.updateRatePreview = function(val) {
  const preview = document.querySelector('#credit-rate-preview');
  const n = Number(val) || 5;
  if (preview) {
    preview.textContent = `⚡ At ${n} credits/₹1: ₹10 = ${n * 10} credits · ₹100 = ${(n * 100).toLocaleString()} credits`;
  }
};

async function initAdminSettings() {
  await initSession();
  const form = document.querySelector('#pricing-form');
  const retForm = document.querySelector('#retention-form');
  const adminSettingsForm = document.querySelector('#admin-settings-form');
  const runRetBtn = document.querySelector('#run-retention-btn');

  try {
    const s = await api('/api/admin/settings');
    const creditRate = s.creditRate || 5;
    if (form && form.elements.creditRate) form.elements.creditRate.value = creditRate;
    if (adminSettingsForm) {
      if (adminSettingsForm.elements.creditRate) {
        adminSettingsForm.elements.creditRate.value = creditRate;
        window.updateRatePreview(creditRate);
      }
      if (adminSettingsForm.elements.maintenanceMode) {
        adminSettingsForm.elements.maintenanceMode.value = String(Boolean(s.maintenanceMode));
      }
    }

    if (retForm && s.retention) {
      if (retForm.elements.emailLogsDays) retForm.elements.emailLogsDays.value = s.retention.emailLogsDays || 90;
      if (retForm.elements.messageContentDays) retForm.elements.messageContentDays.value = s.retention.messageContentDays || 30;
    }
  } catch (e) { toast(e.message); }

  if (adminSettingsForm) {
    adminSettingsForm.onsubmit = async e => {
      e.preventDefault();
      const btn = adminSettingsForm.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const creditRate = Number(adminSettingsForm.elements.creditRate?.value || 5);
        const maintenanceMode = adminSettingsForm.elements.maintenanceMode?.value === 'true';
        await api('/api/admin/settings', 'POST', { creditRate, maintenanceMode });
        toast('Platform system settings saved successfully');
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    };
  }

  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      try {
        await api('/api/admin/pricing', 'POST', { creditRate: Number(form.elements.creditRate.value) });
        toast('Conversion rate updated');
      } catch (err) { toast(err.message); }
    };
  }

  if (retForm) {
    retForm.onsubmit = async e => {
      e.preventDefault();
      try {
        await api('/api/admin/settings/retention', 'POST', {
          emailLogsDays: Number(retForm.elements.emailLogsDays.value),
          messageContentDays: Number(retForm.elements.messageContentDays.value)
        });
        toast('Retention policies saved successfully');
      } catch (err) { toast(err.message); }
    };
  }

  if (runRetBtn) {
    runRetBtn.onclick = async () => {
      if (!confirm('Run data retention cleanup now? Expired transmission logs and message bodies will be purged.')) return;
      try {
        runRetBtn.disabled = true;
        const res = await api('/api/admin/retention/run', 'POST');
        toast(`Cleanup completed: ${res.purgedLogs || 0} logs purged`);
      } catch (e) { toast(e.message); }
      finally { runRetBtn.disabled = false; }
    };
  }
}

// Admin Activity Logs
let adminActivityList = [];
let adminActivityFilter = 'all';

async function initAdminActivity() {
  await initSession();
  const box = document.querySelector('#activity-list') || document.querySelector('#admin-activity-list');
  const searchInput = document.querySelector('#activity-search');
  if (!box) return;

  function renderActivity() {
    let list = adminActivityList;
    if (adminActivityFilter !== 'all') {
      list = list.filter(x => (x.action || '').toLowerCase().includes(adminActivityFilter));
    }
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (q) {
      list = list.filter(x => 
        (x.action || '').toLowerCase().includes(q) ||
        (x.adminUid || '').toLowerCase().includes(q) ||
        (x.targetUid || x.target || '').toLowerCase().includes(q) ||
        JSON.stringify(x.details || {}).toLowerCase().includes(q)
      );
    }

    if (box.classList.contains('empty')) box.classList.remove('empty');

    if (!list.length) {
      box.innerHTML = '<div class="empty"><div class="empty-icon">≡</div><strong>No administrative actions found</strong><p class="mg-muted">No activity records match criteria.</p></div>';
      return;
    }

    box.innerHTML = list.map(x => {
      const action = x.action || 'system.event';
      const timeStr = (x.createdAt || x.timestamp) ? new Date(x.createdAt || x.timestamp).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : 'Recent';
      const target = x.targetUid || x.target || 'System';
      const admin = x.adminUid || 'admin';
      
      let badgeCls = 'badge-info';
      let icon = '⚙️';
      if (action.includes('credit') || action.includes('payment')) {
        badgeCls = 'badge-success';
        icon = '⚡';
      } else if (action.includes('suspend') || action.includes('delete') || action.includes('purge')) {
        badgeCls = 'badge-error';
        icon = '🔒';
      } else if (action.includes('rate') || action.includes('limit')) {
        badgeCls = 'badge-warn';
        icon = '⏱️';
      } else if (action.includes('suppress')) {
        badgeCls = 'badge-error';
        icon = '🛡️';
      }

      return `
        <div class="admin-activity-card" id="act-${esc(x.id || '')}">
          <div class="admin-activity-head">
            <div class="admin-activity-left">
              <div class="admin-activity-icon">${icon}</div>
              <div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <strong style="font-size:14px;color:#1e1b4b">${esc(action)}</strong>
                  <span class="badge ${badgeCls}">● ${esc(action.split('.')[0] || 'audit')}</span>
                </div>
                <div style="font-size:11px;color:#64748b;margin-top:2px">
                  <span>Admin: <code style="font-size:10px;background:#f8fafc;padding:1px 4px;border-radius:3px">${esc(admin.slice(0, 12))}</code></span> · 
                  <span>Target: <b>${esc(target)}</b></span>
                </div>
              </div>
            </div>
            <span style="font-size:11px;color:#94a3b8;font-weight:600">${esc(timeStr)}</span>
          </div>
          ${x.details && Object.keys(x.details).length ? `
            <div class="admin-activity-details">
              <code style="font-size:11px;color:#475569;word-break:break-all">${esc(JSON.stringify(x.details, null, 1).replace(/[\{\}\n]/g, '').trim())}</code>
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  window.filterAdminActivity = function(filter) {
    if (filter) {
      adminActivityFilter = filter;
      document.querySelectorAll('#activity-filter-pills .filter-pill').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
      });
    }
    renderActivity();
  };

  async function load() {
    try {
      box.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><strong>Loading activity audit trail…</strong></div>';
      const d = await api('/api/admin/activity');
      adminActivityList = d.activity || d.logs || [];
      const countBadge = document.querySelector('#activity-count-badge');
      if (countBadge) countBadge.textContent = `${adminActivityList.length} events`;
      renderActivity();
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626"><strong>Error loading audit logs:</strong> ${esc(e.message)}</div>`;
    }
  }

  if (searchInput) {
    searchInput.oninput = () => renderActivity();
  }

  load();
}

// Admin API Limits
let adminTenantLimits = [];

async function initAdminApiLimits() {
  await initSession();
  const box = document.querySelector('#tenant-limits-list');
  const searchInput = document.querySelector('#limits-search');
  const overrideForm = document.querySelector('#rate-limit-override-form');
  const countBadge = document.querySelector('#custom-limits-count');
  const totalCustomStat = document.querySelector('#stat-custom-overrides');

  function renderList() {
    if (!box) return;
    const q = (searchInput?.value || '').trim().toLowerCase();
    let list = adminTenantLimits;
    if (q) {
      list = list.filter(u => 
        (u.email || '').toLowerCase().includes(q) ||
        (u.uid || '').toLowerCase().includes(q) ||
        (u.name || '').toLowerCase().includes(q)
      );
    }

    if (box.classList.contains('empty')) box.classList.remove('empty');

    if (!list.length) {
      box.innerHTML = '<div class="empty"><div class="empty-icon">⏱️</div><strong>No tenants found</strong></div>';
      return;
    }

    box.innerHTML = list.map(u => {
      const limit = u.apiRateLimit || 120;
      const isDefault = (limit === 120);
      return `
        <div class="user-card" style="padding:14px;margin-bottom:10px" id="limit-user-${esc(u.uid)}">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
            <div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <strong style="font-size:14px;color:#1e1b4b">${esc(u.email || u.uid)}</strong>
                <span class="badge ${isDefault ? 'badge-info' : 'badge-warn'}" style="font-weight:700">
                  ${isDefault ? 'Standard (120/min)' : `⚡ Override: ${limit}/min`}
                </span>
                ${u.admin ? '<span class="badge" style="background:#fce7f3;color:#db2777">👑 Admin</span>' : ''}
              </div>
              <div style="font-size:11px;color:#64748b;margin-top:3px">
                UID: <code>${esc(u.uid)}</code> · Status: <b>${esc(u.status || 'active')}</b>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="outline" style="font-size:11px;padding:4px 8px" onclick="setFastLimit('${esc(u.uid)}', 60)">60/m</button>
              <button type="button" class="outline" style="font-size:11px;padding:4px 8px" onclick="setFastLimit('${esc(u.uid)}', 120)">120/m</button>
              <button type="button" class="outline" style="font-size:11px;padding:4px 8px" onclick="setFastLimit('${esc(u.uid)}', 300)">300/m</button>
              <button type="button" class="outline" style="font-size:11px;padding:4px 8px" onclick="setFastLimit('${esc(u.uid)}', 600)">600/m</button>
              <button type="button" class="primary" style="font-size:11px;padding:4px 10px" onclick="adminSetLimit('${esc(u.uid)}')">Custom…</button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  window.setFastLimit = async (uid, limit) => {
    try {
      await api(`/api/admin/users/${encodeURIComponent(uid)}/rate-limit`, 'POST', { limit: Number(limit) });
      toast(`Rate limit set to ${limit} req/min`);
      load();
    } catch (e) { toast(e.message); }
  };

  async function load() {
    try {
      if (box) box.innerHTML = '<div class="empty"><div class="empty-icon">⏳</div><strong>Loading tenant directory…</strong></div>';
      const d = await api('/api/admin/users');
      adminTenantLimits = d.users || [];
      const overrides = adminTenantLimits.filter(u => u.apiRateLimit && u.apiRateLimit !== 120);
      if (countBadge) countBadge.textContent = `${overrides.length} custom`;
      if (totalCustomStat) totalCustomStat.textContent = overrides.length;

      // Populate select in override form
      const select = document.querySelector('#override-uid-select');
      if (select) {
        select.innerHTML = '<option value="">-- Choose Tenant --</option>' + 
          adminTenantLimits.map(u => `<option value="${esc(u.uid)}">${esc(u.email || u.uid)} (${u.apiRateLimit || 120}/min)</option>`).join('');
      }

      renderList();
    } catch (e) {
      if (box) box.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  if (searchInput) searchInput.oninput = () => renderList();

  if (overrideForm) {
    overrideForm.onsubmit = async e => {
      e.preventDefault();
      const uid = overrideForm.elements.uid?.value?.trim();
      const limit = parseInt(overrideForm.elements.limit?.value, 10);
      if (!uid || isNaN(limit) || limit < 1) {
        toast('Valid tenant and positive rate limit required');
        return;
      }
      try {
        await api(`/api/admin/users/${encodeURIComponent(uid)}/rate-limit`, 'POST', { limit });
        toast(`Rate limit updated to ${limit} req/min`);
        load();
      } catch (err) { toast(err.message); }
    };
  }

  load();
}

// Admin System Health Monitor
async function readAdminHealthSnapshot() {
  // Health is public. Read degraded (HTTP 503) JSON too, so a database failure
  // is visible instead of being replaced by a fabricated successful response.
  const response = await fetch(getApiUrl('/api/health'), { credentials: 'omit', cache: 'no-store' });
  const health = await response.json().catch(() => null);
  if (!health || typeof health !== 'object' || typeof health.status !== 'string') {
    throw new Error('The server did not return a valid health report.');
  }
  if (!response.ok && response.status !== 503) {
    throw new Error(health.message || `Health request failed (HTTP ${response.status}).`);
  }
  return { ...health, status: response.ok ? health.status : 'degraded' };
}

async function initAdminHealth() {
  try { await initSession(); } catch {}
  const box = document.querySelector('#admin-health-box') || document.querySelector('#health-box');
  if (!box) return;
  box.innerHTML = '<div class="mg-muted" role="status">Checking backend and Realtime Database…</div>';
  const [healthResult, summaryResult] = await Promise.allSettled([
    readAdminHealthSnapshot(),
    api('/api/admin/summary')
  ]);
  const h = healthResult.status === 'fulfilled' ? healthResult.value : {};
  const s = summaryResult.status === 'fulfilled' ? summaryResult.value : null;
  const database = h.database || {};
  const authentication = h.authentication || {};
  const ready = state => state === 'ready' || state === 'connected';
  const badge = (state, healthy) => `<span class="badge" style="${healthy ? 'background:#dcfce7;color:#15803d' : 'background:#fef3c7;color:#92400e'}">● ${esc(String(state || 'unavailable').toUpperCase())}</span>`;
  const databaseReady = ready(database.state);
  const healthError = healthResult.status === 'rejected' ? healthResult.reason?.message || 'The health endpoint could not be reached.' : '';
  const databaseReason = database.reason || (healthError ? 'Database status could not be checked.' : (databaseReady ? '' : 'The backend has not confirmed a database connection.'));
  const count = value => Number.isFinite(value) ? value.toLocaleString() : 'Unavailable';
  box.innerHTML = `
      <div style="display:grid;gap:12px;font-size:13px">
        <div class="mg-row"><span>Server Status</span>${badge(h.status, h.status === 'ok')}</div>
        <div class="mg-row"><span>Firebase Realtime Database</span>${badge(database.state, databaseReady)}</div>
        <div class="mg-row"><span>Database Configuration</span><strong>${database.configured === true ? 'Configured' : (database.configured === false ? 'Incomplete' : 'Unknown')}</strong></div>
        ${database.checkedAt ? `<div class="mg-row"><span>Last Database Check</span><strong>${esc(new Date(database.checkedAt).toLocaleString())}</strong></div>` : ''}
        ${databaseReason ? `<div class="mg-muted" role="status"><strong>Database:</strong> ${esc(databaseReason)}</div>` : ''}
        <div class="mg-row"><span>Firebase Authentication</span>${badge(authentication.state, ready(authentication.state))}</div>
        ${authentication.reason ? `<div class="mg-muted"><strong>Authentication:</strong> ${esc(authentication.reason)}</div>` : ''}
        <div class="mg-row"><span>Email Sending</span>${badge(h.sending, h.sending === 'active')}</div>
        <div class="mg-row"><span>Dead-letter Queue Jobs</span><strong>${count(s?.queueHealth?.dlqCount)}</strong></div>
        <div class="mg-row"><span>Payment Gateway Status</span><strong>${esc(h.zetpay || h.payments || 'Unavailable')}</strong></div>
        <div class="mg-row"><span>Registered Users</span><strong>${count(s?.users)}</strong></div>
        <div class="mg-row"><span>Configured Senders</span><strong>${count(s?.senders)}</strong></div>
        ${!databaseReady ? '<div class="panel" style="background:#fffbeb;border-color:#fcd34d"><strong>Connect Realtime Database</strong><p>Configure FIREBASE_PROJECT_ID and FIREBASE_DATABASE_URL on the backend, and provide a Firebase Admin service account through GOOGLE_APPLICATION_CREDENTIALS. The account must have permission to access this database. Restart the backend after updating its configuration, then check again.</p></div>' : ''}
        ${healthError ? `<div role="alert" style="color:#b91c1c">Health check failed: ${esc(healthError)}</div>` : ''}
        ${summaryResult.status === 'rejected' ? `<div class="mg-muted">Admin metrics are unavailable: ${esc(summaryResult.reason?.message || 'Sign in as an administrator to view metrics.')}</div>` : ''}
        <button type="button" class="outline" onclick="initAdminHealth()">Check again</button>
      </div>
    `;
}

// Admin Revenue Overview
async function initAdminRevenue() {
  await initSession();
  const box = document.querySelector('#admin-revenue-box') || document.querySelector('.panel .empty') || document.querySelector('.panel');
  try {
    const s = await api('/api/admin/summary');
    const el = document.querySelector('#admin-revenue-box') || document.querySelector('.panel');
    if (!el) return;
    const captured = (s.capturedPaise || 0) / 100;
    const refunded = (s.refundedPaise || 0) / 100;
    const net = captured - refunded;
    el.innerHTML = `
      <h2>Financial Inflow & Settlements</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:16px 0">
        <div class="stat" style="--accent:#28b99a;--pale:#e6f8f3">
          <div class="stat-head"><span class="stat-label">Gross Captured</span></div>
          <div class="stat-value">₹${captured.toFixed(2)}</div>
          <div class="stat-note">Total verified UPI payments</div>
        </div>
        <div class="stat" style="--accent:#f07e85;--pale:#fff0f1">
          <div class="stat-head"><span class="stat-label">Total Refunded</span></div>
          <div class="stat-value">₹${refunded.toFixed(2)}</div>
          <div class="stat-note">Settled chargebacks/refunds</div>
        </div>
        <div class="stat" style="--accent:#805bea;--pale:#f0ebff">
          <div class="stat-head"><span class="stat-label">Net Inflow</span></div>
          <div class="stat-value">₹${net.toFixed(2)}</div>
          <div class="stat-note">Realized platform revenue</div>
        </div>
        <div class="stat" style="--accent:#e2a840;--pale:#fff7e6">
          <div class="stat-head"><span class="stat-label">Purchased Credits</span></div>
          <div class="stat-value">${(s.creditsPurchased || 0).toLocaleString()}</div>
          <div class="stat-note">Purchased by tenants</div>
        </div>
      </div>
    `;
  } catch (e) {
    if (box) box.innerHTML = `<div class="empty">Administrator sign in required to view revenue data. <a href="/account.html" class="link">Sign in →</a></div>`;
  }
}

// Admin Platform Analytics
async function initAdminAnalytics() {
  await initSession();
  const box = document.querySelector('#admin-analytics-box') || document.querySelector('.panel');
  try {
    const s = await api('/api/admin/summary');
    if (!box) return;
    box.innerHTML = `
      <h2>Cross-Tenant Analytics & Throughput</h2>
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin:16px 0">
        <div class="stat" style="--accent:#805bea;--pale:#f0ebff">
          <div class="stat-head"><span class="stat-label">Total Registered Tenants</span></div>
          <div class="stat-value">${s.users || 0}</div>
          <div class="stat-note">Active Firebase accounts</div>
        </div>
        <div class="stat" style="--accent:#28b99a;--pale:#e6f8f3">
          <div class="stat-head"><span class="stat-label">Accepted Email Sends</span></div>
          <div class="stat-value">${s.totalAccepted || 0}</div>
          <div class="stat-note">Successful provider relays</div>
        </div>
        <div class="stat" style="--accent:#f07e85;--pale:#fff0f1">
          <div class="stat-head"><span class="stat-label">Failed Requests</span></div>
          <div class="stat-value">${s.totalFailed || 0}</div>
          <div class="stat-note">SMTP rejects or invalid requests</div>
        </div>
        <div class="stat" style="--accent:#4d90ea;--pale:#eaf3ff">
          <div class="stat-head"><span class="stat-label">Credits Consumed</span></div>
          <div class="stat-value">${(s.creditsConsumed || 0).toLocaleString()}</div>
          <div class="stat-note">Total email credits burnt</div>
        </div>
      </div>
    `;
  } catch (e) {
    if (box) box.innerHTML = `<div class="empty">Administrator sign in required to view cross-tenant analytics. <a href="/account.html" class="link">Sign in →</a></div>`;
  }
}

// Admin Database Metrics
async function initAdminDbMetrics() {
  await initSession();
  const box = document.querySelector('#admin-db-metrics') || document.querySelector('.panel .empty') || document.querySelector('.panel');
  try {
    const s = await api('/api/admin/summary');
    const el = document.querySelector('.panel');
    if (!el) return;
    el.innerHTML = `
      <h2>Firebase Realtime Database Telemetry</h2>
      <div style="display:grid;gap:12px;font-size:13px;margin-top:14px">
        <div class="mg-row"><span>Project ID</span><strong>to-375ee</strong></div>
        <div class="mg-row"><span>Database Host</span><strong>to-375ee-default-rtdb.firebaseio.com</strong></div>
        <div class="mg-row"><span>Database Node: users</span><strong>${s.users || 0} records</strong></div>
        <div class="mg-row"><span>Database Node: wallets</span><strong>${s.users || 0} records</strong></div>
        <div class="mg-row"><span>Database Node: sender_accounts</span><strong>${s.senders || 0} records</strong></div>
        <div class="mg-row"><span>Synchronization Mode</span><span class="badge" style="background:#dcfce7;color:#15803d">● Live Realtime Stream (SSE / REST)</span></div>
      </div>
    `;
  } catch (e) {
    if (box) box.innerHTML = `<div class="empty">Administrator sign in required to view database telemetry. <a href="/account.html" class="link">Sign in →</a></div>`;
  }
}

// Admin User Details Drawer & Deep Inspector
async function initAdminUserDetails() {
  await initSession();
  const form = document.querySelector('#inspect-user-form');
  const input = document.querySelector('#inspect-uid');
  const output = document.querySelector('#user-details-output');
  const quickSelector = document.querySelector('#tenant-quick-chips');
  if (!output) return;

  async function loadTenantsList() {
    try {
      const d = await api('/api/admin/users');
      const users = d.users || [];
      if (quickSelector && users.length) {
        quickSelector.innerHTML = `
          <div style="font-size:12px;font-weight:600;color:#6b7280;margin-bottom:6px">Quick Tenant Selector (click to inspect):</div>
          <div class="filter-pills" style="margin:0">
            ${users.slice(0, 20).map(u => `
              <button type="button" class="filter-pill" onclick="inspectTenant('${esc(u.uid)}')">
                ${esc(u.email || u.uid)}
              </button>
            `).join('')}
          </div>
        `;
      }
    } catch (e) {
      console.warn('Failed to load tenants list', e);
    }
  }

  window.inspectTenant = uid => {
    if (input) input.value = uid;
    inspectUser(uid);
  };

  window.adminQuickGrant = async (uid, amount) => {
    try {
      const operationId = 'adj_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
      await api('/api/admin/credits/adjust', 'POST', {
        uid,
        amount,
        reason: 'Admin 1-click credit grant +' + amount,
        operationId
      });
      toast('+' + amount + ' credits successfully granted to ' + uid);
      inspectUser(uid);
    } catch (e) { toast(e.message); }
  };

  async function inspectUser(query) {
    if (!query) return;
    output.innerHTML = '<div class="panel">Searching and inspecting tenant account in Firebase…</div>';
    try {
      const uRes = await api('/api/admin/users?' + new URLSearchParams({ search: query }));
      const user = uRes.users?.find(u => u.uid === query || u.email?.toLowerCase() === query.toLowerCase()) || uRes.users?.[0];
      if (!user) {
        output.innerHTML = `<div class="empty">No user account found matching "${esc(query)}".</div>`;
        return;
      }
      const w = await api('/api/admin/wallets/' + encodeURIComponent(user.uid)).catch(() => ({}));
      const isAdmin = Boolean(user.admin);
      const isActive = user.status === 'active';
      const initials = (user.name ? user.name.slice(0, 2) : user.email ? user.email.slice(0, 2) : 'U').toUpperCase();
      const ledger = w.ledger || Object.entries(w.wallet?.ledger || {}).map(([id, item]) => ({ id, ...item }));

      output.innerHTML = `
        <div style="display:grid;gap:16px">
          <div class="user-card" style="margin-bottom:0">
            <div class="user-card-header">
              <div class="user-avatar-circle ${isAdmin ? 'user-avatar-admin' : ''}">${esc(initials)}</div>
              <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <strong style="font-size:16px;word-break:break-all">${esc(user.email || user.uid)}</strong>
                  ${user.name ? `<span class="mg-muted" style="font-size:13px">(${esc(user.name)})</span>` : ''}
                  <span class="badge" style="${isAdmin ? 'background:#fce7f3;color:#db2777' : 'background:#f3f4f6;color:#4b5563'}">${isAdmin ? '👑 Super Admin' : 'Tenant'}</span>
                  <span class="badge" style="${isActive ? 'background:#dcfce7;color:#15803d' : 'background:#fee2e2;color:#dc2626'}">● ${isActive ? 'Active' : 'Suspended'}</span>
                </div>
                <div style="margin-top:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:11px;color:#6b7280">
                  <span>UID: <code>${esc(user.uid)}</code></span>
                  <button type="button" class="copy-chip" onclick="copyUid('${esc(user.uid)}', this)">📋 Copy</button>
                  <span>· Created: ${user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Active'}</span>
                </div>
              </div>
            </div>

            <div class="user-meta-chips" style="margin-top:14px">
              <div class="meta-chip">
                <span>Wallet Balance</span>
                <strong style="color:#6342dc;font-size:16px">${Number(w.balance || user.balance || 0).toLocaleString()} credits</strong>
              </div>
              <div class="meta-chip">
                <span>Credits Consumed</span>
                <strong style="font-size:16px">${Number(w.consumed || user.consumed || 0).toLocaleString()}</strong>
              </div>
              <div class="meta-chip">
                <span>Credits Purchased</span>
                <strong style="font-size:16px">${Number(w.purchased || 0).toLocaleString()}</strong>
              </div>
              <div class="meta-chip">
                <span>API Rate Limit</span>
                <strong style="font-size:16px">${user.apiRateLimit || 120}/min</strong>
              </div>
            </div>

            <div style="background:#f4f3fa;border-radius:8px;padding:10px 14px;margin-top:10px">
              <div style="font-size:12px;font-weight:600;color:#555;margin-bottom:6px">⚡ 1-Click Quick Credit Grant:</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="outline" style="padding:4px 12px;font-size:12px;font-weight:700" onclick="adminQuickGrant('${esc(user.uid)}', 100)">+100</button>
                <button type="button" class="outline" style="padding:4px 12px;font-size:12px;font-weight:700" onclick="adminQuickGrant('${esc(user.uid)}', 500)">+500</button>
                <button type="button" class="outline" style="padding:4px 12px;font-size:12px;font-weight:700" onclick="adminQuickGrant('${esc(user.uid)}', 1000)">+1,000</button>
                <button type="button" class="outline" style="padding:4px 12px;font-size:12px;font-weight:700" onclick="adminQuickGrant('${esc(user.uid)}', 5000)">+5,000</button>
              </div>
            </div>

            <div class="user-action-grid" style="margin-top:12px">
              <button class="outline" onclick="adminAdjustCreditsPrompt('${esc(user.uid)}')">⚡ Adjust Credits</button>
              <button class="outline" onclick="adminSetLimit('${esc(user.uid)}')">⏱ Set Limit</button>
              <button class="outline" onclick="adminToggleRole('${esc(user.uid)}', ${isAdmin})">${isAdmin ? 'Demote to Tenant' : '👑 Make Super Admin'}</button>
              <button class="outline" onclick="adminToggleStatus('${esc(user.uid)}', '${isActive ? 'suspended' : 'active'}')">${isActive ? '🔒 Suspend Account' : '✓ Activate Account'}</button>
              <button class="outline" style="color:#d9534f;border-color:#f5c6cb" onclick="adminPurgeUser('${esc(user.uid)}')">🗑 GDPR Wipe</button>
            </div>
          </div>

          <div>
            <h3 style="margin:16px 0 8px;font-size:15px">Tenant Double-Entry Ledger Transactions</h3>
            ${Array.isArray(ledger) && ledger.length ? `
              <div style="border:1px solid #eeedf5;border-radius:8px;background:white;max-height:350px;overflow:auto">
                ${ledger.map(i => `
                  <div style="display:flex;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #f3f2f8;font-size:12px">
                    <div>
                      <strong style="color:#2e2a4a">${esc(i.type || 'TRANSACTION')}</strong> · <span class="mg-muted">${new Date(i.createdAt || Date.now()).toLocaleString()}</span>
                      <div class="mg-muted" style="margin-top:2px">Ref: ${esc(i.orderId || i.reference || i.reason || 'N/A')}</div>
                    </div>
                    <b style="font-size:13px;white-space:nowrap;color:${(i.credits || 0) >= 0 ? '#15803d' : '#dc2626'}">
                      ${(i.credits || 0) > 0 ? '+' : ''}${i.credits || 0} credits
                    </b>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="empty">No financial ledger transactions recorded for this tenant.</div>'}
          </div>
        </div>
      `;
    } catch (e) {
      output.innerHTML = `<div class="panel" style="color:#dc2626">Inspection error: ${esc(e.message)}</div>`;
    }
  }

  if (form) {
    form.onsubmit = e => {
      e.preventDefault();
      inspectUser(input.value.trim());
    };
  }

  loadTenantsList();

  const urlUid = new URLSearchParams(window.location.search).get('uid');
  if (urlUid) {
    if (input) input.value = urlUid;
    inspectUser(urlUid);
  }
}

// Admin Announcements
async function initAdminAnnouncements() {
  await initSession();
  const box = document.querySelector('#admin-announcements-list');
  const form = document.querySelector('#announcement-form');

  async function load() {
    if (!box) return;
    try {
      box.innerHTML = '<div class="panel">Loading platform announcements…</div>';
      const d = await api('/api/admin/announcements');
      const items = d.announcements || [];
      if (!items.length) {
        box.innerHTML = '<div class="empty">No global announcements currently broadcast. Create one above to notify all users.</div>';
        return;
      }
      box.innerHTML = items.map(a => `
        <div style="border:1px solid #eeedf5;border-radius:10px;padding:14px;background:white;margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
            <div>
              <div style="display:flex;align-items:center;gap:8px">
                <strong style="font-size:14px">${esc(a.title)}</strong>
                <span class="badge" style="${a.type === 'critical' ? 'background:#fee2e2;color:#dc2626' : a.type === 'warning' ? 'background:#fef3c7;color:#b45309' : 'background:#ede9fe;color:#6342dc'}">${esc(a.type.toUpperCase())}</span>
              </div>
              <p style="margin:8px 0;font-size:13px;color:#4b5563">${esc(a.message)}</p>
              <div class="mg-muted" style="font-size:11px">Posted by: ${esc(a.author)} · ${new Date(a.createdAt).toLocaleString()}</div>
            </div>
            <button class="outline" style="color:#d9534f;border-color:#f5c6cb;padding:4px 10px;font-size:11px" onclick="adminDeleteAnnouncement('${esc(a.id)}')">🗑 Delete</button>
          </div>
        </div>
      `).join('');
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  window.adminDeleteAnnouncement = async id => {
    if (!confirm('Remove this global announcement broadcast?')) return;
    try {
      await api('/api/admin/announcements/' + encodeURIComponent(id), 'DELETE');
      toast('Announcement deleted');
      load();
    } catch (e) { toast(e.message); }
  };

  if (form) {
    form.onsubmit = async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type=submit]');
      btn.disabled = true;
      try {
        const title = form.elements.title.value.trim();
        const message = form.elements.message.value.trim();
        const type = form.elements.type.value;
        await api('/api/admin/announcements', 'POST', { title, message, type });
        toast('Announcement broadcast active!');
        form.reset();
        load();
      } catch (err) { toast(err.message); }
      finally { btn.disabled = false; }
    };
  }

  load();
}

// Admin Backups & Disaster Recovery
async function initAdminBackups() {
  await initSession();
  const box = document.querySelector('#admin-backups-list');

  async function load() {
    if (!box) return;
    try {
      box.innerHTML = '<div class="panel">Loading backup snapshots…</div>';
      const d = await api('/api/admin/backups');
      const items = d.backups || [];
      if (!items.length) {
        box.innerHTML = '<div class="empty">No point-in-time snapshots created yet. Click "Create Snapshot Backup" above to generate one.</div>';
        return;
      }
      box.innerHTML = items.map(b => `
        <div style="border:1px solid #eeedf5;border-radius:10px;padding:12px 14px;background:white;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
          <div>
            <strong>${esc(b.id)}</strong>
            <div class="mg-muted" style="font-size:11px;margin-top:2px">Created: ${new Date(b.createdAt).toLocaleString()} · Records: ${b.userCount || 0} users, ${b.senderCount || 0} senders · Size: ${(b.sizeBytes / 1024).toFixed(1)} KB</div>
            <code style="font-size:10px;color:#6b7280">SHA-256: ${esc(b.sha256?.slice(0, 24))}…</code>
          </div>
          <span class="badge" style="background:#dcfce7;color:#15803d">● Verified Snapshot</span>
        </div>
      `).join('');
    } catch (e) {
      box.innerHTML = `<div class="panel" style="color:#dc2626">${esc(e.message)}</div>`;
    }
  }

  window.adminCreateBackup = async () => {
    toast('Generating point-in-time snapshot with SHA-256 verification…');
    try {
      const res = await api('/api/admin/backups', 'POST', {});
      toast('Backup snapshot ' + res.backup?.id + ' successfully created!');
      load();
    } catch (e) { toast(e.message); }
  };

  window.adminRunRetention = async () => {
    if (!confirm('Run data retention cleanup now? Expired email logs and closed support tickets will be purged according to retention policy.')) return;
    toast('Running data retention cleanup…');
    try {
      const res = await api('/api/admin/retention/run', 'POST', {});
      toast('Cleanup complete: ' + JSON.stringify(res.result || {}));
    } catch (e) { toast(e.message); }
  };

  load();
}

// Export All Admin Functions to Window
window.initAdminUsers = initAdminUsers;
window.initAdminUserDetails = initAdminUserDetails;
window.initAdminSenders = initAdminSenders;
window.initAdminMonitoring = initAdminMonitoring;
window.initAdminEmailLogs = initAdminEmailLogs;
window.initAdminKeys = initAdminKeys;
window.initAdminCredits = initAdminCredits;
window.initAdminPayments = initAdminPayments;
window.initAdminRefunds = initAdminRefunds;
window.initAdminDisputes = initAdminDisputes;
window.initAdminReconciliation = initAdminReconciliation;
window.initAdminQueue = initAdminQueue;
window.initAdminAbuse = initAdminAbuse;
window.initAdminSupport = initAdminSupport;
window.initAdminAnnouncements = initAdminAnnouncements;
window.initAdminBackups = initAdminBackups;
window.initAdminSettings = initAdminSettings;
window.initAdminActivity = initAdminActivity;
window.initAdminApiLimits = initAdminApiLimits;
window.initAdminHealth = initAdminHealth;
window.initAdminRevenue = initAdminRevenue;
window.initAdminAnalytics = initAdminAnalytics;
window.initAdminDbMetrics = initAdminDbMetrics;
