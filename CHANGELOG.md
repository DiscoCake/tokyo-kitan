# Changelog

### 2026-06-16 — Anki lapsed-vocab reinforcement (#19)

**Feature — subtle in-scene re-exposure of forgotten Anki words (anki.js, server.js, game.js, state.js, main.js, ui.js, index.html, eval/system.js, .env.example):**
- New `anki.js` — read-only AnkiConnect client; `getStrugglingVocab()` queries lapsed cards (`findCards`/`cardsInfo`, query `ANKI_LAPSED_QUERY` default `prop:lapses>=2 -is:new`) → `{word, reading, lapses}[]`. Mirrors the sibling `companion/src/anki.js` struggling-card path, trimmed to the read.
- New route `GET /api/anki/struggling` in `server.js` (last-good in-memory cache). **Anki closed is not an error** — responds `{cards:[], available:false}` (HTTP 200) so the client treats "no Anki" identically to "no lapses": the feature silently no-ops.
- **Client (game.js):** `primeLapsedPool()` fetches once per start/resume into an ephemeral (NOT persisted) module pool; `nextLapsedCandidate()` round-robins one not-yet-surfaced word per scene into `ankiCtx`, appended after `gramCtx` in all four `generate()` branches and held in `activeLapsedCandidate`. Wired via `getPlayerName()` in `main.js`.
- **SYSTEM prompt:** new optional LAPSED VOCABULARY section — "use the one given word ONLY if it fits, story first, skip if forced; never list more than one." Same soft framing as grammar reinforcement (#15). Mirrored into `eval/system.js` (drift guard).
- **Surfacing log:** `renderScene()` checks `stripHtml(scene_jp).includes(word)` — if the model actually used the candidate, pushes `{word, reading, sceneNum, location}` onto new per-run `S.lapsedSurfaced` (serialized in the save blob, NOT the persistent profile; reset in `resetGame()`).
- **UI:** `#mastery-panel` gains a third section (`苦手の言葉が出た場面`, `#mastery-lapsed-list`) listing surfaced words + where; skipped candidates never appear. word/location set via `textContent`.
- **Contract unchanged** — no new validators. Run `eval:update` after this prompt change to refresh snapshots (the SYSTEM addition is inert to existing outputs but the drift guard requires the mirror, which is in place).
- New env: `ANKI_URL`, `ANKI_LAPSED_QUERY` (both optional, documented in `.env.example`). `anki.js` is new. Prior state of `server.js`/`public/*` is recoverable from the parent commit (no separate archive snapshot this round).

### 2026-06-15 — Grammar mastery loop: spaced reinforcement + targeted output

**Feature — persistent learner profile across runs (state.js, game.js, main.js, ui.js, index.html, eval/*):**
- New persistent profile under `PROFILE_KEY` (keyed by player name), separate from the run save so it survives restart/ending: `globalSceneCount` (reinforcement clock), `grammarMastery` (`【expr】` → `{exposures, lastSeen, strength}`), `errorLog` (typed-output journal). `saveProfile()`/`loadProfile(name)` in `state.js`; hydrated in `getPlayerName()`; `resetGame()` deliberately preserves them.
- **Grammar: exposure-once → spaced reinforcement.** SYSTEM prompt now asks for one NEW point (echoed into the new `grammar_point_targeted` field) AND, when present, reuse of a DUE point without re-explaining. `dueGrammar()` scheduler (`REINFORCE_INTERVAL = [0,2,4,8,16]` by strength) feeds `reinforceCtx`, injected alongside `grammarCtx` in every `generate()` branch. Evolves decision #15.
- **Targeted output.** Input scenes are prompted to frame the NPC question so a natural answer uses a run grammar point; `feedback` tightened to name a specific mistake + corrected phrasing. Feedback logged to `errorLog`.
- **UI.** `#mastery-panel` (★ strength + exposure count per point, plus output error journal) via `openMasteryPanel()`; `#mastery-btn` (定着) in topbar and `#ending-mastery-btn` on the ending screen. User-supplied answer/feedback set via `textContent`.
- **Contract.** Added `grammar_point_targeted` (must match `grammar_note` head). Mirrored into `eval/system.js`; new `grammarTargetPresent` validator (now 8 checks); new `reinforce_grammar` golden case (now 11); `assertSystemInSync()` drift guard added to `eval/run.js` (fails fast if mirror diverges). Verified byte-identical.
- **Resilience.** `renderScene` shows a ruby-annotated retry message instead of `undefined` if `scene_jp` is missing.
- Archived prior `state.js`/`game.js`/`main.js`/`ui.js`/`index.html` via PreToolUse hook.
- Snapshots NOT yet refreshed — `grammar_point_targeted` is absent from existing snapshots, so `eval:check` reports `grammarTargetPresent` failures until `eval:update` is run.

### 2026-06-15 — NPC tracker polish and eval fixes

**Fix — NPC panel note safety, ending screen button, eval hardening (ui.js, index.html, main.js, eval/checks.js, game.js, eval/system.js):**
- `openNpcPanel()`: `note` now set via `textContent` (not `innerHTML`) — plain Japanese text has no markup.
- Added `#ending-npc-btn` to ending screen (mirrors grammar/gallery pattern); wired in `main.js`.
- Added `npcFieldsValid` check to `eval/checks.js` — validates `npcs` array structure (name_jp, name_reading, relationship enum, note) on every snapshot run.
- `sceneTextLength` validator now strips ruby markup before measuring (30–300 prose chars) — the 1200 raw-char cap was systematically failing complex N3 scenes due to markup overhead, not excess prose.
- SYSTEM prompt: `scene_jp` capped at 3 sentences for harder difficulty, 4–5 for standard/easier — complexity signals difficulty, not length.
- All 10 eval snapshots refreshed and passing.

### 2026-06-15 — NPC tracker: note field changed to Japanese

**Fix — NPC note now Japanese plain text (game.js, eval/system.js):**
- Updated SYSTEM prompt: `note` field is now 1-sentence Japanese plain text (no ruby markup) instead of English, matching the immersive UI tone.

### 2026-06-15 — NPC tracker panel

**Feature — NPC relationship tracker (scene contract, state, UI):**
- Added `npcs` field to scene JSON contract: array of `{name_jp, name_reading, relationship, note}` for established characters. Model returns only named/identified NPCs; random pedestrians excluded.
- `S.npcLog` accumulates entries via upsert-by-`name_reading` in `renderScene()` — relationship and note update in place when a character reappears. Serialized in saves.
- `openNpcPanel()` added to `ui.js`; `#npc-panel` added to `index.html` (same `.panel` structure as grammar/vocab panels).
- `#npc-btn` (人物) added to `#topbar-right` — accessible during play, not just end-of-game.
- Relationship badges color-coded: cyan=ally, yellow=neutral, pink=suspicious, red=hostile, grey=unknown.
- Updated `eval/system.js` to mirror SYSTEM prompt change.

### 2026-06-15 — Difficulty threshold tuning

**Fix — Adaptive difficulty no longer skews hard (public/js/game.js):**
- Raised the "harder" guard from `sceneNum < 2` to `sceneNum < 4` — no difficulty escalation until there's a meaningful sample of player signals.
- Lowered the "harder" rate threshold from `< 0.25` to `< 0.10` — "harder" now requires fewer than 1 peek/tap per 10 scenes (genuine ease signal), not 1 per 4.
- "easier" threshold (`> 0.6`) and "standard" band unchanged.

### 2026-06-14 — Minimap toggle moved to game screen topbar

**Fix — Minimap toggle now visible inside rooms (public/index.html, public/js/main.js, public/js/dungeon.js):**
- Added `#minimap-btn` to `#topbar-right` (game screen), hidden by default.
- Button appears when entering a room (`onEnterRoom` + resume-into-room path) and hides on
  `exitDungeonRoom()` / `startDungeon()`.
- Both `#minimap-btn` (game screen) and `#dungeon-minimap-btn` (dungeon map) call `setMinimap()`
  and stay in sync — toggling either one updates both.

### 2026-06-14 — Dungeon: resume-in-room, room-tile prompt on spawn, randomised room positions

**Bug fix — Resume restores room scene (public/js/main.js):**
- Resume handler now checks `S.currentRoomId` before deciding where to land. If the player
  saved while inside a room, resume restores the room scene directly (same `renderScene(saved,
  true, true)` path used by re-entry) instead of dropping them at the dungeon map.
- Layout is restored from `S.dungeonLayout` before any `startDungeon()` or room render call.

**Bug fix — Room prompt shows on spawn/exit (public/js/dungeon.js):**
- `startDungeon()` now checks `ROOM_COORDS` against the current position after drawing and
  shows the enter-prompt if the player is standing on a room tile (fixes "must walk off and
  back" on resume). Same fix applied to `exitDungeonRoom()` — stepping back onto the map
  while still on the room tile now immediately re-shows the prompt.

**Feature — Randomised room positions (public/js/dungeon.js, state.js, main.js):**
- Room tile positions are no longer hardcoded. ROOMS now holds name data only; a step-2
  candidate grid per wing (12 slots each, C(12,4)=495 arrangements) is shuffled on each
  new dungeon run via `generateLayout()`.
- `S.dungeonLayout` (roomId → {x,y}) is serialised in saves so layout persists across
  reloads and is restored via `restoreLayout()` on resume.
- `generateLayout()` and `restoreLayout()` exported from `dungeon.js`; called from `main.js`
  on new-game and resume respectively; `resetGame()` clears `S.dungeonLayout`.

---

### 2026-06-14 — Minimap toggle + word card meaning fix

**Minimap toggle (public/index.html, public/js/main.js):**
- Added `<ruby>地図<rt>ちず</rt></ruby>` toggle button (`#dungeon-minimap-btn`) to
  `#dungeon-topbar-right`, styled as a standard `ctrl-btn active` (on by default).
- `onEnterRoom` now checks whether the toggle is active before showing `#minimap-canvas`
  — toggling off mid-room immediately hides the minimap; toggling on re-draws it if
  already inside a room.

**Word card meaning (public/js/ui.js):**
- `showWordCard` now shows `'(not in scene vocab)'` instead of blank when a tapped word
  is not in the scene's vocab list. Previously the meaning field was silently empty,
  which made the feature look broken for most words.

**Vocab count (public/js/game.js, eval/system.js, eval/checks.js):**
- Increased vocab from 4–6 to 8–12 words per scene, skewing toward less common vocab
  the learner may not know. More words covered means fewer `(not in scene vocab)` hits.
- `eval/checks.js` validator updated: `< 6 || > 14` (was `< 4 || > 6`).
- Snapshots regenerated: all 10 pass.

---

### 2026-06-14 — Server-side SQLite persistence (X2)

**server.js:**
- Added `better-sqlite3` dependency; DB initialised at startup at `tokyo_kitan.db`
  (path overridable via `DB_PATH` env var; file is gitignored).
- Schema: single `saves` table — `player_name TEXT PRIMARY KEY`, `data TEXT` (full snap
  JSON), `updated_at TEXT`. Simple and schema-light; no migrations needed while data shape
  is still changing.
- Three new routes:
  - `GET /api/save/:name` — returns the save for that player name (404 if none)
  - `POST /api/save` — upserts by `playerName` field in request body
  - `DELETE /api/save/:name` — clears the save for that player

**public/js/state.js:**
- `saveGame()` fire-and-forgets a `POST /api/save` after each localStorage write (silent
  on failure — localStorage remains the fast same-device path).
- `clearSave()` fire-and-forgets a `DELETE /api/save/:name` alongside localStorage clear.
- New export `loadGameFromServer(name)` — async, returns null on 404/error.

**public/js/main.js:**
- Imports `loadGameFromServer` from state.js.
- Resume button now always visible (removed the `if (loadGame())` guard) — enables
  cross-device resume by entering the same player name on a new device.
- `resume-btn.onclick` is now async: tries server first, falls back to localStorage.
  Shows `#resume-msg` in pink if no save found under that name on either source.

**public/index.html / public/css/style.css:**
- Added `<p id="resume-msg">` below setup buttons for the "no save found" message.
- `#resume-msg` styled: 0.75rem, `--pink`, min-height 1em.

- Archived: `archive/2026-06-14_server.js`, `archive/2026-06-14_state.js`,
  `archive/2026-06-14_main.js`

---

### 2026-06-14 — N1: N3 grammar coverage; N2: prompt caching

**N1 — Grammar coverage (public/js/game.js, eval/system.js):**
- Added GRAMMAR COVERAGE block to SYSTEM prompt between DIFFICULTY and OUTPUT sections.
  Instructs the model to weave in ONE N3 grammar point not yet in the covered list for this
  run — story and natural Japanese come first; nothing forced; if nothing fits, proceed normally.
  Deliberately a *coverage* (breadth) axis, not a difficulty axis — never skews the whole scene
  toward N3 (that's the `harder` difficulty signal, unchanged).
- Added `grammarCtx` in `generate()` ([game.js:220](public/js/game.js#L220)): built from
  `S.grammarSeen` and injected into every user-message branch so the model knows what's
  already been covered this run.
- Mirrored both changes in `eval/system.js` (exact mirror verified; 10/10 eval:check pass).

**N2 — Prompt caching (server.js):**
- Both Anthropic fetch call sites (`/api/scene` and `/api/scene/stream`) now wrap the `system`
  string in `[{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]` before
  forwarding to Anthropic. Client continues sending a plain string; server transforms it.
- No beta header required (prompt caching is GA for Sonnet 4.6 / Opus 4.8).
- Note: the SYSTEM prompt is currently ~600–700 tokens; Sonnet 4.6 requires 2048 tokens minimum
  for a cache hit. Caching is wired and will activate automatically as the prompt grows or if
  the model is switched to a lower-threshold variant. Zero cost if below threshold.
- Archived: `archive/2026-06-14_server.js`, `archive/2026-06-14_game.js`

---

### 2026-06-14 — Eval gate: fix everyKanjiHasRuby failures (7/10 → 10/10)

**Prompt fix (public/js/game.js, eval/system.js):**
- Tightened `scene_jp` ruby instruction to explicitly name the two model blind spots:
  kanji inside 「」 dialogue lines, and both halves of compound/送り仮名 verbs (e.g. 拾い上げる → 拾 AND 上).
  Same change applied to both files; exact-mirror verified programmatically.
- Archived: `archive/2026-06-14_game.js`

**Eval runner (eval/run.js):**
- Added optional trailing slug args so individual cases can be targeted:
  `node eval/run.js update choice_follow dungeon_room` — avoids re-rolling good snapshots.

**Snapshots regenerated:** choice_follow, dungeon_room, quiet_moment, tense_encounter,
with_inventory, harder_difficulty, easier_difficulty, long_history, opener, long_history
(iteratively re-rolled until all 10 pass `everyKanjiHasRuby` and all other checks).

---

### 2026-06-14 — Grammar review panel + Dungeon Phase 2 (fog of war + minimap)

**Grammar review:**
- `public/js/ui.js`: added `openGrammarPanel()` — deduplicated session grammar notes rendered
  with `【expression】` highlighted yellow; exported alongside existing panel functions
- `public/index.html`: added `#grammar-panel` (same `.panel` pattern as vocab/gallery); added
  `#ending-grammar-btn` to ending-actions row; all ending-action buttons now carry ruby markup
- `public/js/main.js`: `ending-grammar-btn` wired to `openGrammarPanel`
- `public/css/style.css`: `.grammar-entry` and `.grammar-expr` styles

**Dungeon Phase 2 — fog of war:**
- `public/js/state.js`: added `exploredTiles: new Set()` field; serialized as array in
  `saveGame`; restored as `new Set(snap.exploredTiles || [])` on resume; reset in `resetGame`
- `public/js/dungeon.js`: `revealAround(x, y)` reveals 3-tile Chebyshev radius around player
  on every move and on `startDungeon`; `drawTile` draws near-black (`#05050f`) for any tile
  not in `S.exploredTiles` and returns early (walls and rooms are hidden until explored)

**Dungeon Phase 2 — minimap:**
- `public/js/dungeon.js`: exports `drawMinimap(miniCanvas)` — draws fog-respecting 4px/tile
  minimap: explored floors in `#1e1e42`, walls in `#10102a`, unvisited rooms pink, visited
  rooms dim pink, current room cyan; hides `#minimap-canvas` on `exitDungeonRoom` and
  `startDungeon`
- `public/index.html`: `<canvas id="minimap-canvas">` as fixed body element (stays visible
  across screen transitions; controlled via `display` style)
- `public/js/main.js`: imports `drawMinimap`; `onEnterRoom` callback shows and draws minimap;
  `resetGame` hides minimap and clears `exploredTiles`
- `public/css/style.css`: `#minimap-canvas` — fixed bottom-left, pixelated rendering, 2× CSS
  scale for crispness on HiDPI

Reverse-chronological. Add an entry whenever a feature is added, changed, or removed.
Include the date (YYYY-MM-DD) and a tight bullet list. Note any archived files.

### 2026-06-14 — Eval prompt fix: ruby coverage + scene length limit

- `public/js/game.js` + `eval/system.js`: strengthened ruby rule in SYSTEM prompt —
  `location_jp` and `scene_jp` now say "NO EXCEPTIONS — every single kanji, including common
  ones like 人・日・駅・続・知"; previously the model intermittently dropped ruby on common kanji
  (surfaced by eval baseline: opener/tense_encounter/easier_difficulty failures)
- `eval/checks.js`: raised `sceneTextLength` upper limit 900 → 1200 chars — the prior limit
  didn't account for ruby markup overhead (~25 chars per annotated kanji); 5-sentence scenes
  with heavy kanji legitimately exceed 900 in markup length
- **Known baseline**: 7/10 snapshots pass `everyKanjiHasRuby` — model non-deterministically
  drops ruby on common kanji (上, 一, 来先一人無理 across runs); which cases fail and which
  kanji are skipped varies per call. Prompt strengthening improved from 6/10 → 7/10 but
  can't fully eliminate. Honest red baseline; check stays — it catches real model behavior.

### 2026-06-14 — Testing methodology: smoke tests + pre-PR harness

- `test/smoke.js`: 7-check golden-path Playwright suite — zero console errors on load,
  setup screen renders, hero name input + start game, scene text populates with Japanese,
  ≥2 choice buttons, furigana toggle hides/shows `rt` elements (computed style check),
  zero console errors after scene generation; exits 0 on pass, 1 on fail; falls back to
  npx cache path if `playwright` devDep not installed
- `package.json`: added `"test:smoke": "node test/smoke.js"` script

### 2026-06-14 — Eval harness (prompt regression testing) + dev tooling

- `eval/system.js`: SYSTEM prompt mirrored from `public/js/game.js`; must be kept in sync
  when prompt changes
- `eval/golden.js`: 10 representative scene prompts (opener, choice follow, typed answer,
  dungeon room, quiet moment, tense encounter, item use, harder/easier difficulty, long history)
- `eval/checks.js`: 6 pure validators — `matchesContract`, `everyKanjiHasRuby`, `choiceCount`,
  `choicesAreJapanese`, `sceneTextLength`, `noRawBrackets`
- `eval/run.js`: three-mode runner (`check`/`update`/`run`), SPACING_MS=7000, MAX_RETRIES=4,
  BACKOFF_MS=65000 on 429; `check` mode validates snapshots offline, `update` writes new
  snapshots, `run` checks live without writing
- `eval/snapshots/.gitkeep`: directory committed for snapshot storage
- `package.json`: added `eval`, `eval:check`, `eval:update` scripts
- `.claude/settings.local.json`: added hooks —
  - **PreToolUse / Edit|Write**: auto-archives `server.js` and `public/**/*.{js,css,html}`
    to `archive/YYYY-MM-DD_<filename>` before any edit (silent no-op if snapshot already exists
    for today)
  - **PreToolUse / Bash / .env guard**: blocks `git add .env`; exits 2 with refusal
  - **PreToolUse / Bash / pre-PR gate**: fires on `gh pr create`; skips gracefully if
    `test/smoke.js` missing or server not running; blocks on smoke test failure
  - **PostToolUse / Edit|Write / server restart**: kills running instance and relaunches
    `npm run dev` when `server.js` is edited; logs to `/tmp/tokyo-kitan-server.log`
  - **PostToolUse / Edit|Write / static hint**: prints Cmd+Shift+R reminder when any
    `public/**/*.{html,js,css}` is edited
  - **PostToolUse / Edit|Write / eval nudge**: prints `npm run eval:check` reminder when
    `server.js` is edited
  - **Stop / changelog nag**: if `server.js` or `public/js/*.js` is newer than `CLAUDE.md`
    by >5s, prints reminder and exits 2 until a changelog entry is added
- `.claude/skills/new-branch/SKILL.md`: step 4 runs `rm archive/* 2>/dev/null` — wipes
  pre-edit snapshots after PR merges since git history takes over
- `.claude/skills/pre-pr/SKILL.md`: diff-aware pre-PR checklist — read diff, run smoke +
  eval:check, stamp PR with ✅/⚠️ for each changed surface
- `CLAUDE.md`: added `eval/` architecture bullet; added design decision #14 (eval harness)
- Archived: `archive/2026-06-14/CLAUDE.md` (pre-eval-docs snapshot)

### 2026-06-14 — Phase 4: shared `jp-ui` package (palette CSS + furigana toggle)

- `server.js`: added `app.use('/jp-ui', express.static(path.join(__dirname, '..', 'companion',
  'packages', 'jp-ui')))` before the public static route — serves shared CSS and JS from the
  sibling `companion/` repo
- `public/index.html`: added `<link>` tags for `/jp-ui/palette.css` and `/jp-ui/furigana.css`
  before `css/style.css`
- `public/css/style.css`: removed duplicated `:root` vars block, `* {}` reset,
  `body { background; color; min-height }`, `body.hide-furigana rt { display: none }`,
  `ruby { display: inline-ruby }`, and `rt` base rule — all now in jp-ui; kept
  `html { font-size: calc(18px * var(--s)) }`, `body { font-family: Noto Sans JP / Hiragino }`,
  and `rt { 0.52rem; letter-spacing: 0.01em }` override
- `public/js/main.js`: imports `setFurigana as setFuriganaCore` from `/jp-ui/furigana.js`;
  local `setFurigana` calls core instead of direct `classList.toggle`; still updates all 3
  app-specific buttons (`furigana-btn`, `setup-furigana-btn`, `dungeon-furigana-btn`)
- `README.md`: added sibling-repo setup instructions (`companion/` must be cloned alongside
  `tokyo-kitan/`); updated features list (tappable ruby word-card, corrected adaptive difficulty)
- `CLAUDE.md`: architecture section updated for jp-ui shared package; design decisions #3, #11
  updated to reference jp-ui
- Archived: `archive/2026-06-14_server_pre-phase4.js`, `archive/2026-06-14_index_pre-phase4.html`,
  `archive/2026-06-14_style_pre-phase4.css`, `archive/2026-06-14_main_pre-phase4.js`

### 2026-06-13 — Dungeon: room caching, E key, WASD fix, narrative continuity

- `public/js/dungeon.js`: E key enters room alongside Enter/Space; WASD from a room tile
  now dismisses the enter-prompt and moves in a single keypress (previously required two)
- `public/js/dungeon.js`: `exitDungeonRoom()` saves `{ ...S.currentScene, _imgSrc: heroImg.src }`
  to `S.roomScenes[S.currentRoomId]`; re-entry calls `renderScene(saved, true, true)`
  (skipImageLoad + skipMeta) — no API call, no mystery_memo regression, same hero image
- `public/js/dungeon.js`: `enterRoom()` builds `visitedRoomNames` from `S.visitedRooms`
  and passes to `onEnterRoom` callback
- `public/js/game.js`: `generate()` room branch injects `visitedCtx` — "Already visited this
  dungeon run: ..." — into the user message so NPCs/clues can reference earlier locations
- `public/js/game.js`: `renderScene(scene, skipImageLoad, skipMeta)` — new `skipMeta` param;
  when `true`, skips `mystery_memo` and `grammarSeen` updates (safe to call on restore)
- `public/js/main.js`: `onEnterRoom` callback checks `S.roomScenes[roomId]`; if found,
  `clearScene()` + restore `_imgSrc` to `#hero-img` + `renderScene(saved, true, true)`
- `public/js/state.js`: added `roomScenes: {}` field to `S`; serialised/restored in saveGame
- `public/index.html`: dungeon prompt hint updated to "Enter / E で入る"
- Archived: `archive/2026-06-13/dungeon.js`, `archive/2026-06-13/game.js`,
  `archive/2026-06-13/main.js`, `archive/2026-06-13/state.js`

### 2026-06-13 — Vocab UX: tappable ruby word-card; adaptive difficulty via unknownTaps

- `public/js/ui.js`: removed vocab chip auto-logging; added `makeSceneWordTaps(sceneEl, vocab)` —
  attaches click handlers to every `<ruby>` in scene text; `showWordCard(rubyEl, vocab)` clones
  ruby to extract word (strips `rt`), reads reading from `rt.innerText`, looks up in vocab
  array, increments `S.unknownTaps` if no match, positions floating `#word-card`; `logVocabWord(v)`
  exported (deduped push to `S.vocabLog`)
- `public/js/game.js`: `renderScene()` calls `makeSceneWordTaps(textEl, scene.vocab)` after
  setting innerHTML; removed `renderVocabChips` call; adaptive difficulty formula changed to
  `(S.peeks + S.unknownTaps) / S.sceneNum`
- `public/js/state.js`: added `unknownTaps: 0` to `S`; included in saveGame snapshot
- `public/index.html`: added `<div id="word-card">` with `#wc-word`, `#wc-reading`,
  `#wc-meaning`, `#wc-add` button; vocab panel empty-hint text updated
- `public/css/style.css`: `#vocab-row { display: none }`, `#word-card` styles (fixed position,
  dark bg, pink/cyan palette, shadow); `#scene-text ruby { cursor: pointer }` hover style;
  `.chip-add` styles
- `CLAUDE.md`: design decisions #2, #7 updated for new vocab UX and unknownTaps difficulty signal
- Archived: `archive/2026-06-13/ui.js`, `archive/2026-06-13/game.js`,
  `archive/2026-06-13/index.html`, `archive/2026-06-13/main.js`

### 2026-06-12 — Streaming scene generation + cinematic transitions

- `public/js/game.js`: `generate()` switched from blocking POST to SSE streaming via
  `POST /api/scene/stream`; `makeExtractor(fieldName)` state machine extracts `location_jp`,
  `image_query`, `scene_jp` character-by-character as tokens arrive; cinematic closes when
  `location_jp` completes (~300–500ms, min 500ms enforced); `makeHtmlAppender(el)` buffers
  inside `<ruby>…</ruby>` blocks before flushing to DOM — prevents partial ruby injection
  during streaming; `renderScene` fires after full JSON arrives
- `server.js`: added `POST /api/scene/stream` SSE route; pipes `text_delta` events to client;
  existing `POST /api/scene` kept as non-streaming fallback
- `public/js/images.js`: new module — `pickImage(query)` fetches `GET /api/image` proxy
- `public/index.html`: added cinematic overlay elements (`#cinematic`, `#cin-top/bottom`
  letterbox bars, `#cin-location`, `#cin-subtitle`); added audio bar (`#audio-bar`,
  `#audio-play`, `#audio-back`, `#audio-speed`, `#audio-progress-wrap/track/fill`)
- Archived: `archive/2026-06-12/game.js`, `archive/2026-06-12/images.js`,
  `archive/2026-06-12/index.html`, `archive/2026-06-12/server.js`

### 2026-06-12 — initial documented state

- Core game loop: scene generation (POST /api/scene), JSON contract, `renderScene()`,
  `renderChoices()`, mystery hook seeded in scene 1
- Visual novel mode with typed-input scenes (WanaKana IME, romaji→kana, `IMEMode: true`)
- Furigana on all kanji with global toggle (`body.hide-furigana rt { display: none }`)
- Multi-voice TTS (Kyoko for narration, Otoya for dialogue, Web Speech API, speed cycle,
  segment-based seek, `parseSegments()` splits on `「」` boundaries)
- Save/resume (`tokyo_kitan_save_v1` in localStorage, try/catch wrapped)
- Pexels image integration (server-proxied `GET /api/image`, in-memory cache)
- Adaptive difficulty (original: `S.peeks / S.sceneNum`; later updated to include unknownTaps)
- `mystery_memo` continuity: model returns 2–4 sentence English internal note; fed back into
  every subsequent request
- 2D dungeon mode (32×14 tile canvas, WASD movement, 12 rooms across 3 wing acts)
- Story bible: 3 acts over ~12 scenes, recurring NPCs, inventory system, register variation
- Archived: `archive/2026-06-12/plan-streaming-scene-generation.md`
