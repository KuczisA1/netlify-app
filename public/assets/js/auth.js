// @ts-nocheck
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hasIdentity = () => typeof window !== 'undefined' && !!window.netlifyIdentity;
  let bootstrapped = false;

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

  // Czeka na dostępność widgetu i event 'init'
  function waitForIdentityInit(timeoutMs = 4000) {
    return new Promise((resolve) => {
      if (!hasIdentity()) return resolve(null);

      let resolved = false;
      const done = (u) => { if (!resolved) { resolved = true; resolve(u ?? window.netlifyIdentity.currentUser()); } };

      // Jeśli ktoś już zainicjował wcześniej
      try {
        const u = window.netlifyIdentity.currentUser();
        // Podłącz listener zanim wywołamy init — żeby nie przegapić eventu
        window.netlifyIdentity.on('init', done);
        // Wywołujemy init zawsze — bezpieczne wielokrotne wywołanie
        window.netlifyIdentity.init();
        if (u !== undefined) {
          // Jeśli currentUser już jest zdefiniowany (null albo user), zaczekaj na 'init', ale daj fallback
          setTimeout(() => done(u), 50);
        }
      } catch {
        // w razie czego i tak spróbujemy po init
        try { window.netlifyIdentity.on('init', done); window.netlifyIdentity.init(); } catch {}
      }

      setTimeout(() => done(window.netlifyIdentity.currentUser?.()), timeoutMs);
    });
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

    // świeży user i token
    user = await refreshUser(user);
    try { setJwtCookie(await user.jwt()); } catch {}

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

  async function clientGuards() {
    if (!hasIdentity()) return;
    const path = location.pathname;

    const user = window.netlifyIdentity.currentUser();

    // DASHBOARD: nie wpuszczaj niezalogowanego (dodatkowa bariera na kliencie)
    if (path.endsWith('/dashboard.html')) {
      if (!user) {
        window.netlifyIdentity.open('login');
        return false;
      }
    }

    // MEMBERS: jeśli jakimś cudem trafi niezalogowany/bez roli
    if (path.startsWith('/members')) {
      if (!user) { location.replace('/unauthorized.html'); return false; }
      const roles = (user.app_metadata && user.app_metadata.roles) || [];
      const status = statusFromRoles(roles);
      if (status !== 'active') { location.replace('/unauthorized.html'); return false; }
    }

    return true;
  }

  function bootstrap() {
    if (bootstrapped || !hasIdentity()) return;
    bootstrapped = true;

    const loginBtn = $('login-btn');
    if (loginBtn) loginBtn.addEventListener('click', (e) => { e.preventDefault(); window.netlifyIdentity.open('login'); });

    const logoutLink = $('logout-link');
    if (logoutLink) logoutLink.addEventListener('click', (e) => { e.preventDefault(); window.netlifyIdentity.logout(); });

    // Lifecycle
    window.netlifyIdentity.on('init', async (user) => {
      if (user) {
        try { setJwtCookie(await user.jwt()); } catch {}
      } else {
        clearJwtCookie();
      }

      const ok = await clientGuards();
      // Jeśli na dashboardzie i zalogowany — narysuj UI
      if (ok && location.pathname.endsWith('/dashboard.html') && user) {
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
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!hasIdentity()) return;
    bootstrap();

    // Zawsze poczekaj na pełną inicjalizację zanim sprawdzisz dostęp / malujesz UI
    await waitForIdentityInit();

    // Dodatkowo: jeśli jesteśmy na dashboardzie — enforce + paint
    if (location.pathname.endsWith('/dashboard.html')) {
      try {
        await ensureLoggedIn();   // jeśli nie — rzuci i otworzy login
        await paintUser();        // zawsze malujemy po wejściu (naprawia znikanie)
      } catch {
        window.netlifyIdentity.open('login');
      }
    }
  });
})();
