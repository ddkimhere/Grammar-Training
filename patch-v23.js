(function () {
    'use strict';

    // v23: YMS Grammar Training output guards
    // 1) Single-blank questions must not show a stray (A) label or broken subject line.
    // 2) A~E sentence bundles must not show stray trailing 1~5 numbers.

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

    // Also strengthen Gemini instructions without rewriting the large app file.
    const originalFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
        const url = String(input ?? '');
        const isGemini = url.includes('generativelanguage.googleapis.com') && url.includes(':generateContent');

        if (isGemini && init && typeof init.body === 'string') {
            try {
                const body = JSON.parse(init.body);
                const part = body?.contents?.[0]?.parts?.[0];
                if (part && typeof part.text === 'string') {
                    part.text += `\n\n# YMS 추가 출력 규칙\n- 빈칸이 정확히 1개인 문제에는 (A), (B) 같은 빈칸 번호를 절대 붙이지 마세요. 주어와 빈칸을 줄바꿈으로 분리하지 말고 하나의 자연스러운 문장으로 작성하세요. 예: We _____ the piano for three years.\n- A.~E. 또는 (A)~(E) 문장 묶음은 각 문장을 한 줄씩 작성하고, 각 문장 끝에 1, 2, 3, 4, 5 같은 순번 숫자를 절대 덧붙이지 마세요.\n`;
                    init = { ...init, body: JSON.stringify(body) };
                }
            } catch (e) {
                console.warn('YMS v23 prompt guard could not modify request.', e);
            }
        }

        return originalFetch(input, init);
    };
})();