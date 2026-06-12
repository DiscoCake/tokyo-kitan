import { S } from './state.js';

/* ── VOICES ── */
let kyokoVoice = null, otoyaVoice = null;

function findJaVoices() {
  const vs = speechSynthesis.getVoices();
  kyokoVoice =
    vs.find(v => v.lang === 'ja-JP' && v.name.includes('Kyoko') && v.name.includes('Enhanced')) ||
    vs.find(v => v.lang === 'ja-JP' && v.name.includes('Kyoko')) ||
    vs.find(v => v.lang === 'ja-JP' && v.name.includes('Enhanced')) ||
    vs.find(v => v.lang === 'ja-JP') || null;
  otoyaVoice =
    vs.find(v => v.lang === 'ja-JP' && v.name.includes('Otoya') && v.name.includes('Enhanced')) ||
    vs.find(v => v.lang === 'ja-JP' && v.name.includes('Otoya')) ||
    kyokoVoice;
}

if ('speechSynthesis' in window) {
  findJaVoices();
  speechSynthesis.onvoiceschanged = findJaVoices;
}

/* ── TEXT / SEGMENT HELPERS ── */
function sceneSpokenText() {
  const d = document.createElement('div');
  d.innerHTML = S.currentScene?.scene_jp || '';
  d.querySelectorAll('rt').forEach(rt => rt.remove());
  return d.textContent;
}

// Split text into narration (Kyoko) and 「dialogue」 (Otoya) segments
function parseSegments(text) {
  const segs = [];
  let pos = 0, rem = text;
  while (rem.length) {
    const open = rem.indexOf('「'); // 「
    if (open === -1) {
      if (rem.trim()) segs.push({ text: rem, voice: 'kyoko', startChar: pos });
      break;
    }
    if (open > 0) {
      const nar = rem.slice(0, open);
      if (nar.trim()) segs.push({ text: nar, voice: 'kyoko', startChar: pos });
      pos += open;
      rem = rem.slice(open);
    }
    const close = rem.indexOf('」'); // 」
    if (close === -1) {
      if (rem.trim()) segs.push({ text: rem, voice: 'kyoko', startChar: pos });
      break;
    }
    const dlg = rem.slice(0, close + 1);
    segs.push({ text: dlg, voice: 'otoya', startChar: pos });
    pos += dlg.length;
    rem = rem.slice(close + 1);
  }
  return segs.filter(s => s.text.trim().length > 0);
}

/* ── STATE ── */
export const TTS = {
  text: '',           // full spoken text (also read externally by ui.js clearScene)
  segments: [],       // { text, voice, startChar }[]
  segIdx: 0,
  pausedGlobalChar: 0,
  rate: 0.9,
  rates: [0.7, 0.9, 1.0, 1.2],
  playing: false,
  paused: false,
  startTime: 0,
  timer: null
};

// Incremented on each new play; makes stale segment onend/onerror callbacks no-ops
let _tok = 0;

/* ── PROGRESS ── */
export function ttsGlobalChar() {
  if (!TTS.segments.length) return 0;
  const seg = TTS.segments[TTS.segIdx];
  if (!seg) return 0;
  const elapsed = (Date.now() - TTS.startTime) / 1000;
  // Japanese TTS ~4 chars/sec (English 7 chars/sec is too fast and causes bar to fill early)
  const posInSeg = Math.min(seg.text.length - 1, Math.floor(elapsed * 4 * TTS.rate));
  return Math.min(TTS.text.length - 1, seg.startChar + posInSeg);
}

function ttsUpdateProgress() {
  const frac = TTS.text.length ? ttsGlobalChar() / TTS.text.length : 0;
  document.getElementById('audio-progress-fill').style.width = (frac * 100) + '%';
}

/* ── SEGMENT PLAYER (internal) ── */
function _playSeg(segIdx, offsetInSeg, tok) {
  if (tok !== _tok) return;
  if (segIdx >= TTS.segments.length) { ttsStop(true); return; }
  const seg = TTS.segments[segIdx];
  const u = new SpeechSynthesisUtterance(seg.text.slice(offsetInSeg));
  u.lang = 'ja-JP';
  u.voice = seg.voice === 'otoya' ? otoyaVoice : kyokoVoice;
  u.rate = TTS.rate;
  u.onend = () => {
    if (tok !== _tok || !TTS.playing || TTS.paused) return;
    const next = segIdx + 1;
    if (next < TTS.segments.length) {
      TTS.segIdx = next;
      TTS.startTime = Date.now();
      _playSeg(next, 0, tok);
    } else {
      ttsStop(true);
    }
  };
  u.onerror = () => { if (tok === _tok) ttsStop(false); };
  speechSynthesis.speak(u);
}

/* ── PUBLIC API ── */
export function ttsSpeakFrom(charOffset) {
  speechSynthesis.cancel();
  const tok = ++_tok;
  if (!TTS.segments.length) return;

  let segIdx = 0;
  for (let i = TTS.segments.length - 1; i >= 0; i--) {
    if (charOffset >= TTS.segments[i].startChar) { segIdx = i; break; }
  }
  TTS.segIdx = segIdx;
  TTS.startTime = Date.now();
  TTS.playing = true;
  TTS.paused = false;

  document.getElementById('audio-play').textContent = '⏸';
  document.getElementById('audio-play').classList.add('speaking');

  const offsetInSeg = Math.max(0, charOffset - TTS.segments[segIdx].startChar);
  _playSeg(segIdx, offsetInSeg, tok);

  if (!TTS.timer) TTS.timer = setInterval(ttsUpdateProgress, 250);
}

export function ttsStop(completed) {
  speechSynthesis.cancel();
  TTS.playing = false;
  TTS.paused = false;
  clearInterval(TTS.timer);
  TTS.timer = null;
  const btn = document.getElementById('audio-play');
  btn.textContent = '▶';
  btn.classList.remove('speaking');
  document.getElementById('audio-progress-fill').style.width = completed ? '100%' : '0%';
  if (completed) setTimeout(() => {
    document.getElementById('audio-progress-fill').style.width = '0%';
  }, 1200);
}

/* ── CONTROLS ── */
document.getElementById('audio-play').onclick = function() {
  if (!('speechSynthesis' in window)) { alert('このブラウザは読み上げに対応していません'); return; }
  if (!TTS.playing) {
    TTS.text = sceneSpokenText();
    if (!TTS.text) return;
    TTS.segments = parseSegments(TTS.text);
    TTS.segIdx = 0;
    ttsSpeakFrom(0);
  } else if (TTS.paused) {
    speechSynthesis.resume();
    TTS.paused = false;
    // Restore startTime so time-based progress continues from where it was paused
    const seg = TTS.segments[TTS.segIdx];
    const posInSeg = Math.max(0, TTS.pausedGlobalChar - (seg ? seg.startChar : 0));
    TTS.startTime = Date.now() - (posInSeg / (4 * TTS.rate)) * 1000;
    this.textContent = '⏸';
    this.classList.add('speaking');
  } else {
    TTS.pausedGlobalChar = ttsGlobalChar();
    speechSynthesis.pause();
    TTS.paused = true;
    this.textContent = '▶';
    this.classList.remove('speaking');
  }
};

/* rewind one sentence (。！？ boundaries) */
document.getElementById('audio-back').onclick = function() {
  if (!TTS.playing) return;
  const cur = ttsGlobalChar();
  const upto = TTS.text.slice(0, Math.max(0, cur - 4));
  const lastEnd = Math.max(upto.lastIndexOf('。'), upto.lastIndexOf('！'), upto.lastIndexOf('？'));
  const before = upto.slice(0, lastEnd);
  const prevEnd = Math.max(before.lastIndexOf('。'), before.lastIndexOf('！'), before.lastIndexOf('？'));
  ttsSpeakFrom(prevEnd >= 0 ? prevEnd + 1 : 0);
};

/* click-to-seek on progress bar */
document.getElementById('audio-progress-wrap').onclick = function(e) {
  if (!TTS.text) {
    TTS.text = sceneSpokenText();
    if (!TTS.text) return;
    TTS.segments = parseSegments(TTS.text);
  }
  const rect = this.getBoundingClientRect();
  const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  ttsSpeakFrom(Math.floor(frac * TTS.text.length));
};

/* speed cycle */
document.getElementById('audio-speed').onclick = function() {
  const i = TTS.rates.indexOf(TTS.rate);
  TTS.rate = TTS.rates[(i + 1) % TTS.rates.length];
  this.textContent = TTS.rate + '×';
  if (TTS.playing && !TTS.paused) ttsSpeakFrom(ttsGlobalChar());
};
