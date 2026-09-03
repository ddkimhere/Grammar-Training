(function () {
  'use strict';

  // v38: prevent repeated vocabulary and repeated topics across the whole exam.
  const previousFetch = window.fetch.bind(window);

  function generationRules() {
    return `\n\n# YMS v38 시험 전체 어휘 중복 제한 — 최우선 어휘 다양성 규칙\n` +
`v37의 학년×난이도별 어휘 밴드는 그대로 지키되, 그 예시 단어를 여러 문항에 반복 사용하지 마세요. 각 문항은 가능한 한 서로 다른 핵심 내용어와 소재를 사용해야 합니다.\n\n` +
`## 핵심 내용어 반복 제한\n` +
`1. 명사·일반동사·형용사·내용부사·핵심 숙어를 content word로 봅니다. be/have/do가 문법 구조상 필요한 경우, 관사·전치사·대명사·접속사·조동사 같은 기능어는 이 반복 제한에서 제외합니다.\n` +
`2. 같은 content word의 원형(lemma)은 시험 전체에서 원칙적으로 최대 2회까지만 사용하세요. 예: achieve/achieves/achieved는 같은 단어로 계산합니다.\n` +
`3. 같은 어휘군(word family)도 과도하게 반복하지 마세요. 예: contribute/contribution/contributory, decide/decision처럼 뿌리가 같은 핵심어는 전체에서 합쳐 최대 2회 정도를 목표로 하세요.\n` +
`4. 연속 3문항 안에서는 같은 핵심 명사, 일반동사, 형용사 또는 핵심 숙어를 다시 사용하지 마세요.\n` +
`5. 동일한 고급 단어를 difficulty='상' 문항마다 반복하지 마세요. 상 문항마다 다른 동급 어휘와 다른 문맥을 사용하세요.\n` +
`6. v37 어휘표의 단어는 예시 수준을 뜻할 뿐 '반드시 써야 할 단어 목록'이 아닙니다. 예시 단어를 순환 복사하지 말고 같은 난이도의 다양한 동의·관련 어휘를 새로 선택하세요.\n` +
`7. 사용자가 요청한 문법 자체 때문에 특정 동사/표현을 반복해야 하는 경우에만 예외를 허용합니다. 예외가 필요하더라도 주변의 소재·명사·형용사·부사는 반드시 바꾸세요.\n\n` +
`## 소재·상황 반복 제한\n` +
`- school/homework/student/teacher만 반복하지 마세요. 학교생활, 여행, 환경, 기술, 과학, 문화, 지역사회, 취미, 계획, 선택, 문제 해결, 경험, 협력, 건강한 생활, 미디어 등 서로 다른 소재를 분산하세요.\n` +
`- 같은 인물·장소·행동 구조를 이름만 바꾸어 반복하지 마세요. '친구가 숙제한다'와 '학생이 과제한다'처럼 사실상 같은 상황도 반복으로 봅니다.\n` +
`- 바로 앞 문항과 같은 핵심 동사+목적어 조합 또는 같은 상황 틀을 재사용하지 마세요.\n\n` +
`## 최종 생성 전 내부 어휘 장부 검사\n` +
`JSON을 출력하기 직전에 모든 문항의 passage와 options를 훑어 핵심 내용어의 lemma/word family 빈도를 내부적으로 세세요. 같은 핵심어가 3회 이상이면 첫 사용 1~2회만 남기고 뒤쪽 문항의 핵심어와 소재를 같은 학년·difficulty 밴드의 다른 자연스러운 어휘로 교체하세요. 이 내부 장부는 JSON에 출력하지 마세요.\n` +
`어휘를 교체한 뒤에는 반드시 그 문항의 정답 유일성, 문법 자연스러움, 해설 일치 여부를 다시 검산하세요.\n`;
  }

  function reviewRules() {
    return `\n\n# YMS v38 최종 검수 — 시험 전체 어휘 중복 검사\n` +
`문항 정확성 검수와 별도로 시험 전체의 passage/options를 대상으로 어휘 빈도를 검사하세요.\n` +
`1. 기능어를 제외한 핵심 명사·일반동사·형용사·내용부사·핵심 숙어를 lemma/word family 단위로 묶어 내부 빈도표를 만드세요. 이 표는 응답에 출력하지 마세요.\n` +
`2. 동일한 핵심 lemma 또는 사실상 같은 word family가 3회 이상 나타나면 품질 오류로 판정하세요. 앞쪽 1~2회는 유지하고 뒤쪽 반복 문항을 revisions에 넣어 동급의 다른 어휘로 바꾸세요.\n` +
`3. 연속 3문항 안에서 같은 핵심 내용어가 재등장하면 뒤쪽 문항을 수정하세요.\n` +
`4. 동일 소재나 거의 같은 상황이 3회 이상 반복되면 단어만 바꾸지 말고 뒤쪽 문항의 상황 자체도 다른 소재로 바꾸세요.\n` +
`5. 특히 v37 밴드 예시어가 시험 전체에 반복 복사되지 않았는지 확인하세요. 예시어는 수준 기준이지 고정 출제어가 아닙니다.\n` +
`6. 어휘 교체 시 해당 문항의 학년×difficulty 어휘 수준은 그대로 유지하세요. 하를 너무 어렵게, 상을 너무 쉽게 만들지 마세요.\n` +
`7. 어휘를 바꾼 뒤 questionStyle, id, type, difficulty, score, 출제 문법 범위를 유지하고 객관식은 ①~⑤를 다시 직접 풀어 정답이 정확히 1개인지 확인하세요.\n` +
`8. 문법 범위 특성상 반복이 불가피한 목표 표현은 예외로 둘 수 있지만, 주변의 핵심 명사·동사·형용사·상황은 반드시 다양화하세요.\n`;
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
          const isReview = /최종 검수 책임자|검수 대상 전체 시험 JSON|전 문항 정밀 검수/.test(part.text);
          part.text += isReview ? reviewRules() : generationRules();
          init = { ...init, body: JSON.stringify(body) };
        }
      } catch (error) {
        console.warn('YMS v38 lexical-diversity prompt could not modify request.', error);
      }
    }

    return previousFetch(input, init);
  };
})();
