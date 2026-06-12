---
description: Archive a project file to archive/YYYY-MM-DD/ before making major changes
---

# /archive skill

Archives a file to the project's `archive/YYYY-MM-DD/` folder per CLAUDE.md File Change Discipline rules.

## Usage
/archive <relative-path-to-file>

Example: /archive public/js/images.js

## Steps
1. Run `date +%Y-%m-%d` to get today's date
2. Ensure `archive/<date>/` directory exists (`mkdir -p`)
3. Copy the file: `cp <source> archive/<date>/<filename-only>`
4. Confirm: "Archived <file> → archive/<date>/<filename>"

## When to use
Before any major rewrite, new feature addition, or change to the Scene JSON contract,
per the File Change Discipline rules in CLAUDE.md. Minor edits (typos, small bug fixes)
do not require archiving.
