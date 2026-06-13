# Plan: Doc sweep + /push and /play skills

## Context
After the dungeon mode implementation, both CLAUDE.md and README.md are partially stale.
Dungeon mode is the biggest new feature but has no design-decision entry and is absent from
README features. Two recurring manual workflows (commit+push, launch game) are strong
candidates for skills. No hooks proposed — the only natural hook fires too broadly to be useful.

---

## CLAUDE.md changes

### 1. Add design decision #13 — Dungeon mode
After decision #12 (cinematic + streaming), add:

> **13. Dungeon mode is a navigation shell, not a gameplay replacement.** The 探索モード
> option adds a 2D top-down canvas dungeon (32×14 tile grid, WASD movement) as an
> alternative way to move between scenes. The learning mechanics — scene generation,
> furigana, TTS, vocab chips, typed input, adaptive difficulty — are completely identical
> in both modes. Dungeon rooms trigger `generate({ kind: 'room', ... })` the same way
> choices do; `mystery_memo` and inventory carry across. The dungeon is structured in three
> wings matching the 3-act story (駅, 神社, 地下). Both modes share the same save slot.

### 2. Update roadmap — add Phase 2 dungeon items
Add to the roadmap section:
- Dungeon Phase 2: minimap overlay, fog of war (unexplored rooms hidden), NPC sprites on map, district-matched ambience

### 3. Update testing convention
Change: "Test by playing at least one choice + one typed-input scene"
To: "Test by playing at least one choice + one typed-input scene (visual novel mode); also verify dungeon mode: WASD movement, room entry, scene generation, マップに戻る return"

### 4. Fix stale index.html description
Change "~90 lines" to "~130 lines" (grew with dungeon-screen div).

---

## README.md changes

### Add dungeon mode to Features
Add after the streaming line:
- Dual game modes: visual novel (物語モード) or 2D dungeon explorer (探索モード) — same AI story, different navigation

---

## New skill: `/push`

**File:** `.claude/skills/push/SKILL.md`

Automates the full commit+push workflow that happens every session:
1. Run `git status` to see changed/untracked files
2. Run `git diff --stat` for a summary
3. Prompt: "Describe the commit in one line:" (or accept argument: `/push "message"`)
4. Stage all tracked modified files + relevant untracked files (exclude .env, node_modules)
5. Commit with conventional message + `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`
6. Push to current branch: `git push origin <branch>`
7. Report: commit hash + branch URL

**When to use:** After completing a feature or fix and the user says "push" or "let's push."

---

## New skill: `/play`

**File:** `.claude/skills/play/SKILL.md`

Launches the game for manual testing:
1. Check if server is running: `curl -s --max-time 2 http://localhost:3000/ > /dev/null`
2. If not running: `npm run dev` in background, wait ~2s, verify
3. Open browser: `open http://localhost:3000`
4. Report: URL + reminder to test the golden path (visual novel + dungeon mode)

**When to use:** When the user says "launch the game", "open the game", "let's test", or "run the app."

---

## Hooks decision: none recommended

The only natural hook would be a post-Edit reminder to update CLAUDE.md. But it would fire
on every file change (including minor tweaks) and require human judgement to act on —
making it noise rather than signal. The File Change Discipline in CLAUDE.md is the right
enforcement mechanism.

---

## Verification
- CLAUDE.md: read it and confirm dungeon is documented, roadmap updated, testing note updated
- README.md: read it and confirm dungeon mode appears in Features
- `/push` skill: invoke with `/push "test commit"` and verify it stages, commits, pushes
- `/play` skill: invoke with `/play` and verify browser opens to the game
