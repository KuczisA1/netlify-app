// ======= Minimalna „obfuskacja” ID =======
// Podmień wartości tablic na swoje klucze (?id=YT_FILM1 itp.).
// Jak wygenerować tablicę dla ID (offline / w konsoli dev):
//   Array.from("YOUR_VIDEO_ID").map(c => c.charCodeAt(0) ^ 73)
// To samo decode(…):  String.fromCharCode(...arr.map(n => n ^ 73))
const OBF_MAP = {
  // PRZYKŁAD: YT_FILM1 = "dQw4w9WgXcQ"
  YT_FILM1: [45,24,62,125,62,112,30,46,17,42,24],
  // YT_FILM_MATURA: [/* <- tu Twoje liczby */]
};

// ======= Konfiguracja =======
const DEFAULT_KEY = "YT_FILM1"; // użyj klucza z OBF_MAP
const PLAYER_VARS = {
  // ukrywamy natywne kontrolki YT:
  controls: 0, modestbranding: 1, rel: 0, fs: 0, disablekb: 1, playsinline: 1, iv_load_policy: 3
};

// ======= Helpery =======
const $ = (sel) => document.querySelector(sel);
const msg = $("#msg");
const playBtn = $("#playPause");
const seek = $("#seek");
const vol = $("#volume");
const muteBtn = $("#muteToggle");
const rateSel = $("#rate");
const fsBtn = $("#fullscreen");
const timeNow = $("#timeNow");
const timeDur = $("#timeDur");
const card = $("#playerCard");
const shell = $("#playerShell");

function setMsg(t){ msg.textContent = t || ""; }
function fmtTime(s){
  s = Math.max(0, Math.floor(s||0));
  const m = Math.floor(s/60), r = s%60;
  return `${m}:${r.toString().padStart(2,"0")}`;
}
function decodeId(arr){ return String.fromCharCode(...arr.map(n => n ^ 73)); }

// Utrudnienia pro-kopiowanie (to nie jest „ochrona”, tylko friction)
window.addEventListener("contextmenu", e => e.preventDefault(), {capture:true});
window.addEventListener("keydown", e => {
  if ((e.ctrlKey || e.metaKey) && ["u","s","c"].includes(e.key.toLowerCase())) e.preventDefault();
}, {capture:true});

// ======= Pozyskanie „klucza” z URL bez ujawniania ID =======
const params = new URLSearchParams(location.search);
const key = params.get("id") || DEFAULT_KEY;
const VIDEO_ID = OBF_MAP[key] ? decodeId(OBF_MAP[key]) : null;
if (!VIDEO_ID) setMsg("Brak zdefiniowanego wideo dla tego klucza (?id=...).");

// ======= YouTube IFrame API =======
let player = null;
let ticker = null;
let dragging = false;

window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("player", {
    width: "100%", height: "100%",
    videoId: "", // nie przekazujemy ID tutaj, by nie było w DOM/HTML
    host: "https://www.youtube-nocookie.com",
    playerVars: PLAYER_VARS,
    events: {
      onReady: onReady,
      onStateChange: onState
    }
  });
};

function onReady(){
  try{
    if (VIDEO_ID) {
      player.cueVideoById({ videoId: VIDEO_ID });
    }
  }catch(e){
    setMsg("Nie udało się zainicjalizować odtwarzacza.");
  }
  setupUI();
}

function onState(ev){
  const YTState = YT.PlayerState;
  // 1 - playing, 2 - paused, etc.
  const st = ev.data;
  updatePlayIcon(st === YTState.PLAYING);

  if (st === YTState.PLAYING) {
    startTicker();
  } else if (st === YTState.PAUSED || st === YTState.ENDED || st === YTState.CUED) {
    stopTicker();
    if (st === YTState.ENDED) {
      seek.value = 0;
      timeNow.textContent = "0:00";
    }
  }

  // Ustal czas trwania, gdy dostępny
  const d = safeGetDuration();
  if (d > 0) timeDur.textContent = fmtTime(d);
}

function setupUI(){
  // Play/Pause
  playBtn.addEventListener("click", () => togglePlay());

  // Seek
  seek.addEventListener("input", () => {
    if (!dragging) return;
    const d = safeGetDuration();
    const t = (seek.value/1000) * d;
    timeNow.textContent = fmtTime(t);
  });
  seek.addEventListener("mousedown", () => dragging = true);
  seek.addEventListener("touchstart", () => dragging = true);
  const commitSeek = () => {
    const d = safeGetDuration();
    if (d > 0) {
      const t = (seek.value/1000) * d;
      player.seekTo(t, true);
    }
    dragging = false;
  };
  seek.addEventListener("mouseup", commitSeek);
  seek.addEventListener("touchend", commitSeek);
  seek.addEventListener("change", commitSeek);

  // Volume
  vol.addEventListener("input", () => {
    player.setVolume(parseInt(vol.value,10));
    if (player.isMuted() && vol.value > 0) player.unMute();
    updateMuteIcon();
  });

  // Mute
  muteBtn.addEventListener("click", () => {
    if (player.isMuted() || player.getVolume() === 0) {
      player.unMute(); if (vol.value === "0") { vol.value = "50"; player.setVolume(50); }
    } else {
      player.mute();
    }
    updateMuteIcon();
  });

  // Rate
  rateSel.addEventListener("change", () => {
    const r = parseFloat(rateSel.value);
    player.setPlaybackRate(r);
  });

  // Fullscreen (theater na kontenerze)
  fsBtn.addEventListener("click", async () => {
    try{
      if (!document.fullscreenElement) {
        await shell.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    }catch{}
  });

  // Skróty klawiatury
  window.addEventListener("keydown", (e) => {
    if (["INPUT","TEXTAREA","SELECT"].includes(document.activeElement?.tagName)) return;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); }
    if (e.key === "ArrowRight") { player.seekTo(player.getCurrentTime() + 5, true); }
    if (e.key === "ArrowLeft") { player.seekTo(Math.max(0, player.getCurrentTime() - 5), true); }
    if (e.key.toLowerCase() === "m") { muteBtn.click(); }
    if (e.key.toLowerCase() === "f") { fsBtn.click(); }
  });

  // Ustawienia startowe
  try {
    player.setVolume(100);
    updateMuteIcon();
  } catch {}
}

function togglePlay(){
  const st = player.getPlayerState();
  if (st === YT.PlayerState.PLAYING) player.pauseVideo();
  else player.playVideo();
}

function startTicker(){
  stopTicker();
  ticker = setInterval(() => {
    const d = safeGetDuration();
    const t = safeGetTime();
    if (d > 0) {
      if (!dragging) {
        seek.value = Math.round((t/d)*1000);
        timeNow.textContent = fmtTime(t);
        timeDur.textContent = fmtTime(d);
      }
    }
  }, 250);
}
function stopTicker(){ if (ticker) { clearInterval(ticker); ticker = null; } }

function updatePlayIcon(playing){
  playBtn.innerHTML = playing
    ? '<svg viewBox="0 0 24 24" class="i"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' // pause
    : '<svg viewBox="0 0 24 24" class="i"><path d="M8 5v14l11-7z"/></svg>'; // play
}

function updateMuteIcon(){
  const muted = player.isMuted() || player.getVolume() === 0;
  muteBtn.innerHTML = muted
    ? '<svg viewBox="0 0 24 24" class="i"><path d="M7 9v6h4l5 5V4l-5 5H7zM19 12l3 3-1.5 1.5L17.5 13.5 14 10l1.5-1.5L19 12z"/></svg>'
    : '<svg viewBox="0 0 24 24" class="i"><path d="M7 9v6h4l5 5V4l-5 5H7z"/></svg>';
}

function safeGetTime(){ try { return player.getCurrentTime() || 0; } catch { return 0; } }
function safeGetDuration(){ try { return player.getDuration() || 0; } catch { return 0; } }

// Start (gdy API załadowane wywoła onYouTubeIframeAPIReady)
if (!OBF_MAP[key]) {
  setMsg("Uwaga: nie znaleziono klucza w OBF_MAP. Użyj ?id=YT_FILM1 albo dopisz swój.");
}
