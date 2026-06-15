#!/usr/bin/env node
/**
 * Golden-path smoke test for 東京奇譚.
 * Requires the app running at http://localhost:3000 with ANTHROPIC_API_KEY set.
 * Exit 0 = all pass, exit 1 = one or more failures.
 *
 * Usage:
 *   npm run test:smoke
 *   node test/smoke.js
 *
 * To install Playwright if not present:
 *   npm install --save-dev playwright && npx playwright install chromium
 */

let chromium;
const tryPaths = [
  'playwright',
  '/Users/jasonalmerini/.npm/_npx/e41f203b7505f1fb/node_modules/playwright',
];
for (const p of tryPaths) {
  try { ({ chromium } = require(p)); break; } catch {}
}
if (!chromium) {
  console.error('playwright not found. Install with: npm install --save-dev playwright && npx playwright install chromium');
  process.exit(1);
}

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  const failures = [];

  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGE ERR: ' + e.message));

  await page.goto('http://localhost:3000');
  await page.waitForLoadState('networkidle');

  // 1. Zero console errors on load
  if (errors.length) {
    failures.push(`Console errors on load: ${errors.join('; ')}`);
  } else {
    console.log('✅ Page load — zero console errors');
  }

  // 2. Setup screen renders with expected elements
  const setupVisible  = await page.locator('#setup-screen').isVisible();
  const nameVisible   = await page.locator('#name-input').isVisible();
  const startVisible  = await page.locator('#start-story-btn').isVisible();
  if (!setupVisible || !nameVisible || !startVisible) {
    failures.push(`Setup screen: setup=${setupVisible} name-input=${nameVisible} start-btn=${startVisible}`);
  } else {
    console.log('✅ Setup screen — renders correctly');
  }

  // 3. Fill in hero name and start — game screen must appear
  await page.locator('#name-input').fill('テスト');
  errors.length = 0;
  await page.locator('#start-story-btn').click();
  const gameVisible = await page.locator('#game-screen').isVisible().catch(() => false);
  if (!gameVisible) {
    failures.push('Game screen did not appear after clicking start');
  } else {
    console.log('✅ Start game — game screen appears');
  }

  // 4 + 5. Wait for the full scene to render: text AND interactive state must both be ready.
  // Scene text streams in before renderScene() is called (streaming appender fires mid-stream),
  // so we can't check choices immediately after text appears — wait for both together.
  let sceneReady = false;
  try {
    await page.waitForFunction(() => {
      const sceneEl = document.getElementById('scene-text');
      const hasText = sceneEl && sceneEl.textContent.trim().length > 10;
      const hasChoices = document.querySelectorAll('#choices .choice-btn').length >= 2;
      const hasInput = document.getElementById('answer-row')?.style.display === 'flex';
      return hasText && (hasChoices || hasInput);
    }, { timeout: 30000 });
    sceneReady = true;
  } catch {
    failures.push('Scene timed out (30s) — is ANTHROPIC_API_KEY set and server running?');
  }

  if (sceneReady) {
    const sceneText = await page.locator('#scene-text').textContent();
    const hasJP = /[぀-ヿ一-鿿]/.test(sceneText || '');
    if (!hasJP) {
      failures.push('Scene text: no Japanese characters found');
    } else {
      console.log('✅ Scene text — non-empty and contains Japanese');
    }

    const choiceCount = await page.locator('#choices .choice-btn').count();
    const answerVisible = await page.locator('#answer-row').isVisible();
    if (choiceCount >= 2) {
      console.log(`✅ Interactive state — ${choiceCount} choice button(s)`);
    } else if (answerVisible) {
      console.log('✅ Interactive state — answer row visible (input scene)');
    } else {
      failures.push(`Interactive state: no choice buttons (${choiceCount}) and answer row not visible`);
    }
  }

  // 6. Furigana toggle hides/shows rt elements (computed style, not class name)
  const rtCount = sceneReady ? await page.locator('#scene-text ruby rt').count() : 0;
  if (rtCount === 0) {
    failures.push('Furigana: no <rt> elements found in scene text');
  } else {
    const rt = page.locator('#scene-text ruby rt').first();
    await page.locator('#furigana-btn').click();
    await page.waitForTimeout(150);
    const afterToggle = await rt.evaluate(el => getComputedStyle(el).display);
    if (afterToggle !== 'none') {
      failures.push(`Furigana toggle: rt display should be "none" after toggle, got "${afterToggle}"`);
    } else {
      console.log('✅ Furigana toggle — hides rt elements correctly');
    }
    // restore
    await page.locator('#furigana-btn').click();
    await page.waitForTimeout(150);
  }

  // 7. Zero console errors after scene generation
  if (errors.length) {
    failures.push(`Console errors after scene generation: ${errors.join('; ')}`);
  } else {
    console.log('✅ Post-scene — zero console errors');
  }

  await browser.close();

  console.log('');
  if (failures.length) {
    console.log(`❌ ${failures.length} check(s) failed:`);
    failures.forEach(f => console.log(`   - ${f}`));
    process.exit(1);
  }
  console.log('✅ All 7 smoke checks passed');
})().catch(e => {
  console.error('Smoke test crashed:', e.message);
  process.exit(1);
});
