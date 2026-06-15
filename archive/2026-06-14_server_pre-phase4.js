/**
 * 東京奇譚 — minimal API proxy
 * Keeps the Anthropic API key server-side. The frontend POSTs to /api/scene
 * and this forwards to the Anthropic Messages API.
 */
require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('Missing ANTHROPIC_API_KEY — copy .env.example to .env and add your key.');
  process.exit(1);
}

const imageCache = new Map();

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/image', async (req, res) => {
  const query = ((req.query.q || '') + ' japan').trim();
  if (!query) return res.status(400).json({ error: 'q required' });
  if (imageCache.has(query)) return res.json({ url: imageCache.get(query) });
  if (!process.env.PEXELS_API_KEY) return res.status(503).json({ error: 'PEXELS_API_KEY not set' });

  try {
    const r = await fetch(
      `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1&orientation=landscape`,
      { headers: { Authorization: process.env.PEXELS_API_KEY } }
    );
    const data = await r.json();
    const photo = data.photos?.[0];
    if (!photo) return res.status(404).json({ error: 'No results' });
    const url = photo.src.large2x || photo.src.large || photo.src.original;
    imageCache.set(query, url);
    res.json({ url, photographer: photo.photographer, pexels_url: photo.url });
  } catch (e) {
    console.error('Pexels error:', e);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/scene', async (req, res) => {
  try {
    const { system, messages, max_tokens } = req.body;
    if (!system || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Bad request: system and messages required' });
    }

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
        system,
        messages
      })
    });

    const data = await upstream.json();
    if (!upstream.ok) {
      console.error('Anthropic API error:', data);
      return res.status(upstream.status).json(data);
    }
    res.json(data);
  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: 'Proxy error: ' + err.message });
  }
});

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

app.listen(PORT, () => {
  console.log(`東京奇譚 running at http://localhost:${PORT}`);
});
