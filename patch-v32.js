(function () {
  'use strict';

  // v32: core prompt/passages that students must inspect are always boxed.
  // In particular:
  // - correction_pair: original sentence to diagnose/correct
  // - same_meaning: reference sentence whose meaning is compared with the options

  const originalShouldForceBoxStyle = window.shouldForceBoxStyle;

  window.shouldForceBoxStyle = function (question) {
    const q = question || {};
    const passage = String(q.passage ?? '').trim();

    if (!passage) {
      return typeof originalShouldForceBoxStyle === 'function'
        ? originalShouldForceBoxStyle(q)
        : false;
    }

    const style = String(q.questionStyle ?? '').trim();
    const instruction = String(q.instruction ?? '').trim();

    const mustBoxByStyle =
      style === 'correction_pair' ||
      style === 'same_meaning';

    const mustBoxByInstruction =
      /틀린\s*부분.*바르게\s*고친|바르게\s*고친\s*것|어법상\s*틀린\s*부분.*고르/.test(instruction) ||
      /의미가\s*(?:같은|같도록)|같은\s*의미|의미가\s*같은\s*것/.test(instruction);

    if (mustBoxByStyle || mustBoxByInstruction) return true;

    return typeof originalShouldForceBoxStyle === 'function'
      ? originalShouldForceBoxStyle(q)
      : false;
  };

  // Also tell Gemini to mark these passages as boxed in the generated JSON.
  // The renderer rule above is authoritative even if the model ignores this prompt.
  const previousFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = String(input ?? '');
    const isGemini = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');

    if (isGemini && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const part = body?.contents?.[0]?.parts?.[0];
        if (part && typeof part.text === 'string') {
          part.text += `\n\n# YMS v32 제시문 박스 규칙\n- correction_pair 유형은 학생이 고쳐야 할 원문 문장을 passage에 넣고 passageStyle='box'로 지정하세요.\n- same_meaning 유형은 비교 기준이 되는 원문 문장을 passage에 넣고 passageStyle='box'로 지정하세요.\n- 위 두 유형의 기준 문장을 instruction에만 넣거나 plain으로 두지 마세요.\n`;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v32 box prompt could not modify request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
