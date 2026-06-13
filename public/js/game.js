import { S, SCENE_NUMS, saveGame } from './state.js';
import {
  stripHtml, cinematicOpen, cinematicClose, clearScene,
  loadHeroImage, renderItems, renderVocabChips,
  updateHistoryTrail, showEnding
} from './ui.js';
import { exitDungeonRoom } from './dungeon.js';

const SYSTEM = `You are the narrator of 東京奇譚 (Tokyo Strange Tales), an interactive mystery RPG for an early-intermediate Japanese learner (N4/N3).

STORY BIBLE — follow strictly:
- A central mystery threads ALL scenes: scene 1 plants something strange (object, message, person who knows the player's name). Deepens every scene, resolves around scene 12.
- Act 1 (1-3): hook. Act 2 (4-8): deepening, recurring characters, clues. Act 3 (9-11): revelation approaching. Scene 12+: resolution/ending.
- NPCs RECUR and REMEMBER the player — track relationships in mystery_memo (friendly/cold/suspicious based on how the player has treated them) and reflect it in their behavior.
- ITEMS matter: things the player picks up are carried (provided in context as inventory). Reference and use them in later scenes — a key opens something, a note gets deciphered.
- REGISTER VARIATION: deliberately rotate NPC speech styles across scenes — casual young people (だよ/じゃん), polite shopkeepers (です/ます/いらっしゃいませ), rough older men (だろ/〜ぞ), formal keigo where natural. The grammar_note should sometimes highlight register differences.
- Tone: 不思議, Murakami-adjacent quiet surreality. Never horror.

DIFFICULTY (provided per request as easier/standard/harder):
- easier: shorter sentences, solid N4 grammar, common vocab
- standard: N4/N3 mix
- harder: longer sentences, N3 grammar throughout with occasional N2, less common vocab

OUTPUT: valid JSON only — no markdown fences.
{
  "location_jp": "場所名, ruby furigana on ALL kanji, Japanese only",
  "image_query": "3-6 English keywords describing the VISUAL ATMOSPHERE of the scene for a photo search — focus on what it looks like, not just the place name. Good examples: 'japan train platform interior crowd', 'tokyo neon alley night rain', 'shinto shrine torii gate fog', 'japanese izakaya lanterns warm', 'old bookshop dusty shelves'. Avoid generic location names alone like 'tokyo station' — describe the mood and setting.",
  "scene_jp": "3-5 sentences, ALL kanji with ruby furigana, at least one NPC line in 「」",
  "scene_translation": "Natural English translation",
  "grammar_note": "【expression】explanation — sometimes a register note",
  "vocab": [{"word": "切符", "reading": "きっぷ", "meaning": "ticket"}, ... 4-6 words],
  "items_gained": [{"jp": "古い鍵", "reading": "ふるいかぎ"}] (ONLY when the player gains an item this scene, else omit or empty. jp is PLAIN TEXT — no ruby/HTML markup),
  "scene_type": "choice" OR "input" OR "ending",
  "choices": [...] (when choice: 3 options, jp with full ruby + text_only plain),
  "feedback": "(only when evaluating typed answer) 1-2 English sentences on naturalness; suggest natural phrasing if needed. Player types kana-only — NEVER penalize missing kanji.",
  "mystery_memo": "2-4 sentence English internal note: mystery state + NPC relationships + items significance"
}

SCENE TYPE: roughly every 3rd scene is "input" — an NPC asks a direct question the player answers by typing. Scene 12+: "ending".
Player name: PLAYER_NAME`;

function difficultyLevel() {
  if (S.sceneNum < 2) return 'standard';
  const rate = S.peeks / S.sceneNum;
  if (rate < 0.25) return 'harder';
  if (rate > 0.6)  return 'easier';
  return 'standard';
}

function renderChoices(choices) {
  const c = document.getElementById('choices');
  c.innerHTML = '';
  const nums = ['一','二','三'];
  choices.forEach((ch, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.innerHTML = `<span class="choice-num">${nums[i]}</span><span>${ch.jp}</span>`;
    btn.onclick = () => {
      if (S.loading) return;
      S.history.push({ num: S.sceneNum, loc: stripHtml(S.currentScene?.location_jp || ''), choice: ch.text_only, type: 'choice' });
      generate({ kind: 'choice', value: ch.text_only });
    };
    c.appendChild(btn);
  });
}

export function renderScene(scene, skipImageLoad = false) {
  S.currentScene = scene;
  if (scene.mystery_memo) S.mysteryMemo = scene.mystery_memo;
  if (scene.grammar_note) S.grammarSeen.push(scene.grammar_note);

  document.getElementById('loc-text').innerHTML = scene.location_jp;
  if (!skipImageLoad) {
    // Fire image request concurrently — scene text/choices render immediately while image loads
    loadHeroImage(scene.image_query).then(imgUrl => {
      S.gallery.push({ loc: scene.location_jp, img: imgUrl || '', num: S.sceneNum });
    });
  }

  if (scene.items_gained && scene.items_gained.length) {
    scene.items_gained.forEach(it => {
      if (!S.items.some(x => x.jp === it.jp)) S.items.push(it);
    });
    renderItems(true);
  } else renderItems(false);

  const fb = document.getElementById('feedback-box');
  if (scene.feedback) {
    document.getElementById('feedback-text').textContent = scene.feedback;
    fb.style.display = 'block';
  } else fb.style.display = 'none';

  const textEl = document.getElementById('scene-text');
  textEl.innerHTML = scene.scene_jp;
  textEl.classList.add('fadein');
  setTimeout(() => textEl.classList.remove('fadein'), 400);

  document.getElementById('translation-box').innerHTML = scene.scene_translation || '';
  document.getElementById('grammar-box').innerHTML =
    (scene.grammar_note || '').replace(/【(.+?)】/, '<strong>【$1】</strong>');

  renderVocabChips(scene.vocab || []);

  if (scene.scene_type === 'ending') { saveGame(); showEnding(); return; }

  if (scene.scene_type === 'input') {
    document.getElementById('choices').innerHTML = '';
    document.getElementById('answer-row').style.display = 'flex';
    document.getElementById('input-hint').style.display = 'block';
    const inp = document.getElementById('answer-input');
    inp.value = '';
    setTimeout(() => inp.focus(), 450);
  } else {
    document.getElementById('answer-row').style.display = 'none';
    document.getElementById('input-hint').style.display = 'none';
    renderChoices(scene.choices || []);
  }

  // In dungeon mode, add a "back to map" button alongside choices
  if (S.mode === 'dungeon') {
    const btn = document.createElement('button');
    btn.className = 'choice-btn map-return-btn';
    btn.innerHTML = '<span class="choice-num">↩</span><span><ruby>マップ<rt>まっぷ</rt></ruby>に<ruby>戻<rt>もど</rt></ruby>る</span>';
    btn.onclick = () => { if (!S.loading) exitDungeonRoom(); };
    document.getElementById('choices').appendChild(btn);
  }

  updateHistoryTrail();
  saveGame();
}

// Extracts a single string field from a streaming JSON payload character by character.
// Returns newly arrived characters while capturing, null otherwise.
// `pendingEscape` carries a trailing `\` across SSE chunk boundaries so a `\"` split
// between two chunks doesn't falsely terminate capture.
function makeExtractor(fieldName) {
  const marker = `"${fieldName}": "`;
  let state = 'searching', mPos = 0, value = '', pendingEscape = false;
  return {
    feed(chunk) {
      let fresh = '';
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (state === 'searching') {
          mPos = (c === marker[mPos]) ? mPos + 1 : 0;
          if (mPos === marker.length) state = 'capturing';
        } else if (state === 'capturing') {
          if (pendingEscape) {
            pendingEscape = false;
            const u = c === 'n' ? '\n' : c === 't' ? '\t' : c;
            value += u; fresh += u;
          } else if (c === '\\') {
            if (i + 1 < chunk.length) {
              const n = chunk[++i];
              const u = n === 'n' ? '\n' : n === 't' ? '\t' : n;
              value += u; fresh += u;
            } else {
              pendingEscape = true; // `\` is last char of chunk — resolve on next feed()
            }
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

// Appends HTML chunks to an element safely — buffers inside tags and entire
// <ruby>…</ruby> blocks so furigana is always inserted as a complete unit.
function makeHtmlAppender(el) {
  let buf = '', inTag = false, rubyDepth = 0, pendingTag = '';
  return function append(chunk) {
    for (const c of chunk) {
      if (c === '<') { inTag = true; pendingTag = ''; }
      if (inTag) pendingTag += c;
      buf += c;
      if (inTag && c === '>') {
        inTag = false;
        if (/^<ruby[\s>]/i.test(pendingTag)) rubyDepth++;
        else if (/^<\/ruby>/i.test(pendingTag)) rubyDepth = Math.max(0, rubyDepth - 1);
        pendingTag = '';
      }
      if (!inTag && rubyDepth === 0) {
        el.insertAdjacentHTML('beforeend', buf);
        buf = '';
      }
    }
  };
}

export async function generate(action) {
  if (S.loading) return;
  S.loading = true;

  cinematicOpen(S.currentScene?.location_jp || '');
  clearScene();

  document.getElementById('translation-box').style.display = 'none';
  document.getElementById('grammar-box').style.display = 'none';
  document.getElementById('translation-btn').classList.remove('active');
  document.getElementById('grammar-btn').classList.remove('active');

  S.sceneNum++;
  document.getElementById('scene-tag').innerHTML =
    '<ruby>場面<rt>ばめん</rt></ruby> ' + (SCENE_NUMS[S.sceneNum - 1] || S.sceneNum);

  const histCtx = S.history.length
    ? '\nRecent history:\n' + S.history.slice(-4).map(h => `Scene ${h.num} (${h.loc}): ${h.choice}`).join('\n')
    : '';
  const memoCtx = S.mysteryMemo ? `\nMystery state: ${S.mysteryMemo}` : '';
  const itemCtx = S.items.length ? `\nInventory: ${S.items.map(i => i.jp).join('、')}` : '';
  const diffCtx = `\nDifficulty: ${difficultyLevel()}`;

  let userMsg;
  if (!action) {
    userMsg = `Scene 1 of ~12. Begin — the player just arrived in Tokyo. Establish the mystery hook.${diffCtx}`;
  } else if (action.kind === 'answer') {
    userMsg = `Scene ${S.sceneNum} of ~12. The player TYPED this answer to the NPC's question: "${action.value}". Evaluate it (feedback field), then continue incorporating their answer.${memoCtx}${itemCtx}${diffCtx}${histCtx}`;
  } else if (action.kind === 'room') {
    userMsg = `Scene ${S.sceneNum} of ~12. The player enters ${action.roomName}. Generate a scene set specifically in this location — describe the space, introduce an NPC or clue, deepen the mystery.${memoCtx}${itemCtx}${diffCtx}${histCtx}`;
  } else {
    userMsg = `Scene ${S.sceneNum} of ~12. Player chose: "${action.value}". Continue.${memoCtx}${itemCtx}${diffCtx}${histCtx}`;
  }

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

    const locEx   = makeExtractor('location_jp');
    const imageEx = makeExtractor('image_query');
    const textEx  = makeExtractor('scene_jp');

    let cinematicClosed = false;
    let sceneTextReady = false;
    let earlyImagePromise = null;
    const sceneTextEl = document.getElementById('scene-text');
    let appendHtml = null;

    // Close cinematic once location_jp arrives; enforce 500ms minimum display time.
    // Called without await in the stream loop so text keeps arriving during the wait.
    async function closeCinematic(locationHtml) {
      if (cinematicClosed) return;
      cinematicClosed = true;
      document.getElementById('cin-location').innerHTML = locationHtml;
      const elapsed = Date.now() - startTime;
      if (elapsed < 500) await new Promise(r => setTimeout(r, 500 - elapsed));
      cinematicClose();
      await new Promise(r => setTimeout(r, 280));
      document.getElementById('loc-text').innerHTML = locationHtml;
      sceneTextEl.innerHTML = '';
      appendHtml = makeHtmlAppender(sceneTextEl);
      sceneTextReady = true;
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      sseBuffer += dec.decode(value, { stream: true });
      const lines = sseBuffer.split('\n');
      sseBuffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '{}') continue;
        try {
          const { t } = JSON.parse(payload);
          if (!t) continue;
          fullText += t;

          locEx.feed(t);
          if (locEx.done && !cinematicClosed) {
            closeCinematic(locEx.value); // intentionally not awaited
          }

          imageEx.feed(t);
          if (imageEx.done && !earlyImagePromise) {
            earlyImagePromise = loadHeroImage(imageEx.value);
          }

          const textFrag = textEx.feed(t);
          if (textFrag && sceneTextReady && appendHtml) {
            appendHtml(textFrag);
          }
        } catch {}
      }
    }

    if (!cinematicClosed) await closeCinematic('');

    const raw = fullText.replace(/```json|```/g, '').trim();
    if (!raw) throw new Error('Empty response');
    const scene = JSON.parse(raw);

    if (earlyImagePromise) {
      earlyImagePromise.then(imgUrl => {
        S.gallery.push({ loc: scene.location_jp, img: imgUrl || '', num: S.sceneNum });
      });
    }
    renderScene(scene, /* skipImageLoad */ earlyImagePromise != null);
  } catch (e) {
    cinematicClose();
    console.error('Scene error:', e);
    const isNetwork = e.message.includes('Failed to fetch') || e.message.includes('NetworkError');
    const msg = isNetwork
      ? 'サーバーに接続できません。`npm run dev` でサーバーが起動しているか確認してください。'
      : 'エラーが発生しました: ' + e.message;
    // Only overwrite scene text when nothing streamed yet (blank screen is worse than error).
    // If text was already visible, show error below the content instead.
    const textEl = document.getElementById('scene-text');
    if (!textEl.textContent.trim()) {
      textEl.textContent = msg;
    } else {
      const err = document.createElement('p');
      err.style.cssText = 'color:#ff6fa8;font-size:0.8em;margin-top:1em;opacity:0.8';
      err.textContent = msg;
      textEl.appendChild(err);
    }
  }

  S.loading = false;
}
