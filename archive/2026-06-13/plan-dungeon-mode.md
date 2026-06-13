# Plan: V2 Dungeon Mode + Mode Select

## Context
The user wants to add an optional dungeon-crawler navigation layer to the game, selectable from
the title screen. In "Dungeon Explorer" mode, instead of clicking choices to advance scenes, the
player moves a character through a 2D top-down tile map of Tokyo locations. Entering a room
triggers the existing scene generation machinery — same API call, same `generate()`, same vocab/
TTS/furigana system. After a scene resolves, the player returns to the map. The visual novel
mode stays intact; both are accessible from a mode select screen.

**Key constraint**: no new build step, no heavy 3D libraries. Pure canvas API + vanilla JS.

---

## Architecture

```
Title Screen (mode select)
    ├── 「物語モード」 → existing visual novel flow (unchanged)
    └── 「探索モード」 → dungeon canvas shown; WASD movement
                            ↓ enter room
                        generate({ kind: 'room', roomId }) called
                            ↓
                        #game-screen overlay appears (existing layout, unchanged)
                            ↓ choice made / answer submitted
                        "マップに戻る" button → overlay hides, dungeon resumes
```

The AI generation is **completely unchanged**. `generate()`, `renderScene()`, TTS, vocab chips,
furigana — none of it changes. The dungeon is a navigation shell that triggers existing scenes.

---

## Files to Change

| File | Change |
|---|---|
| `public/js/dungeon.js` | **New.** Map data, canvas renderer, WASD input, room detection |
| `public/js/state.js` | Add `S.mode`, `S.dungeonPos`, `S.visitedRooms` to state + save/load |
| `public/index.html` | Add `<canvas id="dungeon-canvas">` + mode select buttons on title |
| `public/css/style.css` | Dungeon canvas layout, mode-select button styles, "back to map" btn |
| `public/js/main.js` | Wire mode select; call `initDungeon()` / `startDungeon()` |
| `public/js/game.js` | Inject "マップに戻る" button after scene renders in dungeon mode |
| `CLAUDE.md` | Document dungeon mode, new state fields, `dungeon.js` in architecture |
| `archive/2026-06-13/` | Archive `state.js`, `main.js`, `index.html` before edits |

---

## Map Design

Hand-authored 32×22 tile grid. Three distinct districts matching the 3-act mystery structure.
Tile types: `0`=wall, `1`=floor, `2`=room trigger, `3`=player start.

**12 named rooms** across three wings:
- **Act 1 wing** — 駅 (station area): ホーム, 改札口, 暗い路地
- **Act 2 wing** — 神社 (shrine district): 鳥居, 社務所, 隠れた庭
- **Act 3 wing** — 地下 (underground/rooftop): 地下道, 古い事務所, 屋上

Each room entry passes `roomId` and the room's `name_jp` into `generate()` as part of `userMsg`,
so the AI knows what location it's describing.

Canvas render: 24px tiles, citypop color palette (indigo walls, dim floor, pink room highlights).
Player = small cyan square with a directional arrow. Visited rooms dim slightly on the map.

---

## `dungeon.js` — Key Exports

```js
export function initDungeon()          // set up canvas, attach keydown listener
export function startDungeon()         // hide title, show canvas, place player at start
export function exitDungeonRoom()      // hide #game-screen overlay, resume dungeon
export function markRoomVisited(id)    // add to S.visitedRooms, redraw map
```

Internal:
- `drawMap()` — full canvas redraw each frame (requestAnimationFrame loop)
- `tryMove(dx, dy)` — collision-checks next tile; if ROOM tile, show enter prompt
- `enterRoom(roomId)` — calls `generate({ kind: 'room', roomId, roomName })` from game.js

---

## State Changes (`state.js`)

```js
// additions to S:
mode: 'visual-novel',         // 'visual-novel' | 'dungeon'
dungeonPos: { x: 2, y: 11 }, // starting tile
visitedRooms: new Set(),      // roomIds already entered
```

`saveGame()` serializes `mode`, `dungeonPos`, `visitedRooms` (as array).
`loadGame()` restores them; `clearSave()` resets to defaults.

---

## `generate()` changes (`game.js`)

Add one branch to `userMsg` construction for dungeon room entry:
```js
} else if (action.kind === 'room') {
  userMsg = `Scene ${S.sceneNum} of ~12. The player entered ${action.roomName} (${action.roomId}).
  Generate a scene set in this specific location. ${memoCtx}${itemCtx}${diffCtx}${histCtx}`;
}
```

After `renderScene()` in dungeon mode, inject a "マップに戻る" button into `#choices`:
```js
if (S.mode === 'dungeon' && scene.scene_type !== 'input') {
  // append back-to-map button after choice buttons
}
```
Clicking it calls `exitDungeonRoom()` from dungeon.js.

---

## Title Screen (index.html + main.js)

After the name input `<div>`, add:
```html
<div id="mode-select">
  <button id="mode-story-btn">
    <ruby>物語<rt>ものがたり</rt></ruby>モード
  </button>
  <button id="mode-dungeon-btn">
    <ruby>探索<rt>たんさく</rt></ruby>モード
  </button>
</div>
```

`main.js`: clicking either button sets `S.mode` and either calls `generate()` (visual-novel)
or `startDungeon()` (dungeon). Resume logic checks `S.mode` to decide which screen to show.

---

## Phased scope

**Phase 1 (this plan):** Playable prototype
- Mode select UI on title
- Canvas dungeon with full map, WASD movement, wall collision
- Room entry prompt → scene generation → "back to map" button
- Visited room visual indicator on map
- Save/resume includes dungeon position and visited rooms

**Phase 2 (future):** Polish
- Minimap overlay in corner
- Fog of war (unexplored rooms hidden)
- Item pickups visible on map
- Ambient sound varies by district
- NPC sprites on map that trigger dialogue

---

## Verification

1. Title screen shows both mode buttons; both start a game correctly
2. Visual novel mode: unchanged behavior end-to-end
3. Dungeon mode: WASD moves player, walls block, floor tiles allow movement
4. Walking onto a room tile shows room name + enter prompt (Japanese)
5. Pressing Enter/Space enters room → cinematic opens → scene generates → plays normally
6. After scene, "マップに戻る" button returns to dungeon canvas
7. Visited rooms show dimmed on map
8. Save a dungeon-mode game, refresh, resume → restores dungeon position and visited rooms
9. Furigana toggle, TTS, vocab chips all work normally inside dungeon-mode scenes
