(async () => {
  const iframe = document.getElementById('slidesFrame');

  try {
    const params = new URLSearchParams(location.search);
    const alias = params.get('id') || ''; // np. PREZENTACJA1

    const url = alias
      ? `/.netlify/functions/slides-key?id=${encodeURIComponent(alias)}`
      : '/.netlify/functions/slides-key';

    const res = await fetch(url, { cache: 'no-store', headers: { 'Accept': 'application/json' } });
    const data = await res.json().catch(() => ({}));
    const id = (data && data.id) ? String(data.id).trim() : '';

    if (!id) {
      console.error('Nie znaleziono ID prezentacji (sprawdź zmienne env).');
      return;
    }

    const embedParams = new URLSearchParams({ start: 'false', loop: 'false', delayms: '3000' });
    iframe.src = `https://docs.google.com/presentation/d/${encodeURIComponent(id)}/embed?${embedParams}`;
  } catch (err) {
    console.error('Błąd ładowania prezentacji:', err);
  }
})();
