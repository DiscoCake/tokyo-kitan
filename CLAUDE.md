# CLAUDE.md — 東京奇譚 (Tokyo Strange Tales)

AI-generated Japanese learning mystery RPG for an early-intermediate learner (N4 approaching N3).
The player reads AI-generated scenes in Japanese, makes choices, sometimes types answers, and
collects vocabulary — all wrapped in a ~12-scene mystery story set in Tokyo.

## Architecture

- `public/index.html` — HTML markup only (~90 lines); no inline script or style
- `public/css/style.css` — all styles extracted here
- `public/js/` — ES modules (no build step, `<script type="module">`):
  - `state.js` — `S` object, `SAVE_KEY`, `SCENE_NUMS`, save/load/clear
  - `images.js` — `TOKYO_IMAGES` map, `pickImage(query)`
  - `tts.js` — TTS controller, Web Speech API, audio button listeners
  - `ambience.js` — synthesized brown-noise ambience, ambience button
  - `ui.js` — panels, vocab chips, gallery, cinematic, scene helpers
  - `game.js` — `generate()`, `renderScene()`, `renderChoices()`, story bible `SYSTEM` prompt
  - `main.js` — entry point: scale, furigana, IME, start/resume/restart, ending buttons
- `server.js` — minimal Express proxy; its ONLY job is keeping `ANTHROPIC_API_KEY` server-side
  and forwarding `/api/scene` → Anthropic Messages API
- No database yet. Game state lives in browser memory + localStorage saves

## Design decisions — DO NOT undo these without asking the user

1. **Token-conscious by explicit request.** One API call per scene transition. The user
   removed branch pre-generation deliberately to save tokens. Do not re-add speculative
   generation, parallel calls, or per-word lookup calls.

2. **Vocab rides in the scene response.** Each scene returns 4–6 `vocab` entries; they render
   as tap-to-reveal chips (meaning hidden until tapped — inference first is intentional
   learning design). Tapping logs to the 単語帳 with TSV export for Anki. No extra API calls.

3. **Furigana everywhere, one global toggle.** EVERY kanji anywhere in the UI (static text,
   scene text, choices, location names, buttons) gets `<ruby>漢字<rt>かんじ</rt></ruby>`.
   The toggle is a single class: `body.hide-furigana rt { display: none !important; }`.
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

7. **Adaptive difficulty from translation peeks.** `S.peeks / S.sceneNum` < 0.25 → "harder"
   (N3+/occasional N2); > 0.6 → "easier"; else "standard". Passed with every request.

8. **TTS via Web Speech API.** Full audio bar: play/pause, sentence rewind, click-to-seek,
   speed cycle (0.7/0.9/1.0/1.2). Seeking = cancel + restart utterance from char offset
   (the API has no native seek). Progress = boundary events with time-based fallback
   (~7 chars/sec × rate) because Safari may not fire boundaries for Japanese.
   Furigana (`rt`) is stripped before speaking to avoid double-reading.

9. **Images are a curated local map.** `image_query` keywords → Wikimedia Commons URLs
   (the Unsplash source API is dead). Fine for v1; a proper image API or generated art
   is a known future upgrade.

10. **Save/resume via localStorage** (`tokyo_kitan_save_v1`), wrapped in try/catch.
    Auto-saves after each scene; cleared on ending or restart. Future: move to server-side
    persistence (SQLite) for cross-device play.

11. **Visual identity: citypop/vaporwave.** Deep indigo bg (#0d0d1a), pink (#ff6fa8) for
    titles/furigana/accents, cyan (#4fd8e8) for main Japanese text, yellow for grammar
    highlights and items, purple for vocab chips. Main text serif (Noto Serif JP), UI sans
    (Noto Sans JP). Everything sized in rem off `--s` scale variable (UI zoom: ±buttons and
    ctrl+scroll, 50–200%, padding compresses as scale grows).

12. **Cinematic scene transitions.** Full-black overlay with location kanji title card +
    letterbox bars during API calls. The loading state IS the transition.

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
- Better images: proper image API or generated scene art
- Session-end grammar review screen (grammarSeen is already collected)
- Speech input (Web Speech recognition) for spoken answers — stretch

## Conventions

- Vanilla JS, no framework, no build step — keep it that way unless the user asks
- All UI strings in Japanese with ruby; English only in learner-facing feedback/translations
- Test by running `npm start` and playing at least one choice + one typed-input scene
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
