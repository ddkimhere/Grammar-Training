(function () {
  'use strict';

  // v37: vocabulary is controlled by BOTH grade and item difficulty.
  // These are YMS operational bands for exam generation, not an official national vocabulary list.
  const previousFetch = window.fetch.bind(window);

  const VOCAB_BANDS = {
    '초등학교 5학년': {
      '하': { length: '7~11단어', words: 'arrive, carry, finish, decide, careful, different, early, together, remember, happen', tone: '구체적인 일상·학교 상황 중심. 기본어만 반복하지 말고 초등 고학년 핵심어를 사용.' },
      '중': { length: '10~14단어', words: 'borrow, return, prepare, promise, choose, invite, enough, during, instead, important, possible, suddenly', tone: '두 개의 문맥 단서를 함께 볼 수 있는 자연스러운 확장어휘 사용.' },
      '상': { length: '12~17단어', words: 'prefer, suggest, continue, improve, experience, discover, describe, probably, depend on, be interested in, as soon as', tone: '초5 상위권 수준. 다소 긴 문맥과 확장어휘를 쓰되 중등 추상어를 과하게 사용하지 않음.' }
    },
    '초등학교 6학년': {
      '하': { length: '9~13단어', words: 'decide, promise, prepare, choose, borrow, return, enough, during, several, already, recently', tone: '초6 기본 내신 수준의 고빈도 확장어휘.' },
      '중': { length: '12~17단어', words: 'experience, improve, continue, prefer, suggest, possible, instead, while, realize, manage, without', tone: '초6 중상위권. 익숙한 소재 안에서 한 단계 높은 동사·부사·연결 표현 사용.' },
      '상': { length: '15~20단어', words: 'consider, avoid, expect, offer, recognize, especially, although, communicate, opportunity, be responsible for, instead of', tone: '초6 최상위권 수준. 중1 초입 정도의 확장어휘를 문맥으로 이해 가능하게 사용.' }
    },
    '중학교 1학년': {
      '하': { length: '11~15단어', words: 'experience, improve, continue, prefer, suggest, realize, prepare, available, local, recently, although', tone: '중1 교과·내신 기본 수준. 유아적인 표현 반복 금지.' },
      '중': { length: '14~19단어', words: 'participate, expect, avoid, manage, offer, consider, recognize, especially, communicate, responsible, without', tone: '중1 중상위권. 동사와 추상 명사를 적절히 섞고 문맥을 한 단계 확장.' },
      '상': { length: '17~23단어', words: 'influence, opportunity, recommend, achieve, compare, environment, effective, require, likely, as soon as, in order to, be willing to', tone: '중1 상위권 변별 수준. 중2 초입 어휘까지 자연스럽게 사용하되 의미 추론 가능해야 함.' }
    },
    '중학교 2학년': {
      '하': { length: '13~18단어', words: 'participate, recognize, manage, compare, communicate, responsible, recommend, achieve, opportunity, available, instead of', tone: '중2 기본 내신 수준. 지나치게 쉬운 초등 단어 중심 문장 금지.' },
      '중': { length: '16~22단어', words: 'influence, environment, effective, require, likely, benefit, challenge, maintain, contribute, concern, despite, therefore', tone: '중2 중상위권. 원인·결과·목적·대조가 드러나는 조금 더 추상적인 문맥 사용.' },
      '상': { length: '20~27단어', words: 'consequence, significant, approach, assume, determine, factor, relevant, indicate, adapt, perspective, account for, lead to, be likely to', tone: '중2 상위권 변별 수준. 중3~고1 초입의 추상어를 제한적으로 사용하고 문법 판단은 2~3단계가 되게 함.' }
    },
    '중학교 3학년': {
      '하': { length: '15~20단어', words: 'influence, opportunity, achieve, environment, effective, maintain, benefit, challenge, concern, despite, therefore', tone: '중3 기본 내신 수준. 중등 고학년다운 추상 명사와 연결어 사용.' },
      '중': { length: '18~25단어', words: 'consequence, significant, approach, assume, contribute, determine, relevant, indicate, factor, adapt, perspective, require', tone: '중3 중상위권. 문장 내 정보량과 추상성을 한 단계 높임.' },
      '상': { length: '22~31단어', words: 'interpret, establish, tendency, evidence, assumption, distinguish, demonstrate, implication, emerge, attribute, whereas, in contrast, result from', tone: '중3 최상위권~고1 초입. 학술적 어휘를 자연스럽게 포함하되 희귀 전문용어는 금지.' }
    },
    '고등학교 1학년': {
      '하': { length: '17~23단어', words: 'consequence, maintain, significant, approach, benefit, challenge, contribute, effective, concern, require, likely, despite', tone: '고1 기본 내신 수준. 중등식 단순 생활영어에서 벗어난 문맥 사용.' },
      '중': { length: '21~29단어', words: 'interpret, establish, perspective, tendency, relevant, indicate, factor, determine, occur, adapt, evidence, assumption, whereas, account for', tone: '고1 중상위권. 추상적·학술적 문맥과 복합적인 정보 관계를 사용.' },
      '상': { length: '26~35단어', words: 'implication, substantial, inherent, conventional, demonstrate, distinguish, derive, emerge, attribute, ultimately, plausible, underlying, be attributed to, give rise to', tone: '고1 상위권 내신·모의 변별 수준. 학술적 어휘와 복잡한 문맥을 쓰되 대학 전공 전문어는 피함.' }
    }
  };

  function currentGrade() {
    return document.getElementById('grade')?.value || '중학교 1학년';
  }

  function matrixText(grade) {
    const bands = VOCAB_BANDS[grade] || VOCAB_BANDS['중학교 1학년'];
    return ['하', '중', '상'].map(level => {
      const b = bands[level];
      return `- ${level}: 문장 길이 ${b.length}. 어휘 예시/수준: ${b.words}. 특징: ${b.tone}`;
    }).join('\n');
  }

  function generationRules(grade) {
    return `\n\n# YMS v37 학년 × 난이도별 어휘 밴드 — 최우선 어휘 규칙\n` +
`대상 학년: ${grade}\n` +
`각 question의 difficulty='하'|'중'|'상' 값에 맞춰 아래 어휘 밴드를 개별적으로 적용하세요. 시험 전체에 한 가지 어휘 수준을 쓰면 안 됩니다.\n` +
`${matrixText(grade)}\n\n` +
`## 적용 원칙\n` +
`1. 위 단어들은 강제 단어목록이 아니라 어휘 난이도를 보여주는 기준 예시입니다. 같은 수준의 다른 자연스러운 단어를 적극 사용하세요.\n` +
`2. 같은 학년에서도 하 < 중 < 상 순으로 내용어(content words)의 난이도, 문장 길이, 문맥의 추상성, 정보량이 눈에 띄게 올라가야 합니다.\n` +
`3. 하 문항도 go, like, good, happy, school, book 같은 극기초어만으로 만들지 마세요. 해당 학년의 '하' 밴드 수준은 지켜야 합니다.\n` +
`4. 중 문항은 해당 학년 중 밴드 수준의 확장어휘를 문장당 대체로 1~2개 포함하고, 상 문항은 상 밴드 수준의 내용어·연결표현을 대체로 2개 이상 자연스럽게 포함하세요. 단, 문장이 짧은 유형은 억지로 단어 수를 채우지 마세요.\n` +
`5. 상 문항의 어려움은 희귀 단어 암기가 아니라 '조금 높은 어휘 + 긴 문맥 + 그럴듯한 오답 + 복수 단서'에서 나와야 합니다.\n` +
`6. 어휘 자체를 모르면 정답을 못 고르는 어휘시험으로 변질시키지 마세요. 핵심 정답 근거는 사용자가 지정한 문법 범위여야 합니다.\n` +
`7. 하 문항에 상 밴드의 지나치게 추상적인 어휘를 몰아넣지 말고, 상 문항에 하 밴드의 지나치게 단순한 생활어만 쓰지도 마세요.\n` +
`8. 같은 시험 안에서 같은 고급 단어를 반복 사용하지 말고 소재도 학교·과학·환경·기술·사회·경험·계획·문제해결 등으로 분산하세요.\n` +
`9. 최종 출력 전 각 문항별로 [학년, difficulty, 실제 어휘 수준]을 대조하여 밴드가 맞지 않는 문항은 어휘와 문맥을 조정한 뒤 출력하세요.\n`;
  }

  function reviewRules(grade) {
    return `\n\n# YMS v37 최종 검수 — 학년 × 난이도 어휘 일치 검사\n` +
`대상 학년: ${grade}\n${matrixText(grade)}\n` +
`검수자는 모든 문항을 하나씩 보며 difficulty와 실제 어휘 수준이 일치하는지 검사하세요.\n` +
`- 하: 해당 학년 기본 밴드보다 지나치게 유아적이면 수정하고, 반대로 상 밴드 어휘가 과도하면 낮추세요.\n` +
`- 중: 해당 학년 중 밴드보다 쉬운 초급 생활어 중심이면 확장어휘와 문맥을 한 단계 올리세요.\n` +
`- 상: 해당 학년 상 밴드 수준의 어휘·문맥이 부족하거나 한눈에 답이 보이면 반드시 수정하세요.\n` +
`- 어휘를 수정한 뒤에도 원래 questionStyle, id, type, difficulty, score, 정답 유일성, 문법 출제 범위는 유지하세요.\n` +
`- 수정으로 인해 정답이 0개 또는 2개 이상이 되지 않는지 객관식 5개 보기를 다시 검산하세요.\n` +
`- '상이라서 무조건 어려운 희귀어를 넣는 것'도 오류입니다. 대상 학년의 상위권 학생이 문맥으로 이해 가능한 수준을 유지하세요.\n`;
  }

  window.fetch = function (input, init) {
    const url = String(typeof input === 'string' ? input : (input?.url || ''));
    const isGeneration = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');
    const isProxy = url.includes('yms-grammar-api.vercel.app/api/gemini');

    if ((isGeneration || isProxy) && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const part = body?.contents?.[0]?.parts?.[0];
        if (part && typeof part.text === 'string') {
          const grade = currentGrade();
          const isReview = /최종 검수 책임자|검수 대상 전체 시험 JSON|전 문항 정밀 검수/.test(part.text);
          part.text += isReview ? reviewRules(grade) : generationRules(grade);
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v37 vocabulary-band prompt could not modify request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
