// ============================================================
// QUESTION BANK MANAGER
// ============================================================
// Responsible for reading the raw question bank data and
// producing a randomized, shuffled set of questions for a new
// test attempt. Keeping this logic separate means new question
// files can be added later (see questionData.js) without
// touching any other part of the app. Works for both the FAST
// and NUST exam patterns since both are just lists of sections
// with a question count.
// ============================================================

const QuestionBank = (() => {
  /**
   * Fisher-Yates shuffle. Returns a new array; does not mutate input.
   */
  function shuffle(array) {
    const result = array.slice();
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Returns `count` random questions from the named section.
   * Each question's options are also shuffled, and a deep copy
   * is returned so the original bank is never mutated.
   */
  function pickRandomQuestions(sectionKey, count) {
    const allQuestions = window.QUESTION_BANK[sectionKey] || [];

    if (allQuestions.length === 0) {
      console.warn(`No questions found for section "${sectionKey}".`);
      return [];
    }

    if (allQuestions.length < count) {
      console.warn(
        `Section "${sectionKey}" has only ${allQuestions.length} usable questions ` +
        `(requested ${count}). Using all available questions instead.`
      );
    }

    const selectedCount = Math.min(count, allQuestions.length);
    const chosen = shuffle(allQuestions).slice(0, selectedCount);

    // Deep-copy and shuffle each question's options independently
    // so option order also varies between attempts.
    return chosen.map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      options: shuffle(q.options),
    }));
  }

  /**
   * Builds a full randomized exam for the given pattern key
   * ('fast' or 'nust'), following window.EXAM_PATTERNS. Each
   * returned section carries its own marking scheme so the
   * scoring engine doesn't need pattern-specific logic.
   */
  function buildExam(patternKey) {
    const pattern = window.EXAM_PATTERNS[patternKey];
    if (!pattern) {
      throw new Error(`Unknown exam pattern "${patternKey}"`);
    }

    return pattern.sections.map((sectionDef) => ({
      key: sectionDef.key,
      title: sectionDef.title,
      durationMinutes: sectionDef.durationMinutes || null,
      marking: sectionDef.marking,
      questions: pickRandomQuestions(sectionDef.key, sectionDef.questionCount),
    }));
  }

  return { buildExam, shuffle };
})();
