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
      if (!S.vocabLog.some(x => x.word === v.word)) {
        S.vocabLog.push(v);
        updateVocabBadge();
        saveGame();
      }
    };
    row.appendChild(chip);
  });
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
      <div class="summary-stat"><span>出会った文法</span><span class="val">${S.grammarSeen.length}</span></div>
      <div class="summary-stat"><span>持ち物</span><span class="val">${S.items.length}</span></div>
      <div class="summary-stat"><span>自分で答えた回数</span><span class="val">${S.history.filter(h => h.type === 'input').length}</span></div>`;
    document.getElementById('ending-screen').style.display = 'block';
    clearSave();
  }, 6000);
}

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
