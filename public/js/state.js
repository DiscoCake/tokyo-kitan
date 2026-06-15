export const SCENE_NUMS = ['一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四','十五'];
export const SAVE_KEY = 'tokyo_kitan_save_v1';

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
  items: [],
  gallery: [],
  peeks: 0,
  unknownTaps: 0,
  // Dungeon mode state
  mode: 'visual-novel',        // 'visual-novel' | 'dungeon'
  dungeonPos: { x: 1, y: 7 }, // tile coordinates; matches MAP start position
  currentRoomId: null,         // room the player is currently inside
  visitedRooms: new Set(),     // roomIds where a scene has been entered
  roomScenes: {},              // roomId → last scene object seen; restored on re-entry
  exploredTiles: new Set()     // "x,y" strings for fog-of-war reveal
};

export function saveGame() {
  try {
    const snap = {
      playerName: S.playerName, sceneNum: S.sceneNum, history: S.history,
      currentScene: S.currentScene, mysteryMemo: S.mysteryMemo,
      vocabLog: S.vocabLog, grammarSeen: S.grammarSeen,
      items: S.items, gallery: S.gallery, peeks: S.peeks, unknownTaps: S.unknownTaps,
      mode: S.mode,
      dungeonPos: { ...S.dungeonPos },
      currentRoomId: S.currentRoomId,
      visitedRooms: [...S.visitedRooms],
      roomScenes: S.roomScenes,
      exploredTiles: [...S.exploredTiles]
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(snap));
  } catch(e) {}
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch(e) {}
}
