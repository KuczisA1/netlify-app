// @ts-nocheck
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hasIdentity = () => typeof window !== 'undefined' && !!window.netlifyIdentity;

  // ŚCIEŻKI (dopasuj przy zmianach)
  const PATHS = {
    home: ['/', '/index.html'],
    dashboard: '/dashboard.html',
    login: '/login/', // ważne: tu zakładamy public/login/index.html
  };
  const onHome = () => PATHS.home.includes(location.pathname);
  const onDashboard = () => location.pathname === PATHS.dashboard;

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
    const dashboardLink = $('dashboard-link');
    if (dashboardLink) dashboardLink.style.display = user ? '' : 'none';
  }

  async function refreshUser(user) {
    try { await user.jwt(true); } catch {}
    return window.netlifyIdentity.currentUser() || user;
  }

  function updateNavForStatus(status) {
    const membersLink = $('members-link');
    if (membersLink) membersLink.style.display = (status === 'active') ? '' : 'none';
  }

  // ---- NAZWY UŻYTKOWNIKA ----
  // Zbiera preferowaną nazwę do wyświetlenia oraz "username" (jeśli istnieje w metadata)
  function deriveNames(user) {
    const md = (user && user.user_metadata) || {};
    const preferredDisplay =
      md.name ||
      md.full_name ||
      md.display_name ||
      (user && user.email ? user.email.split('@')[0] : '');

    const username =
      md.username ||
      md.preferred_username ||
      (preferredDisplay ? String(preferredDisplay).replace(/\s+/g, '') : '') ||
      (user && user.email ? user.email.split('@')[0] : '');

    return {
      displayName: preferredDisplay || '',
      username: username || ''
    };
  }

  async function paintUser() {
    if (painting) return;
    painting = true;
    try {
      if (!hasIdentity()) return;
      let user = window.netlifyIdentity.currentUser();
      updateAuthLinks(user);
      if (!user) return;

      user = await refreshUser(user);
      try { setJwtCookie(await user.jwt()); } catch {}
      updateAuthLinks(user);

      const emailEl = $('user-email');
      const nameEl = $('user-name');          // <span id="user-name">—</span> (w Twoim HTML)
      const unameEl = $('user-username');     // opcjonalnie: <span id="user-username">—</span>
      const statusEl = $('user-status');
      const hintEl = $('status-hint');

      if (emailEl) emailEl.textContent = user.email || '—';

      // Ustal nazwy
      const { displayName, username } = deriveNames(user);
      if (nameEl)  nameEl.textContent  = displayName || '—';
      if (unameEl) unameEl.textContent = username || '—';

      // Status/role
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

  // --- OCHRONA TRAS (bez popupa) ---
  async function guardAndPaint() {
    if (!hasIdentity()) return;

    const user = window.netlifyIdentity.currentUser();

    // 1) Strona główna: jeśli zalogowany → dashboard
    if (onHome() && user) {
      window.location.replace(PATHS.dashboard);
      return;
    }

    // 2) Dashboard: jeśli niezalogowany → /login/
    if (onDashboard()) {
      if (!user) {
        window.location.replace(PATHS.login);
        return;
      }
      await paintUser();
    }
  }

  function bootstrap() {
    if (bootstrapped || !hasIdentity()) return;
    bootstrapped = true;

    try { window.netlifyIdentity.init(); } catch {}

    // Klik przycisku na stronie głównej → bez modala idziemy na /login/
    const loginBtn = $('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', (e) => {
        if (loginBtn.tagName === 'BUTTON') {
          e.preventDefault();
          window.location.href = PATHS.login;
        }
      });
    }

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
      await guardAndPaint();
    });

    window.netlifyIdentity.on('login', async (user) => {
      updateAuthLinks(user);
      try { setJwtCookie(await user.jwt()); } catch {}
      window.location.replace(PATHS.dashboard);
    });

    window.netlifyIdentity.on('logout', () => {
      updateAuthLinks(null);
      clearJwtCookie();
      window.location.replace(PATHS.home[0]); // '/'
    });

    // BFCache / powroty / widoczność / wielokarty
    window.addEventListener('pageshow', async () => {
      await guardAndPaint();
      updateAuthLinks(window.netlifyIdentity.currentUser());
    });

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible') {
        await guardAndPaint();
        updateAuthLinks(window.netlifyIdentity.currentUser());
      }
    });

    window.addEventListener('storage', async (e) => {
      if (e.key && e.key.includes('gotrue.user')) {
        updateAuthLinks(window.netlifyIdentity.currentUser());
        await guardAndPaint();
      }
    });
  }

  // Start
  document.addEventListener('DOMContentLoaded', async () => {
    if (!hasIdentity()) return;
    bootstrap();
    updateAuthLinks(window.netlifyIdentity.currentUser());
    await guardAndPaint();
  });
})();
