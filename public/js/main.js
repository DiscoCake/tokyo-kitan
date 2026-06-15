import { setFurigana as setFuriganaCore } from '/jp-ui/furigana.js';
import { S, SCENE_NUMS, loadGame, loadGameFromServer, clearSave } from './state.js';
import { updateVocabBadge, renderItems, openVocabPanel, openGalleryPanel, openGrammarPanel, clearScene } from './ui.js';
import { generate, renderScene } from './game.js';
import { initDungeon, startDungeon, hideDungeonScreen, drawMinimap } from './dungeon.js';

// Side-effect imports — each module wires its own event listeners on load
import './tts.js';
import './ambience.js';

/* ── SCALE ── */
function setScale(v) {
  S.scale = Math.min(2.0, Math.max(0.5, Math.round(v * 10) / 10));
  document.documentElement.style.setProperty('--s', S.scale);
  const pad = Math.max(0.5, 2 / S.scale);
  document.getElementById('app').style.padding = `${pad}rem ${pad * 1.1}rem ${4 / S.scale}rem`;
  document.getElementById('scale-label').textContent = Math.round(S.scale * 100) + '%';
}
document.getElementById('scale-up').onclick   = () => setScale(S.scale + 0.1);
document.getElementById('scale-down').onclick = () => setScale(S.scale - 0.1);
window.addEventListener('wheel', e => {
  if (e.ctrlKey || e.metaKey) { e.preventDefault(); setScale(S.scale + (e.deltaY < 0 ? 0.1 : -0.1)); }
}, { passive: false });

/* ── FURIGANA ── */
function setFurigana(on) {
  S.furigana = on;
  setFuriganaCore(on);
  document.getElementById('furigana-btn').classList.toggle('active', on);
  document.getElementById('setup-furigana-btn').classList.toggle('active', on);
  document.getElementById('dungeon-furigana-btn').classList.toggle('active', on);
}
document.getElementById('furigana-btn').onclick          = () => setFurigana(!S.furigana);
document.getElementById('setup-furigana-btn').onclick    = () => setFurigana(!S.furigana);
document.getElementById('dungeon-furigana-btn').onclick  = () => setFurigana(!S.furigana);

/* ── TOPBAR TOGGLES ── */
document.getElementById('translation-btn').onclick = function() {
  const b = document.getElementById('translation-box');
  const v = b.style.display !== 'none';
  b.style.display = v ? 'none' : 'block';
  this.classList.toggle('active', !v);
  if (!v) { S.peeks++; }
};
document.getElementById('grammar-btn').onclick = function() {
  const b = document.getElementById('grammar-box');
  const v = b.style.display !== 'none';
  b.style.display = v ? 'none' : 'block';
  this.classList.toggle('active', !v);
};

/* ── TYPED ANSWER + WANAKANA IME ── */
const answerInput = document.getElementById('answer-input');
let imeBound = false;
function bindIME() {
  if (!imeBound && window.wanakana) { wanakana.bind(answerInput, { IMEMode: true }); imeBound = true; }
}
function unbindIME() {
  if (imeBound && window.wanakana) { wanakana.unbind(answerInput); imeBound = false; }
}
bindIME();
document.getElementById('ime-toggle').onclick = function() {
  if (imeBound) { unbindIME(); this.classList.remove('active'); }
  else { bindIME(); this.classList.add('active'); }
  answerInput.focus();
};
document.getElementById('answer-send').onclick = submitAnswer;
answerInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); submitAnswer(); }
});
function submitAnswer() {
  const val = answerInput.value.trim();
  if (!val || S.loading) return;
  const d = document.createElement('div');
  d.innerHTML = S.currentScene?.location_jp || '';
  S.history.push({ num: S.sceneNum, loc: d.textContent, choice: `(typed) ${val}`, type: 'input' });
  generate({ kind: 'answer', value: val });
}

/* ── RESET ── */
function resetGame() {
  S.history = []; S.sceneNum = 0; S.currentScene = null;
  S.mysteryMemo = ''; S.vocabLog = []; S.grammarSeen = [];
  S.items = []; S.gallery = []; S.peeks = 0; S.unknownTaps = 0;
  S.roomScenes = {};
  S.mode = 'visual-novel';
  S.dungeonPos = { x: 1, y: 7 };
  S.visitedRooms = new Set();
  S.currentRoomId = null;
  S.exploredTiles = new Set();
  document.getElementById('minimap-canvas').style.display = 'none';
  updateVocabBadge(); renderItems(false);
  document.getElementById('history-trail').style.display = 'none';
  clearSave();
}

/* ── START / RESUME ── */
function getPlayerName() {
  const n = document.getElementById('name-input').value.trim();
  if (n) S.playerName = n;
}

document.getElementById('start-story-btn').onclick = function() {
  getPlayerName();
  S.mode = 'visual-novel';
  clearSave();
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  generate(null);
};

document.getElementById('start-dungeon-btn').onclick = function() {
  getPlayerName();
  S.mode = 'dungeon';
  S.dungeonPos = { x: 1, y: 7 };
  S.visitedRooms = new Set();
  clearSave();
  document.getElementById('setup-screen').style.display = 'none';
  startDungeon();
};

document.getElementById('resume-btn').onclick = async function() {
  getPlayerName();
  let snap = await loadGameFromServer(S.playerName);
  if (!snap) snap = loadGame();
  if (!snap || !snap.sceneNum) {
    const msg = document.getElementById('resume-msg');
    if (msg) { msg.textContent = `「${S.playerName}」のセーブデータが見つかりません。`; }
    return;
  }
  Object.assign(S, snap);
  S.mode = snap.mode || 'visual-novel';
  S.dungeonPos = snap.dungeonPos || { x: 1, y: 7 };
  S.visitedRooms = new Set(snap.visitedRooms || []);
  S.currentRoomId = snap.currentRoomId || null;
  S.exploredTiles = new Set(snap.exploredTiles || []);
  updateVocabBadge();
  document.getElementById('setup-screen').style.display = 'none';

  if (S.mode === 'dungeon') {
    startDungeon();
  } else {
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('scene-tag').innerHTML =
      '<ruby>場面<rt>ばめん</rt></ruby> ' + (SCENE_NUMS[S.sceneNum - 1] || S.sceneNum);
    if (S.currentScene) renderScene(S.currentScene);
  }
};

/* ── RESTART ── */
document.getElementById('restart-btn').onclick = function() {
  if (!confirm('最初からやり直しますか？単語帳もリセットされます。')) return;
  resetGame();
  hideDungeonScreen();
  document.getElementById('game-screen').style.display = 'block';
  generate(null);
};

document.getElementById('dungeon-restart-btn').onclick = function() {
  if (!confirm('最初からやり直しますか？単語帳もリセットされます。')) return;
  resetGame();
  hideDungeonScreen();
  document.getElementById('game-screen').style.display = 'block';
  generate(null);
};

/* ── ENDING SCREEN ── */
document.getElementById('ending-vocab-btn').onclick = openVocabPanel;
document.getElementById('ending-grammar-btn').onclick = openGrammarPanel;
document.getElementById('ending-gallery-btn').onclick = openGalleryPanel;
document.getElementById('ending-restart-btn').onclick = () => {
  resetGame();
  document.getElementById('ending-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  generate(null);
};

/* ── DUNGEON INIT ── */
initDungeon({
  onEnterRoom: ({ roomId, roomName, visitedRoomNames }) => {
    const miniCanvas = document.getElementById('minimap-canvas');
    miniCanvas.style.display = 'block';
    drawMinimap(miniCanvas);

    const saved = S.roomScenes[roomId];
    if (saved) {
      clearScene();
      if (saved._imgSrc) {
        const img = document.getElementById('hero-img');
        img.src = saved._imgSrc;
        img.classList.add('loaded');
        document.getElementById('hero-skeleton').style.display = 'none';
      }
      renderScene(saved, true, true); // skipImageLoad + skipMeta: restore without side-effects
    } else {
      generate({ kind: 'room', roomId, roomName, visitedRoomNames });
    }
  }
});

/* ── INIT ── */
document.getElementById('resume-btn').style.display = 'inline-flex';
