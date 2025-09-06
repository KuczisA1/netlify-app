// netlify/functions/slides-key.js
exports.handler = async (event) => {
  try {
    const q = event.queryStringParameters || {};
    const raw = (q.id || '').trim();
    const mode = (q.mode || 'preview').trim().toLowerCase(); // preview|present|embed

    let id = null, source = null;

    // 1) pełny URL → spróbuj różne wzorce
    id = extractId(raw);
    if (id) source = 'query';

    // 2) jeżeli nic, a coś podano → potraktuj jako KLUCZ środowiskowy SLIDES_<KEY>
    if (!id && raw) {
      const envName = `SLIDES_${raw.toUpperCase()}`;
      const envVal = process.env[envName];
      if (!envVal) return json(404, { error: `Brak zmiennej: ${envName}` });
      id = extractId(envVal);
      if (!id) return json(400, { error: `Nie udało się wyciągnąć ID z ${envName}` });
      source = `env:${envName}`;
    }

    // 3) domyślna SLIDES_ID
    if (!id && !raw) {
      const envVal = process.env.SLIDES_ID;
      if (!envVal) return json(404, { error: 'Brak zmiennej: SLIDES_ID' });
      id = extractId(envVal);
      if (!id) return json(400, { error: 'Nie udało się wyciągnąć ID z SLIDES_ID' });
      source = 'env:SLIDES_ID';
    }

    const urls = buildUrls(id);
    const chosen = mode === 'present' ? urls.presentUrl
                 : mode === 'embed'   ? urls.embedUrl
                 : urls.previewUrl; // default: preview (ma kontrolki)

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

// === Najbardziej odporne wyciąganie ID ===
function extractId(input) {
  if (!input) return null;
  const s = String(input).trim();

  // Jeśli to już samo ID
  if (/^[A-Za-z0-9_-]{10,}$/.test(s)) return s;

  // Jeśli to URL — sprawdź różne warianty
  try {
    const u = new URL(s);

    // /presentation/d/<ID>/..., /file/d/<ID>/..., /…/pub, /…/edit itd.
    let m = u.pathname.match(/\/(?:presentation|file)\/d\/([A-Za-z0-9_-]+)/i);
    if (m && m[1]) return m[1];

    // /open?id=<ID>  lub  /uc?id=<ID>
    const qid = u.searchParams.get('id');
    if (qid && /^[A-Za-z0-9_-]{10,}$/.test(qid)) return qid;
  } catch {/* nie-URL */}

  // Ostatnia deska: spróbuj znaleźć ciąg jak ID w tekście
  const m2 = s.match(/([A-Za-z0-9_-]{10,})/);
  return m2 ? m2[1] : null;
}

function buildUrls(id) {
  return {
    embedUrl:   `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&rm=minimal`,
    previewUrl: `https://docs.google.com/presentation/d/${id}/preview`,
    presentUrl: `https://docs.google.com/presentation/d/${id}/present`,
  };
}
