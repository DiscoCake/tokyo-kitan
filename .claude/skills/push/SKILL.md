---
description: Stage, commit, and push all current changes to GitHub following project conventions
---

# /push skill

Automates the full git commit + push workflow for tokyo-kitan.

## Usage
/push
/push "short description of what changed"

If no message is provided, summarize the changes from `git diff --stat` and `git status`.

## Steps

1. **Check status**: Run `git status` and `git diff --stat` to see what changed.

2. **Draft commit message**: If the user provided a message, use it. Otherwise infer a
   concise one-line summary from the diff stat. Follow the project's commit style:
   active verb + what changed (e.g. "Add dungeon mode Phase 1", "Fix TTS progress bar").

3. **Stage files**: Add modified tracked files and relevant untracked files. Never add:
   - `.env` or any file containing secrets
   - `node_modules/`
   - OS files (`.DS_Store`)
   Always include `archive/` snapshots that accompany code changes.

4. **Commit**: Use a HEREDOC to pass the message cleanly:
   ```
   git commit -m "$(cat <<'EOF'
   <message here>

   Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
   EOF
   )"
   ```

5. **Push**: `git push origin <current-branch>`

6. **Report**: Print the commit hash and confirm push succeeded.

## When to use
When the user says "push", "push to GitHub", "let's push", or "commit and push."

## Notes
- Never force-push or amend published commits without explicit user instruction
- If a pre-commit hook fails, fix the issue and create a NEW commit (do not --amend)
- Canonical remote: https://github.com/DiscoCake/tokyo-kitan (origin)
