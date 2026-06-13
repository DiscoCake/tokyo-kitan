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
  peeks: 0
};

export function saveGame() {
  try {
    const snap = {
      playerName: S.playerName, sceneNum: S.sceneNum, history: S.history,
      currentScene: S.currentScene, mysteryMemo: S.mysteryMemo,
      vocabLog: S.vocabLog, grammarSeen: S.grammarSeen,
      items: S.items, gallery: S.gallery, peeks: S.peeks
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
