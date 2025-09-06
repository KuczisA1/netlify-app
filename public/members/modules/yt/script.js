// ======= OBF_MAP: ZAMIEŃ na swoje dane (XOR z 73) =======
// Jak zrobić tablicę: Array.from("TWOJE_YT_ID").map(c => c.charCodeAt(0) ^ 73)
const OBF_MAP = {
  // PRZYKŁAD (Rick): YT_FILM1 -> "dQw4w9WgXcQ"
  YT_FILM1: [45,24,62,125,62,112,30,46,17,42,24],
  // YT_FILM_MATURA: [ ... ]
};

// ======= USTAWIENIA =======
const DEFAULT_KEY = "YT_FILM1";
const PLAYER_VARS = {
  controls: 0,
  modestbranding: 1,
  rel: 0,
  fs: 0,
  disablekb: 1,
  playsinline: 1,
  iv_load_policy: 3,
  origin: location.origin // ważne na produkcji (YT zaleca)
};

// ======= HELPERS =======
const $ = (s) => document.querySelector(s);
const msg = $("#msg");
const playBtn = $("#playPause");
const seek = $("#seek");
const vol = $("#volume");
const muteBtn = $("#muteToggle");
const rateSel = $("#rate");
const fsBtn = $("#fullscreen");
const timeNow = $("#timeNow");
const timeDur = $("#timeDur");
const shell = $("#playerShell");

function setMsg(t){ msg.textContent = t || ""; }
function fmtTime(s){ s=Math.max(0,Math.floor(s||0)); const m=Math.floor(s/60), r=s%60; return `${m}:${r.toString().padStart(2,"0")}`; }
function decodeId(arr){ return String.fromCharCode(...arr.map(n => n ^ 73)); }
function maskId(id){ if(!id) return ""; return id.length<=4 ? "***" : id.slice(0,2)+"*".repeat(id.length-4)+id.slice(-2); }

// Utrudnienia kopiowania (to tylko „friction”)
window.addEventListener("contextmenu", e => e.preventDefault(), {capture:true});
window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && ["u","s","c"].includes(e.key.toLowerCase())) e.preventDefault();
}, {capture:true});

// ======= POBRANIE KLUCZA =======
const params = new URLSearchParams(location.search);
const key = params.get("id") || DEFAULT_KEY;
const VIDEO_ID = OBF_MAP[key] ? decodeId(OBF_MAP[key]) : null;

// Szybka walidacja obfuskacji
(function validateObf(){
  if (!VIDEO_ID) {
    setMsg("Brak zdefiniowanego wideo dla klucza (?id=...). Uzupełnij OBF_MAP.");
  } else if (VIDEO_ID.length !== 11) {
    setMsg("ID wideo wygląda na niepoprawne (sprawdź obfuskację).");
    console.warn("[YT] ID ma nietypową długość:", VIDEO_ID.length);
  }
})();

// ======= YT API =======
let player = null, ticker = null, dragging = false;

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", {
    width: "100%", height: "100%",
    videoId: "", // ustawimy później
    host: "https://www.youtube-nocookie.com",
    playerVars: PLAYER_VARS,
    events: { onReady, onStateChange, onError }
  });
};

function onReady(){
  try {
    if (VIDEO_ID) {
      player.cueVideoById({ videoId: VIDEO_ID });
      setMsg(""); // ok
    } else {
      setMsg("Nie ustawiono ID wideo.");
    }
  } catch(e) {
    console.error(e);
    setMsg("Nie udało się zainicjalizować odtwarzacza.");
  }
  setupUI();
}

function onState(ev){
  const st = ev.data, YTS = YT.PlayerState;
  updatePlayIcon(st === YTS.PLAYING);

  if (st === YTS.PLAYING) startTicker();
  else { stopTicker(); if (st === YTS.ENDED){ seek.value = 0; timeNow.textContent = "0:00"; } }

  const d = safeGetDuration(); if (d > 0) timeDur.textContent = fmtTime(d);
}

function onError(e){
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

function setupUI(){
  playBtn.addEventListener("click", togglePlay);

  seek.addEventListener("input", () => {
    if (!dragging) return;
    const d = safeGetDuration(); const t = (seek.value/1000)*d;
    timeNow.textContent = fmtTime(t);
  });
  const startDrag = () => dragging = true;
  const commitSeek = () => {
    const d = safeGetDuration();
    if (d > 0) player.seekTo((seek.value/1000)*d, true);
    dragging = false;
  };
  seek.addEventListener("mousedown", startDrag);
  seek.addEventListener("touchstart", startDrag, {passive:true});
  seek.addEventListener("mouseup", commitSeek);
  seek.addEventListener("touchend", commitSeek);
  seek.addEventListener("change", commitSeek);

  vol.addEventListener("input", () => {
    try {
      player.setVolume(parseInt(vol.value,10));
      if (player.isMuted() && vol.value > 0) player.unMute();
      updateMuteIcon();
    } catch {}
  });

  muteBtn.addEventListener("click", () => {
    try {
      if (player.isMuted() || player.getVolume() === 0) {
        player.unMute(); if (vol.value === "0") { vol.value = "50"; player.setVolume(50); }
      } else player.mute();
      updateMuteIcon();
    } catch {}
  });

  rateSel.addEventListener("change", () => {
    try { player.setPlaybackRate(parseFloat(rateSel.value)); } catch {}
  });

  fsBtn.addEventListener("click", async () => {
    try {
      if (!document.fullscreenElement) await shell.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  });

  window.addEventListener("keydown", (e) => {
    if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    if (e.key === "ArrowRight") player.seekTo(safeGetTime()+5, true);
    if (e.key === "ArrowLeft")  player.seekTo(Math.max(0, safeGetTime()-5), true);
    if (e.key.toLowerCase() === "m") muteBtn.click();
    if (e.key.toLowerCase() === "f") fsBtn.click();
  });

  try { player.setVolume(100); updateMuteIcon(); } catch {}
}

function togglePlay(){
  try {
    const st = player.getPlayerState();
    if (st === YT.PlayerState.PLAYING) player.pauseVideo();
    else player.playVideo();
  } catch {}
}

function startTicker(){
  stopTicker();
  ticker = setInterval(() => {
    const d = safeGetDuration(), t = safeGetTime();
    if (d > 0 && !dragging) {
      seek.value = Math.round((t/d)*1000);
      timeNow.textContent = fmtTime(t);
      timeDur.textContent = fmtTime(d);
    }
  }, 250);
}
function stopTicker(){ if (ticker) { clearInterval(ticker); ticker = null; } }
function updatePlayIcon(playing){
  playBtn.innerHTML = playing
    ? '<svg viewBox="0 0 24 24" class="i"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>'
    : '<svg viewBox="0 0 24 24" class="i"><path d="M8 5v14l11-7z"/></svg>';
}
function updateMuteIcon(){
  let muted = false;
  try { muted = player.isMuted() || player.getVolume() === 0; } catch {}
  muteBtn.innerHTML = muted
    ? '<svg viewBox="0 0 24 24" class="i"><path d="M7 9v6h4l5 5V4l-5 5H7zM19 12l3 3-1.5 1.5L17.5 13.5 14 10l1.5-1.5L19 12z"/></svg>'
    : '<svg viewBox="0 0 24 24" class="i"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>';
}
function safeGetTime(){ try { return player.getCurrentTime()||0; } catch { return 0; } }
function safeGetDuration(){ try { return player.getDuration()||0; } catch { return 0; } }

// Prosty diagnostyk do konsoli (nie pokazuje pełnego ID)
window.__yt_diag = () => ({
  ytApiLoaded: !!window.YT,
  key,
  idLen: VIDEO_ID ? VIDEO_ID.length : 0,
  idMasked: maskId(VIDEO_ID),
  location: location.href
});
