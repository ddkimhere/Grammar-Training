(function () {
  'use strict';

  // v36: safe local guards only.
  // No fetch/proxy wrapping here. This avoids interfering with Gemini/Vercel requests.
  // 1) Keep about five text lines between exam questions.
  // 2) Reject malformed correction_pair questions locally so the existing generation retry can rebuild them.

  if (!document.getElementById('yms-v36-question-spacing')) {
    const style = document.createElement('style');
    style.id = 'yms-v36-question-spacing';
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

  const originalValidateQuestionStructure = window.validateQuestionStructure;

  function normalizeArrowOption(value) {
    return String(value ?? '')
      .replace(/\s*->\s*/g, ' → ')
      .replace(/\s*⇒\s*/g, ' → ')
      .trim();
  }

  function validateCorrectionPair(question) {
    if (!question || question.type !== 'multiple_choice' || question.questionStyle !== 'correction_pair') return;

    const passage = String(question.passage ?? '').trim();
    const instruction = String(question.instruction ?? '').trim();
    const options = Array.isArray(question.options) ? question.options : [];

    if (!passage) {
      throw new Error(`${question.id}번 correction_pair: 오류를 진단할 제시문이 없습니다.`);
    }

    // Authoritative display rule: correction-pair source sentence is always boxed.
    question.passageStyle = 'box';

    if (!/틀린|어법|고친|바르게/.test(instruction)) {
      throw new Error(`${question.id}번 correction_pair: 지시문이 오류 수정형과 맞지 않습니다.`);
    }

    if (options.length !== 5) {
      throw new Error(`${question.id}번 correction_pair: 보기는 정확히 5개여야 합니다.`);
    }

    const normalized = options.map(normalizeArrowOption);
    if (normalized.some(opt => !opt.includes('→'))) {
      throw new Error(`${question.id}번 correction_pair: 모든 보기는 '원문 표현 → 수정 표현' 형식이어야 합니다.`);
    }

    // Prevent the malformed pattern that appeared in the screenshot:
    // Korean sentence → complete English sentence / full-sentence translation pairs.
    const looksLikeTranslationPair = normalized.some(opt => {
      const [left, right] = opt.split('→').map(s => s.trim());
      const leftHasKorean = /[가-힣]/.test(left || '');
      const rightLooksFullSentence = /\s/.test(right || '') && /[.!?]$/.test(right || '');
      return leftHasKorean && rightLooksFullSentence;
    });
    if (looksLikeTranslationPair) {
      throw new Error(`${question.id}번 correction_pair: 번역 대응형 보기는 허용되지 않습니다.`);
    }

    // Each left-hand expression should actually occur in the source passage.
    for (const opt of normalized) {
      const left = (opt.split('→')[0] || '')
        .replace(/^['"“”‘’]+|['"“”‘’]+$/g, '')
        .trim();
      if (!left || !passage.includes(left)) {
        throw new Error(`${question.id}번 correction_pair: 보기의 원문 표현 '${left}'이 제시문에 없습니다.`);
      }
    }

    question.options = normalized;
  }

  if (typeof originalValidateQuestionStructure === 'function') {
    window.validateQuestionStructure = function (question) {
      originalValidateQuestionStructure(question);
      validateCorrectionPair(question);
      return true;
    };
  }
})();
