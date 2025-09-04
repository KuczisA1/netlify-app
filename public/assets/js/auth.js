// @ts-nocheck
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hasIdentity = () => typeof window !== 'undefined' && !!window.netlifyIdentity;

  // ————— helpers: nf_jwt cookie —————
  function setJwtCookie(token) {
    // cookie dostępne w całej domenie, sesyjne
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

    // odśwież użytkownika i token (naprawia gubienie e-maila po powrocie)
    user = await refreshUser(user);

    // ustaw odświeżone ciasteczko nf_jwt (ważne dla redirectów Netlify)
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

  function onReady() {
    if (!hasIdentity()) return;

    // jawne init – pomaga gdy widget ładuje się wolniej
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

    // Zdarzenia Identity
    window.netlifyIdentity.on('init', async (user) => {
      // po każdym wejściu na stronę uzupełnij cookie nf_jwt i UI
      if (user) {
        try { setJwtCookie(await user.jwt()); } catch {}
      } else {
        clearJwtCookie();
      }
      if (location.pathname.endsWith('/dashboard.html')) {
        try { await ensureLoggedIn(); await paintUser(); } catch { window.netlifyIdentity.open('login'); }
      }
    });

    window.netlifyIdentity.on('login', async (user) => {
      try { setJwtCookie(await user.jwt()); } catch {}
      // po zalogowaniu przejdź na dashboard (gdzie UI odświeży się samo)
      window.location.href = '/dashboard.html';
    });

    window.netlifyIdentity.on('logout', () => {
      clearJwtCookie();
      window.location.href = '/';
    });

    // Jeśli Identity zdążył się zainicjalizować wcześniej:
    if (location.pathname.endsWith('/dashboard.html')) {
      ensureLoggedIn().then(paintUser).catch(() => window.netlifyIdentity.open('login'));
    }
  }

  document.addEventListener('DOMContentLoaded', onReady);
})();
