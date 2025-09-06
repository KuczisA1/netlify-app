/* =========================================================
   ChemDisk YT Player (bez inline JS, zgodny z CSP)
   - rozwiązuje race condition z IFrame API
   - własne kontrolki, brak JSON, ID „zaciemnione”
   ========================================================= */

// ------- Minimalna obfuskacja ID (XOR z 73) --------
// Jak policzyć tablicę: Array.from("TWOJE_YT_ID").map(c => c.charCodeAt(0) ^ 73)
// Poniżej PRZYKŁAD (działa): "dQw4w9WgXcQ"
const OBF_MAP = {
  YT_FILM1: [45,24,62,125,62,112,30,46,17,42,24],
  // YT_FILM_MATURA: [ ...twoje liczby... ]
};

const DEFAULT_KEY = "YT_FILM1";
const PLAYER_VARS = {
  controls: 0, modestbranding: 1, rel: 0, fs: 0, disablekb: 1,
  playsinline: 1, iv_load_policy: 3, origin: location.origin
};

// ---- Helpers (bez dotykania DOM przed DOMContentLoaded) ----
const qs = (s) => document.querySelector(s);
function fmtTime(s) { s = Math.max(0, Math.floor(s || 0)); const m = Math.floor(s/60), r = s%60; return `${m}:${String(r).padStart(2,"0")}`; }
function decodeId(arr) { return String.fromCharCode(...arr.map(n => n ^ 73)); }
function maskId(id) { if(!id) return ""; return id.length<=4 ? "***" : id.slice(0,2)+"*".repeat(id.length-4)+id.slice(-2); }

// --------- Utrudnienia kopiowania (friction, nie ochrona) ----------
window.addEventListener("contextmenu", e => e.preventDefault(), {capture:true});
window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && ["u","s","c"].includes(e.key.toLowerCase())) e.preventDefault();
}, {capture:true});

// --------- Stan + bramki inicjalizacji ----------
const state = {
  domReady: false,
  apiReady: false,
  player: null,
  ticker: null,
  dragging: false,
  loadedOnce: false,
  elements: {}
};

// Callback wołany przez YT API (musi istnieć ZANIM załadujesz API)
window.onYouTubeIframeAPIReady = function onYouTubeIframeAPIReady() {
  state.apiReady = true;
  maybeInit();
};

// DOM gotowy -> chwytamy elementy i bindowanie UI
document.addEventListener("DOMContentLoaded", () => {
  state.domReady = true;

  // Fallback logo bez inline
  const logo = document.getElementById("brandLogo");
  if (logo) {
    logo.addEventListener("error", () => {
      const span = document.createElement("span");
      span.textContent = "ChemDisk";
      span.className = "title";
      logo.replaceWith(span);
    }, { once: true });
  }

  // Cache elementów
  state.elements = {
    msg: qs("#msg"),
    playBtn: qs("#playPause"),
    seek: qs("#seek"),
    vol: qs("#volume"),
    muteBtn: qs("#muteToggle"),
    rateSel: qs("#rate"),
    fsBtn: qs("#fullscreen"),
    timeNow: qs("#timeNow"),
    timeDur: qs("#timeDur"),
    shell: qs("#playerShell")
  };

  bindUI();
  maybeInit();
});

// --------- Ustal ID na podstawie ?id=... bez ujawniania go w DOM ----------
const params = new URLSearchParams(location.search);
const key = params.get("id") || DEFAULT_KEY;
const VIDEO_ID = OBF_MAP[key] ? decodeId(OBF_MAP[key]) : null;

// --------- Inicjalizacja gracza dopiero gdy i DOM, i API są gotowe ----------
function maybeInit() {
  if (!state.domReady || !state.apiReady || state.player) return;

  if (!VIDEO_ID) {
    setMsg("Brak zdefiniowanego wideo dla klucza (?id=...). Uzupełnij OBF_MAP.");
    return;
  }
  if (VIDEO_ID.length !== 11) {
    setMsg("ID wideo wygląda na niepoprawne (sprawdź obfuskację).");
  }

  state.player = new YT.Player("player", {
    width: "100%", height: "100%",
    videoId: "", // ładujemy dopiero na klik (user gesture)
    host: "https://www.youtube-nocookie.com",
    playerVars: PLAYER_VARS,
    events: { onReady, onStateChange, onError }
  });
}

function onReady() {
  // Nie autoodtwarzamy; na pierwsze „Play” robimy loadVideoById
  try {
    state.player.setVolume(100);
    updateMuteIcon();
    // Ustal od razu duration (jeśli możliwe po cue); ale my ładować będziemy przy Play
    setMsg("");
  } catch {}
}

function onStateChange(ev) {
  const st = ev.data, YTS = YT.PlayerState;
  updatePlayIcon(st === YTS.PLAYING);

  if (st === YTS.PLAYING) startTicker();
  else { stopTicker(); if (st === YTS.ENDED) { setSeek(0); setNow(0); } }

  const d = safeGetDuration(); if (d > 0) setDur(d);
}

function onError(e) {
  const code = e?.data;
  const map = {
    2: "Błąd parametrów (ID nieprawidłowe). Sprawdź OBF_MAP.",
    5: "Błąd odtwarzacza HTML5 (spróbuj ponownie / inna przeglądarka).",
    101: "Autor wyłączył osadzanie tego filmu (embed disabled).",
    150: "Autor wyłączył osadzanie tego filmu (embed disabled)."
  };
  const extra = VIDEO_ID ? ` (ID: ${maskId(VIDEO_ID)})` : "";
  setMsg(map[code] ? `${map[code]}${extra}` : `Nieznany błąd odtwarzacza [${code}]${extra}`);
  console.warn("[YT-ERROR]", code);
}

// ---------------- UI ----------------
function bindUI() {
  const { playBtn, seek, vol, muteBtn, rateSel, fsBtn, shell } = state.elements;

  // Play/Pause
  playBtn?.addEventListener("click", () => {
    // Pierwsze kliknięcie: załaduj wideo prawdziwym wywołaniem (user gesture)
    if (!state.loadedOnce) {
      try {
        state.player.loadVideoById({ videoId: VIDEO_ID, startSeconds: 0 });
        state.loadedOnce = true;
      } catch {
        // gdyby API nie doszło, spróbuj później
      }
      return;
    }
    togglePlay();
  });

  // Seek
  seek?.addEventListener("input", () => {
    if (!state.dragging) return;
    const d = safeGetDuration(); const t = (seek.value / 1000) * d; setNow(t);
  });
  const startDrag = () => (state.dragging = true);
  const commitSeek = () => {
    const d = safeGetDuration();
    if (d > 0) state.player.seekTo((seek.value / 1000) * d, true);
    state.dragging = false;
  };
  seek?.addEventListener("mousedown", startDrag);
  seek?.addEventListener("touchstart", startDrag, { passive: true });
  seek?.addEventListener("mouseup", commitSeek);
  seek?.addEventListener("touchend", commitSeek);
  seek?.addEventListener("change", commitSeek);

  // Volume
  vol?.addEventListener("input", () => {
    try {
      state.player.setVolume(parseInt(vol.value, 10));
      if (state.player.isMuted() && vol.value > 0) state.player.unMute();
      updateMuteIcon();
    } catch {}
  });

  // Mute
  muteBtn?.addEventListener("click", () => {
    try {
      if (state.player.isMuted() || state.player.getVolume() === 0) {
        state.player.unMute();
        if (vol && vol.value === "0") { vol.value = "50"; state.player.setVolume(50); }
      } else state.player.mute();
      updateMuteIcon();
    } catch {}
  });

  // Rate
  rateSel?.addEventListener("change", () => {
    try { state.player.setPlaybackRate(parseFloat(rateSel.value)); } catch {}
  });

  // Fullscreen
  fsBtn?.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  });

  // Skróty
  window.addEventListener("keydown", (e) => {
    if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); playBtn?.click(); }
    if (e.key === "ArrowRight") state.player?.seekTo(safeGetTime()+5, true);
    if (e.key === "ArrowLeft")  state.player?.seekTo(Math.max(0, safeGetTime()-5), true);
    if (e.key.toLowerCase() === "m") muteBtn?.click();
    if (e.key.toLowerCase() === "f") fsBtn?.click();
  });
}

// --------------- Ticker / aktualizacja czasu ---------------
function startTicker() {
  stopTicker();
  state.ticker = setInterval(() => {
    const d = safeGetDuration(), t = safeGetTime();
    if (d > 0 && !state.dragging) {
      setSeek(Math.round((t / d) * 1000));
      setNow(t); setDur(d);
    }
  }, 250);
}
function stopTicker() { if (state.ticker) { clearInterval(state.ticker); state.ticker = null; } }

// --------------- Utility na UI ---------------
function setMsg(text) { if (state.elements.msg) state.elements.msg.textContent = text || ""; }
function setSeek(v) { if (state.elements.seek) state.elements.seek.value = String(v); }
function setNow(t) { if (state.elements.timeNow) state.elements.timeNow.textContent = fmtTime(t); }
function setDur(t) { if (state.elements.timeDur) state.elements.timeDur.textContent = fmtTime(t); }

function updatePlayIcon(playing) {
  if (!state.elements.playBtn) return;
  state.elements.playBtn.innerHTML = playing
    ? '<svg viewBox="0 0 24 24" class="i"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" class="i"><path d="M8 5v14l11-7z"/></svg>';
}
function updateMuteIcon() {
  if (!state.elements.muteBtn) return;
  let muted = false;
  try { muted = state.player.isMuted() || state.player.getVolume() === 0; } catch {}
  state.elements.muteBtn.innerHTML = muted
    ? '<svg viewBox="0 0 24 24" class="i"><path d="M7 9v6h4l5 5V4l-5 5H7zM19 12l3 3-1.5 1.5L17.5 13.5 14 10l1.5-1.5L19 12z"/></svg>'
    : '<svg viewBox="0 0 24 24" class="i"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>';
}

function togglePlay() {
  try {
    const st = state.player.getPlayerState();
    if (st === YT.PlayerState.PLAYING) state.player.pauseVideo();
    else state.player.playVideo();
  } catch {}
}

function safeGetTime(){ try { return state.player.getCurrentTime() || 0; } catch { return 0; } }
function safeGetDuration(){ try { return state.player.getDuration() || 0; } catch { return 0; } }

// Diagnostyka do konsoli (bez ujawniania pełnego ID)
window.__yt_diag = () => ({
  ytApiLoaded: !!window.YT,
  domReady: state.domReady,
  apiReady: state.apiReady,
  playerReady: !!state.player,
  key,
  idLen: VIDEO_ID ? VIDEO_ID.length : 0,
  idMasked: maskId(VIDEO_ID),
  href: location.href
});
