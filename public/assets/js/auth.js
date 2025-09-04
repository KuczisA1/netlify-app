// @ts-nocheck
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hasIdentity = () => typeof window !== 'undefined' && !!window.netlifyIdentity;

  // ————— nf_jwt cookie —————
  function setJwtCookie(token) {
    document.cookie = `nf_jwt=${token}; Path=/; Secure; SameSite=Lax`;
  }
  function clearJwtCookie() {
    document.cookie = 'nf_jwt=; Path=/; Max-Age=0; Secure; SameSite=Lax';
  }

  function statusFromRoles(roles) {
    if (!Array.isArray(roles)) return 'pending';
    if (roles.includes('admin') || roles.includes('active')) return 'active';
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
    if (membersLink) membersLink.style.display = (status === 'active') ? '' : 'none';
  }

  async function paintUser() {
    if (!hasIdentity()) return;
    let user = window.netlifyIdentity.currentUser();
    if (!user) return;

    // świeży user + token
    user = await refreshUser(user);
    try {
      const freshToken = await user.jwt();
      if (freshToken) setJwtCookie(freshToken);
    } catch {}

    const emailEl = $('user-email');
    const statusEl = $('user-status');
    const hintEl = $('status-hint');

    if (emailEl) emailEl.textContent = user.email || '—';

    const roles = (user.app_metadata && user.app_metadata.roles) || [];
    const status = statusFromRoles(roles);

    if (statusEl) statusEl.textContent = status;
    updateNavForStatus(status);

    if (hintEl) {
      hintEl.textContent = (status === 'active')
        ? 'Masz aktywną rolę. Dostęp do strefy Members jest włączony.'
        : 'Status pending – poproś administratora o aktywację konta.';
    }
  }

  // Client-side strażnik: bez logowania nie wejdzie na dashboard,
  // a na members bez roliactive/admin też go cofniemy (belt & suspenders).
  async function clientGuards() {
    if (!hasIdentity()) return;
    const path = location.pathname;

    // poczekaj aż identity się zainicjalizuje
    await new Promise((res) => setTimeout(res, 0));

    const user = window.netlifyIdentity.currentUser();

    // DASHBOARD: wymuś logowanie
    if (path.endsWith('/dashboard.html')) {
      if (!user) {
        window.netlifyIdentity.open('login');
        return;
      }
    }

    // MEMBERS: dodatkowa klientowa weryfikacja (serwer już blokuje)
    if (path.startsWith('/members')) {
      if (!user) { location.replace('/unauthorized.html'); return; }
      const roles = (user.app_metadata && user.app_metadata.roles) || [];
      const status = statusFromRoles(roles);
      if (status !== 'active') { location.replace('/unauthorized.html'); return; }
    }
  }

  function onReady() {
    if (!hasIdentity()) return;

    try { window.netlifyIdentity.init(); } catch {}

    const loginBtn = $('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.netlifyIdentity.open('login');
    });

    const logoutLink = $('logout-link');
    if (logoutLink) logoutLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.netlifyIdentity.logout();
    });

    // Identity lifecycle
    window.netlifyIdentity.on('init', async (user) => {
      if (user) {
        try { setJwtCookie(await user.jwt()); } catch {}
      } else {
        clearJwtCookie();
      }

      await clientGuards();

      if (location.pathname.endsWith('/dashboard.html') && user) {
        await paintUser();
      }
    });

    window.netlifyIdentity.on('login', async (user) => {
      try { setJwtCookie(await user.jwt()); } catch {}
      window.location.href = '/dashboard.html';
    });

    window.netlifyIdentity.on('logout', () => {
      clearJwtCookie();
      window.location.href = '/';
    });

    // Jeśli init już się wydarzył
    clientGuards().then(() => {
      if (location.pathname.endsWith('/dashboard.html')) {
        ensureLoggedIn().then(paintUser).catch(() => window.netlifyIdentity.open('login'));
      }
    });
  }

  document.addEventListener('DOMContentLoaded', onReady);
})();
