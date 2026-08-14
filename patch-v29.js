(function () {
  'use strict';

  // v30: rigorous second-pass exam quality review.
  // Review every completed question independently, return only problematic questions,
  // and merge only corrected questions that pass the local validator.

  const PROXY_URL = 'https://yms-grammar-api.vercel.app/api/gemini';
  const originalRenderExam = window.renderExam;

  if (typeof originalRenderExam !== 'function') return;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function getReviewerQuestionSchema() {
    try {
      const schema = window.getExamResponseSchema?.();
      const item = schema?.properties?.questions?.items;
      if (item) return clone(item);
    } catch (e) {}

    return {
      type: 'OBJECT',
      properties: {
        id: { type: 'INTEGER' },
        type: { type: 'STRING', enum: ['multiple_choice', 'essay'] },
        difficulty: { type: 'STRING', enum: ['하', '중', '상'] },
        score: { type: 'NUMBER' },
        instruction: { type: 'STRING' },
        passage: { type: 'STRING' },
        passageStyle: { type: 'STRING', enum: ['box', 'plain', 'none'] },
        options: { type: 'ARRAY', items: { type: 'STRING' } },
        answer: { type: 'STRING' },
        translation: { type: 'STRING' },
        explanation: { type: 'STRING' },
        rubric: { type: 'STRING' }
      },
      required: [
        'id', 'type', 'difficulty', 'score', 'instruction', 'passage', 'passageStyle',
        'options', 'answer', 'translation', 'explanation', 'rubric'
      ]
    };
  }

  function buildReviewSchema() {
    return {
      type: 'OBJECT',
      properties: {
        summary: { type: 'STRING' },
        revisions: {
          type: 'ARRAY',
          items: {
            type: 'OBJECT',
            properties: {
              id: { type: 'INTEGER' },
              issues: { type: 'ARRAY', items: { type: 'STRING' } },
              correctedQuestion: getReviewerQuestionSchema()
            },
            required: ['id', 'issues', 'correctedQuestion']
          }
        }
      },
      required: ['summary', 'revisions']
    };
  }

  function buildReviewPrompt(data, grade, unitNum, unitTitle, scope) {
    return `
# Role
당신은 영어 시험 출제자가 아니라 최종 검수 책임자입니다. 아래 시험은 실제 학생에게 배포하기 직전의 원고입니다. 출제자의 기존 answer와 explanation을 믿지 말고, 모든 문항을 학생의 입장에서 처음부터 독립적으로 다시 풀어 검수하세요.

# 절대 원칙
- 정상 문항은 절대 수정하지 마세요. 이상이 있는 문항만 revisions에 넣으세요.
- 객관식은 정답이 정확히 1개여야 합니다. 정답 후보가 0개이거나 2개 이상이면 반드시 수정하세요.
- 문법적으로 성립하더라도 학교 시험 문제로서 지시문·문맥·보기·정답 근거가 애매하면 반드시 수정하세요.
- 기존 answer가 맞다고 가정하지 마세요. 먼저 직접 풀고 마지막에 기존 answer와 비교하세요.
- 애매한 문항을 억지로 살리지 마세요. 학생이나 교사가 이의를 제기할 여지가 있으면 수정 대상입니다.

# 모든 객관식에 반드시 적용할 내부 검수 절차
각 객관식 문항마다 아래 절차를 내부적으로 수행하세요. 이 중간 판정표는 최종 JSON에 출력하지 마세요.
1) instruction만 읽고 학생이 무엇을 판단해야 하는지 한 문장으로 정의합니다.
2) passage의 문법·의미·시간 표현·지시 대상을 먼저 분석합니다.
3) 보기 ①~⑤를 하나씩 독립적으로 검사하여 각각 '정답 가능 / 오답'으로 판정합니다.
4) 정답 가능 보기의 개수를 셉니다.
5) 그 개수가 정확히 1이 아니면 무조건 문항을 수정합니다.
6) 정답 가능 보기가 정확히 1개라면 기존 answer가 그 보기와 일치하는지 확인합니다. 다르면 수정합니다.
7) 마지막으로 explanation과 translation이 수정 후 문항 및 실제 정답과 일치하는지 다시 확인합니다.

# 문항 유형별 필수 검사
## A. 빈칸 문제
- 빈칸 수와 보기 구조가 일치해야 합니다.
- 단일 빈칸이면 정답이 하나만 가능하도록 시간 표현·주어·문맥이 충분해야 합니다.
- (A)/(B) 두 빈칸 문제는 각 보기의 A와 B를 반드시 '한 쌍'으로 대입해 두 문장/대화가 모두 자연스러운지 검사하세요.
- 두 개 이상의 보기 쌍이 성립하면 수정하세요.

## B. 어법상 알맞은/틀린 문장
- 5개 문장을 각각 독립적으로 문법 판정하세요.
- '알맞은 문장'은 정확히 1개만 맞아야 하고, '틀린 문장'은 정확히 1개만 틀려야 합니다.
- 나머지 보기들이 의도치 않게 문법적으로 허용되는 변형인지도 확인하세요.

## C. 옳은/틀린 문장 개수
- 제시된 각 문장을 하나씩 O/X 판정한 뒤 실제 개수를 다시 세세요.
- 보기의 개수와 answer가 실제 계산값과 정확히 일치해야 합니다.

## D. '쓰임이 나머지와 다른 하나' / '성격이 다른 하나'
- 반드시 5개 보기의 목표 표현을 각각 문법 기능/의미 기능으로 분류하세요.
- 정확히 4개가 같은 범주이고 1개만 다른 범주여야 합니다.
- 5개가 모두 같은 쓰임이거나 3:2처럼 나뉘면 문제 자체가 성립하지 않으므로 반드시 수정하세요.
- 무엇의 '쓰임'을 비교하는지 학생이 화면에서 명확히 알 수 있어야 합니다.

## E. 밑줄 관련 지시문
- instruction에 '밑줄', '밑줄 친 부분', '밑줄 친 표현'이 들어가면 실제 학생 화면에 그 대상이 명확히 표시되어 있어야 합니다.
- 표시 대상이 없거나 여러 개라서 무엇을 보는지 불명확하면 반드시 수정하세요.
- 현재 YMS 객관식은 밑줄형을 사용하지 않는 것을 원칙으로 합니다. 가능하면 '다음 중 어법상 알맞은/틀린 문장을 고르세요', correction_pair, sentence_count, sentence_bundle 등 비밑줄형으로 바꾸세요.

## F. 오류 수정쌍(correction_pair)
- 원문에 실제 문법 오류가 존재하는지 먼저 확인하세요.
- 보기 5개 중 정확히 한 수정쌍만 원문 오류를 올바르게 고쳐야 합니다.
- 다른 보기도 문법적으로 가능한 수정이거나 원문에 오류가 둘 이상이면 수정하세요.
- 본문에 오류 위치를 밑줄로 노출하여 정답을 암시하지 마세요.

## G. 같은 의미 / 문장 전환
- 원문과 각 보기를 의미까지 비교하세요.
- 시제, 시간 기준, 부정/긍정, 완료 여부, 화자 의도 차이 때문에 의미가 달라지는지 확인하세요.
- '비슷해 보이는 문장'이 아니라 실제로 같은 의미인 보기만 정답이어야 합니다.

## H. 어순 배열
- 정답 문장이 문법적으로 완전하고 자연스러운지 확인하세요.
- 주어진 모든 단어를 조건대로 사용했는지 확인하세요.
- 2개 이상의 보기에서 자연스러운 문장이 만들어지면 수정하세요.

## I. A~E 문장 묶음 / 짝짓기
- A~E 각각을 먼저 독립 판정하세요.
- 그 판정 결과와 보기의 조합을 다시 대조하여 정답 조합이 정확히 하나인지 확인하세요.
- 문장 끝의 불필요한 번호나 표시가 답을 암시하지 않아야 합니다.

# 공통 품질 검수
1. 문법 정확성
- passage와 모든 options의 문법을 다시 확인하세요.
- 시제, 시간 표현, 주어-동사 수일치, 조동사 뒤 동사원형, 완료형, 진행형, 의문문/부정문 구조를 함께 확인하세요.

2. 영어의 자연스러움
- 문법만 맞고 실제 영어로 어색한 표현은 수정하세요.
- 불완전하거나 부자연스러운 시간 표현, collocation, 전치사 표현을 허용하지 마세요.
- 학생이 문법이 아니라 상식이나 어휘 모호성으로 답을 추측하게 만들지 마세요.

3. instruction-passage-options 일치
- 지시문이 요구하는 정보가 passage/options에 실제로 존재해야 합니다.
- passage와 options가 같은 내용을 불필요하게 중복하지 않아야 합니다.
- (A)/(B), A~E, 대화 화자, 빈칸, 조건 번호가 빠지거나 중복되지 않았는지 확인하세요.

4. 학년 및 범위
- 대상 학년 ${grade} 수준에 맞는 어휘와 문장 구조인지 확인하세요.
- 출제 범위 '${scope}' 밖의 문법 지식이 정답 판단의 핵심이 되면 수정하세요.
- 난이도를 높이려고 범위 밖 문법이나 지나치게 어려운 어휘를 요구하지 마세요.

5. 시험 전체 중복
- 앞뒤 문항과 사실상 같은 문장·같은 답 패턴·같은 풀이 방식이 반복되는지 확인하세요.
- 주어/명사만 바꾼 사실상 동일 문제도 중복입니다.
- 중복이 과도하면 뒤쪽 문항을 수정하되 원래 문법 범위는 유지하세요.

# 서술형 검수
- 학생이 무엇을 써야 하는지 지시와 조건이 명확해야 합니다.
- answer가 실제 가능한 모범답인지 직접 작성해 검산하세요.
- 정답이 여러 형태로 가능한 경우 rubric에 허용 가능한 변형과 필수 요소가 명확히 있어야 합니다.
- 조건에서 제공하지 않은 단어나 정보를 학생이 추측해야만 정답을 쓸 수 있으면 수정하세요.
- 조건 문구에 '조건'이라는 단어가 불필요하게 단독 반복되지 않도록 correctedQuestion의 passage를 깔끔하게 정리하세요.
- 문장 전환 문제는 요구한 시제/부정/의문/문장 결합 방식이 answer에 정확히 반영되어야 합니다.

# 해석·해설 검수
- translation은 해당 영어 문장과 의미가 정확히 맞아야 합니다.
- explanation은 실제 정답 근거를 설명해야 합니다.
- 다른 문항의 설명이 섞였거나, 틀린 문법 규칙을 설명하거나, 정답과 모순되면 수정하세요.

# 수정 규칙
- 정상 문항은 revisions에 넣지 마세요.
- 수정할 때 id, type, difficulty, score는 원래 값을 반드시 유지하세요.
- 원래 출제하려던 핵심 문법 개념은 가능한 한 유지하세요.
- 오류 원인을 제거하는 최소 수정이 우선입니다.
- multiple_choice는 options를 정확히 5개 유지하고 정답이 정확히 하나만 존재하게 하세요.
- essay는 options를 반드시 []로 유지하세요.
- 수정 후 answer, translation, explanation, rubric을 수정된 문항에 맞춰 전부 다시 검산하세요.
- HTML 태그를 사용하지 마세요.
- 객관식에는 새 밑줄형 문제를 만들지 마세요.

# 최종 자체 점검
revisions를 출력하기 직전에 수정된 각 객관식을 다시 한 번 ①~⑤ 독립 판정하세요. 수정 후에도 정답 후보가 정확히 1개가 아니면 그 수정안은 다시 고쳐서 확정하세요.

# 출력
- 이상 없는 문항은 출력하지 마세요.
- 문제가 있는 문항만 revisions 배열에 넣고 correctedQuestion에 수정 완료된 전체 문항 객체를 넣으세요.
- issues에는 실제 발견한 오류를 짧고 구체적으로 적으세요. 예: '정답 2개 가능', '밑줄 지시문이나 표시 없음', '5개 모두 같은 쓰임', '해설과 정답 불일치'.
- revisions가 없으면 빈 배열 []을 반환하세요.
- JSON 외에는 아무것도 출력하지 마세요.

# 시험 정보
- 대상 학년: ${grade}
- 단원: ${unitNum} - ${unitTitle}
- 출제 범위: ${scope}

# 검수 대상 전체 시험 JSON
${JSON.stringify(data)}
`;
  }

  async function requestReview(data, grade, unitNum, unitTitle, scope) {
    const body = {
      contents: [{ parts: [{ text: buildReviewPrompt(data, grade, unitNum, unitTitle, scope) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: buildReviewSchema(),
        maxOutputTokens: 32768,
        temperature: 0.05
      }
    };

    let lastError = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await fetch(PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`검수 API 오류 (${response.status}): ${text}`);
        }

        const payload = await response.json();
        if (payload.error) throw new Error(payload.error.message || '검수 API 오류');
        if (!payload.candidates?.length) throw new Error('검수 응답이 없습니다.');

        const raw = (payload.candidates[0].content?.parts || [])
          .map(part => part.text || '')
          .join('')
          .trim();
        if (!raw) throw new Error('검수 응답이 비어 있습니다.');

        const parsed = typeof window.parseGeminiJson === 'function'
          ? window.parseGeminiJson(raw)
          : JSON.parse(raw);

        if (!parsed || !Array.isArray(parsed.revisions)) {
          throw new Error('검수 결과 형식이 올바르지 않습니다.');
        }
        return parsed;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1200));
      }
    }
    throw lastError || new Error('검수에 실패했습니다.');
  }

  function mergeReviewedQuestions(data, reviewResult) {
    const output = clone(data);
    const byId = new Map(output.questions.map(q => [Number(q.id), q]));
    let applied = 0;

    for (const revision of reviewResult.revisions || []) {
      const id = Number(revision?.id);
      const original = byId.get(id);
      const corrected = revision?.correctedQuestion;
      if (!original || !corrected) continue;

      const candidate = {
        ...corrected,
        id: original.id,
        type: original.type,
        difficulty: original.difficulty,
        score: original.score
      };

      if (original.questionStyle && !candidate.questionStyle) {
        candidate.questionStyle = original.questionStyle;
      }

      if (candidate.type === 'essay') candidate.options = [];

      try {
        if (candidate.type === 'multiple_choice' && (!Array.isArray(candidate.options) || candidate.options.length !== 5)) {
          throw new Error('객관식 보기가 5개가 아닙니다.');
        }
        if (typeof window.validateQuestionStructure === 'function') {
          window.validateQuestionStructure(candidate);
        }

        const index = output.questions.findIndex(q => Number(q.id) === id);
        if (index >= 0) {
          output.questions[index] = candidate;
          byId.set(id, candidate);
          applied += 1;
        }
      } catch (error) {
        console.warn(`YMS v30: ${id}번 검수 수정안은 구조 검증 실패로 원문을 유지합니다.`, error);
      }
    }

    return { data: output, applied };
  }

  window.renderExam = async function (data, grade, unitNum, unitTitle, scope, mcCount) {
    const loadingMsg = document.getElementById('loadingMsg');
    if (loadingMsg) {
      loadingMsg.classList.remove('hidden');
      loadingMsg.innerText = '1차 출제 완료 · AI가 ①~⑤ 정답 유일성까지 전 문항 정밀 검수 중입니다...';
    }

    try {
      const reviewResult = await requestReview(data, grade, unitNum, unitTitle, scope);
      const merged = mergeReviewedQuestions(data, reviewResult);
      console.info(`YMS v30 review: ${reviewResult.revisions.length}개 지적, ${merged.applied}개 수정 반영.`, reviewResult.summary || '');
      return originalRenderExam(merged.data, grade, unitNum, unitTitle, scope, mcCount);
    } catch (error) {
      console.warn('YMS v30 final review failed; rendering the locally validated exam.', error);
      return originalRenderExam(data, grade, unitNum, unitTitle, scope, mcCount);
    }
  };
})();
