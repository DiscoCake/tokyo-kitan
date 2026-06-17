/**
 * anki.js — read-only AnkiConnect client for lapsed-vocab reinforcement (design decision #19).
 * No framework dependencies. Required by server.js for GET /api/anki/struggling.
 *
 * Mirrors the sibling companion repo's struggling-card query (companion/src/anki.js),
 * trimmed to the single read path this project needs: find cards the learner keeps
 * forgetting and return {word, reading, lapses}. The game weaves at most one of these
 * into each scene's prompt as subtle, in-context re-exposure.
 *
 * Requires the AnkiConnect add-on (ankiweb.net/shared/info/2055492159) and Anki to be
 * open. If Anki is closed, ankiRequest throws and the caller degrades to a no-op.
 */

const ANKI_URL = process.env.ANKI_URL || 'http://localhost:8765';
const DEFAULT_QUERY = process.env.ANKI_LAPSED_QUERY || 'prop:lapses>=2 -is:new';

// Note-field name candidates, in priority order — covers Kaishi 1.5k and common note types.
const WORD_KEYS = ['Word', 'Vocabulary', 'Front', 'Expression', 'Japanese', 'Kanji'];
const READING_KEYS = ['Reading', 'Furigana', 'Kana', 'Pronunciation'];

async function ankiRequest(action, params = {}) {
  const res = await fetch(ANKI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  if (!res.ok) throw new Error(`AnkiConnect HTTP ${res.status}`);
  const data = await res.json();
  if (data.error) throw new Error(`AnkiConnect: ${data.error}`);
  return data.result;
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]+>/g, '').trim();
}

function extractFields(fields) {
  let word = '';
  let reading = '';
  for (const key of WORD_KEYS) {
    if (fields[key]?.value) { word = stripHtml(fields[key].value); break; }
  }
  if (!word) {
    const first = Object.values(fields)[0];
    word = stripHtml(first?.value || '');
  }
  for (const key of READING_KEYS) {
    if (fields[key]?.value) { reading = stripHtml(fields[key].value); break; }
  }
  return { word, reading };
}

// Find the cards the learner keeps lapsing and return them word-first, most-lapsed first.
// Throws if AnkiConnect is unreachable — the route turns that into a graceful no-op.
async function getStrugglingVocab({ query = DEFAULT_QUERY, limit = 50 } = {}) {
  const cardIds = await ankiRequest('findCards', { query });
  if (!cardIds || !cardIds.length) return { cards: [], total: 0, available: true };

  const total = cardIds.length;
  const cardInfos = await ankiRequest('cardsInfo', { cards: cardIds });

  const cards = cardInfos
    .map(c => {
      const { word, reading } = extractFields(c.fields || {});
      return { word, reading, lapses: c.lapses || 0 };
    })
    .filter(c => c.word)
    .sort((a, b) => b.lapses - a.lapses)
    .slice(0, limit);

  return { cards, total, available: true };
}

module.exports = { getStrugglingVocab };
