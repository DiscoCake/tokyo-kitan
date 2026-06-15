import { S } from './state.js';

// ── Tile constants ──
const W = 0; // wall
const F = 1; // floor
const T = 3; // player start (treated as floor)

// ── Map: 32 cols × 14 rows ──
// Three wings (駅, 神社, 地下) connected by a central corridor at row 7.
// Walls at cols 9-11 and 20-22 separate the wings except at the corridor row.
// Room trigger positions are placed dynamically — see generateLayout().
const MAP = [
//col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
/*r0*/ [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
/*r1*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r2*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r3*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r4*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r5*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r6*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r7*/ [W, T, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // corridor
/*r8*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r9*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r10*/[W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r11*/[W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r12*/[W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r13*/[W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
];

// ── Room registry — name only; positions assigned dynamically each run ──
const ROOMS = {
  // Wing 1 — 駅エリア (Act 1)
  'platform':     { name_jp:'<ruby>駅<rt>えき</rt></ruby>のホーム',                                         name_plain:'駅のホーム' },
  'ticket_gate':  { name_jp:'<ruby>改札口<rt>かいさつぐち</rt></ruby>',                                       name_plain:'改札口' },
  'alley':        { name_jp:'<ruby>暗<rt>くら</rt></ruby>い<ruby>路地<rt>ろじ</rt></ruby>',                   name_plain:'暗い路地' },
  'noodle_shop':  { name_jp:'そば<ruby>屋<rt>や</rt></ruby>',                                                name_plain:'駅のそば屋' },
  // Wing 2 — 神社エリア (Act 2)
  'torii':        { name_jp:'<ruby>鳥居<rt>とりい</rt></ruby>',                                              name_plain:'鳥居' },
  'shrine_office':{ name_jp:'<ruby>社務所<rt>しゃむしょ</rt></ruby>',                                         name_plain:'社務所' },
  'hidden_garden':{ name_jp:'<ruby>隠<rt>かく</rt></ruby>れた<ruby>庭<rt>にわ</rt></ruby>',                   name_plain:'隠れた庭' },
  'stone_path':   { name_jp:'<ruby>石畳<rt>いしだたみ</rt></ruby>の<ruby>道<rt>みち</rt></ruby>',              name_plain:'石畳の道' },
  // Wing 3 — 地下エリア (Act 3)
  'underground':  { name_jp:'<ruby>地下道<rt>ちかどう</rt></ruby>',                                           name_plain:'地下道' },
  'old_office':   { name_jp:'<ruby>古<rt>ふる</rt></ruby>い<ruby>事務所<rt>じむしょ</rt></ruby>',              name_plain:'古い事務所' },
  'fire_escape':  { name_jp:'<ruby>非常階段<rt>ひじょうかいだん</rt></ruby>',                                  name_plain:'非常階段' },
  'rooftop':      { name_jp:'<ruby>屋上<rt>おくじょう</rt></ruby>',                                           name_plain:'屋上' },
};

// Candidate slot positions per wing.
// Step-2 grid: any two slots have Chebyshev distance ≥ 2 so rooms are never adjacent.
// 12 slots per wing → C(12,4) = 495 possible arrangements per wing.
const WING_SLOTS = [
  // Wing 1: cols 2,4,6 × rows 2,4,9,11
  [{x:2,y:2},{x:4,y:2},{x:6,y:2},{x:2,y:4},{x:4,y:4},{x:6,y:4},
   {x:2,y:9},{x:4,y:9},{x:6,y:9},{x:2,y:11},{x:4,y:11},{x:6,y:11}],
  // Wing 2: cols 13,15,17 × rows 2,4,9,11
  [{x:13,y:2},{x:15,y:2},{x:17,y:2},{x:13,y:4},{x:15,y:4},{x:17,y:4},
   {x:13,y:9},{x:15,y:9},{x:17,y:9},{x:13,y:11},{x:15,y:11},{x:17,y:11}],
  // Wing 3: cols 24,26,28 × rows 2,4,9,11
  [{x:24,y:2},{x:26,y:2},{x:28,y:2},{x:24,y:4},{x:26,y:4},{x:28,y:4},
   {x:24,y:9},{x:26,y:9},{x:28,y:9},{x:24,y:11},{x:26,y:11},{x:28,y:11}],
];

const WING_ROOM_IDS = [
  ['platform','ticket_gate','alley','noodle_shop'],
  ['torii','shrine_office','hidden_garden','stone_path'],
  ['underground','old_office','fire_escape','rooftop'],
];

// Act gating — at least one room per act must be visited before the next act unlocks
const ACT1_ROOM_IDS = ['platform','ticket_gate','alley','noodle_shop'];
const ACT2_ROOM_IDS = ['torii','shrine_office','hidden_garden','stone_path'];

// ── Dynamic layout (rebuilt from S.dungeonLayout each run) ──
let roomPositions = {}; // roomId → {x, y}
let ROOM_COORDS = {};   // "x,y" → roomId

function applyLayout(layout) {
  roomPositions = layout;
  ROOM_COORDS = {};
  for (const [id, pos] of Object.entries(layout)) {
    ROOM_COORDS[`${pos.x},${pos.y}`] = id;
  }
}

export function generateLayout() {
  const layout = {};
  for (let wing = 0; wing < 3; wing++) {
    const shuffled = [...WING_SLOTS[wing]].sort(() => Math.random() - 0.5);
    WING_ROOM_IDS[wing].forEach((id, i) => { layout[id] = { x: shuffled[i].x, y: shuffled[i].y }; });
  }
  applyLayout(layout);
  return layout;
}

export function restoreLayout(layout) {
  applyLayout(layout);
}

// ── Module state ──
const TILE = 22; // px per tile at native canvas resolution
const MINI = 4;  // px per tile on the minimap canvas
const COLS = MAP[0].length;
const ROWS = MAP.length;
const FOG_RADIUS = 3;

let canvas, ctx;
let _onEnterRoom = null;
let dungeonActive = false;
let promptRoomId = null;
let _gateTimer = null;

// ── Public API ──

export function initDungeon({ onEnterRoom }) {
  _onEnterRoom = onEnterRoom;
  canvas = document.getElementById('dungeon-canvas');
  ctx = canvas.getContext('2d');
  canvas.width  = COLS * TILE;
  canvas.height = ROWS * TILE;
  document.addEventListener('keydown', onKey);
}

export function startDungeon() {
  dungeonActive = true;
  document.getElementById('dungeon-screen').style.display = 'block';
  document.getElementById('minimap-canvas').style.display = 'none';
  document.getElementById('minimap-btn').style.display = 'none';
  revealAround(S.dungeonPos.x, S.dungeonPos.y);
  updateDistrict();
  // Check if spawning on a room tile (resume mid-dungeon)
  const key = `${S.dungeonPos.x},${S.dungeonPos.y}`;
  promptRoomId = ROOM_COORDS[key] || null;
  if (promptRoomId) showPrompt(ROOMS[promptRoomId]);
  else hidePrompt();
  draw();
}

export function exitDungeonRoom() {
  if (S.currentRoomId) {
    const heroImg = document.getElementById('hero-img');
    const cachedScene = { ...S.currentScene };
    if (heroImg.classList.contains('loaded')) cachedScene._imgSrc = heroImg.src;
    S.roomScenes[S.currentRoomId] = cachedScene;
    S.visitedRooms.add(S.currentRoomId);
    S.currentRoomId = null;
  }
  dungeonActive = true;
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('minimap-canvas').style.display = 'none';
  document.getElementById('minimap-btn').style.display = 'none';
  document.getElementById('dungeon-screen').style.display = 'block';
  updateDistrict();
  // Show prompt if still standing on the room tile they just left
  const key = `${S.dungeonPos.x},${S.dungeonPos.y}`;
  promptRoomId = ROOM_COORDS[key] || null;
  if (promptRoomId) showPrompt(ROOMS[promptRoomId]);
  else hidePrompt();
  draw();
}

export function hideDungeonScreen() {
  dungeonActive = false;
  document.getElementById('dungeon-screen').style.display = 'none';
  hidePrompt();
}

// ── Input handling ──

function onKey(e) {
  if (!dungeonActive) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;

  if (promptRoomId) {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'e') {
      e.preventDefault();
      enterRoom(promptRoomId);
      return;
    } else if (e.key === 'Escape') {
      e.preventDefault();
      promptRoomId = null;
      hidePrompt();
      draw();
      return;
    } else if (['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      promptRoomId = null;
      hidePrompt();
    } else {
      return;
    }
  }

  let dx = 0, dy = 0;
  if (e.key === 'w' || e.key === 'ArrowUp')    { dy = -1; e.preventDefault(); }
  if (e.key === 's' || e.key === 'ArrowDown')   { dy =  1; e.preventDefault(); }
  if (e.key === 'a' || e.key === 'ArrowLeft')   { dx = -1; e.preventDefault(); }
  if (e.key === 'd' || e.key === 'ArrowRight')  { dx =  1; e.preventDefault(); }

  if (dx !== 0 || dy !== 0) tryMove(dx, dy);
}

function tryMove(dx, dy) {
  const nx = S.dungeonPos.x + dx;
  const ny = S.dungeonPos.y + dy;
  if (ny < 0 || ny >= ROWS || nx < 0 || nx >= COLS) return;
  if (MAP[ny][nx] === W) return;

  // Sequential act gating — corridor (row 7) is the only cross-wing path
  if (ny === 7) {
    const act1Done = ACT1_ROOM_IDS.some(id => S.visitedRooms.has(id));
    const act2Done = ACT2_ROOM_IDS.some(id => S.visitedRooms.has(id));
    if (nx >= 9  && !act1Done) { showGateHint(2); return; }
    if (nx >= 20 && !act2Done) { showGateHint(3); return; }
  }

  S.dungeonPos.x = nx;
  S.dungeonPos.y = ny;
  revealAround(nx, ny);
  updateDistrict();

  const key = `${nx},${ny}`;
  promptRoomId = ROOM_COORDS[key] || null;
  if (promptRoomId) showPrompt(ROOMS[promptRoomId]);
  else hidePrompt();

  draw();
}

function enterRoom(roomId) {
  const room = ROOMS[roomId];
  if (!room) return;
  promptRoomId = null;
  dungeonActive = false;
  hidePrompt();

  S.currentRoomId = roomId;
  document.getElementById('dungeon-screen').style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';

  const visitedRoomNames = [...S.visitedRooms]
    .map(id => ROOMS[id]?.name_plain)
    .filter(Boolean);
  _onEnterRoom({ roomId, roomName: room.name_plain, visitedRoomNames });
}

// ── Fog of war ──

function revealAround(x, y) {
  for (let dy = -FOG_RADIUS; dy <= FOG_RADIUS; dy++) {
    for (let dx = -FOG_RADIUS; dx <= FOG_RADIUS; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) S.exploredTiles.add(`${nx},${ny}`);
    }
  }
}

// ── Canvas rendering ──

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      drawTile(x, y, MAP[y][x]);

  // Player sprite
  const px = S.dungeonPos.x * TILE + TILE / 2;
  const py = S.dungeonPos.y * TILE + TILE / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(79,216,232,0.7)';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#4fd8e8';
  ctx.beginPath();
  ctx.arc(px, py, TILE / 2 - 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTile(x, y, tile) {
  const px = x * TILE, py = y * TILE;

  if (!S.exploredTiles.has(`${x},${y}`)) {
    ctx.fillStyle = '#05050f';
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }

  if (tile === W) {
    ctx.fillStyle = '#080812';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = '#12122a';
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    return;
  }

  // Floor base
  ctx.fillStyle = '#13132a';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(180,140,255,0.05)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);

  // Room tile (position from dynamic ROOM_COORDS)
  const roomId = ROOM_COORDS[`${x},${y}`];
  if (roomId) {
    const visited = S.visitedRooms.has(roomId);
    const isPrompted = promptRoomId === roomId;
    const alpha = visited ? 0.3 : (isPrompted ? 1.0 : 0.7);
    const pad = 4;
    ctx.save();
    if (!visited) {
      ctx.shadowColor = isPrompted ? 'rgba(255,111,168,0.9)' : 'rgba(255,111,168,0.5)';
      ctx.shadowBlur = isPrompted ? 14 : 8;
    }
    ctx.fillStyle = `rgba(255,111,168,${alpha})`;
    ctx.fillRect(px + pad, py + pad, TILE - pad * 2, TILE - pad * 2);
    ctx.restore();
  }

  // Amber gate bar on corridor tiles separating locked acts
  if (y === 7 && (x === 9 || x === 20)) {
    const act1Done = ACT1_ROOM_IDS.some(id => S.visitedRooms.has(id));
    const act2Done = ACT2_ROOM_IDS.some(id => S.visitedRooms.has(id));
    const locked = (x === 9 && !act1Done) || (x === 20 && !act2Done);
    if (locked) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,200,50,0.15)';
      ctx.fillRect(px, py, TILE, TILE);
      ctx.fillStyle = 'rgba(255,200,50,0.85)';
      ctx.fillRect(px + TILE / 2 - 1, py, 2, TILE);
      ctx.restore();
    }
  }
}

// ── HTML helpers ──

function showPrompt(room) {
  document.getElementById('dungeon-prompt-name').innerHTML = room.name_jp;
  document.getElementById('dungeon-prompt').style.display = 'flex';
}

function showGateHint(actNum) {
  const el = document.getElementById('dungeon-hint');
  el.innerHTML = actNum === 2
    ? '🔒 <ruby>駅<rt>えき</rt></ruby>エリアを<ruby>探索<rt>たんさく</rt></ruby>してから<ruby>先<rt>さき</rt></ruby>へ'
    : '🔒 <ruby>神社<rt>じんじゃ</rt></ruby>エリアを<ruby>探索<rt>たんさく</rt></ruby>してから<ruby>先<rt>さき</rt></ruby>へ';
  if (_gateTimer) clearTimeout(_gateTimer);
  _gateTimer = setTimeout(() => {
    el.innerHTML = 'WASD /<ruby>矢印<rt>やじるし</rt></ruby>キー で<ruby>移動<rt>いどう</rt></ruby>　ピンクのマスに<ruby>乗<rt>の</rt></ruby>る → Enter/E で<ruby>入室<rt>にゅうしつ</rt></ruby>';
  }, 1800);
}

function hidePrompt() {
  document.getElementById('dungeon-prompt').style.display = 'none';
}

function updateDistrict() {
  const x = S.dungeonPos.x;
  const label = x < 10  ? '<ruby>駅<rt>えき</rt></ruby>エリア'
              : x < 22  ? '<ruby>神社<rt>じんじゃ</rt></ruby>エリア'
              :            '<ruby>地下<rt>ちか</rt></ruby>エリア';
  const el = document.getElementById('dungeon-district');
  if (el) el.innerHTML = label;
}

// ── Minimap ──

export function drawMinimap(miniCanvas) {
  const mCtx = miniCanvas.getContext('2d');
  miniCanvas.width  = COLS * MINI;
  miniCanvas.height = ROWS * MINI;

  mCtx.fillStyle = '#05050f';
  mCtx.fillRect(0, 0, miniCanvas.width, miniCanvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (!S.exploredTiles.has(`${x},${y}`)) continue;
      mCtx.fillStyle = MAP[y][x] === W ? '#10102a' : '#1e1e42';
      mCtx.fillRect(x * MINI, y * MINI, MINI, MINI);
    }
  }

  // Room dots (positions from dynamic roomPositions)
  for (const [id, pos] of Object.entries(roomPositions)) {
    if (!S.exploredTiles.has(`${pos.x},${pos.y}`)) continue;
    const visited = S.visitedRooms.has(id);
    const isCurrent = S.currentRoomId === id;
    mCtx.fillStyle = isCurrent ? '#4fd8e8'
      : visited ? 'rgba(255,111,168,0.35)'
      : 'rgba(255,111,168,0.85)';
    const pad = isCurrent ? 0 : 1;
    mCtx.fillRect(pos.x * MINI + pad, pos.y * MINI + pad, MINI - pad * 2, MINI - pad * 2);
  }

  // Player dot
  if (!S.currentRoomId) {
    mCtx.fillStyle = '#4fd8e8';
    mCtx.fillRect(S.dungeonPos.x * MINI + 1, S.dungeonPos.y * MINI + 1, MINI - 2, MINI - 2);
  }
}
