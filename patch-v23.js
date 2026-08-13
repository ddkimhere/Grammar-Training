(function () {
    'use strict';

    // v25: YMS Grammar Training output guards
    // 1) Single-blank questions must not show a stray (A) label or broken subject line.
    // 2) A~E sentence bundles must not show stray trailing 1~5 numbers.
    // 3) Exam header must include a handwritten date field.
    // 4) Generated exams must use a broad mix of question types.

    // ----- Exam header date field -----
    const examHeaderInfo = document.querySelector('#examSection header .text-right');
    if (examHeaderInfo && !document.getElementById('examDateField')) {
        const dateRow = document.createElement('div');
        dateRow.id = 'examDateField';
        dateRow.innerHTML = '날짜 <span class="inline-block w-28 border-b border-black">&nbsp;</span>';

        const scoreRow = examHeaderInfo.lastElementChild;
        if (scoreRow) {
            examHeaderInfo.insertBefore(dateRow, scoreRow);
        } else {
            examHeaderInfo.appendChild(dateRow);
        }
    }

    const originalFormatPassage = window.formatPassageForDisplay;

    if (typeof originalFormatPassage === 'function') {
        window.formatPassageForDisplay = function (question) {
            let passage = originalFormatPassage(question);
            passage = String(passage ?? '');

            // ----- Single blank cleanup -----
            const blankCount = (passage.match(/_{3,}/g) || []).length;
            if (blankCount === 1 && /\(A\)/.test(passage) && !/\(B\)/.test(passage)) {
                passage = passage.replace(/\s*\(A\)\s*/g, ' ');

                const isDialogue = /(?:^|\n)\s*[A-Z]\s*:/.test(passage);
                const isBundle = /(?:^|\n|\s)(?:\([A-E]\)|[A-E]\.)\s*/.test(passage);

                if (!isDialogue && !isBundle) {
                    passage = passage
                        .replace(/[ \t]*\n[ \t]*/g, ' ')
                        .replace(/[ \t]{2,}/g, ' ');
                }
            }

            // ----- A~E bundle trailing-number cleanup -----
            const lines = passage
                .split(/\n+/)
                .map(line => line.trim())
                .filter(Boolean);

            const numberedBundleLines = lines.filter(line =>
                /^(?:\([A-E]\)|[A-E]\.)\s+/.test(line) && /\s[1-5]\s*$/.test(line)
            );

            if (numberedBundleLines.length >= 2) {
                passage = lines
                    .map(line => {
                        if (/^(?:\([A-E]\)|[A-E]\.)\s+/.test(line)) {
                            return line.replace(/\s+[1-5]\s*$/, '');
                        }
                        return line;
                    })
                    .join('\n');
            }

            return passage
                .replace(/^\s*\n+/, '')
                .replace(/\n{2,}/g, '\n')
                .trim();
        };
    }

    // Strengthen Gemini instructions without rewriting the large app file.
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        const url = String(input ?? '');
        const isGemini = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');

        if (isGemini && init && typeof init.body === 'string') {
            try {
                const body = JSON.parse(init.body);
                const part = body?.contents?.[0]?.parts?.[0];

                // Add an internal question-style field to the structured output schema.
                // The renderer ignores this field, but Gemini uses it to plan a more varied exam.
                const questionSchema = body?.generationConfig?.responseSchema?.properties?.questions?.items;
                if (questionSchema?.properties) {
                    questionSchema.properties.questionStyle = {
                        type: 'STRING',
                        enum: [
                            'single_blank',
                            'context_blank',
                            'whole_sentence_judgment',
                            'sentence_count',
                            'correction_pair',
                            'dialogue_ab',
                            'sentence_bundle',
                            'same_meaning',
                            'sentence_transformation',
                            'word_order',
                            'matching',
                            'error_correction_essay',
                            'conditional_writing',
                            'sentence_combination_essay',
                            'transformation_essay',
                            'word_order_essay'
                        ]
                    };
                    if (Array.isArray(questionSchema.required) && !questionSchema.required.includes('questionStyle')) {
                        questionSchema.required.push('questionStyle');
                    }
                }

                if (part && typeof part.text === 'string') {
                    part.text += `\n\n# YMS 추가 출력 규칙\n- 빈칸이 정확히 1개인 문제에는 (A), (B) 같은 빈칸 번호를 절대 붙이지 마세요. 주어와 빈칸을 줄바꿈으로 분리하지 말고 하나의 자연스러운 문장으로 작성하세요. 예: We _____ the piano for three years.\n- A.~E. 또는 (A)~(E) 문장 묶음은 각 문장을 한 줄씩 작성하고, 각 문장 끝에 1, 2, 3, 4, 5 같은 순번 숫자를 절대 덧붙이지 마세요.\n\n# YMS 문제 유형 다양화 규칙\n- 각 questions 원소에 questionStyle을 반드시 지정하세요. questionStyle은 API 스키마에 정의된 값 중 하나만 사용하세요.\n- 같은 문법 범위 안에서도 시험 전체가 서로 다른 사고 방식을 요구하도록 출제하세요. 단순 빈칸 선택형과 단순 어법상 옳은/틀린 문장형에 치우치지 마세요.\n- 객관식이 15문항 이상이면 최소 8개의 서로 다른 questionStyle을 사용하세요. 객관식이 10~14문항이면 최소 6개, 6~9문항이면 최소 4개의 서로 다른 유형을 사용하세요.\n- 동일한 questionStyle은 객관식에서 최대 3문항까지만 사용하세요. 동일하거나 거의 같은 instruction 문구는 최대 2회까지만 허용하세요. 같은 유형을 3문제 연속 배치하지 마세요.\n- single_blank와 context_blank를 합친 빈칸형 문항은 전체 객관식의 30%를 넘기지 마세요. whole_sentence_judgment와 sentence_count도 합쳐서 전체 객관식의 35%를 넘기지 마세요.\n- 출제 범위에 적합한 경우 다음 유형을 적극적으로 섞으세요: 단일 빈칸 선택, 문맥 속 형태 선택, 문장 전체 어법 판단, 옳은/틀린 문장 개수, 틀린 표현→고친 표현 수정쌍, 대화문 (A)/(B), A~E 복수 문장 판단, 같은 의미 문장 찾기, 문장 전환, 어순 배열·문장 완성, 두 표현/문장 대응·짝짓기.\n- 단, 문법 범위에 맞지 않는 유형을 억지로 만들지 마세요. 범위 안에서 가능한 유형 중 최대한 다양하게 선택하세요.\n- 문항의 표면 문장만 바꾸고 풀이 방식이 같은 문제를 다른 유형으로 간주하지 마세요. 학생이 실제로 다른 방식으로 생각해야 questionStyle을 다르게 지정할 수 있습니다.\n- 객관식의 난이도 상 문항은 단순 형태 선택보다 sentence_count, sentence_bundle, dialogue_ab, same_meaning, sentence_transformation, correction_pair처럼 2단계 이상 판단이 필요한 유형을 우선하세요.\n- 서술형도 한 유형으로 반복하지 마세요. 서술형이 5문항 이상이면 최소 4종류를 사용하고, 3~4문항이면 최소 3종류를 사용하세요. error_correction_essay, conditional_writing, sentence_combination_essay, transformation_essay, word_order_essay를 범위에 맞게 섞으세요.\n- 서술형에서 조건 영작만 연속으로 출제하지 말고, 틀린 부분 고치기, 문장 결합, 문장 전환, 어순 배열 후 완성, 주어진 조건을 반영한 영작을 골고루 배치하세요.\n- 최종 JSON을 출력하기 전에 전체 questions의 questionStyle 분포를 스스로 점검하고 위 다양성 기준을 충족하도록 중복 유형을 교체하세요.\n`;
                    init = { ...init, body: JSON.stringify(body) };
                }
            } catch (e) {
                console.warn('YMS v25 prompt guard could not modify request.', e);
            }
        }

        return originalFetch(input, init);
    };
})();