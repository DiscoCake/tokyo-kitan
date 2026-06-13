import { S } from './state.js';

// ── Tile constants ──
const W = 0; // wall
const F = 1; // floor
const R = 2; // room trigger
const T = 3; // player start (treated as floor)

// ── Map: 32 cols × 14 rows ──
// Three wings (駅, 神社, 地下) connected by a central corridor at row 7.
// Walls at cols 9-11 and 20-22 separate the wings except at the corridor row.
const MAP = [
//col: 0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
/*r0*/ [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
/*r1*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r2*/ [W, F, R, F, F, F, F, R, F, W, W, W, F, R, F, F, F, F, R, F, W, W, W, F, R, F, F, F, F, R, F, W],
/*r3*/ [W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W, W, W, F, F, F, F, F, F, F, F, W],
/*r4*/ [W, F, R, F, F, F, F, R, F, W, W, W, F, R, F, F, F, F, R, F, W, W, W, F, R, F, F, F, F, R, F, W],
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

// ── Room registry ──
// name_jp: ruby-annotated HTML (shown in prompt)
// name_plain: plain text (passed to generate() for AI context)
const ROOMS = {
  // Wing 1 — 駅エリア (Act 1)
  'platform':     { x:2,  y:2, name_jp:'<ruby>駅<rt>えき</rt></ruby>のホーム',          name_plain:'駅のホーム' },
  'ticket_gate':  { x:7,  y:2, name_jp:'<ruby>改札口<rt>かいさつぐち</rt></ruby>',        name_plain:'改札口' },
  'alley':        { x:2,  y:4, name_jp:'<ruby>暗<rt>くら</rt></ruby>い<ruby>路地<rt>ろじ</rt></ruby>', name_plain:'暗い路地' },
  'noodle_shop':  { x:7,  y:4, name_jp:'そば<ruby>屋<rt>や</rt></ruby>',                  name_plain:'駅のそば屋' },

  // Wing 2 — 神社エリア (Act 2)
  'torii':        { x:13, y:2, name_jp:'<ruby>鳥居<rt>とりい</rt></ruby>',               name_plain:'鳥居' },
  'shrine_office':{ x:18, y:2, name_jp:'<ruby>社務所<rt>しゃむしょ</rt></ruby>',          name_plain:'社務所' },
  'hidden_garden':{ x:13, y:4, name_jp:'<ruby>隠<rt>かく</rt></ruby>れた<ruby>庭<rt>にわ</rt></ruby>', name_plain:'隠れた庭' },
  'stone_path':   { x:18, y:4, name_jp:'<ruby>石畳<rt>いしだたみ</rt></ruby>の<ruby>道<rt>みち</rt></ruby>', name_plain:'石畳の道' },

  // Wing 3 — 地下エリア (Act 3)
  'underground':  { x:24, y:2, name_jp:'<ruby>地下道<rt>ちかどう</rt></ruby>',            name_plain:'地下道' },
  'old_office':   { x:29, y:2, name_jp:'<ruby>古<rt>ふる</rt></ruby>い<ruby>事務所<rt>じむしょ</rt></ruby>', name_plain:'古い事務所' },
  'fire_escape':  { x:24, y:4, name_jp:'<ruby>非常階段<rt>ひじょうかいだん</rt></ruby>',   name_plain:'非常階段' },
  'rooftop':      { x:29, y:4, name_jp:'<ruby>屋上<rt>おくじょう</rt></ruby>',            name_plain:'屋上' },
};

// Reverse lookup: "x,y" → roomId
const ROOM_COORDS = {};
for (const [id, r] of Object.entries(ROOMS)) ROOM_COORDS[`${r.x},${r.y}`] = id;

// ── Module state ──
const TILE = 22; // px per tile at native canvas resolution
const COLS = MAP[0].length;
const ROWS = MAP.length;

let canvas, ctx;
let _onEnterRoom = null; // callback set by main.js: ({ roomId, roomName }) => void
let dungeonActive = false;
let promptRoomId = null; // roomId currently stepped on, awaiting enter/escape

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
  promptRoomId = null;
  document.getElementById('dungeon-screen').style.display = 'block';
  updateDistrict();
  draw();
}

export function exitDungeonRoom() {
  if (S.currentRoomId) {
    S.visitedRooms.add(S.currentRoomId);
    S.currentRoomId = null;
  }
  promptRoomId = null;
  dungeonActive = true;
  document.getElementById('game-screen').style.display = 'none';
  document.getElementById('dungeon-screen').style.display = 'block';
  updateDistrict();
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
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      enterRoom(promptRoomId);
    } else if (e.key === 'Escape' || ['w','a','s','d','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) {
      e.preventDefault();
      promptRoomId = null;
      hidePrompt();
      draw();
    }
    return;
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
  const tile = MAP[ny][nx];
  if (tile === W) return;

  S.dungeonPos.x = nx;
  S.dungeonPos.y = ny;
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

  _onEnterRoom({ roomId, roomName: room.name_plain });
}

// ── Canvas rendering ──

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      drawTile(x, y, MAP[y][x]);
    }
  }

  // Player
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

  if (tile === W) {
    ctx.fillStyle = '#080812';
    ctx.fillRect(px, py, TILE, TILE);
    ctx.fillStyle = '#12122a';
    ctx.fillRect(px + 1, py + 1, TILE - 2, TILE - 2);
    return;
  }

  // Floor (F, T, R all render a floor base)
  ctx.fillStyle = '#13132a';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(180,140,255,0.05)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);

  if (tile === R) {
    const roomId = ROOM_COORDS[`${x},${y}`];
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
}

// ── HTML helpers ──

function showPrompt(room) {
  const el = document.getElementById('dungeon-prompt');
  document.getElementById('dungeon-prompt-name').innerHTML = room.name_jp;
  el.style.display = 'flex';
}

function hidePrompt() {
  document.getElementById('dungeon-prompt').style.display = 'none';
}

function updateDistrict() {
  const x = S.dungeonPos.x;
  let label;
  if (x < 10)      label = '<ruby>駅<rt>えき</rt></ruby>エリア';
  else if (x < 22) label = '<ruby>神社<rt>じんじゃ</rt></ruby>エリア';
  else              label = '<ruby>地下<rt>ちか</rt></ruby>エリア';
  const el = document.getElementById('dungeon-district');
  if (el) el.innerHTML = label;
}
