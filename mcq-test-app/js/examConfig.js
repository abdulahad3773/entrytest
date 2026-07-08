// ============================================================
// EXAM CONFIGURATION
// ============================================================
// Central definition of both exam patterns (FAST and NUST). To
// change section order, question counts, timing, or marking
// scheme, edit this file only -- no other file needs to change.
//
// Each section defines its own marking scheme (correct / wrong /
// unattempted) since different patterns use different negative
// marking rules (e.g. FAST English uses +0.33/-0.08, while every
// other FAST section and all NUST sections use different values).
// ============================================================

window.EXAM_PATTERNS = {
  // ----------------------------------------------------------
  // FAST Entry Test: sections must be completed in order, each
  // with its own independent timer. Unused time is discarded
  // when moving to the next section.
  // ----------------------------------------------------------
  fast: {
    label: 'FAST Entry Test',
    mode: 'sequential', // sections completed one at a time, in order
    timerMode: 'per-section',
    sections: [
      {
        key: 'basic-math',
        title: 'Basic Mathematics',
        questionCount: 20,
        durationMinutes: 20,
        marking: { correct: 1, wrong: -0.25, unattempted: 0 },
      },
      {
        key: 'iq',
        title: 'IQ',
        questionCount: 20,
        durationMinutes: 20,
        marking: { correct: 1, wrong: -0.25, unattempted: 0 },
      },
      {
        key: 'english',
        title: 'English',
        questionCount: 30,
        durationMinutes: 30,
        marking: { correct: 0.33, wrong: -0.08, unattempted: 0 },
      },
      {
        key: 'advanced-math',
        title: 'Advanced Mathematics',
        questionCount: 50,
        durationMinutes: 50,
        marking: { correct: 1, wrong: -0.25, unattempted: 0 },
      },
    ],
    passPercentage: 50,
  },

  // ----------------------------------------------------------
  // NUST Entry Test: all sections are available at once, the
  // user can switch between them freely, and a single shared
  // countdown governs the entire exam.
  // ----------------------------------------------------------
  nust: {
    label: 'NUST Entry Test',
    mode: 'free', // user can move between sections at will
    timerMode: 'shared',
    totalDurationMinutes: 180,
    sections: [
      {
        key: 'advanced-math',
        title: 'Mathematics',
        questionCount: 100,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
      {
        key: 'physics',
        title: 'Physics',
        questionCount: 60,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
      {
        key: 'english',
        title: 'English',
        questionCount: 40,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
    ],
    passPercentage: null,
  },

  // ----------------------------------------------------------
  // MDCAT Mock Test: follows the official MDCAT distribution
  // (Biology / Chemistry / Physics / English / Logical Reasoning).
  // Like NUST, all sections are available at once with free
  // navigation and a single shared countdown timer. "Logical
  // Reasoning" draws from the same 'iq' question section already
  // used by FAST -- no separate question data needed.
  // ----------------------------------------------------------
  mdcat: {
    label: 'MDCAT Mock Test',
    mode: 'free', // user can move between sections at will
    timerMode: 'shared',
    totalDurationMinutes: 180,
    sections: [
      {
        key: 'biology',
        title: 'Biology',
        questionCount: 81,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
      {
        key: 'chemistry',
        title: 'Chemistry',
        questionCount: 45,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
      {
        key: 'physics',
        title: 'Physics',
        questionCount: 36,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
      {
        key: 'english',
        title: 'English',
        questionCount: 9,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
      {
        key: 'iq',
        title: 'Logical Reasoning',
        questionCount: 9,
        marking: { correct: 1, wrong: 0, unattempted: 0 },
      },
    ],
    passPercentage: null,
  },
};
