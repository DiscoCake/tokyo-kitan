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

app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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

app.listen(PORT, () => {
  console.log(`東京奇譚 running at http://localhost:${PORT}`);
});
