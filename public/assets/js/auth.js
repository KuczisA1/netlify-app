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
    if (!Array.isArray(roles)) return 'pending';
    if (roles.includes('active') || roles.includes('admin')) return 'active';
    if (roles.includes('pending')) return 'pending';
    return 'pending';
  }

  async function ensureLoggedIn() {
    if (!hasIdentity()) throw new Error('identity-not-loaded');
    const user = window.netlifyIdentity.currentUser();
    if (user) return user;
    throw new Error('no-user');
  }

  async function refreshUser(user) {
    try { await user.jwt(true); } catch {}
    return window.netlifyIdentity.currentUser() || user;
  }

  function updateNavForStatus(status) {
    const membersLink = $('members-link');
    if (!membersLink) return;
    // Members tylko dla active/admin
    membersLink.style.display = (status === 'active') ? '' : 'none';
  }

  async function updateDashboard() {
    if (!hasIdentity()) return;

    let user = window.netlifyIdentity.currentUser();
    if (!user) return;

    user = await refreshUser(user);

    const emailEl = $('user-email');
    const statusEl = $('user-status');
    const hintEl = $('status-hint');

    if (emailEl) emailEl.textContent = user.email || '—';

    const roles = (user.app_metadata && user.app_metadata.roles) || [];
    const status = statusFromRoles(roles);

    if (statusEl) statusEl.textContent = status;
    updateNavForStatus(status);

    if (hintEl) {
      if (status === 'active') {
        hintEl.textContent = 'Masz aktywną rolę. Dostęp do strefy Members jest włączony.';
      } else {
        hintEl.textContent = 'Status pending – poproś administratora o aktywację konta.';
      }
    }
  }

  function onReady() {
    const loginBtn = $('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); openLogin(); });

    const logoutLink = $('logout-link');
    if (logoutLink) logoutLink.addEventListener('click', (e) => { e.preventDefault(); logout(); });

    if (!hasIdentity()) return;

    // Po zalogowaniu przejdź do dashboardu
    window.netlifyIdentity.on('login', () => {
      window.location.href = '/dashboard.html';
    });

    // Po wylogowaniu wróć na start
    window.netlifyIdentity.on('logout', () => {
      window.location.href = '/';
    });

    // Jeśli jesteśmy na dashboardzie – wymuś login i pokaż dane
    if (location.pathname.endsWith('/dashboard.html')) {
      ensureLoggedIn().then(updateDashboard).catch(openLogin);
    }
  }

  document.addEventListener('DOMContentLoaded', onReady);
})();
