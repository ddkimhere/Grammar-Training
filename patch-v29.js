(function () {
  'use strict';

  // v29: second-pass exam quality review.
  // Review the completed exam once, return only problematic questions,
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
당신은 영어 시험을 출제하는 사람이 아니라 최종 검수 책임자입니다. 아래 시험을 실제 학생에게 배포하기 직전의 상태라고 생각하고 매우 엄격하게 검수하세요.

# 가장 중요한 원칙
- 출제자의 의도를 추측하지 말고 학생이 실제로 보게 되는 instruction, passage, options만 보고 문제를 독립적으로 다시 풀어 정답을 확인하세요.
- 객관식은 정답이 반드시 정확히 1개여야 합니다. 정답이 없거나 2개 이상 성립할 가능성이 조금이라도 있으면 해당 문항을 수정하세요.
- 문법적으로만 가능하다고 승인하지 마세요. 실제 학교 시험 문항으로 보았을 때 문맥, 의미, 지시문, 보기 구성이 자연스럽고 명확해야 합니다.
- 애매하면 승인하지 말고 수정하세요.
- 문제가 정상이라면 절대 손대지 마세요. 이상이 있는 문항만 revisions에 넣으세요.

# 검수 항목
1. 문법 정확성
- 제시문과 모든 보기의 문법을 다시 확인하세요.
- 정답 번호/정답 문장이 실제 정답과 일치하는지 독립적으로 검산하세요.
- explanation의 문법 설명이 실제 문제와 일치하는지 확인하세요.

2. 정답의 유일성
- 객관식 5개 보기 중 정확히 하나만 정답이어야 합니다.
- 문맥에 따라 두 개 이상 자연스러울 수 있거나, 허용 가능한 문법 변형이 두 개 이상 있으면 수정하세요.
- 오답은 그럴듯할 수 있지만 반드시 명확한 이유로 오답이어야 합니다.

3. 문제 형식 일치
- instruction, passage, options가 서로 같은 문제를 가리키는지 확인하세요.
- 빈칸 개수와 보기 구조가 맞는지 확인하세요.
- (A)/(B), A~E 표지, 대화문 화자, 문장 묶음이 빠지거나 중복되지 않았는지 확인하세요.
- 문제에 정답을 암시하거나 오류 위치를 노출하는 불필요한 표시가 없어야 합니다.
- passage와 options에 같은 내용이 불필요하게 중복되지 않아야 합니다.

4. 영어의 자연스러움과 의미
- 문법은 맞더라도 영어가 부자연스럽거나 의미가 이상하면 수정하세요.
- 학생이 문법이 아니라 상식 추측이나 어휘 모호성 때문에 답을 고르게 만들지 마세요.
- 시제, 시간 표현, 주어-동사 관계, 대명사 지시 대상, 논리적 문맥을 함께 확인하세요.

5. 학년 및 출제 범위
- 대상 학년 ${grade} 수준에 맞는 어휘와 문장 구조인지 확인하세요.
- 출제 범위 '${scope}'를 벗어난 지식이 정답 판단의 핵심이 되면 수정하세요.
- 난이도를 높이기 위해 범위 밖 문법을 요구하지 마세요.

6. 시험 전체 중복
- 앞뒤 문항과 사실상 같은 문장, 같은 정답 패턴, 같은 사고 과정이 과도하게 반복되면 뒤쪽 문항을 수정하세요.
- 단순히 주어/명사만 바꾼 사실상 동일한 문제도 중복으로 보세요.

7. 서술형
- 학생이 무엇을 써야 하는지 지시가 명확해야 합니다.
- answer가 실제 가능한 모범답인지 확인하세요.
- 정답이 여러 형태로 가능한 문제는 rubric에 허용 가능한 변형과 필수 요소가 반영되어야 합니다.
- 제시되지 않은 정보나 특정 단어를 억지로 추측해야만 답할 수 있는 문제는 수정하세요.

8. 해석 및 해설
- translation은 해당 영어 문장과 의미가 맞아야 합니다.
- explanation은 정답을 뒷받침해야 하며 잘못된 규칙이나 다른 문항의 설명이 섞이면 수정하세요.

# 수정 규칙
- 정상 문항은 revisions에 넣지 마세요.
- 수정할 때 id, type, difficulty, score는 원래 값을 반드시 유지하세요.
- 원래 출제하려던 핵심 문법 개념도 가능한 한 유지하세요.
- 문제 전체를 새로 갈아엎기보다 오류 원인을 제거하는 최소 수정이 우선입니다.
- multiple_choice는 options를 정확히 5개 유지하고 정답이 하나만 존재하게 하세요.
- essay는 options를 반드시 []로 유지하세요.
- 수정 후 answer, translation, explanation, rubric도 수정된 문제와 다시 일치시켜 주세요.
- HTML 태그를 사용하지 마세요.
- 객관식에는 밑줄형 문제를 새로 만들지 마세요.

# 출력
- 이상 없는 문항은 출력하지 마세요.
- 문제가 있는 문항만 revisions 배열에 넣고 correctedQuestion에 수정 완료된 전체 문항 객체를 넣으세요.
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
        temperature: 0.1
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
        console.warn(`YMS v29: ${id}번 검수 수정안은 구조 검증 실패로 원문을 유지합니다.`, error);
      }
    }

    return { data: output, applied };
  }

  window.renderExam = async function (data, grade, unitNum, unitTitle, scope, mcCount) {
    const loadingMsg = document.getElementById('loadingMsg');
    if (loadingMsg) {
      loadingMsg.classList.remove('hidden');
      loadingMsg.innerText = '1차 출제 완료 · AI가 전체 문항을 최종 검수 중입니다...';
    }

    try {
      const reviewResult = await requestReview(data, grade, unitNum, unitTitle, scope);
      const merged = mergeReviewedQuestions(data, reviewResult);
      console.info(`YMS v29 review: ${reviewResult.revisions.length}개 지적, ${merged.applied}개 수정 반영.`, reviewResult.summary || '');
      return originalRenderExam(merged.data, grade, unitNum, unitTitle, scope, mcCount);
    } catch (error) {
      console.warn('YMS v29 final review failed; rendering the locally validated exam.', error);
      return originalRenderExam(data, grade, unitNum, unitTitle, scope, mcCount);
    }
  };
})();
