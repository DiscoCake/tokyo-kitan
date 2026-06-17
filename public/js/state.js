export const SCENE_NUMS = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五'];
export const SAVE_KEY = 'tokyo_kitan_save_v1';
export const PROFILE_KEY = 'tokyo_kitan_profile_v1';

export const S = {
  playerName: '旅人',
  sceneNum: 0,
  furigana: true,
  scale: 1,
  history: [],
  currentScene: null,
  loading: false,
  mysteryMemo: '',
  vocabLog: [],
  grammarSeen: [],
  npcLog: [],
  lapsedSurfaced: [],          // per-run log of lapsed Anki words that appeared in scenes: { word, reading, sceneNum, location } (#19)
  items: [],
  gallery: [],
  peeks: 0,
  unknownTaps: 0,
  // Persistent learner profile — survives restart, stored under PROFILE_KEY (keyed by player
  // name), NOT in the per-run save blob that clearSave() wipes. This is what gives grammar
  // spaced reinforcement and output history continuity across separate story runs.
  globalSceneCount: 0,   // total scenes ever read — the clock for grammar reinforcement spacing
  grammarMastery: {},    // 【expr】 head → { expr, exposures, lastSeen, strength }
  errorLog: [],          // typed-output journal: { sceneNum, answer, feedback } (newest first)
  // Dungeon mode state
  mode: 'visual-novel',        // 'visual-novel' | 'dungeon'
  dungeonPos: { x: 1, y: 7 }, // tile coordinates; matches MAP start position
  currentRoomId: null,         // room the player is currently inside
  visitedRooms: new Set(),     // roomIds where a scene has been entered
  roomScenes: {},              // roomId → last scene object seen; restored on re-entry
  exploredTiles: new Set(),    // "x,y" strings for fog-of-war reveal
  dungeonLayout: null          // roomId → {x,y} map, generated each run
};

export function saveGame() {
  try {
    const snap = {
      playerName: S.playerName, sceneNum: S.sceneNum, history: S.history,
      currentScene: S.currentScene, mysteryMemo: S.mysteryMemo,
      vocabLog: S.vocabLog, grammarSeen: S.grammarSeen, npcLog: S.npcLog,
      lapsedSurfaced: S.lapsedSurfaced,
      items: S.items, gallery: S.gallery, peeks: S.peeks, unknownTaps: S.unknownTaps,
      mode: S.mode,
      dungeonPos: { ...S.dungeonPos },
      currentRoomId: S.currentRoomId,
      visitedRooms: [...S.visitedRooms],
      roomScenes: S.roomScenes,
      exploredTiles: [...S.exploredTiles],
      dungeonLayout: S.dungeonLayout
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
    fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(snap)
    }).catch(() => {});
  } catch(e) {}
}

export async function loadGameFromServer(name) {
  try {
    const r = await fetch(`/api/save/${encodeURIComponent(name)}`);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { return null; }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
  if (S.playerName) {
    fetch(`/api/save/${encodeURIComponent(S.playerName)}`, { method: 'DELETE' }).catch(() => {});
  }
}

// Persistent learner profile — deliberately separate from the run save so it outlives
// restart/ending (which call clearSave()). Keyed by player name within one localStorage blob.
export function saveProfile() {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    all[S.playerName] = {
      globalSceneCount: S.globalSceneCount,
      grammarMastery: S.grammarMastery,
      errorLog: S.errorLog
    };
    localStorage.setItem(PROFILE_KEY, JSON.stringify(all));
  } catch(e) {}
}

export function loadProfile(name) {
  try {
    const all = JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}');
    const p = all[name];
    S.globalSceneCount = p?.globalSceneCount || 0;
    S.grammarMastery   = p?.grammarMastery   || {};
    S.errorLog         = p?.errorLog         || [];
  } catch(e) {
    S.globalSceneCount = 0; S.grammarMastery = {}; S.errorLog = [];
  }
}
