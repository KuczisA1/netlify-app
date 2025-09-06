// netlify/functions/slides-key.js
exports.handler = async (event) => {
  try {
    const idKeyRaw = (event.queryStringParameters && event.queryStringParameters.id) || '';
    const idKey = idKeyRaw.trim();
    // Użyj domyślnej SLIDES_ID, albo nazwanej SLIDES_<IDKEY>
    const envName = idKey ? `SLIDES_${idKey.toUpperCase()}` : 'SLIDES_ID';

    const raw = process.env[envName];
    if (!raw) {
      return json(404, { error: `Brak zmiennej środowiskowej: ${envName}` });
    }

    const embedUrl = toEmbedUrl(raw);
    if (!embedUrl) {
      return json(400, { error: 'Nie udało się zbudować adresu /embed z podanej wartości.' });
    }

    return json(200, { key: idKey || 'DEFAULT', embedUrl });
  } catch (err) {
    console.error(err);
    return json(500, { error: 'Błąd serwera funkcji.' });
  }
};

function json(statusCode, bodyObj) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(bodyObj)
  };
}

function toEmbedUrl(input) {
  // Wejście może być: samo ID albo pełny link do Slides.
  const trimmed = String(input).trim();

  // 1) Jeśli to pełny URL, spróbuj wyciągnąć ID.
  // Obsługa: .../presentation/d/<ID>/... (edit, view, pub itp.)
  try {
    const url = new URL(trimmed);
    const m = url.pathname.match(/\/presentation\/d\/([\w-]+)/i);
    if (m && m[1]) {
      const id = m[1];
      return buildEmbed(id);
    }
  } catch {
    // nie był to URL – traktuj jako samo ID
  }

  // 2) Zakładamy, że to samo ID
  if (/^[\w-]+$/.test(trimmed)) {
    return buildEmbed(trimmed);
  }

  return null;
}

function buildEmbed(id) {
  // rm=minimal -> mniej UI; start/loop = false; delayms bez znaczenia gdy brak autoplay
  return `https://docs.google.com/presentation/d/${id}/embed?start=false&loop=false&rm=minimal`;
}
