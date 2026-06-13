# 東京奇譚 — Tokyo Strange Tales

An AI-generated Japanese learning mystery RPG (N4/N3). Read scenes in Japanese, make
choices, sometimes answer NPCs in your own typed Japanese, collect vocabulary, and
unravel a ~12-scene mystery set in Tokyo.

## Setup

```bash
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
- Tap-to-reveal vocab chips → 単語帳 log → TSV export for Anki
- Typed answer scenes with romaji→kana auto-conversion (WanaKana) and naturalness feedback
- Multi-voice TTS: Kyoko (narration) / Otoya (dialogue), with play/pause, seek, speed control
- Adaptive difficulty based on how often you peek at translations
- Save/resume, scene gallery, UI scaling, cinematic transitions

## Project notes for development

See `CLAUDE.md` — it documents the design decisions and the scene JSON contract.
Read it before changing anything substantive.
