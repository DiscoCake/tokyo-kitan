#!/usr/bin/env node
// Eval runner for tokyo-kitan prompt output.
// Requires the dev server to be running at localhost:3000 for 'run' and 'update' modes.
//
// Usage:
//   node eval/run.js check   — validate existing snapshots offline (CI-safe, no API)
//   node eval/run.js update  — call live API, write snapshots, report
//   node eval/run.js run     — call live API, report, no writes (default)
//
// Optional trailing slug args filter to specific golden cases, e.g.:
//   node eval/run.js update choice_follow dungeon_room
//   node eval/run.js check long_history

const fs   = require('fs');
const path = require('path');

const SYSTEM       = require('./system.js');
const GOLDEN       = require('./golden.js');
const { runChecks } = require('./checks.js');

const BASE_URL     = 'http://localhost:3000';
const SPACING_MS   = 7000;
const MAX_RETRIES  = 4;
const BACKOFF_MS   = 65000;
const SNAPSHOT_DIR = path.join(__dirname, 'snapshots');
const PLAYER_NAME  = 'テスト';

const mode = process.argv[2] || 'run';
if (!['check', 'update', 'run'].includes(mode)) {
  console.error(`Unknown mode: ${mode}. Use check, update, or run.`);
  process.exit(1);
}

const slugFilter = new Set(process.argv.slice(3));
const CASES = slugFilter.size
  ? GOLDEN.filter(c => slugFilter.has(c.slug))
  : GOLDEN;
if (slugFilter.size && CASES.length !== slugFilter.size) {
  const found = new Set(CASES.map(c => c.slug));
  const missing = [...slugFilter].filter(s => !found.has(s));
  console.error(`Unknown slug(s): ${missing.join(', ')}`);
  process.exit(1);
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function callScene(messages) {
  const res = await fetch(`${BASE_URL}/api/scene`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: SYSTEM.replace('PLAYER_NAME', PLAYER_NAME),
      messages,
      max_tokens: 3000
    })
  });

  const data = await res.json();

  if (!res.ok) {
    const err = new Error(`API error ${res.status}: ${JSON.stringify(data)}`);
    err.status = res.status;
    throw err;
  }

  const text = data.content?.[0]?.text;
  if (!text) throw new Error('Empty content in API response');

  const raw = text.replace(/```json|```/g, '').trim();
  if (!raw) throw new Error('Empty text after stripping fences');

  return JSON.parse(raw);
}

async function callWithRetry(c) {
  let lastErr;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await callScene(c.messages);
    } catch (err) {
      lastErr = err;
      if (err.status === 429) {
        console.log(`  [429] Rate limited — waiting ${BACKOFF_MS / 1000}s before retry ${attempt}/${MAX_RETRIES}`);
        await sleep(BACKOFF_MS);
      } else if (attempt < MAX_RETRIES) {
        console.log(`  [err] ${err.message} — retry ${attempt}/${MAX_RETRIES}`);
        await sleep(2000);
      }
    }
  }
  throw lastErr;
}

function evaluate(c, result) {
  const checks = runChecks(result);
  let allPass = true;
  for (const check of checks) {
    if (check.pass) {
      console.log(`    [PASS] ${check.name}`);
    } else {
      allPass = false;
      console.log(`    [FAIL] ${check.name}`);
      for (const msg of check.messages) {
        console.log(`           → ${msg}`);
      }
    }
  }
  return allPass;
}

function snapshotPath(c) {
  return path.join(SNAPSHOT_DIR, `${c.slug}.json`);
}

async function runCheck() {
  let passed = 0, total = 0;
  for (const c of CASES) {
    const p = snapshotPath(c);
    if (!fs.existsSync(p)) {
      console.log(`\n[SKIP] ${c.slug} — no snapshot (run eval:update first)`);
      continue;
    }
    total++;
    console.log(`\n[CHECK] ${c.slug} — ${c.label}`);
    const result = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (evaluate(c, result)) passed++;
  }
  return { passed, total };
}

async function runLive(writeSnapshots) {
  let passed = 0, total = CASES.length;
  for (let i = 0; i < CASES.length; i++) {
    const c = CASES[i];
    if (i > 0) {
      process.stdout.write(`  waiting ${SPACING_MS / 1000}s...`);
      await sleep(SPACING_MS);
      process.stdout.write('\r                  \r');
    }
    console.log(`\n[${i + 1}/${total}] ${c.slug} — ${c.label}`);
    try {
      const result = await callWithRetry(c);
      if (writeSnapshots) {
        fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
        fs.writeFileSync(snapshotPath(c), JSON.stringify(result, null, 2), 'utf8');
        console.log(`  snapshot written: eval/snapshots/${c.slug}.json`);
      }
      if (evaluate(c, result)) passed++;
    } catch (err) {
      console.log(`  [ERROR] ${err.message}`);
    }
  }
  return { passed, total };
}

async function main() {
  console.log(`\n東京奇譚 eval — mode: ${mode}\n${'─'.repeat(50)}`);

  let result;
  if (mode === 'check') {
    result = await runCheck();
  } else {
    result = await runLive(mode === 'update');
  }

  const { passed, total } = result;
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`${passed}/${total} passed`);

  if (passed < total) process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
