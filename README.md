# 東京奇譚 — Tokyo Strange Tales

An AI-generated Japanese learning mystery RPG (N4/N3). Read scenes in Japanese, make
choices, sometimes answer NPCs in your own typed Japanese, collect vocabulary, and
unravel a ~12-scene mystery set in Tokyo.

## Setup

This app shares UI components with the `companion` repo. Both must be siblings on disk:

```
parent-dir/
  tokyo-kitan/   ← this repo
  companion/     ← required sibling (provides /jp-ui assets)
```

```bash
# 1. Clone both repos as siblings
git clone <companion-repo-url> companion

# 2. Install and configure tokyo-kitan
cd tokyo-kitan
npm install
cp .env.example .env
# edit .env — add ANTHROPIC_API_KEY and PEXELS_API_KEY

npm run dev   # development (auto-restarts on server changes)
# npm start   # production
```

Open http://localhost:3000

## Features

- AI-generated mystery story (3-act structure, recurring NPCs, inventory that matters)
- Dual game modes: visual novel (物語モード) or 2D dungeon explorer (探索モード) — same AI story, different navigation
- Streaming scene text — cinematic closes ~0.5s after clicking, text appears progressively
- Scene-matched photos via Pexels API (atmospheric, not just location names)
- Furigana on all kanji with a global toggle
- Tappable kanji in scene text → floating lookup card with reading + meaning → explicit 単語帳 add → TSV export for Anki
- Typed answer scenes with romaji→kana auto-conversion (WanaKana) and naturalness feedback
- Multi-voice TTS: Kyoko (narration) / Otoya (dialogue), with play/pause, seek, speed control
- Adaptive difficulty from two signals: translation peeks + tapping kanji the AI didn't flag as vocabulary
- Save/resume, scene gallery, UI scaling, cinematic transitions

## Development

```bash
npm run dev           # start server with auto-restart (use this during development)
npm run eval:check    # validate prompt output against snapshots — offline, no API call
npm run eval:update   # refresh snapshots after editing the system prompt in game.js
npm run test:smoke    # Playwright golden-path smoke test (requires server running)
```

Run `eval:check` before every PR. Run `eval:update` whenever you change the SYSTEM prompt in `public/js/game.js` (and keep `eval/system.js` in sync — it's the eval's copy of the prompt).

## Project notes for development

See `CLAUDE.md` for design decisions and the scene JSON contract, and `CHANGELOG.md` for
full feature history. Read both before changing anything substantive.
