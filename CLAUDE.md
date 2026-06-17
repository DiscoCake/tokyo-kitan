# CLAUDE.md — 東京奇譚 (Tokyo Strange Tales)

AI-generated Japanese learning mystery RPG for an early-intermediate learner (N4 approaching N3).
The player reads AI-generated scenes in Japanese, makes choices, sometimes types answers, and
collects vocabulary — all wrapped in a ~12-scene mystery story set in Tokyo.

## Architecture

- `public/index.html` — HTML markup only; no inline script or style. Loads `/jp-ui/palette.css` and `/jp-ui/furigana.css` before `css/style.css`
- `public/css/style.css` — app-specific styles; color variables and furigana rules live in the shared `jp-ui` package (see below)
- `public/js/` — ES modules (no build step, `<script type="module">`):
  - `state.js` — `S` object, `SAVE_KEY`, `SCENE_NUMS`, save/load/clear; dungeon fields (`mode`, `dungeonPos`, `currentRoomId`, `visitedRooms` Set); **persistent learner profile** (`globalSceneCount`, `grammarMastery`, `errorLog`) stored under `PROFILE_KEY` via `saveProfile()`/`loadProfile(name)` — separate from the run save so it survives restart (see #18)
  - `images.js` — async `pickImage(query)` — fetches scene-matched photos from Pexels via server proxy; falls back to dark gradient
  - `tts.js` — TTS controller, Web Speech API, audio button listeners
  - `ambience.js` — synthesized brown-noise ambience, ambience button
  - `ui.js` — panels, vocab chips, gallery, cinematic, scene helpers; `makeSceneWordTaps` wires ruby-tap lookup; `logVocabWord` is shared add-to-log helper
  - `game.js` — `generate()`, `renderScene()`, `renderChoices()`, story bible `SYSTEM` prompt; `kind:'room'` action branch; imports `exitDungeonRoom` for マップに戻る button
  - `dungeon.js` — 2D top-down dungeon: 32×14 tile MAP, 12 ROOMS, canvas renderer, WASD input, room-entry prompt; exports `initDungeon({ onEnterRoom })`, `startDungeon()`, `exitDungeonRoom()`, `hideDungeonScreen()`
  - `main.js` — entry point: scale, furigana (delegates to `setFurigana` from `/jp-ui/furigana.js`), IME, mode select (物語/探索), start/resume/restart, `initDungeon` wiring, ending buttons
- `eval/` — prompt-output eval harness (CommonJS, runs against the live server):
  - `system.js` — SYSTEM prompt mirrored from `game.js`; keep in sync when the prompt changes
  - `golden.js` — 11 representative scene prompts (opener, choice follow, typed answer, dungeon room, quiet moment, tense encounter, inventory use, harder/easier difficulty, grammar reinforcement, long history)
  - `checks.js` — 8 pure validators: `matchesContract`, `everyKanjiHasRuby`, `choiceCount`, `choicesAreJapanese`, `sceneTextLength`, `noRawBrackets`, `npcFieldsValid`, `grammarTargetPresent`
  - `run.js` — three-mode runner (`check` / `update` / `run`); invoked via `npm run eval:*`. `assertSystemInSync()` runs first in every mode — fails fast if `eval/system.js` ≠ the `SYSTEM` string in `game.js` (the drift guard)
  - `snapshots/` — committed JSON responses (one per golden case slug); `eval:check` validates these offline
- `anki.js` — read-only AnkiConnect client (CommonJS); `getStrugglingVocab()` queries lapsed
  cards (`prop:lapses>=2 -is:new`) → `{word, reading, lapses}[]`. Required by `server.js` for #19.
  Mirrors the sibling `companion/src/anki.js` struggling-card path, trimmed to the read.
- `server.js` — Express proxy with eight routes:
  - `GET /jp-ui/*` — static files from `../companion/packages/jp-ui` (sibling repo required; see Setup)
  - `POST /api/scene` — non-streaming fallback (unused by client, kept for debugging)
  - `POST /api/scene/stream` — SSE streaming proxy to Anthropic; pipes `text_delta` events to client; wraps `system` string in `[{ type:'text', cache_control:{type:'ephemeral'} }]` for prompt caching (see #16)
  - `GET /api/image` — Pexels photo search with "japan" appended; in-memory cache (Map)
  - `GET /api/anki/struggling` — lapsed-vocab feed for #19; calls `getStrugglingVocab()` via AnkiConnect, in-memory last-good cache. **Anki closed is not an error** — returns `{cards:[], available:false}` (HTTP 200) so the client no-ops. `ANKI_URL`/`ANKI_LAPSED_QUERY` env-overridable.
  - `GET /api/save/:name` — retrieve SQLite save by player name (404 if none)
  - `POST /api/save` — upsert save by `playerName` field (JSON blob in `saves` table)
  - `DELETE /api/save/:name` — clear save for that player name
- **Shared `jp-ui` package** (`../companion/packages/jp-ui`, served at `/jp-ui/`):
  - `palette.css` — CSS custom properties: `--bg`, `--pink`, `--cyan`, `--yellow`, `--purple`, etc.
  - `furigana.css` — `ruby`/`rt` base styles and `body.hide-furigana rt { display:none }` rule
  - `furigana.js` — exports `setFurigana(on: boolean)` — the furigana toggle implementation
- Game state lives in browser memory + localStorage, with a server-side SQLite mirror for
  cross-device resume (see #10). The persistent learner profile (#18/#19) is localStorage-only.

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

15. **N3 grammar coverage via self-selected targeting + spaced reinforcement.** Each scene
    request injects a `grammarCtx` string built from `S.grammarSeen` (this-run `grammar_note`
    values) AND a `reinforceCtx` string of points DUE for reinforcement (see #18). The SYSTEM
    prompt instructs the model to (a) pick ONE NEW N3 point not yet seen this run, feature it,
    and echo its `【expression】` head into the `grammar_point_targeted` field, and (b) when a
    due point is listed, reuse ONE of them naturally **without re-explaining it**. Never forced,
    never stacked, story always first. This is a **coverage** (breadth) axis distinct from the
    **difficulty** axis (`easier/standard/harder`). Both `grammarCtx` and `reinforceCtx` are
    injected in every user-message branch in `generate()` alongside `memoCtx`/`itemCtx`/`diffCtx`.
    **Evolved from exposure-once:** the original design added each point to a "do not repeat"
    list and never showed it again. Reinforcement (#18) restores spaced depth — breadth + depth,
    not breadth alone. Do not revert to exposure-once without asking.

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
    (`ally/neutral/suspicious/hostile/unknown`), and `note` (1-sentence Japanese plain text — no ruby markup).
    `S.npcLog` accumulates entries across scenes via upsert-by-`name_reading` in `renderScene()` —
    relationship and note update in place when a character reappears. Serialized in saves.
    UI: `#npc-btn` in `#topbar-right` (accessible during play) and `#ending-npc-btn` on the
    ending screen (mirrors the grammar/gallery pattern). Opens `#npc-panel` via `openNpcPanel()`
    in `ui.js`; relationship shown as a color-coded badge (cyan=ally, yellow=neutral,
    pink=suspicious, red=hostile, grey=unknown). The `note` field is set via `textContent`
    (not `innerHTML`) since it is plain text. A `npcFieldsValid` check in `eval/checks.js`
    validates the `npcs` array structure on every snapshot run.
    **Scene length constraint:** `scene_jp` is capped at 3 sentences for harder difficulty,
    4–5 for standard/easier — complexity signals difficulty, not length. The `sceneTextLength`
    validator strips ruby markup before measuring (30–300 prose chars) so kanji-heavy scenes
    aren't penalised by markup overhead.

14. **Eval harness for prompt regression testing.** `eval/run.js` has three modes:
    - `npm run eval:check` — reads `eval/snapshots/*.json` offline, runs all 8 validators (and the
      `assertSystemInSync` drift guard). No API calls. Use in CI or to quickly verify a batch.
    - `npm run eval:update` — calls the live server (`POST /api/scene`, non-streaming), writes new
      snapshot files. Run after changing the SYSTEM prompt to refresh the baseline.
    - `npm run eval` — calls the live server, reports pass/fail, does NOT write files.
    Server must be running for `update` and `run` modes. SPACING_MS=7000, MAX_RETRIES=4,
    BACKOFF_MS=65000 on 429. **Never loosen a check to make a case pass — fix the prompt output.**
    When updating the SYSTEM prompt in `game.js`, also update `eval/system.js` (exact mirror).
    All three modes accept optional trailing slug args to target specific cases:
    `node eval/run.js update choice_follow dungeon_room` — re-rolls only those snapshots,
    leaving passing ones untouched. Useful after prompt fixes that only affect certain cases.

18. **Persistent learner profile — grammar mastery loop + output journal.** A learner profile
    lives under `PROFILE_KEY` (keyed by player name), DELIBERATELY SEPARATE from the per-run
    save blob (`SAVE_KEY`) that `clearSave()` wipes on restart/ending — so grammar reinforcement
    and output history carry across story runs. Three fields: `globalSceneCount` (total scenes
    ever read — the clock for reinforcement spacing), `grammarMastery` (map of `【expr】` head →
    `{expr, exposures, lastSeen, strength}`), `errorLog` (typed-output journal, newest first,
    cap 50). `saveProfile()` writes after each scene's meta accumulation in `renderScene()` and
    after each typed-answer feedback; `loadProfile(name)` hydrates in `getPlayerName()` (so it
    fires on start/resume). `resetGame()` deliberately does NOT clear these. **Spaced scheduler:**
    `dueGrammar()` in `game.js` flags a point as due once `globalSceneCount - lastSeen` reaches a
    strength-based interval (`REINFORCE_INTERVAL = [0,2,4,8,16]` by strength 0–4), returning the
    up-to-3 most overdue `【expressions】` for `reinforceCtx` (see #15). `strength` rises (capped 4)
    each exposure. **UI:** `#mastery-btn` in `#topbar-right` and `#ending-mastery-btn` on the
    ending screen open `#mastery-panel` via `openMasteryPanel()` in `ui.js` — grammar points with
    ★ strength + exposure count, and the output error journal (answer + specific feedback). The
    journal's user-supplied `answer`/`feedback` are set via `textContent`. **Contract addition:**
    scenes now return `grammar_point_targeted` (the featured `【expression】` head, no brackets,
    must match the `【…】` in `grammar_note`); `grammarTargetPresent` in `eval/checks.js` enforces it.

19. **Anki lapsed-vocab reinforcement — subtle, opt-in, graceful.** Pulls the learner's
    most-lapsed Anki cards and offers the AI ONE per scene to weave in naturally, giving
    forgotten words in-context re-exposure. **Deliberately subtle** (the user's words: words
    shouldn't feel forced or break immersion): at most one candidate per scene, the SYSTEM
    prompt frames it exactly like grammar reinforcement (#15) — "use it ONLY if it fits, story
    first, skip entirely if forced." Distinct from the difficulty (#7) and grammar (#15/#18) axes.
    **Server:** `GET /api/anki/struggling` → `getStrugglingVocab()` in `anki.js` (AnkiConnect
    `findCards`/`cardsInfo`, query `ANKI_LAPSED_QUERY` default `prop:lapses>=2 -is:new`). Anki
    closed ⇒ `{cards:[], available:false}`, so the whole feature silently no-ops. **Client:**
    `primeLapsedPool()` in `game.js` fetches once per start/resume into an ephemeral (NOT persisted)
    module-level pool; `nextLapsedCandidate()` round-robins one not-yet-surfaced word per scene into
    `ankiCtx` (appended after `gramCtx` in all four `generate()` branches), holding it in
    `activeLapsedCandidate`. **Surfacing log:** `renderScene()` checks `stripHtml(scene_jp).includes(word)`
    — if the model actually used it, pushes `{word, reading, sceneNum, location}` onto `S.lapsedSurfaced`
    (per-run, serialized in the save blob, NOT the persistent profile). **UI:** the `#mastery-panel`
    has a third section (`苦手の言葉が出た場面`, `#mastery-lapsed-list`) listing surfaced words + where —
    skipped candidates never appear. **Contract unchanged** — no new validators. The SYSTEM addition is
    mirrored in `eval/system.js` (drift guard). **Limitation:** like #18 this is localStorage/desktop-only
    and depends on the Anki app being open on the same machine as the server (AnkiConnect on localhost:8765).

## Scene JSON contract (returned by the model)

```json
{
  "location_jp": "ruby-annotated Japanese location name",
  "image_query": "english keywords for image selection",
  "scene_jp": "3-5 sentences, ALL kanji ruby-annotated, ≥1 NPC line in 「」",
  "scene_translation": "English translation",
  "grammar_note": "【expression】explanation",
  "grammar_point_targeted": "【expression】 head (no brackets) of the featured point — matches grammar_note",
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

- ~~Vocab chip UX~~ — **done**: tappable ruby words in scene text → floating lookup card with an explicit ＋ add. (Note: `renderVocabChips()` in `ui.js` is an unused earlier chip-row implementation — the shipped UX is the ruby-tap card, `makeSceneWordTaps`.)
- ~~Session-end grammar review screen~~ — **done**: `#grammar-panel` on ending screen; `openGrammarPanel()` in ui.js; `【expression】` entries deduplicated and highlighted yellow
- ~~Dungeon Phase 2 (fog of war + minimap)~~ — **done**: `S.exploredTiles` Set (3-tile Chebyshev reveal per step); unexplored tiles draw near-black; `drawMinimap(canvas)` renders 4px/tile overview in bottom-left corner while inside a room
- ~~Relationship/NPC tracker UI~~ — **done**: `S.npcLog` array, `npcs` field in scene contract, `#npc-panel` with color-coded relationship badges, accessible mid-game via `#npc-btn` in topbar
- ~~Grammar mastery loop (spaced reinforcement + targeted output)~~ — **done** (#18): persistent
  `grammarMastery`/`errorLog` profile across runs, `dueGrammar()` scheduler feeds `reinforceCtx`,
  input scenes target production, `#mastery-panel` shows strength + output journal
- ~~Anki integration for lapsed-word reinforcement~~ — **done** (#19): `GET /api/anki/struggling`
  feeds one lapsed Anki word per scene into `ankiCtx`; surfaced words logged to `S.lapsedSurfaced`
  and shown in `#mastery-panel`. Subtle by design; silently no-ops when Anki is closed.
- Dungeon Phase 3 (remaining): NPC sprites on map, per-district ambient sound
- Server-side sync for the persistent learner profile (#18) — currently localStorage-only (see Known limitation below)
- Dropped (low learning ROI): real location-matched ambience audio files, generated/curated scene art (Pexels stays), in-browser speech-recognition input
- **Known limitation:** the persistent learner profile (#18) is localStorage-only — unlike the
  run save (#10) it does NOT sync to SQLite, so cross-device resume restores the story but not
  grammar mastery / the error journal. Server-side profile sync is unbuilt.
- **Cost lever (see #16):** the SYSTEM prompt is ~6.0k chars / ~1.8k tokens after #19 —
  still under the 2048-token cache minimum, but close. Crossing it would activate prompt
  caching and cut input tokens on every scene call. Do not pad the prompt just to hit it.

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
