(function () {
  'use strict';

  // v35
  // 1) Keep about five text lines of whitespace between exam questions.
  // 2) correction_pair must always be: one erroneous passage sentence + five correction-pair options.
  // 3) The final AI reviewer must rewrite malformed correction_pair items, not merely change the instruction.

  // ----- Five-line question spacing -----
  if (!document.getElementById('yms-v35-question-spacing')) {
    const style = document.createElement('style');
    style.id = 'yms-v35-question-spacing';
    style.textContent = `
      #examContent .question-box {
        margin-bottom: 5lh !important;
      }
      @media print {
        #examContent .question-box {
          margin-bottom: 5lh !important;
        }
      }
    `;
    document.head.appendChild(style);
  }

  // ----- Generation + review prompt guards -----
  const previousFetch = window.fetch.bind(window);
  const PROXY_URL = 'https://yms-grammar-api.vercel.app/api/gemini';

  function isGeminiLikeUrl(url) {
    return (url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent')) ||
           url === PROXY_URL;
  }

  window.fetch = function (input, init) {
    const url = String(typeof input === 'string' ? input : (input?.url || ''));

    if (isGeminiLikeUrl(url) && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const part = body?.contents?.[0]?.parts?.[0];

        if (part && typeof part.text === 'string') {
          const isFinalReview =
            part.text.includes('최종 검수 책임자') ||
            part.text.includes('# 검수 대상 전체 시험 JSON');

          if (isFinalReview) {
            part.text += `\n\n# YMS v35 correction_pair 최종 검수 — 필수\n` +
`questionStyle='correction_pair'인 모든 객관식은 아래 형식을 하나라도 위반하면 반드시 revisions에 넣고 correctedQuestion 전체를 다시 작성하세요. 지시문만 바꾸고 원래 보기를 살리는 방식은 금지합니다.\n` +
`1. passage에는 학생이 직접 진단할 영어 문장이 정확히 하나 있어야 합니다. 그 문장에는 의도된 문법 오류가 정확히 하나만 있어야 하며 다른 오류는 없어야 합니다.\n` +
`2. passageStyle은 반드시 'box'여야 합니다.\n` +
`3. instruction은 '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고친 것을 고르세요.'와 같은 오류 수정 지시여야 합니다.\n` +
`4. options 5개는 반드시 '원문 표현 → 수정 표현'의 짧은 correction pair 형식이어야 합니다. 예: 'practice → practices'.\n` +
`5. options에 한국어 문장과 영어 완성문을 '한국어 → English sentence'처럼 대응시키지 마세요. 완성된 영어 문장 5개를 보기로 나열하는 것도 correction_pair가 아닙니다.\n` +
`6. 각 보기의 왼쪽 원문 표현은 passage에서 실제로 찾을 수 있어야 합니다.\n` +
`7. 다섯 수정안을 passage에 각각 적용해 직접 검산하고, 문장 전체가 완전히 올바르게 되는 보기는 정확히 하나만 존재해야 합니다. 0개 또는 2개 이상이면 반드시 다시 작성하세요.\n` +
`8. 정답 option과 answer가 정확히 일치하고 explanation은 왜 그 수정만 옳은지 설명해야 합니다.\n` +
`9. correction_pair 구조가 깨져 있다면 '다음 중 어법상 틀린 문장은?'로 지시문만 바꾸지 말고, correction_pair 자체를 정상 구조로 재작성하세요.\n`;
          } else {
            part.text += `\n\n# YMS v35 오류 수정쌍(correction_pair) 강제 형식 — 최우선\n` +
`questionStyle='correction_pair' 문항은 반드시 아래 구조로만 출제하세요.\n` +
`- instruction: '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고친 것을 고르세요.' 형태.\n` +
`- passage: 영어 문장 정확히 1개. 학생이 찾아야 할 문법 오류를 정확히 1개만 포함하고, 나머지 부분은 모두 자연스럽고 문법적으로 정확해야 합니다.\n` +
`- passageStyle: 반드시 'box'.\n` +
`- options: 정확히 5개 모두 짧은 '원문 표현 → 수정 표현' 형식. 예: 'practice → practices'.\n` +
`- 각 option의 왼쪽 표현은 passage에 실제로 등장해야 합니다.\n` +
`- 한국어 문장 → 영어 완성문 형식, 완성된 영어 문장 5개, 번역 대응형 보기는 절대 사용하지 마세요.\n` +
`- 다섯 수정안을 원문에 하나씩 대입해 검산했을 때 문장 전체를 완전히 올바르게 만드는 보기는 정확히 1개만 존재해야 합니다.\n` +
`- correction_pair의 예시 구조:\n` +
`  passage: 'She practice getting up early every morning.'\n` +
`  options: ['practice → practices', 'getting → get', 'up → at', 'early → earlier', 'morning → mornings']\n` +
`  단, 실제 출제에서는 오답 수정쌍까지 검산하여 정답이 정확히 하나만 남도록 구성하세요.\n`;
          }

          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v35 prompt guard could not modify request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
