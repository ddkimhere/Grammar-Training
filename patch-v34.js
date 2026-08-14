(function () {
  'use strict';

  // v34: raise lexical and reasoning difficulty by grade without changing the requested grammar scope.
  const previousFetch = window.fetch.bind(window);

  const GRADE_PROFILES = {
    '초등학교 5학년': {
      label: '초5 상향형',
      length: '한 문장 기준 대체로 8~14단어',
      vocab: 'decide, invite, borrow, return, prepare, promise, choose, different, important, careful, before, after, during 같은 초등 고학년 확장 어휘를 자연스럽게 섞으세요.',
      reasoning: '단순 철자·형태 암기보다 시간 표현, 주어, 문맥 중 2가지 단서를 함께 보게 하세요.'
    },
    '초등학교 6학년': {
      label: '초6 상향형',
      length: '한 문장 기준 대체로 10~16단어',
      vocab: 'experience, improve, continue, prefer, suggest, recently, already, several, enough, instead, while, possible 같은 확장 어휘를 자연스럽게 사용하세요.',
      reasoning: '중·상 문항은 시간 표현과 문맥, 문장 구조를 함께 판단하게 하고 단순 동사 형태만 보고 답이 보이지 않게 하세요.'
    },
    '중학교 1학년': {
      label: '중1 내신 중상위형',
      length: '한 문장 기준 대체로 12~18단어',
      vocab: 'participate, realize, expect, avoid, manage, offer, consider, especially, available, local, without, although 같은 중등 확장 어휘를 문맥 속에서 사용하세요.',
      reasoning: '중 문항부터 최소 2개의 문법·문맥 단서를 결합하고, 상 문항은 오답도 실제 학생이 고민할 만큼 그럴듯하게 설계하세요.'
    },
    '중학교 2학년': {
      label: '중2 내신 상위권형',
      length: '한 문장 기준 대체로 14~22단어',
      vocab: 'influence, opportunity, responsible, recommend, achieve, environment, communicate, recognize, compare, manage, instead of, as soon as 같은 중등 중상급 어휘를 적극 사용하세요.',
      reasoning: '중 문항은 문맥+문법의 2단계 판단, 상 문항은 두 문장 이상 또는 복수 문법 단서를 비교하는 2~3단계 판단이 되게 하세요.'
    },
    '중학교 3학년': {
      label: '중3 내신 최상위권형',
      length: '한 문장 기준 대체로 16~25단어',
      vocab: 'consequence, maintain, significant, approach, benefit, challenge, assume, contribute, effective, concern, require, likely, despite, therefore 같은 중3~고등 초입 어휘를 자연스럽게 섞으세요.',
      reasoning: '상 문항은 한 문장 안의 단일 단서가 아니라 시제·구문·의미 단서를 동시에 비교해야 풀리게 하세요.'
    },
    '고등학교 1학년': {
      label: '고1 내신·모의 상위권형',
      length: '한 문장 기준 대체로 18~30단어',
      vocab: 'interpret, establish, perspective, tendency, relevant, indicate, factor, contribute, determine, occur, adapt, evidence, assumption, significant, whereas 같은 학술적·추상적 어휘를 문맥에 맞게 사용하세요.',
      reasoning: '중 문항도 단순 형태 선택을 피하고, 상 문항은 문장 구조와 의미 관계를 2~3단계로 분석해야 정답이 나오게 하세요.'
    }
  };

  function getGrade() {
    return document.getElementById('grade')?.value || '';
  }

  function profileText(grade) {
    const p = GRADE_PROFILES[grade] || GRADE_PROFILES['중학교 1학년'];
    return `대상: ${grade || p.label}\n- 목표 수준: ${p.label}\n- 문장 길이: ${p.length}\n- 어휘: ${p.vocab}\n- 사고 수준: ${p.reasoning}`;
  }

  function generationRules(grade) {
    return `\n\n# YMS v34 학년별 난이도·어휘 상향 규칙 — 중요\n` +
`이 시험은 일반적인 교과서 확인문제보다 한 단계 어려운 YMS 내신 대비용입니다. 문법 범위 자체를 벗어나지 말고, 어휘·문맥·오답 설계와 사고 단계를 높이세요.\n\n` +
`${profileText(grade)}\n\n` +
`## 난이도 라벨의 실제 기준\n` +
`- 하: 해당 학년 기본 확인 수준이지만 너무 유아적인 문장이나 한눈에 답이 보이는 보기 구성은 금지합니다. 최소한 자연스러운 문맥과 그럴듯한 오답을 사용하세요.\n` +
`- 중: 해당 학년 내신 중상 수준. 최소 2개의 단서(시간 표현+문맥, 주어+구문, 앞문장+뒷문장 등)를 함께 판단해야 풀리게 하세요.\n` +
`- 상: 해당 학년 상위권 변별 수준. 단일 형태 암기로 풀 수 없게 하고, 2~3단계 판단 또는 복수 문장 비교가 필요하게 하세요.\n` +
`- 상 문항에서 'yesterday만 보고 과거형', 'now만 보고 진행형'처럼 한 단어만 보고 즉시 답이 확정되는 문제는 금지합니다.\n\n` +
`## 어휘 상향 원칙\n` +
`- go to school, play soccer, read a book, happy, good, like, apple, homework 같은 극기초 표현만 반복하지 마세요. 이런 표현은 필요할 때만 제한적으로 사용하세요.\n` +
`- 문장을 가진 객관식의 대다수에는 해당 학년에 맞는 확장 동사·형용사·명사·부사를 최소 1개 자연스럽게 포함하세요.\n` +
`- 단, 어휘 지식 자체가 정답을 가르는 문제가 되면 안 됩니다. 학생이 문맥으로 뜻을 짐작할 수 있고 핵심 정답 근거는 요청한 문법이어야 합니다.\n` +
`- 희귀 단어, 전문용어, 대학 수준 어휘를 억지로 넣지 마세요. '조금 더 어려운 교과·내신 어휘'가 목표입니다.\n` +
`- 같은 핵심 어휘나 같은 생활 소재를 여러 문항에서 반복하지 마세요. 학교생활, 계획, 여행, 환경, 기술, 취미, 경험, 건강한 생활, 공동체, 문제 해결 등 소재도 분산하세요.\n\n` +
`## 오답 설계\n` +
`- 오답은 철자 하나만 이상하거나 누가 봐도 불가능한 형태로 만들지 마세요. 실제 학생이 흔히 혼동하는 문법 포인트를 반영한 plausible distractor를 만드세요.\n` +
`- 정답을 유일하게 유지하면서도 오답 2~3개는 반드시 한 번 더 생각하게 만들 정도로 그럴듯해야 합니다.\n` +
`- 보기 길이, 어휘 수준, 문장 완성도가 정답만 유난히 돋보이게 하지 마세요.\n\n` +
`## 문장 복잡도\n` +
`- 중·상 문항은 필요하면 부사구, 전치사구, 시간·이유·조건의 짧은 문맥을 추가해 정답 판단 단서를 분산하세요.\n` +
`- 단, 아직 배우지 않은 문법 구조가 정답 판별의 핵심이 되면 안 됩니다. 요청된 출제 범위 안에서만 어렵게 만드세요.\n` +
`- 최종 JSON 출력 전, 각 문항을 보고 '이 학년보다 1~2학년 어린 학생도 너무 쉽게 풀 수 있는가?'를 점검하고 그렇다면 어휘·문맥·오답을 상향 조정하세요.\n`;
  }

  function reviewRules(grade) {
    return `\n\n# YMS v34 추가 검수 — 난이도와 어휘 수준\n` +
`${profileText(grade)}\n` +
`검수 시 문법 오류뿐 아니라 '너무 쉬운 문제'도 품질 오류로 판단하세요.\n` +
`- difficulty='상'인데 한 단어 단서만 보고 바로 답이 나오거나 오답이 지나치게 허술하면 반드시 수정하세요.\n` +
`- difficulty='중'인데 초급 단어와 단순 형태 선택만으로 끝나면 문맥 또는 오답을 한 단계 강화하세요.\n` +
`- 시험 전반에 go/play/read/book/school/happy/good/like 같은 극기초 어휘와 생활 소재가 반복되면 뒤쪽 반복 문항의 어휘와 소재를 해당 학년 수준으로 교체하세요.\n` +
`- 어휘를 올릴 때는 정답 문법, questionStyle, id, type, difficulty, score를 유지하세요.\n` +
`- 어휘 자체가 정답을 결정하게 만들지 말고, 문법적 정답 유일성을 다시 검산하세요.\n` +
`- 초등은 지나친 중고등 추상어를 쓰지 말고, 중등·고등은 유아적인 단문만 반복하지 마세요.\n`;
  }

  window.fetch = function (input, init) {
    const url = String(typeof input === 'string' ? input : (input?.url || ''));
    const isGoogleGeneration = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');
    const isProxyRequest = url.includes('yms-grammar-api.vercel.app/api/gemini');

    if ((isGoogleGeneration || isProxyRequest) && init && typeof init.body === 'string') {
      try {
        const body = JSON.parse(init.body);
        const part = body?.contents?.[0]?.parts?.[0];
        if (part && typeof part.text === 'string') {
          const grade = getGrade();
          const isReview = /최종 검수 책임자|검수 대상 전체 시험 JSON|전 문항 정밀 검수/.test(part.text);
          part.text += isReview ? reviewRules(grade) : generationRules(grade);
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v34 difficulty prompt could not modify request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
