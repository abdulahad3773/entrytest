// ============================================================
// EXAM ENGINE
// ============================================================
// Holds the state for one complete test attempt: the randomized
// sections/questions, the user's answers, per-question status,
// and scoring logic. This module has no knowledge of the DOM --
// it is pure state + logic, which keeps it easy to test and
// keeps app.js (the UI layer) simple.
//
// Supports two navigation modes:
//   - 'sequential' (FAST): sections are completed one at a time,
//     in order, each section is submitted before moving on.
//   - 'free' (NUST): the user can jump between any section at
//     any time; nothing is "submitted" until the whole exam is
//     submitted at once.
// ============================================================

const STATUS = {
  NOT_VISITED: 'not-visited',
  VISITED: 'visited',
  ANSWERED: 'answered',
  MARKED: 'marked',
};

class ExamEngine {
  /**
   * @param {Array} sections - [{ key, title, durationMinutes, marking, questions }]
   * @param {'sequential'|'free'} mode
   */
  constructor(sections, mode = 'sequential') {
    this.sections = sections;
    this.mode = mode;
    this.currentSectionIndex = 0;

    // Per-section runtime state: answers, status, current question pointer.
    // In 'free' mode, "submitted" is only ever set true for every section
    // at once, when the whole exam is submitted.
    this.sectionState = sections.map((section) => ({
      answers: new Array(section.questions.length).fill(null),
      status: new Array(section.questions.length).fill(STATUS.NOT_VISITED),
      currentQuestionIndex: 0,
      submitted: false,
    }));

    this.examSubmitted = false;
  }

  // ---------- Navigation ----------

  get currentSection() {
    return this.sections[this.currentSectionIndex];
  }

  get currentState() {
    return this.sectionState[this.currentSectionIndex];
  }

  get currentQuestion() {
    const state = this.currentState;
    return this.currentSection.questions[state.currentQuestionIndex];
  }

  /** Switches the active section (used by both modes; in 'sequential'
   * mode this only ever moves forward via advanceToNextSection). */
  switchToSection(index) {
    if (index < 0 || index >= this.sections.length) return;
    this.currentSectionIndex = index;
  }

  visitQuestion(index) {
    const state = this.currentState;
    const total = this.currentSection.questions.length;
    if (index < 0 || index >= total) return;

    state.currentQuestionIndex = index;
    if (state.status[index] === STATUS.NOT_VISITED) {
      state.status[index] = STATUS.VISITED;
    }
  }

  goNext() {
    const state = this.currentState;
    this.visitQuestion(state.currentQuestionIndex + 1);
  }

  goPrevious() {
    const state = this.currentState;
    this.visitQuestion(state.currentQuestionIndex - 1);
  }

  // ---------- Answering ----------

  selectAnswer(optionKey) {
    const state = this.currentState;
    const idx = state.currentQuestionIndex;
    state.answers[idx] = optionKey;
    state.status[idx] = STATUS.ANSWERED;
  }

  clearAnswer() {
    const state = this.currentState;
    const idx = state.currentQuestionIndex;
    state.answers[idx] = null;
    state.status[idx] = STATUS.VISITED;
  }

  toggleMarkForReview() {
    const state = this.currentState;
    const idx = state.currentQuestionIndex;
    if (state.status[idx] === STATUS.MARKED) {
      state.status[idx] = state.answers[idx] ? STATUS.ANSWERED : STATUS.VISITED;
    } else {
      state.status[idx] = STATUS.MARKED;
    }
  }

  // ---------- Section lifecycle (sequential / FAST mode) ----------

  /** True once every section has been submitted. */
  get isExamComplete() {
    return this.examSubmitted || this.sectionState.every((s) => s.submitted);
  }

  get isCurrentSectionSubmitted() {
    return this.currentState.submitted;
  }

  submitCurrentSection() {
    this.currentState.submitted = true;
  }

  /** Moves to the next section, if any. Returns false if this was the last section. */
  advanceToNextSection() {
    if (this.currentSectionIndex < this.sections.length - 1) {
      this.currentSectionIndex += 1;
      return true;
    }
    return false;
  }

  // ---------- Whole-exam lifecycle (free / NUST mode) ----------

  /** Marks every section submitted at once -- used to finalize a 'free' mode exam. */
  submitWholeExam() {
    this.sectionState.forEach((s) => { s.submitted = true; });
    this.examSubmitted = true;
  }

  /** Total answered / unattempted counts across all sections, for a progress summary. */
  get overallProgress() {
    let answered = 0;
    let total = 0;
    this.sections.forEach((section, i) => {
      total += section.questions.length;
      answered += this.sectionState[i].answers.filter((a) => a !== null).length;
    });
    return { answered, total };
  }

  // ---------- Scoring ----------

  /**
   * Computes the score for a single section, using that section's
   * own marking scheme (correct/wrong/unattempted point values).
   */
  scoreSection(sectionIndex) {
    const section = this.sections[sectionIndex];
    const state = this.sectionState[sectionIndex];
    const marking = section.marking;

    let correct = 0;
    let wrong = 0;
    let unattempted = 0;

    section.questions.forEach((q, i) => {
      const given = state.answers[i];
      if (given === null || given === undefined) {
        unattempted += 1;
      } else if (given === q.answer) {
        correct += 1;
      } else {
        wrong += 1;
      }
    });

    const score = correct * marking.correct + wrong * marking.wrong + unattempted * marking.unattempted;

    return {
      sectionKey: section.key,
      sectionTitle: section.title,
      total: section.questions.length,
      correct,
      wrong,
      unattempted,
      score: Math.round(score * 100) / 100,
    };
  }

  /** Computes the overall result across all sections. */
  computeFinalResult() {
    const sectionResults = this.sections.map((_, i) => this.scoreSection(i));

    const totals = sectionResults.reduce(
      (acc, r) => {
        acc.correct += r.correct;
        acc.wrong += r.wrong;
        acc.unattempted += r.unattempted;
        acc.total += r.total;
        acc.score += r.score;
        return acc;
      },
      { correct: 0, wrong: 0, unattempted: 0, total: 0, score: 0 }
    );

    totals.score = Math.round(totals.score * 100) / 100;

    // Max possible score: sum of (questionCount * correct marks) per section,
    // since different sections may award different points per correct answer.
    const maxPossible = sectionResults.reduce((sum, r, i) => {
      return sum + r.total * this.sections[i].marking.correct;
    }, 0);
    const percentage = maxPossible > 0 ? Math.round((totals.score / maxPossible) * 10000) / 100 : 0;

    return {
      sectionResults,
      totals,
      percentage,
      maxPossible: Math.round(maxPossible * 100) / 100,
    };
  }

  /**
   * Builds the full review data: every question across every
   * section, with the user's answer, the correct answer, and a
   * result classification for highlighting.
   */
  buildReviewData() {
    return this.sections.map((section, sIdx) => {
      const state = this.sectionState[sIdx];
      return {
        sectionKey: section.key,
        sectionTitle: section.title,
        questions: section.questions.map((q, qIdx) => {
          const given = state.answers[qIdx];
          let result;
          if (given === null || given === undefined) {
            result = 'unattempted';
          } else if (given === q.answer) {
            result = 'correct';
          } else {
            result = 'incorrect';
          }
          return {
            question: q.question,
            options: q.options,
            correctAnswer: q.answer,
            givenAnswer: given,
            result,
          };
        }),
      };
    });
  }
}
