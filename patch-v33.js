(function () {
  'use strict';

  // v33: clean essay condition boxes and A/B dialogue line breaks.
  const originalFormatPassage = window.formatPassageForDisplay;

  function cleanPassage(text) {
    let value = String(text ?? '').replace(/\r\n?/g, '\n');
    let lines = value.split('\n').map(line => line.trim());

    // If numbered conditions exist, remove stray standalone "조건" lines.
    const hasNumberedConditions = lines.some(line => /^조건\s*\d+\s*[.):]?/i.test(line));
    if (hasNumberedConditions) {
      lines = lines.filter(line => !/^조건\s*[.:]?$/i.test(line));
      lines = lines.map(line =>
        line.replace(/^조건\s*(\d+)\s*[.):]?\s*/i, '조건 $1. ')
      );
    }

    // Keep an A/B blank on the same logical line as the speaker's sentence.
    // Examples:
    // A: Do you enjoy\n(A) _____ books? -> A: Do you enjoy (A) _____ books?
    // A:\n(A) _____ you ever been...? -> A: (A) _____ you ever been...?
    const joined = [];
    for (const line of lines) {
      const current = String(line || '').trim();
      if (!current) continue;

      if (/^\([AB]\)\s*_{3,}/i.test(current) && joined.length > 0) {
        const prev = joined[joined.length - 1];
        if (/^[A-Z]\s*:/i.test(prev)) {
          joined[joined.length - 1] = `${prev.replace(/\s+$/, '')} ${current}`
            .replace(/\s{2,}/g, ' ')
            .trim();
          continue;
        }
      }
      joined.push(current);
    }

    return joined.join('\n').replace(/\n{2,}/g, '\n').trim();
  }

  if (typeof originalFormatPassage === 'function') {
    window.formatPassageForDisplay = function (question) {
      return cleanPassage(originalFormatPassage(question));
    };
  }

  // Prevent the same formatting defects at generation time too.
  const previousFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = String(input ?? '');
    const isGemini = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');

    if (isGemini && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const part = body?.contents?.[0]?.parts?.[0];
        if (part && typeof part.text === 'string') {
          part.text += `\n\n# YMS v33 출력 정리 규칙\n- 서술형 조건 목록은 반드시 '조건 1. ...', '조건 2. ...', '조건 3. ...'처럼 한 줄에 하나씩 작성하세요. 번호 없는 '조건'이라는 단어를 단독 줄로 절대 출력하지 마세요.\n- 대화문 A/B 빈칸은 각 화자의 문장 안에서 같은 줄에 작성하세요. 예: 'A: Do you enjoy (A) _____ books?' 및 'B: Yes, I like (B) _____ novels.'처럼 쓰고, 화자 문장과 (A)/(B) 빈칸 사이에 강제 줄바꿈을 넣지 마세요.\n`;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v33 formatting prompt could not modify request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
