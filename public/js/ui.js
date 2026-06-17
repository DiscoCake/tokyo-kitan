import { S, SCENE_NUMS, saveGame, clearSave } from './state.js';
import { pickImage } from './images.js';
import { TTS, ttsStop } from './tts.js';

export function stripHtml(s) {
  const d = document.createElement('div'); d.innerHTML = s; return d.textContent;
}

export function cinematicOpen(locationHtml) {
  document.getElementById('cin-location').innerHTML = locationHtml || '　';
  document.body.classList.add('cinematic-active');
  requestAnimationFrame(() => document.getElementById('cinematic').classList.add('visible'));
}

export function cinematicClose() {
  document.getElementById('cinematic').classList.remove('visible');
  document.body.classList.remove('cinematic-active');
}

export function clearScene() {
  if ('speechSynthesis' in window) ttsStop(false);
  TTS.text = '';
  document.getElementById('scene-text').innerHTML = '';
  document.getElementById('choices').innerHTML = '';
  document.getElementById('vocab-row').innerHTML = '';
  document.getElementById('answer-row').style.display = 'none';
  document.getElementById('input-hint').style.display = 'none';
  document.getElementById('feedback-box').style.display = 'none';
  const img = document.getElementById('hero-img');
  img.classList.remove('loaded');
  document.getElementById('hero-skeleton').style.display = 'block';
  document.getElementById('loc-text').innerHTML = '…';
}

export async function loadHeroImage(query) {
  const img = document.getElementById('hero-img');
  const sk  = document.getElementById('hero-skeleton');
  img.classList.remove('loaded');
  sk.style.display = 'block';

  const url = await pickImage(query);
  if (!url) {
    sk.style.display = 'none';
    img.removeAttribute('src');
    document.getElementById('hero-overlay').style.background =
      'linear-gradient(160deg, #0d0d1a 0%, #1a1030 60%, #0d0d2a 100%)';
    return null;
  }
  img.onload  = () => { img.classList.add('loaded'); sk.style.display = 'none'; };
  img.onerror = () => {
    sk.style.display = 'none';
    img.removeAttribute('src');
    document.getElementById('hero-overlay').style.background =
      'linear-gradient(160deg, #0d0d1a 0%, #1a1030 60%, #0d0d2a 100%)';
  };
  img.src = url;
  return url;
}

export function renderItems(highlightNew) {
  const row = document.getElementById('items-row');
  if (!S.items.length) { row.style.display = 'none'; return; }
  row.style.display = 'flex';
  row.innerHTML = '<span id="items-label">もちもの</span>';
  S.items.forEach((it, i) => {
    const chip = document.createElement('span');
    chip.className = 'item-chip' + (highlightNew && i === S.items.length - 1 ? ' new' : '');
    // jp may already contain ruby markup from the model; avoid double-wrapping
    chip.innerHTML = it.jp.includes('<ruby>')
      ? it.jp
      : `<ruby>${it.jp}<rt>${it.reading}</rt></ruby>`;
    row.appendChild(chip);
  });
}

export function updateVocabBadge() {
  const b = document.getElementById('vocab-count');
  b.textContent = S.vocabLog.length;
  b.style.display = S.vocabLog.length ? 'inline-block' : 'none';
}

export function logVocabWord(v) {
  if (!S.vocabLog.some(x => x.word === v.word)) {
    S.vocabLog.push(v);
    updateVocabBadge();
    saveGame();
  }
}

export function renderVocabChips(vocab) {
  const row = document.getElementById('vocab-row');
  row.innerHTML = '';
  vocab.forEach(v => {
    const chip = document.createElement('button');
    chip.className = 'vocab-chip';
    chip.textContent = v.word;
    chip.onclick = () => {
      if (chip.classList.contains('revealed')) return;
      chip.classList.add('revealed');
      chip.innerHTML = `${v.word}（${v.reading}）<span class="meaning"> ${v.meaning}</span>`;
      const addBtn = document.createElement('button');
      addBtn.className = 'chip-add';
      addBtn.textContent = '＋';
      addBtn.onclick = e => {
        e.stopPropagation();
        logVocabWord(v);
        addBtn.textContent = '✓';
        addBtn.classList.add('added');
        addBtn.disabled = true;
      };
      chip.appendChild(addBtn);
    };
    row.appendChild(chip);
  });
}

// Attach click-to-lookup handlers on every <ruby> element in the scene text.
// Called by renderScene after scene HTML is set.
export function makeSceneWordTaps(sceneEl, vocab) {
  sceneEl.querySelectorAll('ruby').forEach(rubyEl => {
    rubyEl.addEventListener('click', e => {
      e.stopPropagation();
      showWordCard(rubyEl, vocab);
    });
  });
}

function showWordCard(rubyEl, vocab) {
  // Extract base word (kanji) by removing <rt> content from a clone
  const clone = rubyEl.cloneNode(true);
  clone.querySelectorAll('rt').forEach(n => n.remove());
  const word = clone.textContent.trim();

  const rt = rubyEl.querySelector('rt');
  const reading = rt ? rt.innerText.trim() : '';

  const match = vocab.find(v => v.word === word);
  const meaning = match ? match.meaning : '(not in scene vocab)';
  if (!match) { S.unknownTaps++; saveGame(); }

  const card = document.getElementById('word-card');
  document.getElementById('wc-word').textContent = word;
  document.getElementById('wc-reading').textContent = reading;
  document.getElementById('wc-meaning').textContent = meaning;

  const addBtn = document.getElementById('wc-add');
  addBtn.classList.remove('added');
  addBtn.innerHTML = '<ruby>単語帳<rt>たんごちょう</rt></ruby>に<ruby>追加<rt>ついか</rt></ruby>';

  const vocabItem = match || { word, reading, meaning: '' };
  addBtn.onclick = e => {
    e.stopPropagation();
    logVocabWord(vocabItem);
    addBtn.textContent = '追加しました ✓';
    addBtn.classList.add('added');
  };

  // Show card temporarily off-screen to measure it
  card.style.top = '-9999px';
  card.style.left = '-9999px';
  card.style.display = 'block';

  const rect = rubyEl.getBoundingClientRect();
  const cardH = card.offsetHeight;
  const cardW = card.offsetWidth;

  let top = rect.top - cardH - 10;
  if (top < 8) top = rect.bottom + 10;
  let left = rect.left;
  if (left + cardW > window.innerWidth - 8) left = window.innerWidth - cardW - 8;
  if (left < 8) left = 8;

  card.style.top = top + 'px';
  card.style.left = left + 'px';
}

export function openVocabPanel() {
  const list = document.getElementById('vocab-list');
  const empty = document.getElementById('vocab-empty');
  list.innerHTML = '';
  if (!S.vocabLog.length) empty.style.display = 'block';
  else {
    empty.style.display = 'none';
    S.vocabLog.forEach(v => {
      const d = document.createElement('div');
      d.className = 'vlog-entry';
      d.innerHTML = `<span class="vlog-word">${v.word}</span><span class="vlog-reading">${v.reading}</span><span class="vlog-meaning">${v.meaning}</span>`;
      list.appendChild(d);
    });
  }
  document.getElementById('vocab-panel').style.display = 'block';
}

export function openGrammarPanel() {
  const list = document.getElementById('grammar-list');
  const empty = document.getElementById('grammar-empty');
  list.innerHTML = '';
  const seen = [...new Set(S.grammarSeen)]; // deduplicate identical notes
  if (!seen.length) {
    empty.style.display = 'block';
    list.style.display = 'none';
  } else {
    empty.style.display = 'none';
    list.style.display = '';
    seen.forEach(note => {
      const d = document.createElement('div');
      d.className = 'grammar-entry';
      d.innerHTML = note.replace(/【(.+?)】/, '<strong class="grammar-expr">【$1】</strong> ');
      list.appendChild(d);
    });
  }
  document.getElementById('grammar-panel').style.display = 'block';
}

// Persistent learner profile: grammar consolidation (strength + exposures, spanning runs)
// and the typed-output feedback journal. Mirrors the openGrammarPanel/openNpcPanel pattern.
export function openMasteryPanel() {
  const gList = document.getElementById('mastery-grammar-list');
  const eList = document.getElementById('mastery-error-list');
  const lList = document.getElementById('mastery-lapsed-list');
  const empty = document.getElementById('mastery-empty');

  const points = Object.values(S.grammarMastery).sort((a, b) => b.strength - a.strength || b.exposures - a.exposures);
  const errors = S.errorLog || [];
  const lapsed = S.lapsedSurfaced || [];

  if (!points.length && !errors.length && !lapsed.length) {
    empty.style.display = 'block';
    gList.innerHTML = '';
    eList.innerHTML = '';
    lList.innerHTML = '';
    document.getElementById('mastery-panel').style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  gList.innerHTML = points.length
    ? points.map(p => {
        const stars = '★'.repeat(p.strength) + '☆'.repeat(Math.max(0, 4 - p.strength));
        return `<div class="grammar-entry"><strong class="grammar-expr">【${p.expr}】</strong>` +
               `<span class="mastery-stars" style="color:var(--yellow);">${stars}</span>` +
               `<span class="mastery-count">${p.exposures}回</span></div>`;
      }).join('')
    : '<div class="panel-empty" style="display:block;">まだ<ruby>文法<rt>ぶんぽう</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby>がありません。</div>';

  eList.innerHTML = errors.length
    ? errors.map(e => {
        const d = document.createElement('div');
        d.className = 'mastery-error-entry';
        const ans = document.createElement('div');
        ans.className = 'mastery-answer';
        ans.textContent = `「${e.answer}」`;
        const fb = document.createElement('div');
        fb.className = 'mastery-feedback';
        fb.textContent = e.feedback;
        d.appendChild(ans); d.appendChild(fb);
        return d.outerHTML;
      }).join('')
    : '<div class="panel-empty" style="display:block;"><ruby>作文<rt>さくぶん</rt></ruby>の<ruby>記録<rt>きろく</rt></ruby>はまだありません。</div>';

  // Lapsed Anki words that actually surfaced in the story this run, and where (#19).
  // word/location are Anki/scene-supplied → set via textContent.
  lList.innerHTML = lapsed.length
    ? lapsed.map(l => {
        const d = document.createElement('div');
        d.className = 'mastery-error-entry';
        const w = document.createElement('div');
        w.className = 'mastery-answer';
        w.textContent = l.reading ? `${l.word}（${l.reading}）` : l.word;
        const where = document.createElement('div');
        where.className = 'mastery-feedback';
        where.textContent = `第${l.sceneNum}場面・${l.location}`;
        d.appendChild(w); d.appendChild(where);
        return d.outerHTML;
      }).join('')
    : '<div class="panel-empty" style="display:block;"><ruby>苦手<rt>にがて</rt></ruby>の<ruby>言葉<rt>ことば</rt></ruby>はまだ<ruby>出<rt>で</rt></ruby>ていません。</div>';

  document.getElementById('mastery-panel').style.display = 'block';
}

const REL_LABEL = { ally: '味方', neutral: '中立', suspicious: '怪しい', hostile: '敵対', unknown: '不明' };
const REL_COLOR = { ally: 'var(--cyan)', neutral: 'var(--yellow)', suspicious: 'var(--pink)', hostile: '#e05555', unknown: '#888' };

export function openNpcPanel() {
  const list = document.getElementById('npc-list');
  const empty = document.getElementById('npc-empty');
  list.innerHTML = '';
  if (!S.npcLog.length) {
    empty.style.display = 'block';
    list.style.display = 'none';
  } else {
    empty.style.display = 'none';
    list.style.display = '';
    S.npcLog.forEach(npc => {
      const rel = npc.relationship || 'unknown';
      const label = REL_LABEL[rel] || rel;
      const color = REL_COLOR[rel] || '#888';
      const d = document.createElement('div');
      d.className = 'npc-entry';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'npc-name';
      nameDiv.innerHTML = `${npc.name_jp}<span class="npc-badge" style="color:${color};border-color:${color};">${label}</span>`;
      const noteDiv = document.createElement('div');
      noteDiv.className = 'npc-note';
      noteDiv.textContent = npc.note || '';
      d.appendChild(nameDiv);
      d.appendChild(noteDiv);
      list.appendChild(d);
    });
  }
  document.getElementById('npc-panel').style.display = 'block';
}

export function openGalleryPanel() {
  const grid = document.getElementById('gallery-grid');
  const empty = document.getElementById('gallery-empty');
  grid.innerHTML = '';
  if (!S.gallery.length) empty.style.display = 'block';
  else {
    empty.style.display = 'none';
    S.gallery.forEach(g => {
      const card = document.createElement('div');
      card.className = 'gallery-card';
      card.innerHTML = `<img src="${g.img}" alt="" /><div class="g-loc">${g.loc}</div><div class="g-num">場面 ${SCENE_NUMS[g.num-1] || g.num}</div>`;
      grid.appendChild(card);
    });
  }
  document.getElementById('gallery-panel').style.display = 'block';
}

export function updateHistoryTrail() {
  const trail = document.getElementById('history-trail');
  if (!S.history.length) { trail.style.display = 'none'; return; }
  trail.style.display = 'block';
  trail.innerHTML = S.history.slice(-3).map(h => `${h.loc} → ${h.choice}`).join('<br>');
}

export function showEnding() {
  document.getElementById('choices').innerHTML = '';
  document.getElementById('answer-row').style.display = 'none';
  document.getElementById('input-hint').style.display = 'none';
  setTimeout(() => {
    document.getElementById('game-screen').style.display = 'none';
    const stats = document.getElementById('summary-stats');
    stats.innerHTML = `
      <div class="summary-stat"><span>読んだ場面</span><span class="val">${S.sceneNum}</span></div>
      <div class="summary-stat"><span>集めた単語</span><span class="val">${S.vocabLog.length}</span></div>
      <div class="summary-stat"><span><ruby>出会<rt>であ</rt></ruby>った<ruby>文法<rt>ぶんぽう</rt></ruby></span><span class="val">${[...new Set(S.grammarSeen)].length}</span></div>
      <div class="summary-stat"><span>持ち物</span><span class="val">${S.items.length}</span></div>
      <div class="summary-stat"><span>自分で答えた回数</span><span class="val">${S.history.filter(h => h.type === 'input').length}</span></div>`;
    document.getElementById('ending-screen').style.display = 'block';
    clearSave();
  }, 6000);
}

// Dismiss word lookup card when clicking outside it
document.addEventListener('click', e => {
  const card = document.getElementById('word-card');
  if (card.style.display !== 'none' && !card.contains(e.target)) {
    card.style.display = 'none';
  }
});

// Panel controls
document.getElementById('vocab-btn').onclick = openVocabPanel;
document.getElementById('gallery-btn').onclick = openGalleryPanel;
document.querySelectorAll('.panel-close').forEach(btn => {
  btn.onclick = () => btn.closest('.panel').style.display = 'none';
});
document.getElementById('vocab-export').onclick = function() {
  const tsv = S.vocabLog.map(v => `${v.word}\t${v.reading}\t${v.meaning}`).join('\n');
  navigator.clipboard.writeText(tsv).then(() => {
    this.textContent = 'コピーしました！';
    setTimeout(() => this.textContent = 'Ankiにエクスポート (TSV)', 2000);
  });
};
