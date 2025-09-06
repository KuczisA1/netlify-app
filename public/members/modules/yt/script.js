// Minimalny, prosty loader środowiska:
// 1) Lokalne DEV: szuka ./env.local.json (obok index.html)
// 2) Netlify PROD: wywołuje funkcję /.netlify/functions/public-env (zwraca zmienne zaczynające się od YT_)
(async () => {
  const $ = (sel) => document.querySelector(sel);
  const msg = $("#msg");
  const frame = $("#ytFrame");
  const envSel = $("#envKey");
  const copyBtn = $("#copyLinkBtn");

  function setMsg(t) { msg.textContent = t || ""; }

  async function getEnvMap() {
    // DEV: statyczny JSON obok pliku
    try {
      const r = await fetch("./env.local.json", { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch {}

    // PROD: Netlify function
    try {
      const r = await fetch("/.netlify/functions/public-env", { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch {}

    return {}; // brak danych
  }

  function buildEmbedUrl(videoId) {
    const base = "https://www.youtube-nocookie.com/embed/";
    const qp = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1",
      fs: "1"
    });
    return `${base}${encodeURIComponent(videoId)}?${qp.toString()}`;
  }

  function setVideo(videoId) {
    if (!videoId) {
      setMsg("Nie znaleziono ID filmu. Sprawdź nazwę zmiennej w URL (parametr ?id=YT_FILM1).");
      frame.removeAttribute("src");
      return;
    }
    frame.src = buildEmbedUrl(videoId);
    setMsg("");
  }

  function populateSelect(envMap, currentKey) {
    envSel.innerHTML = "";
    const keys = Object.keys(envMap).sort();
    for (const k of keys) {
      const opt = document.createElement("option");
      opt.value = k; opt.textContent = `${k} → ${envMap[k]}`;
      envSel.appendChild(opt);
    }
    if (currentKey && envMap[currentKey]) envSel.value = currentKey;
  }

  function currentBaseUrl() {
    // Zwraca bazowy URL do tej strony bez query
    const u = new URL(window.location.href);
    u.search = ""; u.hash = "";
    return u.toString();
  }

  const envMap = await getEnvMap();
  const params = new URLSearchParams(window.location.search);
  const requestedKey = params.get("id"); // np. YT_FILM1

  // Ustaw selektor i film
  populateSelect(envMap, requestedKey);

  if (requestedKey && envMap[requestedKey]) {
    setVideo(envMap[requestedKey]);
  } else if (!requestedKey && Object.keys(envMap).length) {
    // Brak parametru – wybierz pierwszy dostępny
    const firstKey = Object.keys(envMap).sort()[0];
    envSel.value = firstKey;
    setVideo(envMap[firstKey]);
    const u = new URL(window.location.href);
    u.searchParams.set("id", firstKey);
    history.replaceState(null, "", u.toString());
  } else {
    setMsg("Brak skonfigurowanych zmiennych YT_ w środowisku lub pliku env.local.json.");
  }

  // Zmiana zmiennej z selektora – aktualizuj URL + odtwarzacz
  envSel.addEventListener("change", () => {
    const key = envSel.value;
    const u = new URL(window.location.href);
    u.searchParams.set("id", key);
    history.replaceState(null, "", u.toString());
    setVideo(envMap[key]);
  });

  // Kopiuj link z aktualnym ?id=
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      copyBtn.textContent = "Skopiowano ✓";
      setTimeout(() => (copyBtn.textContent = "Kopiuj link"), 1200);
    } catch {
      setMsg("Nie udało się skopiować linku.");
    }
  });
})();
