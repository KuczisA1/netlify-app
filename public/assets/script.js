// Custom login/register using GoTrue (Netlify Identity API) + Netlify Forms contact
(() => {
  const qs = (sel) => document.querySelector(sel);
  const byId = (id) => document.getElementById(id);

  // Init GoTrue client (Identity must be enabled on Netlify)
  const auth = new window.GoTrue({
    APIUrl: `${window.location.origin}/.netlify/identity`,
    setCookie: true // ustawia nf_jwt automatycznie po zalogowaniu
  });

  // Sections
  const hero = byId('hero');
  const loginSection = byId('login-section');
  const registerSection = byId('register-section');
  const contactSection = byId('contact-section');

  // Nav / CTA
  const navLogin = byId('nav-login');
  const navRegister = byId('nav-register');
  const navContact = byId('nav-contact');
  const navDashboard = byId('nav-dashboard');
  const ctaLogin = byId('cta-login');
  const ctaRegister = byId('cta-register');

  // Forms
  const loginForm = byId('login-form');
  const registerForm = byId('register-form');
  const contactForm = byId('contact-form');

  const loginError = byId('login-error');
  const registerError = byId('register-error');

  function show(section) {
    // hide all
    [hero, loginSection, registerSection, contactSection].forEach(s => s && (s.hidden = true));
    // show one
    if (section) section.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showHero() { show(hero); }
  function showLogin() { show(loginSection); }
  function showRegister() { show(registerSection); }
  function showContact() { show(contactSection); }

  function setDashboardVisible(isLoggedIn) {
    if (navDashboard) navDashboard.style.display = isLoggedIn ? '' : 'none';
  }

  function setJwtCookie(token) {
    if (!token) return;
    document.cookie = `nf_jwt=${token}; Path=/; Secure; SameSite=Lax`;
  }

  async function refreshUserAndCookie(user) {
    try {
      // GoTrue v2: user.jwt() zwraca ważny token
      const token = await user.jwt();
      setJwtCookie(token);
    } catch {}
  }

  async function getCurrentUser() {
    try {
      const user = auth.currentUser();
      return user || null;
    } catch {
      return null;
    }
  }

  async function boot() {
    // decyzja co pokazać na start
    const user = await getCurrentUser();
    setDashboardVisible(!!user);
    showHero();

    // Gdy ?contact=ok po submit Netlify Forms — pokaż potwierdzenie
    if (new URLSearchParams(location.search).get('contact') === 'ok') {
      alert('Dziękujemy! Formularz został wysłany.');
      // czyść parametr
      const url = new URL(location.href);
      url.searchParams.delete('contact');
      history.replaceState({}, '', url.toString());
    }
  }

  // Navigation handlers
  navLogin && navLogin.addEventListener('click', () => showLogin());
  navRegister && navRegister.addEventListener('click', () => showRegister());
  navContact && navContact.addEventListener('click', () => showContact());
  ctaLogin && ctaLogin.addEventListener('click', () => showLogin());
  ctaRegister && ctaRegister.addEventListener('click', () => showRegister());

  // Cancel buttons
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-cancel]');
    if (btn) showHero();
  });

  // Switch links
  const toRegister = byId('to-register');
  const toLogin = byId('to-login');
  toRegister && toRegister.addEventListener('click', (e) => { e.preventDefault(); showRegister(); });
  toLogin && toLogin.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });

  // LOGIN
  loginForm && loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.hidden = true; loginError.textContent = '';

    const email = (byId('login-email').value || '').trim();
    const password = byId('login-password').value || '';

    if (!email || !password) {
      loginError.hidden = false; loginError.textContent = 'Podaj email i hasło.';
      return;
    }

    try {
      const user = await auth.login(email, password, { remember: true });
      await refreshUserAndCookie(user);
      setDashboardVisible(true);
      // przekieruj do dashboardu
      window.location.href = '/dashboard.html';
    } catch (err) {
      loginError.hidden = false;
      loginError.textContent = (err && err.message) ? err.message : 'Nie udało się zalogować.';
    }
  });

  // REGISTER
  registerForm && registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    registerError.hidden = true; registerError.textContent = '';

    const email = (byId('register-email').value || '').trim();
    const password = byId('register-password').value || '';

    if (!email || !password) {
      registerError.hidden = false; registerError.textContent = 'Podaj email i hasło.';
      return;
    }

    try {
      // Rejestracja
      const user = await auth.signup(email, password);
      // W wielu konfiguracjach wymagane jest potwierdzenie email (link aktywacyjny).
      // Jeśli masz w Identity wyłączone potwierdzenie e-mail, user będzie od razu zalogowany.
      await refreshUserAndCookie(user);
      setDashboardVisible(true);
      // Możesz przenieść na dashboard albo zostawić komunikat:
      alert('Konto utworzone. Jeśli wymagane jest potwierdzenie e-mail, sprawdź skrzynkę.');
      window.location.href = '/dashboard.html';
    } catch (err) {
      registerError.hidden = false;
      registerError.textContent = (err && err.message) ? err.message : 'Nie udało się zarejestrować.';
    }
  });

  // Start
  document.addEventListener('DOMContentLoaded', boot);
})();
