---
description: Launch the tokyo-kitan game in the browser for manual testing
---

# /play skill

Checks that the dev server is running and opens the game in the browser.

## Usage
/play

## Steps

1. **Check server**: `curl -s --max-time 2 http://localhost:3000/ > /dev/null && echo "up" || echo "down"`

2. **If down**: Run `npm run dev` in the background (node --watch auto-restarts on changes).
   Wait ~2 seconds, then re-check with curl to confirm it started.

3. **Open browser**: `open http://localhost:3000`

4. **Report**: Confirm the URL and remind what to test:
   - Visual novel mode: name entry → 物語モード → scene generates → make a choice → verify
     streaming text, vocab chips, TTS
   - Dungeon mode: name entry → 探索モード → WASD movement → step on pink tile → Enter →
     scene generates → マップに戻る returns to map

## When to use
When the user says "launch the game", "open the game", "let's test", or "run the app."

## Notes
- Use `npm run dev` (not `npm start`) during development — it auto-restarts on server changes
- The server must be running for API calls to work; the game loads but scenes won't generate
  without it
