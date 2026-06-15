# Changelog

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
