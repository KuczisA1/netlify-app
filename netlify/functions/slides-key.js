// netlify/functions/slides-key.js
exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const raw = (q.id || '').trim();
    const mode = (q.mode || 'preview').trim().toLowerCase(); // preview|present|embed

    let source = null;   // opis skąd bierzemy ID
    let id = null;       // ID prezentacji

    // 1) Jeśli podano pełny URL → wyciągnij ID
    const fromUrl = extractIdFromUrl(raw);
    if (fromUrl) {
      id = fromUrl;
      source = 'query:url';
    }

    // 2) Jeśli wygląda na czyste ID (ciąg znaków) → użyj bez środowiska
    if (!id && isLikelyId(raw)) {
      id = raw;
      source = 'query:id';
    }

    // 3) W innym przypadku potraktuj jako KLUCZ środowiskowy: SLIDES_<KEY>
    if (!id && raw) {
      const envName = `SLIDES_${raw.toUpperCase()}`;
      const envVal = process.env[envName];
      if (!envVal) return json(404, { error: `Brak zmiennej: ${envName}` });
      id = extractIdFromUrl(envVal) || (isLikelyId(envVal) ? envVal : null);
      if (!id) return json(400, { error: `Nie udało się wyciągnąć ID z ${envName}` });
      source = `env:${envName}`;
    }

    // 4) Gdy nic nie podano → domyślna SLIDES_ID
    if (!id && !raw) {
      const envVal = process.env.SLIDES_ID;
      if (!envVal) return json(404, { error: 'Brak zmiennej: SLIDES_ID' });
      id = extractIdFromUrl(envVal) || (isLikelyId(envVal) ? envVal : null);
      if (!id) return json(400, { error: 'Nie udało się wyciągnąć ID z SLIDES_ID' });
      source = 'env:SLIDES_ID';
    }

    const urls = buildUrls(id);
    const chosen = mode === 'present' ? urls.presentUrl
                 : mode === 'embed'   ? urls.embedUrl
                 : urls.previewUrl; // domyślnie preview (ma kontrolki)

    return json(200, { id, source, mode, url: chosen, ...urls });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Błąd serwera funkcji.' });
  }
};

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    body: JSON.stringify(bodyObj),
  };
}

function extractIdFromUrl(input) {
  try {
    const u = new URL(input);
    const m = u.pathname.match(/\/presentation\/d\/([\w-]+)/i);
    return m && m[1] ? m[1] : null;
  } catch { return null; }
}

function isLikelyId(s) {
  return /^[A-Za-z0-9_-]{10,}$/.test(s); // Slides ID zwykle dłuższe; bezpieczny heurystyk
}

function buildUrls(id) {
  const embed   = `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&rm=minimal`;
  const preview = `https://docs.google.com/presentation/d/${id}/preview`;
  const present = `https://docs.google.com/presentation/d/${id}/present`;
  return { embedUrl: embed, previewUrl: preview, presentUrl: present };
}
