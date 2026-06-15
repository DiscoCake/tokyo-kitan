# CLAUDE.md — 東京奇譚 (Tokyo Strange Tales)

AI-generated Japanese learning mystery RPG for an early-intermediate learner (N4 approaching N3).
The player reads AI-generated scenes in Japanese, makes choices, sometimes types answers, and
collects vocabulary — all wrapped in a ~12-scene mystery story set in Tokyo.

## Architecture

- `public/index.html` — HTML markup only; no inline script or style. Loads `/jp-ui/palette.css` and `/jp-ui/furigana.css` before `css/style.css`
- `public/css/style.css` — app-specific styles; color variables and furigana rules live in the shared `jp-ui` package (see below)
- `public/js/` — ES modules (no build step, `<script type="module">`):
  - `state.js` — `S` object, `SAVE_KEY`, `SCENE_NUMS`, save/load/clear; dungeon fields (`mode`, `dungeonPos`, `currentRoomId`, `visitedRooms` Set)
  - `images.js` — async `pickImage(query)` — fetches scene-matched photos from Pexels via server proxy; falls back to dark gradient
  - `tts.js` — TTS controller, Web Speech API, audio button listeners
  - `ambience.js` — synthesized brown-noise ambience, ambience button
  - `ui.js` — panels, vocab chips, gallery, cinematic, scene helpers; `makeSceneWordTaps` wires ruby-tap lookup; `logVocabWord` is shared add-to-log helper
  - `game.js` — `generate()`, `renderScene()`, `renderChoices()`, story bible `SYSTEM` prompt; `kind:'room'` action branch; imports `exitDungeonRoom` for マップに戻る button
  - `dungeon.js` — 2D top-down dungeon: 32×14 tile MAP, 12 ROOMS, canvas renderer, WASD input, room-entry prompt; exports `initDungeon({ onEnterRoom })`, `startDungeon()`, `exitDungeonRoom()`, `hideDungeonScreen()`
  - `main.js` — entry point: scale, furigana (delegates to `setFurigana` from `/jp-ui/furigana.js`), IME, mode select (物語/探索), start/resume/restart, `initDungeon` wiring, ending buttons
- `eval/` — prompt-output eval harness (CommonJS, runs against the live server):
  - `system.js` — SYSTEM prompt mirrored from `game.js`; keep in sync when the prompt changes
  - `golden.js` — 10 representative scene prompts (opener, choice follow, typed answer, dungeon room, quiet moment, tense encounter, inventory use, harder/easier difficulty, long history)
  - `checks.js` — 6 pure validators: `matchesContract`, `everyKanjiHasRuby`, `choiceCount`, `choicesAreJapanese`, `sceneTextLength`, `noRawBrackets`
  - `run.js` — three-mode runner (`check` / `update` / `run`); invoked via `npm run eval:*`
  - `snapshots/` — committed JSON responses (one per golden case slug); `eval:check` validates these offline
- `server.js` — Express proxy with seven routes:
  - `GET /jp-ui/*` — static files from `../companion/packages/jp-ui` (sibling repo required; see Setup)
  - `POST /api/scene` — non-streaming fallback (unused by client, kept for debugging)
  - `POST /api/scene/stream` — SSE streaming proxy to Anthropic; pipes `text_delta` events to client; wraps `system` string in `[{ type:'text', cache_control:{type:'ephemeral'} }]` for prompt caching (see #16)
  - `GET /api/image` — Pexels photo search with "japan" appended; in-memory cache (Map)
  - `GET /api/save/:name` — retrieve SQLite save by player name (404 if none)
  - `POST /api/save` — upsert save by `playerName` field (JSON blob in `saves` table)
  - `DELETE /api/save/:name` — clear save for that player name
- **Shared `jp-ui` package** (`../companion/packages/jp-ui`, served at `/jp-ui/`):
  - `palette.css` — CSS custom properties: `--bg`, `--pink`, `--cyan`, `--yellow`, `--purple`, etc.
  - `furigana.css` — `ruby`/`rt` base styles and `body.hide-furigana rt { display:none }` rule
  - `furigana.js` — exports `setFurigana(on: boolean)` — the furigana toggle implementation
- No database yet. Game state lives in browser memory + localStorage saves

## Design decisions — DO NOT undo these without asking the user

1. **Token-conscious by explicit request.** One API call per scene transition. The user
   removed branch pre-generation deliberately to save tokens. Do not re-add speculative
   generation, parallel calls, or per-word lookup calls.

2. **Vocab rides in the scene response — drives lookup and adaptive difficulty.** Each scene
   returns 8–12 `vocab` entries (no chip UI — hidden), skewing toward less common vocabulary.
   They serve two purposes: (1) the word lookup card (`#word-card`) shows meaning when the
   player taps a kanji that appears in the list; (2) taps on kanji NOT in the list increment
   `S.unknownTaps`, which feeds into adaptive difficulty (see #7). Every `<ruby>` element in
   `#scene-text` is tappable — clicking opens a floating card with reading (from `<rt>`) and
   meaning (from vocab array, or `'(not in scene vocab)'` if absent) plus 「単語帳に追加」 to log
   to `S.vocabLog` for Anki TSV export. `makeSceneWordTaps(sceneEl, vocab)` in `ui.js` wires
   tap handlers; `logVocabWord(v)` is the shared deduped add-to-log helper.

3. **Furigana everywhere, one global toggle.** EVERY kanji anywhere in the UI (static text,
   scene text, choices, location names, buttons) gets `<ruby>漢字<rt>かんじ</rt></ruby>`.
   The `body.hide-furigana rt { display: none !important; }` rule and `ruby`/`rt` base styles
   live in `/jp-ui/furigana.css` (shared package). The toggle calls `setFuriganaCore(on)` from
   `/jp-ui/furigana.js` — do not reimplement the class toggle in app code.
   When adding any new UI text containing kanji, add ruby markup.

4. **Typed input is kana-only via WanaKana.** Romaji→kana auto-conversion (`IMEMode: true`)
   like BunPro/WaniKani, with a toggle for users who want their real OS IME. The story
   evaluator is explicitly instructed to NEVER penalize missing kanji. Browsers cannot
   switch the OS keyboard — do not attempt it.

5. **Mystery continuity via `mystery_memo`.** The model returns a 2–4 sentence English
   internal note (mystery state, NPC relationships, item significance) that gets fed back
   into every subsequent request. This is the cheap continuity mechanism — keep it.

6. **Story bible enforces structure.** Three acts over ~12 scenes; recurring NPCs who
   remember the player; items that must matter later; rotating speech registers
   (casual/polite/rough/keigo) as a deliberate learning feature; Murakami-adjacent
   不思議 tone, never horror. Roughly every 3rd scene is `scene_type: "input"`.

7. **Adaptive difficulty from two signals.** `(S.peeks + S.unknownTaps) / S.sceneNum` < 0.10
   → "harder" (N3+/occasional N2); > 0.6 → "easier"; else "standard". No adjustment before
   scene 4 (guard ensures a real sample before escalating). `S.peeks` increments on
   translation reveals; `S.unknownTaps` increments when the player taps a kanji in the scene
   text that was NOT in the AI's vocab list (i.e., a word the AI assumed they knew). Passed
   with every request.

8. **TTS via Web Speech API — segment-based, multi-voice.** Full audio bar: play/pause,
   sentence rewind, click-to-seek, speed cycle (0.7/0.9/1.0/1.2). `parseSegments(text)`
   splits on `「」` boundaries: narration → Kyoko (Enhanced), dialogue → Otoya (Enhanced),
   with Kyoko as universal fallback. Seeking = cancel + restart from segment + char offset.
   Progress = time-based at ~4 chars/sec × rate (not boundary events — Safari/Chromium fire
   them unreliably for Japanese). A cancel token (`_tok`) prevents stale segment callbacks
   from chaining after a seek/stop. Furigana (`rt`) stripped before speaking.

9. **Images via Pexels API (server-proxied).** Each scene's `image_query` is sent to
   `GET /api/image` on the server, which appends "japan" and calls the Pexels search API.
   Results are cached in-memory per query (Map, resets on restart). `PEXELS_API_KEY`
   required in `.env`. `loadHeroImage` is async; `renderScene` fires it as `.then()`
   so scene text renders immediately while the image loads in parallel. Falls back to a
   dark gradient if the key is missing or search returns no results.

10. **Save/resume: server-side SQLite + localStorage cache.** `tokyo_kitan.db` (SQLite,
    `better-sqlite3`) holds one row per player name in a `saves` table (JSON blob). On every
    scene, `saveGame()` writes localStorage AND fire-and-forgets `POST /api/save`. Resume
    tries `GET /api/save/:name` first (server is source of truth, enables cross-device resume
    by re-entering the same name); falls back to localStorage. `clearSave()` clears both.
    DB path overridable via `DB_PATH` env var; `tokyo_kitan.db` is gitignored.

11. **Visual identity: citypop/vaporwave.** Deep indigo bg (#0d0d1a), pink (#ff6fa8) for
    titles/furigana/accents, cyan (#4fd8e8) for main Japanese text, yellow for grammar
    highlights and items, purple for word-lookup card accents. Main text serif (Noto Serif JP),
    UI sans (Noto Sans JP). Everything sized in rem off `--s` scale variable (UI zoom: ±buttons
    and ctrl+scroll, 50–200%, padding compresses as scale grows). All CSS custom properties
    (`--bg`, `--pink`, `--cyan`, etc.) are defined in `/jp-ui/palette.css` — edit the palette
    there, not in `style.css`.

13. **Dungeon mode is a navigation shell, not a gameplay replacement.** The 探索モード
    option adds a 2D top-down canvas dungeon (32×14 tile grid, WASD/arrow-key movement, E or
    Enter to enter a room) as an alternative way to move between scenes. Learning mechanics —
    scene generation, furigana, TTS, typed input, adaptive difficulty — are identical in both
    modes. Three wings match the 3-act story (駅エリア → 神社エリア → 地下エリア). Acts are gated
    sequentially; locked corridors show an amber barrier. Both modes share `tokyo_kitan_save_v1`.
    **Room caching:** `S.roomScenes[roomId]` stores the last scene seen in each room.
    `exitDungeonRoom()` saves before clearing; re-entry calls `renderScene(saved, true, true)`
    (skipImageLoad + skipMeta) so the player resumes exactly where they left off without a new
    API call and without regressing `mystery_memo`. **Narrative continuity:** `enterRoom()`
    passes `visitedRoomNames` (plain-text names from the ROOMS registry) to the `onEnterRoom`
    callback; `generate()` injects them into the room prompt so the AI can have NPCs and clues
    reference already-visited locations within the same dungeon run.
    **Fog of war (Phase 2):** `S.exploredTiles` (Set of `"x,y"` strings) tracks revealed tiles.
    `revealAround(x, y)` in `dungeon.js` adds a 3-tile Chebyshev radius on every player move
    and on `startDungeon`. `drawTile` draws near-black and returns early for unexplored tiles.
    **Minimap (Phase 2):** `drawMinimap(miniCanvas)` renders a 4px/tile fog-respecting overview
    onto `#minimap-canvas` (fixed bottom-left, CSS-scaled 2× for HiDPI). Toggle is
    `#minimap-btn` in `#topbar-right` (game screen) — appears only while inside a room,
    hidden on `exitDungeonRoom`/`startDungeon`. Mirrors `#dungeon-minimap-btn` in the dungeon
    topbar; both call `setMinimap()` in `main.js` and stay in sync.
    **Random room positions:** `ROOMS` holds name data only. `generateLayout()` picks 4 positions
    from a step-2 candidate grid (12 slots per wing, C(12,4)=495 arrangements) and assigns them
    to room IDs. Layout stored in `S.dungeonLayout` and serialised with saves; `restoreLayout()`
    rebuilds `ROOM_COORDS` on resume. `startDungeon()` and `exitDungeonRoom()` both check the
    current tile for a room trigger so the enter-prompt appears correctly on spawn and on map
    return without needing to walk off and back.
    Phase 3 remaining: NPC sprites on map, per-district ambient sound.

12. **Cinematic scene transitions + streaming.** Full-black overlay with location kanji title
    card + letterbox bars during API calls. `generate()` uses `POST /api/scene/stream` (SSE).
    A `makeExtractor` state machine watches the arriving JSON stream: as soon as `location_jp`
    completes (typically ~300-500ms into the stream) the cinematic closes (500ms minimum display
    enforced). `scene_jp` then streams progressively into `#scene-text` via `makeHtmlAppender`
    (buffers inside `<...>` to never inject a partial ruby tag). Full JSON parse + `renderScene`
    fires after stream end. Perceived wait drops from ~8s → ~1-2s.

15. **N3 grammar coverage via self-selected targeting.** Each scene request injects a
    `grammarCtx` string built from `S.grammarSeen` (the list of `grammar_note` values
    accumulated this run). The SYSTEM prompt instructs the model to pick ONE N3 grammar
    point not yet in that list and weave it naturally into the prose or dialogue — never
    forced, never stacked, story always first. If nothing fits, the scene proceeds normally.
    This is a **coverage** (breadth) axis distinct from the **difficulty** axis (`easier/
    standard/harder`) — it ensures ~12 distinct N3 points are seen across a full run
    without skewing the overall register. `grammarCtx` is injected in every user-message
    branch in `generate()` alongside `memoCtx`/`itemCtx`/`diffCtx`.

16. **Prompt caching on the static SYSTEM block.** Both Anthropic fetch call sites in
    `server.js` wrap the incoming `system` string as
    `[{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]` before
    forwarding to Anthropic. The client continues to send a plain string. No beta header
    required (GA for Sonnet 4.6 / Opus 4.8). The SYSTEM block is currently below the
    2048-token minimum for Sonnet 4.6 cache hits, but the wiring is correct and activates
    automatically as the prompt grows.

17. **NPC tracker panel (`#npc-panel`).** Each scene response now includes an `npcs` array of
    established characters (named or clearly identified — not background pedestrians). Each entry
    has `name_jp` (ruby-annotated), `name_reading` (plain kana, used as dedup key), `relationship`
    (`ally/neutral/suspicious/hostile/unknown`), and `note` (1-sentence English context).
    `S.npcLog` accumulates entries across scenes via upsert-by-`name_reading` in `renderScene()` —
    relationship and note update in place when a character reappears. Serialized in saves.
    UI: `#npc-btn` in `#topbar-right` (accessible during play, not just end-of-game). Opens
    `#npc-panel` via `openNpcPanel()` in `ui.js`; relationship shown as a color-coded badge
    (cyan=ally, yellow=neutral, pink=suspicious, red=hostile, grey=unknown).

14. **Eval harness for prompt regression testing.** `eval/run.js` has three modes:
    - `npm run eval:check` — reads `eval/snapshots/*.json` offline, runs all 6 validators. No API
      calls. Use in CI or to quickly verify a snapshot batch is still valid.
    - `npm run eval:update` — calls the live server (`POST /api/scene`, non-streaming), writes new
      snapshot files. Run after changing the SYSTEM prompt to refresh the baseline.
    - `npm run eval` — calls the live server, reports pass/fail, does NOT write files.
    Server must be running for `update` and `run` modes. SPACING_MS=7000, MAX_RETRIES=4,
    BACKOFF_MS=65000 on 429. **Never loosen a check to make a case pass — fix the prompt output.**
    When updating the SYSTEM prompt in `game.js`, also update `eval/system.js` (exact mirror).
    All three modes accept optional trailing slug args to target specific cases:
    `node eval/run.js update choice_follow dungeon_room` — re-rolls only those snapshots,
    leaving passing ones untouched. Useful after prompt fixes that only affect certain cases.

## Scene JSON contract (returned by the model)

```json
{
  "location_jp": "ruby-annotated Japanese location name",
  "image_query": "english keywords for image selection",
  "scene_jp": "3-5 sentences, ALL kanji ruby-annotated, ≥1 NPC line in 「」",
  "scene_translation": "English translation",
  "grammar_note": "【expression】explanation",
  "vocab": [{"word": "", "reading": "", "meaning": ""}],
  "items_gained": [{"jp": "", "reading": ""}],
  "scene_type": "choice | input | ending",
  "choices": [{"jp": "ruby-annotated", "text_only": "plain"}],
  "feedback": "only when evaluating a typed answer",
  "mystery_memo": "internal English continuity note",
  "npcs": [{"name_jp": "ruby-annotated name", "name_reading": "kana dedup key", "relationship": "ally|neutral|suspicious|hostile|unknown", "note": "1-sentence English context"}]
}
```

## User context (the learner this is built for)

- ~N4, working toward N3 by Dec 2026; listening strong, reading weakest, grammar the bottleneck
- Immersion-first philosophy: SRS is consolidation, not the driver. Output practice and
  natural (vs. textbook) Japanese are the priority gaps
- Existing toolchain: Anki (Kaishi 1.5k), BunPro (N3 grammar daily), Migaku — the TSV vocab
  export deliberately feeds this pipeline rather than competing with it
- Tone preference: direct, practically grounded advice; challenge weak reasoning

## Roadmap (discussed, not yet built)

- Real location-matched ambience with audio files (current: synthesized brown-noise hum)
- Server-side persistence (SQLite) → cross-device save
- Speech input (Web Speech recognition) for spoken answers — stretch
- Better scene photos: generated art or curated image library (Pexels is live but results vary)
- ~~Vocab chip UX~~ — **done**: tappable ruby words in scene text + explicit ＋ button on chips
- ~~Session-end grammar review screen~~ — **done**: `#grammar-panel` on ending screen; `openGrammarPanel()` in ui.js; `【expression】` entries deduplicated and highlighted yellow
- ~~Dungeon Phase 2 (fog of war + minimap)~~ — **done**: `S.exploredTiles` Set (3-tile Chebyshev reveal per step); unexplored tiles draw near-black; `drawMinimap(canvas)` renders 4px/tile overview in bottom-left corner while inside a room
- ~~Relationship/NPC tracker UI~~ — **done**: `S.npcLog` array, `npcs` field in scene contract, `#npc-panel` with color-coded relationship badges, accessible mid-game via `#npc-btn` in topbar
- Dungeon Phase 3 (remaining): NPC sprites on map, per-district ambient sound

## Conventions

- Vanilla JS, no framework, no build step — keep it that way unless the user asks
- All UI strings in Japanese with ruby; English only in learner-facing feedback/translations
- Use `npm run dev` during development — `node --watch` auto-restarts on `server.js` changes. `npm start` is for production only.
- Test by playing at least one choice + one typed-input scene (visual novel mode); also verify dungeon mode: WASD movement, room entry, scene generation, マップに戻る return
- Canonical GitHub remote: https://github.com/DiscoCake/tokyo-kitan — push all changes here

## File Change Discipline

1. **Keep CLAUDE.md current.** Whenever any project file is meaningfully changed (new feature,
   altered design decision, new dependency, new convention), update the relevant CLAUDE.md
   section in the same edit session.

2. **Archive before significant overwrites.** Before making major changes to `server.js` or
   any file under `public/`, the PreToolUse hook in `.claude/settings.local.json` automatically
   copies the file to `archive/YYYY-MM-DD_<filename>` (flat, dated prefix). For manual archives
   (e.g. a full prompt rewrite), use the same naming convention.
   - Minor edits (typos, style tweaks, one-liner bug fixes) do **not** require archiving.
   - Major rewrites, new features, and any change to the Scene JSON contract always do.
   - **Plans are also archived.** Copy plan files to `plans/YYYY-MM-DD_<slug>.md` before
     overwriting for a new task.

## Changelog discipline

After any significant change to `server.js` or `public/`, add an entry to `CHANGELOG.md` before
considering the task complete. Don't batch this to a docs sweep at the end.

## Archive conventions

### Source files

Before making significant edits to `server.js` or any file in `public/`, copy the current version
to `archive/` with a dated prefix so there's always a recoverable snapshot:

```bash
cp server.js archive/2026-06-14_server.js
cp public/js/game.js archive/2026-06-14_game.js
```

This is automated via the PreToolUse hook in `.claude/settings.local.json` — it fires before
any Edit or Write on those paths and silently creates the snapshot if one doesn't already exist
for today. For manual archives (e.g., before a major prompt rewrite), use the same naming convention.

Add a one-line note in the Changelog entry for every archive: what was archived and why.

**Cleanup:** after a PR merges to main, delete all archive files from that branch — git history
is the real archive from that point. The `/new-branch` skill includes this step.

### Plans

Plans live as a single active file in `.claude/plans/`. Before overwriting it for a new task,
copy it to `plans/` at the repo root so past plans are versioned and referenceable:

```bash
cp ".claude/plans/<active-plan>.md" "plans/YYYY-MM-DD_short-description.md"
```

## Changelog

Full history lives in `CHANGELOG.md`. Add new entries there, not here.
