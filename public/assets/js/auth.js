// @ts-nocheck
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hasIdentity = () => typeof window !== 'undefined' && !!window.netlifyIdentity;

  function openLogin() {
    if (hasIdentity()) window.netlifyIdentity.open('login');
  }

  function logout() {
    if (hasIdentity()) window.netlifyIdentity.logout();
  }

  function statusFromRoles(roles) {
    return Array.isArray(roles) && roles.includes('active') ? 'active' : 'pending';
  }

  async function ensureLoggedIn() {
    if (!hasIdentity()) throw new Error('identity-not-loaded');
    const user = window.netlifyIdentity.currentUser();
    if (user) return user;
    throw new Error('no-user');
  }

  async function refreshUser(user) {
    try { await user.jwt(true); } catch (_) {}
    return window.netlifyIdentity.currentUser() || user;
  }

  async function updateDashboard() {
    if (!hasIdentity()) return;

    let user = window.netlifyIdentity.currentUser();
    if (!user) return;

    user = await refreshUser(user);

    const emailEl = $('user-email');
    const statusEl = $('user-status');
    const hintEl = $('status-hint');
    const membersCta = $('members-cta');

    if (emailEl) emailEl.textContent = user.email || '—';

    const roles = (user.app_metadata && user.app_metadata.roles) || [];
    const status = statusFromRoles(roles);
    if (statusEl) statusEl.textContent = status;

    if (status === 'active') {
      if (hintEl) hintEl.innerHTML = 'Masz aktywną subskrypcję. Wejdź do <a href="/members/">Members</a>.';
      if (membersCta) membersCta.style.display = 'block';
      const pay = $('payments');
      if (pay) pay.style.display = 'none';
    } else {
      if (hintEl) hintEl.textContent = 'Status pending – wykup plan, aby uzyskać dostęp.';
    }
  }

  function onReady() {
    const loginBtn = $('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); openLogin(); });

    const logoutLink = $('logout-link');
    if (logoutLink) logoutLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    if (!hasIdentity()) return;

    window.netlifyIdentity.on('login', () => {
      window.location.href = '/dashboard.html';
    });

    window.netlifyIdentity.on('logout', () => {
      window.location.href = '/';
    });

    if (location.pathname.endsWith('/dashboard.html')) {
      ensureLoggedIn().then(updateDashboard).catch(openLogin);
    }
  }

  document.addEventListener('DOMContentLoaded', onReady);
})();
