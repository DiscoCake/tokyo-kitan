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
- `server.js` — minimal Express proxy with four routes:
  - `GET /jp-ui/*` — static files from `../companion/packages/jp-ui` (sibling repo required; see Setup)
  - `POST /api/scene` — non-streaming fallback (unused by client, kept for debugging)
  - `POST /api/scene/stream` — SSE streaming proxy to Anthropic; pipes `text_delta` events to client
  - `GET /api/image` — Pexels photo search with "japan" appended; in-memory cache (Map)
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
   returns 4–6 `vocab` entries (no chip UI — hidden). They serve two purposes: (1) the word
   lookup card (`#word-card`) shows meaning when the player taps a kanji that appears in the
   list; (2) taps on kanji NOT in the list increment `S.unknownTaps`, which feeds into adaptive
   difficulty (see #7). Every `<ruby>` element in `#scene-text` is tappable — clicking opens a
   floating card with reading (from `<rt>`) and meaning (from vocab array if present) plus
   「単語帳に追加」 to log to `S.vocabLog` for Anki TSV export. `makeSceneWordTaps(sceneEl, vocab)`
   in `ui.js` wires tap handlers; `logVocabWord(v)` is the shared deduped add-to-log helper.

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

7. **Adaptive difficulty from two signals.** `(S.peeks + S.unknownTaps) / S.sceneNum` < 0.25
   → "harder" (N3+/occasional N2); > 0.6 → "easier"; else "standard". `S.peeks` increments on
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

10. **Save/resume via localStorage** (`tokyo_kitan_save_v1`), wrapped in try/catch.
    Auto-saves after each scene; cleared on ending or restart. Future: move to server-side
    persistence (SQLite) for cross-device play.

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
    Phase 2 items: minimap, fog of war, NPC sprites on map, district-matched ambience.

12. **Cinematic scene transitions + streaming.** Full-black overlay with location kanji title
    card + letterbox bars during API calls. `generate()` uses `POST /api/scene/stream` (SSE).
    A `makeExtractor` state machine watches the arriving JSON stream: as soon as `location_jp`
    completes (typically ~300-500ms into the stream) the cinematic closes (500ms minimum display
    enforced). `scene_jp` then streams progressively into `#scene-text` via `makeHtmlAppender`
    (buffers inside `<...>` to never inject a partial ruby tag). Full JSON parse + `renderScene`
    fires after stream end. Perceived wait drops from ~8s → ~1-2s.

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
  "mystery_memo": "internal English continuity note"
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
- Relationship/NPC tracker UI (data already exists in mystery_memo)
- Difficulty tuning pass once the user has played several full runs
- Session-end grammar review screen (grammarSeen is already collected)
- Speech input (Web Speech recognition) for spoken answers — stretch
- Better scene photos: generated art or curated image library (Pexels is live but results vary)
- ~~Vocab chip UX~~ — **done**: tappable ruby words in scene text + explicit ＋ button on chips
- Dungeon Phase 2: minimap overlay, fog of war (unexplored rooms hidden), NPC sprites on map, per-district ambient sound

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

2. **Archive before significant overwrites.** Before making major changes to any project file,
   copy the existing version to `archive/YYYY-MM-DD/filename` (today's date), then make the
   change. This creates a human-readable snapshot history alongside git.
   - Format: `archive/2026-06-12/index.html`, `archive/2026-06-12/server.js`, etc.
   - The `archive/` folder is **not** git-ignored; commit snapshots with the change.
   - Minor edits (typos, style tweaks, small bug fixes) do **not** require archiving.
   - Major rewrites, new features, and any change to the Scene JSON contract always do.
   - **Plans are also archived.** After a plan is approved and execution begins, copy the
     plan file to `archive/YYYY-MM-DD/plan-<short-slug>.md` so there is a record of what
     was decided and why alongside the code changes it produced.
