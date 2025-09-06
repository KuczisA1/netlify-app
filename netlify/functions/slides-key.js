// netlify/functions/slides-key.js
export async function handler(event) {
  // odczytaj alias z query: ?id=PREZENTACJA1
  const raw = (event?.queryStringParameters?.id || '').trim();

  // bezpieczny alias: same A-Z, 0-9 i _
  const safe = raw.toUpperCase().replace(/[^A-Z0-9_]/g, '');

  // jeśli jest alias -> SLIDES_<ALIAS>, inaczej fallback na SLIDES_ID
  const envKey = safe ? `SLIDES_${safe}` : 'SLIDES_ID';
  const id = process.env[envKey] || '';

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
    body: JSON.stringify({ id })
  };
}
