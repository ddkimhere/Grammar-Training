(function () {
  'use strict';

  // v28: Gemini 3.5 Flash-Lite long-exam stability guard.
  // Avoid fragile MC underline questions and repair safe malformed cases
  // before one bad question causes the entire exam to be regenerated.

  const originalValidateQuestionStructure = window.validateQuestionStructure;

  if (typeof originalValidateQuestionStructure === 'function') {
    window.validateQuestionStructure = function (question) {
      const q = question || {};

      if (String(q.type ?? '') === 'multiple_choice') {
        const instruction = String(q.instruction ?? '');
        const passage = String(q.passage ?? '');
        const options = Array.isArray(q.options) ? q.options : [];
        const underlineCount = (passage.match(/\[\[u\]\]/gi) || []).length;

        if (/밑줄/.test(instruction) && underlineCount !== 1) {
          const correctionPair = options.length === 5 && options.every(opt =>
            /(?:->|→|⇒)/.test(String(opt ?? ''))
          );

          if (correctionPair) {
            // '틀린 표현 → 고친 표현' 유형은 오류 위치를 보여주면 안 된다.
            q.instruction = '다음 문장에서 어법상 틀린 부분을 찾아 바르게 고친 것을 고르세요.';
            q.passage = passage
              .replace(/\[\[u\]\]([\s\S]*?)\[\[\/u\]\]/gi, '$1')
              .replace(/\[\[\/?u\]\]/gi, '');
            q.options = options.map(opt => String(opt ?? '')
              .replace(/\[\[u\]\]([\s\S]*?)\[\[\/u\]\]/gi, '$1')
              .replace(/\[\[\/?u\]\]/gi, ''));
          } else if (underlineCount > 1) {
            // 여러 밑줄이 잘못 붙은 경우 첫 번째 완성된 밑줄만 남긴다.
            let seen = 0;
            let repaired = passage.replace(
              /\[\[u\]\]([\s\S]*?)\[\[\/u\]\]/gi,
              (_, inner) => {
                seen += 1;
                return seen === 1
                  ? `___YMS_U_OPEN___${inner}___YMS_U_CLOSE___`
                  : inner;
              }
            );
            repaired = repaired
              .replace(/\[\[\/?u\]\]/gi, '')
              .replace('___YMS_U_OPEN___', '[[u]]')
              .replace('___YMS_U_CLOSE___', '[[/u]]');
            q.passage = repaired;
          } else if (underlineCount === 0) {
            // 보기 5개가 완전한 문장이라면 밑줄형 대신 문장 전체 판단형으로 안전 변환.
            const sentenceOptions = options.length === 5 && options.every(opt => {
              const t = String(opt ?? '').trim();
              return /[.!?]$/.test(t) && t.split(/\s+/).length >= 3;
            });

            if (sentenceOptions) {
              q.instruction = /틀린|어색/.test(instruction)
                ? '다음 중 어법상 틀린 문장을 고르세요.'
                : '다음 중 어법상 알맞은 문장을 고르세요.';
              q.passage = '';
              q.passageStyle = 'none';
            }
          }
        }
      }

      return originalValidateQuestionStructure(q);
    };
  }

  // Add a final prompt rule after v25 so Flash-Lite avoids fragile MC underline types.
  const previousFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = String(input ?? '');
    const isGemini = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');

    if (isGemini && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const part = body?.contents?.[0]?.parts?.[0];

        if (part && typeof part.text === 'string') {
          part.text += `\n\n# YMS v28 안정성 규칙\n- 객관식에서는 [[u]]...[[/u]] 밑줄형 문제를 출제하지 마세요.\n- 객관식의 오류 수정 문제는 correction_pair 형식(보기: 틀린 표현 → 고친 표현)을 사용하고 passage에는 밑줄을 넣지 마세요.\n- 특정 표현을 판단하게 하고 싶으면 whole_sentence_judgment, sentence_count, sentence_bundle, dialogue_ab, context_blank 유형으로 바꾸세요.\n- instruction에 '밑줄'이라는 말을 쓰는 객관식은 만들지 마세요.\n- 30문항 이상 긴 시험에서는 형식 안정성을 우선하고, 한 문항의 표시 규칙 때문에 전체 JSON이 실패하지 않도록 각 문항을 최종 점검하세요.\n`;
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v28 stability prompt could not modify request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
