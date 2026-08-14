(function () {
  'use strict';

  // v31: hard question-type blueprint.
  // The model does not choose the MC style distribution freely anymore.
  // It must follow a rotating 11-style blueprint so early questions cannot collapse into blanks/judgment items.

  const previousFetch = window.fetch.bind(window);

  const MC_BLUEPRINT = [
    'dialogue_ab',
    'correction_pair',
    'same_meaning',
    'sentence_count',
    'word_order',
    'sentence_bundle',
    'single_blank',
    'matching',
    'sentence_transformation',
    'context_blank',
    'whole_sentence_judgment',

    'sentence_bundle',
    'word_order',
    'context_blank',
    'dialogue_ab',
    'whole_sentence_judgment',
    'matching',
    'correction_pair',
    'same_meaning',
    'sentence_count',
    'sentence_transformation',
    'single_blank',

    'matching',
    'sentence_transformation',
    'dialogue_ab',
    'context_blank',
    'sentence_count',
    'same_meaning',
    'word_order',
    'whole_sentence_judgment',
    'sentence_bundle',
    'correction_pair',
    'single_blank'
  ];

  const ESSAY_BLUEPRINT = [
    'error_correction_essay',
    'sentence_combination_essay',
    'transformation_essay',
    'word_order_essay',
    'conditional_writing'
  ];

  window.fetch = function (input, init) {
    const url = String(input ?? '');
    const isGeminiGeneration = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');

    if (isGeminiGeneration && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const part = body?.contents?.[0]?.parts?.[0];

        if (part && typeof part.text === 'string') {
          const mcPlan = MC_BLUEPRINT.map((style, i) => `${i + 1}:${style}`).join(', ');
          const essayPlan = ESSAY_BLUEPRINT.map((style, i) => `${i + 1}:${style}`).join(', ');

          part.text += `\n\n# YMS v31 문항 유형 강제 설계표 — 최우선 규칙\n` +
`이 규칙은 이전의 일반적인 '다양하게 출제' 지시보다 우선합니다. questionStyle을 임의로 선택하지 말고 아래 순서를 그대로 따르세요.\n\n` +
`## 객관식 questionStyle 순서\n${mcPlan}\n` +
`- 위 번호는 '전체 questions의 id'가 아니라 객관식끼리만 센 객관식 순번입니다. 요청된 객관식 수만큼 앞에서부터 사용하고 멈추세요.\n` +
`- 객관식이 33문항을 넘으면 위 33개 순서를 다시 처음부터 반복하되, 바로 앞 문항과 같은 유형이 되지 않게 하세요.\n` +
`- 첫 10개 객관식은 반드시 서로 다른 풀이 방식을 사용해야 합니다. 단어와 주어만 바꾼 같은 문제를 다른 유형으로 간주하지 마세요.\n` +
`- 객관식 20문항까지는 동일 questionStyle을 2회를 초과해 사용하지 마세요. 21~30문항은 동일 questionStyle 최대 3회입니다.\n` +
`- single_blank와 context_blank를 연속 배치하지 마세요. whole_sentence_judgment도 앞뒤의 sentence_count와 붙이지 마세요.\n` +
`- 동일하거나 거의 같은 한국어 instruction 문구를 연속 사용하지 마세요. 유형에 맞게 지시문도 달라져야 합니다.\n\n` +
`## 각 유형이 실제로 달라야 하는 기준\n` +
`- dialogue_ab: 실제 대화 맥락 속 (A)/(B) 두 요소를 함께 판단.\n` +
`- correction_pair: 본문 오류를 찾아 보기의 '틀린 표현 → 고친 표현' 중 하나를 선택. 본문에 밑줄 금지.\n` +
`- same_meaning: 원문과 의미가 실질적으로 같은 문장을 고름.\n` +
`- sentence_count: 3~5개 문장을 각각 판정한 뒤 맞거나 틀린 문장 수를 계산.\n` +
`- word_order: 주어진 단어/구를 배열하거나 올바른 어순의 완성문을 선택.\n` +
`- sentence_bundle: A~D 또는 A~E 문장을 각각 판단하고 올바른 조합을 선택.\n` +
`- single_blank: 한 문장의 단일 빈칸. 이 유형은 가장 단순하므로 난이도 하/중 중심.\n` +
`- matching: 두 문장·표현·상황과 문법 기능 또는 의미를 대응/짝짓기.\n` +
`- sentence_transformation: 긍정↔부정, 평서↔의문, 시제 전환 등 지시된 문장 전환의 올바른 결과 선택.\n` +
`- context_blank: 단순 한 문장이 아니라 2문장 이상의 문맥 또는 짧은 상황을 읽고 형태를 결정.\n` +
`- whole_sentence_judgment: 완전한 문장 5개 중 조건에 맞는 한 문장을 고름.\n` +
`각 유형의 외형만 바꾸지 말고 학생의 풀이 과정 자체가 위 설명처럼 달라야 합니다.\n\n` +
`## 서술형 questionStyle 순서\n${essayPlan}\n` +
`- 서술형끼리 센 순번에 따라 위 5개 유형을 순서대로 사용하고, 6번부터 다시 반복하세요.\n` +
`- 연속 서술형을 모두 '조건을 충족하여 문장을 완성하세요' 형태로 만들지 마세요.\n` +
`- error_correction_essay, sentence_combination_essay, transformation_essay, word_order_essay, conditional_writing은 실제 수행 과제가 서로 달라야 합니다.\n\n` +
`## 범위 적합성 예외\n` +
`정말로 해당 문법 범위에서 특정 유형이 교육적으로 성립하지 않는 경우에만 그 유형을 교체할 수 있습니다. 그때도 바로 앞뒤 2문항과 다른 questionStyle을 선택하고, 동일 유형 최대 횟수 제한을 지켜야 합니다. 단순히 만들기 쉽다는 이유로 single_blank나 whole_sentence_judgment로 대체하지 마세요.\n\n` +
`최종 JSON을 출력하기 전에 객관식 순서대로 questionStyle만 다시 나열해 위 설계표와 대조한 뒤, 어긋난 문항은 수정하고 출력하세요.\n`;

          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v31 blueprint could not modify generation request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
