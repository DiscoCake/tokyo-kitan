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
    if (result.vocab.length < 4 || result.vocab.length > 6) {
      msgs.push(`vocab has ${result.vocab.length} items (expected 4–6)`);
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
  const len = (result.scene_jp || '').length;
  const pass = len >= 60 && len <= 1200;
  return {
    name: 'sceneTextLength',
    pass,
    messages: pass ? [] : [`scene_jp is ${len} chars (expected 60–1200)`]
  };
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
  ];
}

module.exports = { runChecks };
