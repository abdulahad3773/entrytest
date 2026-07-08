# Entry Test Practice — MCQ Testing Website

A simple, self-contained MCQ testing website for FAST-NUCES & NUST entry
test preparation, built with plain HTML, CSS and JavaScript (no build
tools, no backend, no database). Supports two distinct exam patterns
from a single shared question bank.

## How to use it

Just open `index.html` in any modern browser. That's it — everything
runs on the client side.

## Exam patterns

### FAST Entry Test (sequential)

| Section              | Questions | Time     | Marking              |
|-----------------------|-----------|----------|------------------------|
| Basic Mathematics     | 20        | 20 min   | +1 / −0.25 / 0         |
| IQ                    | 20        | 20 min   | +1 / −0.25 / 0         |
| English               | 30        | 30 min   | +0.33 / −0.08 / 0      |
| Advanced Mathematics  | 50        | 50 min   | +1 / −0.25 / 0         |

- Sections must be completed **in order**, one at a time.
- Each section has its own independent timer. Finishing early does
  **not** carry unused time over to the next section.
- If a section's timer hits zero, it is auto-submitted (unanswered
  questions count as unattempted) and the test moves to the next section.
- Pass mark: 50% (shown as PASS/FAIL on the result page).

### NUST Entry Test (free navigation)

| Section      | Questions | Marking        |
|--------------|-----------|----------------|
| Mathematics  | 100       | +1 / 0 / 0     |
| Physics      | 60        | +1 / 0 / 0     |
| English      | 40        | +1 / 0 / 0     |

- All three sections are available at once; the user can switch between
  them freely via tabs at any time, in any order.
- **One shared 180-minute timer** governs the entire exam (not
  per-section). When it expires, the whole exam auto-submits.
- No negative marking.
- No pass/fail indicator (NUST result page omits it).

Both patterns randomly select and shuffle questions (and each
question's options) on every new attempt.

## Project structure

```
index.html              All views (Home, Section Intro, Exam, Result, Review) -- shared by both patterns
css/style.css            All styling
js/
  questionData.js        Question bank, embedded as a JS object (generated file)
  examConfig.js           Both exam patterns: sections, question counts, timers, marking
  questionBank.js         Random question/option selection logic (pattern-aware)
  timer.js                Reusable countdown timer (used for both per-section and shared timers)
  examEngine.js            Test-attempt state, navigation (sequential + free modes), and scoring
  app.js                  DOM rendering / view routing — wires everything together
data/
  questions.json          The full merged question bank as plain JSON (source of truth)
build-questions.js         Script that regenerates js/questionData.js from data/questions.json
```

## How the question bank works

`data/questions.json` is the human-editable source of truth, organized
into five sections:

```json
{
  "basic-math": [ ... ],
  "iq": [ ... ],
  "advanced-math": [ ... ],
  "physics": [ ... ],
  "english": [ ... ]
}
```

Each question looks like:

```json
{
  "id": "advanced-math-142",
  "question": "...",
  "options": [
    { "key": "A", "text": "..." },
    { "key": "B", "text": "..." },
    { "key": "C", "text": "..." },
    { "key": "D", "text": "..." }
  ],
  "answer": "C"
}
```

Both exam patterns draw from the **same five sections** -- FAST and
NUST never have separate question banks, only different exam patterns
(question counts, timing, marking, navigation) layered on top of the
same data. For example, both `fast.advanced-math` (50 questions) and
`nust.advanced-math` (100 questions) randomly draw from the single
`advanced-math` array in `questions.json`.

The browser can't `fetch()` a local JSON file when the site is opened
directly from disk (no `file://` CORS access), so the app actually
loads its data from `js/questionData.js` — a generated file that just
assigns the same JSON to `window.QUESTION_BANK`.

### Adding or editing questions

1. Edit `data/questions.json` directly (add new question objects, fix
   text, etc.) — each section is just an array, so you can add or
   remove entries freely. Keep the same shape: `id`, `question`,
   `options` (exactly 4, keys A–D), and `answer` (must match one of the
   option keys).
2. Regenerate the file the app actually loads:
   ```
   node build-questions.js
   ```
3. Refresh `index.html` in your browser. No other code needs to change.

### Adjusting an exam pattern (question counts, timing, marking)

Edit `js/examConfig.js` — `window.EXAM_PATTERNS.fast` or `.nust`. Each
section entry has its own `marking` object (`correct` / `wrong` /
`unattempted` point values), so different sections within the same
pattern can use different marking schemes (e.g. FAST's English section
uses +0.33/−0.08 while its other sections use +1/−0.25). FAST sections
also need `durationMinutes` (per-section timer); NUST sections don't,
since NUST uses a single `totalDurationMinutes` shared timer instead.

### Adding a brand-new section

1. Add a new key (e.g. `"chemistry"`) to `data/questions.json` with its
   own array of questions, then regenerate `questionData.js`.
2. Add a matching entry to the relevant pattern's `sections` array in
   `js/examConfig.js`, e.g. for FAST:
   ```js
   {
     key: 'chemistry',
     title: 'Chemistry',
     questionCount: 20,
     durationMinutes: 20,
     marking: { correct: 1, wrong: -0.25, unattempted: 0 },
   }
   ```

The app will automatically include it in the test flow, palette,
scoring, and result/review pages — no other file needs to change.

## Notes on the source question bank

Questions were extracted from two uploaded documents. Questions with no
definitive answer key entry, an answer key referencing an option
outside A–D, or options that were corrupted/duplicated in the source
(a known OCR artifact, e.g. two options sharing identical text) were
excluded so that every question in the app has an unambiguous,
gradable correct answer. No questions depend on missing images,
figures, or diagrams. Final usable counts per section: **65 Basic
Mathematics**, **50 IQ**, **296 Advanced Mathematics** (original +
merged-in Math from the second document), **198 Physics**, and **44
English** — comfortably covering both exam patterns' question
requirements (FAST's largest section needs 50; NUST's largest needs
100).

### MDCAT Mock Test (free navigation)

| Section            | Questions | Marking    |
|---------------------|-----------|------------|
| Biology              | 81        | +1 / 0 / 0 |
| Chemistry            | 45        | +1 / 0 / 0 |
| Physics              | 36        | +1 / 0 / 0 |
| English              | 9         | +1 / 0 / 0 |
| Logical Reasoning    | 9         | +1 / 0 / 0 |

- Total: **180 MCQs**, matching the official MDCAT distribution
  (45% Biology, 25% Chemistry, 20% Physics, 5% English, 5% Logical
  Reasoning).
- Free navigation, just like NUST: all subjects available at once,
  switch freely, jump to any question via the palette.
- **One shared 180-minute timer** for the whole exam.
- No negative marking.
- No pass/fail indicator (like NUST).
- "Logical Reasoning" reuses the existing `iq` question section --
  no separate question data was added.

Add MDCAT was implemented purely by adding a new `mdcat` entry to
`js/examConfig.js` (the same shape as `fast`/`nust`) plus a matching
card and Start button on the Home view. No other file needed
pattern-specific changes, since `questionBank.js`, `examEngine.js`,
and the "free navigation" rendering path in `app.js` were already
generic across patterns.
