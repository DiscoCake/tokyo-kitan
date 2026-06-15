// Pure validators for scene JSON returned by the tokyo-kitan prompt.
// Each check returns { name, pass, messages: string[] }.
// Never loosen a check to make a case pass — fix the prompt output instead.

function strayKanji(text) {
  const stripped = text.replace(/<ruby[\s\S]*?<\/ruby>/gi, '');
  return (stripped.match(/[㐀-䶿一-鿿豈-﫿]/g) || []);
}

function matchesContract(result) {
  const msgs = [];

  const requiredStrings = ['location_jp', 'image_query', 'scene_jp', 'scene_translation', 'grammar_note', 'mystery_memo'];
  for (const field of requiredStrings) {
    if (typeof result[field] !== 'string' || !result[field].trim()) {
      msgs.push(`missing or empty field: ${field}`);
    }
  }

  if (!Array.isArray(result.vocab)) {
    msgs.push('vocab must be an array');
  } else {
    if (result.vocab.length < 6 || result.vocab.length > 14) {
      msgs.push(`vocab has ${result.vocab.length} items (expected 8–12)`);
    }
    result.vocab.forEach((v, i) => {
      for (const f of ['word', 'reading', 'meaning']) {
        if (typeof v[f] !== 'string' || !v[f].trim()) {
          msgs.push(`vocab[${i}].${f} missing or empty`);
        }
      }
    });
  }

  const validTypes = ['choice', 'input', 'ending'];
  if (!validTypes.includes(result.scene_type)) {
    msgs.push(`scene_type must be one of ${validTypes.join('|')}, got: ${result.scene_type}`);
  }

  if (result.scene_type === 'choice') {
    if (!Array.isArray(result.choices)) {
      msgs.push('choices must be an array when scene_type is "choice"');
    } else {
      if (result.choices.length < 2 || result.choices.length > 4) {
        msgs.push(`choices has ${result.choices.length} items (expected 2–4)`);
      }
      result.choices.forEach((c, i) => {
        if (typeof c.jp !== 'string' || !c.jp.trim()) msgs.push(`choices[${i}].jp missing or empty`);
        if (typeof c.text_only !== 'string' || !c.text_only.trim()) msgs.push(`choices[${i}].text_only missing or empty`);
      });
    }
  }

  return { name: 'matchesContract', pass: msgs.length === 0, messages: msgs };
}

function everyKanjiHasRuby(result) {
  const msgs = [];

  const checks = [
    { field: 'location_jp', text: result.location_jp || '' },
    { field: 'scene_jp',    text: result.scene_jp    || '' },
  ];
  if (Array.isArray(result.choices)) {
    result.choices.forEach((c, i) => {
      checks.push({ field: `choices[${i}].jp`, text: c.jp || '' });
    });
  }

  for (const { field, text } of checks) {
    const stray = strayKanji(text);
    if (stray.length > 0) {
      msgs.push(`${field} has kanji without ruby: ${[...new Set(stray)].join('')}`);
    }
  }

  return { name: 'everyKanjiHasRuby', pass: msgs.length === 0, messages: msgs };
}

function choiceCount(result) {
  if (result.scene_type !== 'choice') {
    return { name: 'choiceCount', pass: true, messages: [] };
  }
  const n = Array.isArray(result.choices) ? result.choices.length : 0;
  const pass = n === 3;
  return {
    name: 'choiceCount',
    pass,
    messages: pass ? [] : [`expected 3 choices, got ${n}`]
  };
}

function choicesAreJapanese(result) {
  if (result.scene_type !== 'choice') {
    return { name: 'choicesAreJapanese', pass: true, messages: [] };
  }
  const msgs = [];
  const cjkRe = /[　-鿿豈-﫿＀-￯]/;
  (result.choices || []).forEach((c, i) => {
    if (!cjkRe.test(c.jp || '')) {
      msgs.push(`choices[${i}].jp contains no CJK characters: "${c.jp}"`);
    }
    if (!c.text_only || !c.text_only.trim()) {
      msgs.push(`choices[${i}].text_only is empty`);
    }
  });
  return { name: 'choicesAreJapanese', pass: msgs.length === 0, messages: msgs };
}

function sceneTextLength(result) {
  // Measure prose length with ruby markup stripped — markup overhead shouldn't penalise
  // kanji-heavy N3 scenes. Strip <ruby>kanji<rt>reading</rt></ruby> → kanji, then all other tags.
  const stripped = (result.scene_jp || '')
    .replace(/<ruby>([^<]*)<rt>[^<]*<\/rt><\/ruby>/g, '$1')
    .replace(/<[^>]+>/g, '');
  const pass = stripped.length >= 30 && stripped.length <= 300;
  return {
    name: 'sceneTextLength',
    pass,
    messages: pass ? [] : [`scene_jp prose is ${stripped.length} chars stripped (expected 30–300)`]
  };
}

function npcFieldsValid(result) {
  const msgs = [];
  if (!Array.isArray(result.npcs)) {
    msgs.push('npcs must be an array (can be empty)');
    return { name: 'npcFieldsValid', pass: false, messages: msgs };
  }
  const validRels = ['ally', 'neutral', 'suspicious', 'hostile', 'unknown'];
  result.npcs.forEach((n, i) => {
    if (typeof n.name_jp !== 'string' || !n.name_jp.trim()) msgs.push(`npcs[${i}].name_jp missing`);
    if (typeof n.name_reading !== 'string' || !n.name_reading.trim()) msgs.push(`npcs[${i}].name_reading missing`);
    if (!validRels.includes(n.relationship)) msgs.push(`npcs[${i}].relationship invalid: ${n.relationship}`);
    if (typeof n.note !== 'string') msgs.push(`npcs[${i}].note must be a string`);
  });
  return { name: 'npcFieldsValid', pass: msgs.length === 0, messages: msgs };
}

function grammarTargetPresent(result) {
  // The featured grammar point must be declared AND match the 【…】 head in grammar_note,
  // so spaced reinforcement (which keys on grammar_point_targeted) has a stable anchor.
  const msgs = [];
  const target = (result.grammar_point_targeted || '').trim();
  if (!target) {
    msgs.push('grammar_point_targeted missing or empty');
  } else {
    const head = (result.grammar_note || '').match(/【(.+?)】/)?.[1]?.trim();
    if (!head) {
      msgs.push('grammar_note has no 【…】 expression to match grammar_point_targeted against');
    } else if (head !== target) {
      msgs.push(`grammar_point_targeted "${target}" does not match grammar_note head "${head}"`);
    }
  }
  return { name: 'grammarTargetPresent', pass: msgs.length === 0, messages: msgs };
}

function noRawBrackets(result) {
  const text = result.scene_jp || '';
  const pass = !text.includes('【') && !text.includes('】');
  return {
    name: 'noRawBrackets',
    pass,
    messages: pass ? [] : ['scene_jp contains 【 or 】 (grammar brackets belong only in grammar_note)']
  };
}

function runChecks(result) {
  return [
    matchesContract(result),
    everyKanjiHasRuby(result),
    choiceCount(result),
    choicesAreJapanese(result),
    sceneTextLength(result),
    noRawBrackets(result),
    npcFieldsValid(result),
    grammarTargetPresent(result),
  ];
}

module.exports = { runChecks };
