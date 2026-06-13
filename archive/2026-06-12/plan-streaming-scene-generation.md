# Plan: Streaming Scene Generation

## Context
Scene load time is: API wait (~3-8s) + 900ms cinematic + 380ms fade = very slow. The entire API response must arrive before anything is shown to the user. Streaming lets us close the cinematic as soon as `location_jp` arrives (~100-300ms into the stream), then render `scene_jp` text progressively while choices/vocab/grammar are still generating. Perceived wait drops from ~8s to ~1-2s.

---

## Architecture

**Server**: New `POST /api/scene/stream` sends `stream: true` to Anthropic, pipes text deltas to the client as SSE. Old `/api/scene` stays unchanged.

**Client**: `generate()` in `game.js` switches to the streaming endpoint. A character-by-character state machine extracts `location_jp` and `scene_jp` from the arriving JSON text. When `location_jp` completes, the cinematic closes (enforcing a 500ms minimum). As `scene_jp` arrives, chunks are appended to `#scene-text` safely (buffering inside HTML tags to avoid partial-tag rendering glitches). When the stream ends, the full JSON is parsed and `renderScene()` is called for everything else (choices, vocab, items, grammar, translation, saving).

---

## Files to change

| File | Change |
|---|---|
| `server.js` | Add `POST /api/scene/stream` SSE route |
| `public/js/game.js` | Rewrite `generate()` to use streaming |
| `CLAUDE.md` | Note streaming in architecture section |

**Archive before changes**: `archive/2026-06-12/game.js` (major rewrite of generate). `server.js` already archived. No need to re-archive.

---

## Implementation

### 1. `server.js` — new `/api/scene/stream` route

Add after the existing `/api/scene` route:

```js
app.post('/api/scene/stream', async (req, res) => {
  const { system, messages, max_tokens } = req.body;
  if (!system || !Array.isArray(messages))
    return res.status(400).json({ error: 'Bad request' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: Math.min(max_tokens || 3000, 4096),
        stream: true,
        system,
        messages
      })
    });

    if (!upstream.ok) {
      const err = await upstream.json();
      res.write(`event: error\ndata: ${JSON.stringify(err)}\n\n`);
      return res.end();
    }

    const reader = upstream.body.getReader();
    const dec = new TextDecoder();
    let buf = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta')
            res.write(`data: ${JSON.stringify({ t: ev.delta.text })}\n\n`);
          else if (ev.type === 'message_stop')
            res.write('event: done\ndata: {}\n\n');
          else if (ev.type === 'error')
            res.write(`event: error\ndata: ${JSON.stringify(ev.error)}\n\n`);
        } catch {}
      }
    }
    res.end();
  } catch (e) {
    console.error('Stream proxy error:', e);
    res.write(`event: error\ndata: ${JSON.stringify({ message: e.message })}\n\n`);
    res.end();
  }
});
```

### 2. `public/js/game.js` — rewrite `generate()`

Replace the existing `generate()` body with streaming logic. Keep the function signature (`export async function generate(action)`) and all surrounding code (SYSTEM prompt, `difficultyLevel`, `renderScene`, `renderChoices`) unchanged.

#### Field extractor utility (add above `generate`):
```js
function makeExtractor(fieldName) {
  const marker = `"${fieldName}": "`;
  let state = 'searching', mPos = 0, value = '';
  return {
    feed(chunk) {
      let fresh = '';
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (state === 'searching') {
          mPos = (c === marker[mPos]) ? mPos + 1 : 0;
          if (mPos === marker.length) state = 'capturing';
        } else if (state === 'capturing') {
          if (c === '\\' && i + 1 < chunk.length) {
            const n = chunk[++i];
            const u = n === 'n' ? '\n' : n === 't' ? '\t' : n;
            value += u; fresh += u;
          } else if (c === '"') {
            state = 'done';
          } else {
            value += c; fresh += c;
          }
        }
      }
      return state === 'capturing' ? fresh : null;
    },
    get value() { return value; },
    get done() { return state === 'done'; }
  };
}
```

#### Safe HTML appender (buffers inside tags, flushes on `>`):
```js
function makeHtmlAppender(el) {
  let buf = '', inTag = false;
  return function append(chunk) {
    for (const c of chunk) {
      if (c === '<') inTag = true;
      buf += c;
      if (!inTag || c === '>') {
        inTag = false;
        el.insertAdjacentHTML('beforeend', buf);
        buf = '';
      }
    }
  };
}
```

#### New `generate()` body:
```js
export async function generate(action) {
  if (S.loading) return;
  S.loading = true;

  cinematicOpen(S.currentScene?.location_jp || '');
  clearScene();
  document.getElementById('translation-box').style.display = 'none';
  document.getElementById('grammar-box').style.display  = 'none';
  document.getElementById('translation-btn').classList.remove('active');
  document.getElementById('grammar-btn').classList.remove('active');

  S.sceneNum++;
  document.getElementById('scene-tag').innerHTML =
    '<ruby>場面<rt>ばめん</rt></ruby> ' + (SCENE_NUMS[S.sceneNum - 1] || S.sceneNum);

  // ... (existing userMsg / context building — unchanged) ...

  const startTime = Date.now();

  try {
    const res = await fetch('/api/scene/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        max_tokens: 3000,
        system: SYSTEM.replace('PLAYER_NAME', S.playerName),
        messages: [{ role: 'user', content: userMsg }]
      })
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let sseBuffer = '';
    let fullText = '';

    const locEx  = makeExtractor('location_jp');
    const textEx = makeExtractor('scene_jp');

    let cinematicClosed = false;
    let sceneTextStarted = false;
    const sceneTextEl = document.getElementById('scene-text');
    let appendHtml = null; // initialized when streaming starts

    async function closeCinematic(locationHtml) {
      if (cinematicClosed) return;
      cinematicClosed = true;
      document.getElementById('cin-location').innerHTML = locationHtml;
      // Enforce minimum 500ms cinematic display
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed));
      cinematicClose();
      await new Promise(r => setTimeout(r, 280));
      sceneTextEl.innerHTML = '';
      appendHtml = makeHtmlAppender(sceneTextEl);
      sceneTextStarted = true;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += dec.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith('event: error')) continue;
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '{}') continue; // done event data
        try {
          const { t } = JSON.parse(payload);
          if (!t) continue;
          fullText += t;

          // Extract location_jp — close cinematic when complete
          const locFrag = locEx.feed(t);
          if (locEx.done && !cinematicClosed) {
            closeCinematic(locEx.value); // async, don't await — let it run
          }

          // Extract scene_jp — stream to scene text div
          const textFrag = textEx.feed(t);
          if (textFrag && sceneTextStarted && appendHtml) {
            appendHtml(textFrag);
          }
        } catch {}
      }
    }

    // Ensure cinematic closed even if location_jp was missing
    if (!cinematicClosed) await closeCinematic('');

    // Parse full response and do the complete render
    const raw = fullText.replace(/```json|```/g, '').trim();
    if (!raw) throw new Error('Empty response');
    const scene = JSON.parse(raw);

    // scene_jp already displayed; renderScene re-sets it (same content) + renders everything else
    renderScene(scene);

  } catch (e) {
    if (!document.getElementById('cinematic').classList.contains('visible') === false) {
      cinematicClose();
    }
    cinematicClose();
    const msg = e.message.includes('Failed to fetch') || e.message.includes('NetworkError')
      ? 'サーバーに接続できません。`npm run dev` でサーバーが起動しているか確認してください。'
      : 'エラーが発生しました: ' + e.message;
    document.getElementById('scene-text').textContent = msg;
  }

  S.loading = false;
}
```

**Key timing**: `closeCinematic()` is called without `await` inside the stream loop so text keeps arriving while the 500ms timer runs. `sceneTextStarted` gates HTML appending until the cinematic is fully closed and `sceneTextEl` is cleared.

---

## What `renderScene()` does at end of stream
`renderScene(scene)` already handles: location display, hero image, items, feedback box, vocab chips, choices, input row, history trail, save. It also sets `scene-text.innerHTML = scene.scene_jp` — same content already shown, no visible change. The `fadein` CSS class is added but by this point the text is already rendered, so it's imperceptible. No changes needed to `renderScene`.

---

## Verification
1. `npm run dev` → start a new story
2. **Timing**: cinematic should close visibly faster (~0.5-1s after click) vs before (~4-8s)
3. **Text streaming**: scene text should appear word-by-word / ruby-block-by-ruby-block
4. **Completeness**: choices, vocab chips, grammar note, translation all render correctly after stream ends
5. **Error path**: kill the server mid-stream → error message appears, `S.loading` resets
6. **Resume**: resume a saved game still works (calls `renderScene` directly, no streaming involved)
