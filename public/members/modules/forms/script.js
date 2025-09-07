(() => {
  const IFRAME = document.getElementById('formFrame');
  const ERROR = document.getElementById('error');

  // ——— Helpers ———

  // Accepts either a plain Forms ID or a full Google Forms URL.
  function normalizeFormId(raw) {
    if (!raw) return null;
    raw = decodeURIComponent(String(raw).trim());

    // If it's a full URL, try to extract ID from ".../forms/d/<ID>/..."
    try {
      if (/^https?:\/\//i.test(raw)) {
        const u = new URL(raw);
        const parts = u.pathname.split('/');
        const dIndex = parts.findIndex(p => p === 'd');
        if (dIndex !== -1 && parts[dIndex + 1]) {
          return sanitizeId(parts[dIndex + 1]);
        }
        // Fallback: sometimes URLs are already to /d/ID/edit etc.
      }
    } catch (_) { /* ignore URL parsing errors */ }

    // Otherwise assume it's an ID and sanitize.
    return sanitizeId(raw);
  }

  // Allow common characters in Google IDs: letters, digits, dash, underscore
  function sanitizeId(id) {
    const m = String(id).match(/[A-Za-z0-9_-]{10,}/);
    return m ? m[0] : null;
  }

  function buildFormUrl(id) {
    // Standard embed endpoint for Google Forms
    return `https://docs.google.com/forms/d/${id}/viewform?embedded=true`;
  }

  function showError(show) {
    ERROR.classList.toggle('hidden', !show);
  }

  function setIframeSrc(url) {
    IFRAME.src = url;
  }

  function clearQueryFromBar() {
    // Remove ?id=... from the address bar without reload
    if (window.history && window.history.replaceState) {
      const clean = window.location.pathname + window.location.hash;
      window.history.replaceState({}, document.title, clean);
    }
  }

  // ——— Main ———

  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    let raw = params.get('id');

    // If no 'id' in URL, try sessionStorage (supports refresh after cleaning URL)
    if (!raw) {
      raw = sessionStorage.getItem('formEmbedId') || '';
    }

    const formId = normalizeFormId(raw);

    if (!formId) {
      showError(true);
      return;
    }

    // Persist for refreshes after query removal
    sessionStorage.setItem('formEmbedId', formId);

    // Set src
    const url = buildFormUrl(formId);
    setIframeSrc(url);

    // Clean the address bar if we arrived with ?id=
    if (params.has('id')) {
      clearQueryFromBar();
    }

    showError(false);
  });

  // Optional robustness: if iframe fails to load, show error overlay
  IFRAME.addEventListener('error', () => showError(true));
})();
