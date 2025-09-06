// @ts-nocheck
(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const hasIdentity = () => typeof window !== 'undefined' && !!window.netlifyIdentity;

  // ===== ŚCIEŻKI =====
  const PATHS = {
    home: ['/', '/index.html'],
    dashboard: '/dashboard.html',
    loginBase: '/login',   // bez trailing w porównaniach
  };

  // Normalizacja path (bez końcowego "/")
  const norm = (p) => (p.endsWith('/') && p !== '/') ? p.slice(0, -1) : p;
  const here = () => norm(location.pathname);

  const onHome = () => PATHS.home.includes(location.pathname);
  const onDashboard = () => here() === norm(PATHS.dashboard);
  const onLogin = () => here().startsWith(norm(PATHS.loginBase));

  // ===== STAN =====
  let bootstrapped = false;
  let painting = false;
  let guardPending = false;
  let guardQueued = false;

  // ===== COOKIE nf_jwt =====
  function setJwtCookie(token) {
    if (!token) return;
    document.cookie = `nf_jwt=${token}; Path=/; Secure; SameSite=Lax; Max-Age=3600`;
  }
  function clearJwtCookie() {
    document.cookie = 'nf_jwt=; Path=/; Max-Age=0; Secure; SameSite=Lax';
  }

  // ===== ROLE → STATUS =====
  function statusFromRoles(roles) {
    if (!Array.isArray(roles)) return 'pending';
    if (roles.includes('admin') || roles.includes('active')) return 'active';
    if (roles.includes('pending')) return 'pending';
    return 'pending';
  }

  // ===== UI LINKI =====
  function updateAuthLinks(user) {
    const dashboardLink = $('dashboard-link');
    if (dashboardLink) dashboardLink.style.display = user ? '' : 'none';
  }

  // ===== JWT refresh =====
  async function refreshUser(user) {
    try { await user.jwt(true); } catch {}
    return window.netlifyIdentity.currentUser() || user;
  }

  function updateNavForStatus(status) {
    const membersLink = $('members-link');
    if (membersLink) membersLink.style.display = (status === 'active') ? '' : 'none';
  }

  // ===== Nazwy użytkownika =====
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
      const nameEl = $('user-name');
      const unameEl = $('user-username');
      const statusEl = $('user-status');
      const hintEl = $('status-hint');

      if (emailEl) emailEl.textContent = user.email || '—';

      const { displayName, username } = deriveNames(user);
      document.querySelectorAll('.js-username').forEach(el => { el.textContent = username || '—'; });

      if (nameEl)  nameEl.textContent  = displayName || '—';
      if (unameEl) unameEl.textContent = username || '—';

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

  // ===== Bezpieczne przejście (anty-pętla) =====
  function safeGo(path) {
    path = norm(path);
    if (here() === path) return;
    const last = sessionStorage.getItem('lastNavPath');
    const lastTs = Number(sessionStorage.getItem('lastNavTs') || 0);
    const now = Date.now();
    if (last === path && (now - lastTs) < 2000) return; // nie skacz w kółko
    sessionStorage.setItem('lastNavPath', path);
    sessionStorage.setItem('lastNavTs', String(now));
    // replace → bez dorzucania historii (mniej BFCache/visibility eventów wstecz)
    location.replace(path);
  }

  // ===== Guard właściwy =====
  async function guardAndPaintCore() {
    if (!hasIdentity()) return;

    const user = window.netlifyIdentity.currentUser();

    // HOME: jeśli zalogowany → przenieś na dashboard (raz)
    if (onHome() && user) {
      safeGo(PATHS.dashboard);
      return;
    }

    // LOGIN: jeśli NIE zalogowany → zostań (zero redirectów)
    // LOGIN: jeśli zalogowany → dashboard
    if (onLogin()) {
      if (user) {
        safeGo(PATHS.dashboard);
      }
      return; // brak redirectu gdy user == null
    }

    // DASHBOARD: jeśli niezalogowany → /login/
    if (onDashboard()) {
      if (!user) {
        safeGo(`${norm(PATHS.loginBase)}/`);
        return;
      }
      await paintUser();
      return;
    }

    // Inne strony: nic na siłę
    if (user) {
      // możesz chcieć uzupełnić UI
      await paintUser();
    }
  }

  async function runGuard() {
    if (guardPending) { guardQueued = true; return; }
    guardPending = true;
    try { await guardAndPaintCore(); }
    finally {
      guardPending = false;
      if (guardQueued) { guardQueued = false; runGuard(); }
    }
  }

  function bootstrap() {
    if (bootstrapped || !hasIdentity()) return;
    bootstrapped = true;

    try { window.netlifyIdentity.init(); } catch {}

    // Klik „Zaloguj się” na HOME → przejście na /login/
    const loginBtn = $('login-btn');
    if (loginBtn) {
      loginBtn.addEventListener('click', (e) => {
        if (loginBtn.tagName === 'BUTTON') e.preventDefault();
        safeGo(`${norm(PATHS.loginBase)}/`);
      });
    }

    const logoutLink = $('logout-link');
    if (logoutLink) {
      logoutLink.addEventListener('click', (e) => {
        e.preventDefault();
        window.netlifyIdentity.logout();
      });
    }

    // ===== Identity lifecycle =====
    window.netlifyIdentity.on('init', async (user) => {
      updateAuthLinks(user);
      if (user) {
        try { setJwtCookie(await user.jwt()); } catch {}
      } else {
        clearJwtCookie();
      }
      await runGuard();
    });

    window.netlifyIdentity.on('login', async (user) => {
      updateAuthLinks(user);
      try { setJwtCookie(await user.jwt()); } catch {}
      safeGo(PATHS.dashboard);
    });

    window.netlifyIdentity.on('logout', () => {
      updateAuthLinks(null);
      clearJwtCookie();
      safeGo(PATHS.home[0]); // '/'
    });

    // ===== Zdarzenia środowiskowe (delikatnie) =====
    window.addEventListener('pageshow', () => { runGuard(); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') runGuard();
    });
    window.addEventListener('storage', (e) => {
      if (e.key && e.key.includes('gotrue.user')) runGuard();
    });
  }

  // Start
  document.addEventListener('DOMContentLoaded', () => {
    if (!hasIdentity()) return;
    bootstrap();
    updateAuthLinks(window.netlifyIdentity.currentUser());
    runGuard();
  });
})();
