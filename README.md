# 東京奇譚 — Tokyo Strange Tales

An AI-generated Japanese learning mystery RPG (N4/N3). Read scenes in Japanese, make
choices, sometimes answer NPCs in your own typed Japanese, collect vocabulary, and
unravel a ~12-scene mystery set in Tokyo.

## Setup

```bash
npm install
cp .env.example .env
# edit .env and add your ANTHROPIC_API_KEY
npm start
```

Open http://localhost:3000

## Features

- AI-generated mystery story (3-act structure, recurring NPCs, inventory that matters)
- Furigana on all kanji with a global toggle
- Tap-to-reveal vocab chips → 単語帳 log → TSV export for Anki
- Typed answer scenes with romaji→kana auto-conversion (WanaKana) and naturalness feedback
- TTS audio bar: play/pause, sentence rewind, seek, speed control
- Adaptive difficulty based on how often you peek at translations
- Save/resume, scene gallery, UI scaling, cinematic transitions

## Project notes for development

See `CLAUDE.md` — it documents the design decisions and the scene JSON contract.
Read it before changing anything substantive.
