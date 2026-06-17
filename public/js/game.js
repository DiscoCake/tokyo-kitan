import { S, SCENE_NUMS, saveGame, saveProfile } from './state.js';
import {
  stripHtml, cinematicOpen, cinematicClose, clearScene,
  loadHeroImage, renderItems,
  updateHistoryTrail, showEnding, makeSceneWordTaps
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

GRAMMAR COVERAGE — N3 breadth + spaced reinforcement (separate from difficulty level):
- Each request lists grammar points already seen this run. Choose ONE NEW N3 point NOT in that list that fits the scene naturally, feature it, and set grammar_point_targeted to its 【expression】 head.
- A request may also list points DUE FOR REINFORCEMENT. When present, also reuse ONE of them naturally somewhere in the scene — do NOT re-explain it (grammar_note stays focused on the featured point). If a due point is itself the most natural fit to feature, you may instead feature it and set grammar_point_targeted to it.
- Weave grammar into prose or dialogue — story and natural Japanese always come first. Never force it, never stack multiple new points, never bend the prose to cram grammar in.
- Highlight the featured point in grammar_note. grammar_point_targeted MUST equal the 【expression】 head shown in grammar_note. If nothing N3 fits naturally, use whatever grammar the scene calls for and set grammar_point_targeted to that point's expression.

LAPSED VOCABULARY (optional, from the learner's Anki reviews):
- A request may list ONE word the learner keeps forgetting. If — and only if — it fits the scene naturally, use it once (in prose or dialogue) and include it in the vocab array with reading + meaning. Story and natural Japanese always come first — never bend the scene to include it, never list more than the one word given, and skip it entirely if it would feel forced. This is subtle re-exposure, not a vocabulary drill.

OUTPUT: valid JSON only — no markdown fences.
{
  "location_jp": "場所名, ruby furigana on ALL kanji — NO EXCEPTIONS, even common kanji like 駅 or 道, Japanese only",
  "image_query": "3-6 English keywords describing the VISUAL ATMOSPHERE of the scene for a photo search — focus on what it looks like, not just the place name. Good examples: 'japan train platform interior crowd', 'tokyo neon alley night rain', 'shinto shrine torii gate fog', 'japanese izakaya lanterns warm', 'old bookshop dusty shelves'. Avoid generic location names alone like 'tokyo station' — describe the mood and setting.",
  "scene_jp": "3 sentences for harder difficulty, 4–5 for standard/easier. ALL kanji with ruby furigana (NO EXCEPTIONS — every single kanji, including common ones like 人・日・駅・続・知, kanji INSIDE 「」 dialogue lines, and BOTH halves of compound/送り仮名 verbs like 拾い上げる → 拾 AND 上), at least one NPC line in 「」. Complexity of grammar and vocabulary signals difficulty — not length.",
  "scene_translation": "Natural English translation",
  "grammar_note": "【expression】explanation — sometimes a register note",
  "grammar_point_targeted": "the 【expression】 head WITHOUT brackets of the grammar point this scene featured — MUST match the 【…】 in grammar_note",
  "vocab": [{"word": "切符", "reading": "きっぷ", "meaning": "ticket"}, ... 8–12 words, skewing toward less common vocabulary the learner may not know],
  "items_gained": [{"jp": "古い鍵", "reading": "ふるいかぎ"}] (ONLY when the player gains an item this scene, else omit or empty. jp is PLAIN TEXT — no ruby/HTML markup),
  "scene_type": "choice" OR "input" OR "ending",
  "choices": [...] (when choice: 3 options, jp with full ruby + text_only plain),
  "feedback": "(only when evaluating typed answer) 1-2 English sentences: say what was right, name any SPECIFIC mistake (particle, verb form, word choice), and give the corrected natural phrasing. Player types kana-only — NEVER penalize missing kanji.",
  "mystery_memo": "2-4 sentence English internal note: mystery state + NPC relationships + items significance",
  "npcs": [{"name_jp": "<ruby>鈴木<rt>すずき</rt></ruby>", "name_reading": "すずき", "relationship": "neutral", "note": "1-sentence Japanese context, plain text no ruby"}]
}

npcs: array of established NPCs appearing or referenced this scene. Each entry: name_jp (ruby-annotated Japanese), name_reading (plain kana — used as dedup key across scenes), relationship (one of: ally/neutral/suspicious/hostile/unknown), note (1-sentence Japanese plain text — no ruby markup, describe who they are and their current stance). Only include named or clearly identified characters — not random pedestrians. Return [] if no established NPCs appear. Relationship should reflect the current state based on player actions so far.

SCENE TYPE: roughly every 3rd scene is "input" — an NPC asks a direct question the player answers by typing. Frame that question so a natural answer would use a grammar point seen this run (ideally one due for reinforcement), giving the player a reason to PRODUCE it. Scene 12+: "ending".
Player name: PLAYER_NAME`;

function difficultyLevel() {
  if (S.sceneNum < 4) return 'standard';
  const rate = (S.peeks + S.unknownTaps) / S.sceneNum;
  if (rate < 0.10) return 'harder';
  if (rate > 0.6)  return 'easier';
  return 'standard';
}

// Spaced-reinforcement scheduler. A grammar point becomes "due" once the number of scenes
// since it was last seen reaches a strength-based interval (the more often it's been
// reinforced, the longer it waits). Returns up to 3 most-overdue 【expressions】.
const REINFORCE_INTERVAL = [0, 2, 4, 8, 16]; // index = strength (0–4)
function dueGrammar() {
  return Object.values(S.grammarMastery)
    .map(m => ({ expr: m.expr, overdue: (S.globalSceneCount - m.lastSeen) - (REINFORCE_INTERVAL[Math.min(m.strength, 4)] ?? 16) }))
    .filter(x => x.overdue >= 0 && x.expr)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 3)
    .map(x => x.expr);
}

// ── Anki lapsed-vocab reinforcement (#19) ──
// Ephemeral, session-only pool of words the learner keeps forgetting (from their Anki
// reviews). Fetched once per game start/resume; NOT persisted. generate() offers at most
// one candidate per scene as a soft, skippable prompt hint; renderScene() checks whether
// the model actually used it. If Anki is closed the pool stays empty and everything no-ops.
let lapsedPool = [];                 // [{ word, reading }] most-lapsed first
let lapsedPtr = 0;                   // round-robin cursor over the pool
const lapsedSurfacedWords = new Set(); // words confirmed used in a scene — skipped thereafter
let activeLapsedCandidate = null;    // the word offered to the current in-flight scene

export async function primeLapsedPool() {
  lapsedPool = []; lapsedPtr = 0; lapsedSurfacedWords.clear(); activeLapsedCandidate = null;
  try {
    const r = await fetch('/api/anki/struggling');
    const data = await r.json();
    lapsedPool = (data.cards || []).filter(c => c.word);
  } catch { lapsedPool = []; }
}

// Round-robin the next not-yet-surfaced candidate. Returns { word, reading } or null.
function nextLapsedCandidate() {
  if (!lapsedPool.length) return null;
  for (let i = 0; i < lapsedPool.length; i++) {
    const c = lapsedPool[(lapsedPtr + i) % lapsedPool.length];
    if (!lapsedSurfacedWords.has(c.word)) {
      lapsedPtr = (lapsedPtr + i + 1) % lapsedPool.length;
      return c;
    }
  }
  return null; // every word already surfaced this run
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

export function renderScene(scene, skipImageLoad = false, skipMeta = false) {
  S.currentScene = scene;
  if (!skipMeta) {
    if (scene.mystery_memo) S.mysteryMemo = scene.mystery_memo;
    S.globalSceneCount++;  // persistent clock for spaced grammar reinforcement
    if (scene.grammar_note) {
      S.grammarSeen.push(scene.grammar_note);
      // Upsert the featured point into the persistent mastery store. Key on the
      // 【expression】 head — prefer the explicit field, fall back to parsing grammar_note.
      const expr = (scene.grammar_point_targeted || scene.grammar_note.match(/【(.+?)】/)?.[1] || '').trim();
      if (expr) {
        const m = S.grammarMastery[expr] || { expr, exposures: 0, lastSeen: 0, strength: 0 };
        m.exposures++;
        m.lastSeen = S.globalSceneCount;
        m.strength = Math.min(4, m.strength + 1);
        S.grammarMastery[expr] = m;
      }
    }
    if (scene.npcs?.length) {
      scene.npcs.forEach(npc => {
        const existing = S.npcLog.find(n => n.name_reading === npc.name_reading);
        if (existing) {
          existing.relationship = npc.relationship;
          existing.note = npc.note;
          existing.name_jp = npc.name_jp;
        } else {
          S.npcLog.push({ ...npc });
        }
      });
    }
    // Lapsed-vocab reinforcement (#19): if a candidate word was offered this scene AND the
    // model actually wove it in, log where it surfaced. stripHtml leaves the base kanji
    // intact (ruby reading text trails it) so includes() still matches inside <ruby> markup.
    if (activeLapsedCandidate) {
      const word = activeLapsedCandidate.word;
      if (!lapsedSurfacedWords.has(word) && stripHtml(scene.scene_jp || '').includes(word)) {
        lapsedSurfacedWords.add(word);
        S.lapsedSurfaced.push({
          word, reading: activeLapsedCandidate.reading || '',
          sceneNum: S.sceneNum, location: stripHtml(scene.location_jp || '')
        });
      }
      activeLapsedCandidate = null;
    }
    saveProfile();
  }

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
  textEl.innerHTML = scene.scene_jp ||
    '<ruby>場面<rt>ばめん</rt></ruby>の<ruby>読<rt>よ</rt></ruby>み<ruby>込<rt>こ</rt></ruby>みに<ruby>失敗<rt>しっぱい</rt></ruby>しました。もう<ruby>一度<rt>いちど</rt></ruby>お<ruby>試<rt>ため</rt></ruby>しください。';
  textEl.classList.add('fadein');
  setTimeout(() => textEl.classList.remove('fadein'), 400);
  makeSceneWordTaps(textEl, scene.vocab || []);

  document.getElementById('translation-box').innerHTML = scene.scene_translation || '';
  document.getElementById('grammar-box').innerHTML =
    (scene.grammar_note || '').replace(/【(.+?)】/, '<strong>【$1】</strong>');

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
  const grammarCtx = S.grammarSeen.length
    ? `\nGrammar covered this run (do not repeat): ${S.grammarSeen.join(' | ')}`
    : '';
  const reinforceCtx = dueGrammar().length
    ? `\nGrammar due for reinforcement (reuse ONE naturally, do NOT re-explain): ${dueGrammar().join(' | ')}`
    : '';
  const gramCtx = grammarCtx + reinforceCtx;
  // Offer at most ONE lapsed Anki word this scene (held in module scope so renderScene can
  // check whether the model actually used it). Soft and skippable — see SYSTEM prompt #19.
  activeLapsedCandidate = nextLapsedCandidate();
  const ankiCtx = activeLapsedCandidate
    ? `\nLapsed vocabulary the learner keeps forgetting (from their Anki reviews): ${activeLapsedCandidate.word}${activeLapsedCandidate.reading ? `（${activeLapsedCandidate.reading}）` : ''}. If — and only if — it fits this scene naturally, use it ONCE and include it in the vocab array. Story comes first; skip it entirely if it would feel forced.`
    : '';

  let userMsg;
  if (!action) {
    userMsg = `Scene 1 of ~12. Begin — the player just arrived in Tokyo. Establish the mystery hook.${diffCtx}${gramCtx}${ankiCtx}`;
  } else if (action.kind === 'answer') {
    userMsg = `Scene ${S.sceneNum} of ~12. The player TYPED this answer to the NPC's question: "${action.value}". Evaluate it (feedback field), then continue incorporating their answer.${memoCtx}${itemCtx}${diffCtx}${gramCtx}${ankiCtx}${histCtx}`;
  } else if (action.kind === 'room') {
    const visitedCtx = action.visitedRoomNames?.length
      ? `\nAlready visited this dungeon run: ${action.visitedRoomNames.join('、')} — NPCs and clues in this room may reference those locations.`
      : '';
    userMsg = `Scene ${S.sceneNum} of ~12. The player enters ${action.roomName}. Generate a scene set specifically in this location — describe the space, introduce an NPC or clue, deepen the mystery.${visitedCtx}${memoCtx}${itemCtx}${diffCtx}${gramCtx}${ankiCtx}${histCtx}`;
  } else {
    userMsg = `Scene ${S.sceneNum} of ~12. Player chose: "${action.value}". Continue.${memoCtx}${itemCtx}${diffCtx}${gramCtx}${ankiCtx}${histCtx}`;
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

    // Log typed-output feedback into the persistent error journal (newest first, cap 50).
    if (action?.kind === 'answer' && scene.feedback) {
      S.errorLog.unshift({ sceneNum: S.sceneNum, answer: action.value, feedback: scene.feedback });
      if (S.errorLog.length > 50) S.errorLog.length = 50;
      saveProfile();
    }
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
