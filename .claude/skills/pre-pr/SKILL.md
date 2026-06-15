# /pre-pr — Pre-PR diff-aware verification

Run this skill before opening any pull request. Read the diff, identify what needs to be verified, run targeted checks, then open the PR with pre-validated test steps.

## Steps

### 1. Read the diff

```bash
git diff main...HEAD --stat
git diff main...HEAD
```

Understand what changed across every file in the branch. Group by surface:
- `server.js` → prompt logic / scene generation / API routes
- `public/js/*.js` → frontend modules (game, dungeon, ui, tts, etc.)
- `public/css/style.css` → layout / visual
- `public/index.html` → HTML structure

### 2. Run smoke tests if available

```bash
node test/smoke.js   # only if test/smoke.js exists
```

**If smoke tests exist, they must pass before writing any ✅ in the PR.** If they fail, fix the issue and do not proceed with PR creation. If no smoke test exists yet, note it as ⚠️ in the PR.

### 3. Run eval check if eval harness exists

```bash
npm run eval:check   # only if eval/ directory exists
```

If eval:check fails, fix the prompt output — never loosen a check to pass.

### 4. Identify targeted checks

For each changed surface beyond the automated coverage:

| Changed | What to verify |
|---|---|
| `server.js` prompt | Hit `POST /api/scene` with curl; confirm JSON contract and ruby on kanji in scene text |
| New server route | Hit it with curl; check happy path + missing-field 400 |
| New frontend feature | Playwright or manual: exercise the feature end-to-end, plus one edge case |
| CSS/layout | Playwright or manual: computed-style check on affected element |
| Dungeon mode | Requires game state setup — mark ⚠️ if not headlessly testable |

### 5. Open the PR

Include in the PR body's **Test plan** section:
- ✅ `<what you did>` → `<what you observed>` — only for steps you actually ran and passed
- ⚠️ `<step>` — `<honest reason not run>`

Never write ✅ for a step you did not run. Never write ✅ and then describe reading code instead of running the app.

## Rules

- Smoke test failure = stop. Fix before opening PR.
- ⚠️ is correct and honest for things requiring live game state or external services.
- Targeted checks must exercise the feature at the UI or API surface — reading the code is not verification.
