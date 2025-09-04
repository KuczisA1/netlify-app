// @ts-nocheck
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hasIdentity = () => typeof window !== 'undefined' && !!window.netlifyIdentity;

  let bootstrapped = false;
  let painting = false;

  // ----- nf_jwt cookie -----
  function setJwtCookie(token) {
    if (!token) return;
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

  function updateAuthLinks(user) {
    // Pokaż „Dashboard” na stronie startowej tylko, gdy user jest zalogowany
    const dashboardLink = $('dashboard-link');
    if (dashboardLink) dashboardLink.style.display = user ? '' : 'none';
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
    if (painting) return;
    painting = true;
    try {
      if (!hasIdentity()) return;
      let user = window.netlifyIdentity.currentUser();
      updateAuthLinks(user); // pokaż/ukryj Dashboard na index.html

      if (!user) return;

      // świeży user + token
      user = await refreshUser(user);
      try { setJwtCookie(await user.jwt()); } catch {}

      // po odświeżeniu aktualizujemy też link na index
      updateAuthLinks(user);

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
    } finally {
      painting = false;
    }
  }

  async function guardAndPaintDashboard() {
    if (!hasIdentity()) return;
    if (!location.pathname.endsWith('/dashboard.html')) return;

    try {
      await ensureLoggedIn();   // jeśli nie — wyjątek
      await paintUser();        // zawsze malujemy po wejściu/po F5/po powrocie
    } catch {
      try { window.netlifyIdentity.open('login'); } catch {}
    }
  }

  function bootstrap() {
    if (bootstrapped || !hasIdentity()) return;
    bootstrapped = true;

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

    // Lifecycle Identity
    window.netlifyIdentity.on('init', async (user) => {
      updateAuthLinks(user);
      if (user) {
        try { setJwtCookie(await user.jwt()); } catch {}
      } else {
        clearJwtCookie();
      }
      await guardAndPaintDashboard();
    });

    window.netlifyIdentity.on('login', async (user) => {
      updateAuthLinks(user);
      try { setJwtCookie(await user.jwt()); } catch {}
      window.location.href = '/dashboard.html';
    });

    window.netlifyIdentity.on('logout', () => {
      updateAuthLinks(null);
      clearJwtCookie();
      window.location.href = '/';
    });

    // Obsługa „powrotu” i zmian widoczności
    window.addEventListener('pageshow', async () => {
      // po powrocie z /members/ lub po BFCache
      await guardAndPaintDashboard();
      // zaktualizuj link na index
      updateAuthLinks(window.netlifyIdentity.currentUser());
    });

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        await guardAndPaintDashboard();
        updateAuthLinks(window.netlifyIdentity.currentUser());
      }
    });

    // gdy w innej karcie nastąpi login/logout
    window.addEventListener('storage', async (e) => {
      if (e.key && e.key.includes('gotrue.user')) {
        updateAuthLinks(window.netlifyIdentity.currentUser());
        await guardAndPaintDashboard();
      }
    });
  }

  // Start
  document.addEventListener('DOMContentLoaded', async () => {
    if (!hasIdentity()) return;
    bootstrap();
    // pierwsze wejście
    updateAuthLinks(window.netlifyIdentity.currentUser());
    await guardAndPaintDashboard();
  });
})();
