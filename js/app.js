// ============================================================
// APP CONTROLLER
// ============================================================
// Wires the ExamEngine + SectionTimer to the DOM. Handles view
// routing for both exam patterns:
//   FAST: Home -> Section Intro -> Exam (sequential) -> ... -> Result -> Review
//   NUST: Home -> Exam (free navigation, shared timer) -> Result -> Review
// ============================================================

// ============================================================
// MATH RENDERING — Multi-Delimiter LaTeX Renderer
// ============================================================
// Supports all common LaTeX math delimiter styles found in the
// question data:
//   \(...\)   — inline math  (most common in this dataset)
//   \[...\]   — display/block math
//   $...$     — inline math  (alternate style)
//
// Everything outside delimiters is shown as plain readable text.
// No aggressive regex transforms — no blue coloring artifacts.
// ============================================================

/**
 * renderMath(element, text)
 *
 * Scans `text` for LaTeX math delimiters and renders each segment:
 *   - \(...\)  → KaTeX inline  math
 *   - \[...\]  → KaTeX display math
 *   - $...$    → KaTeX inline  math
 *   - everything else → plain text node (never mangled)
 */
function renderMath(element, text) {
  if (!element || text == null) return;

  // Tokenise the string into alternating plain-text / math segments.
  // Returns an array of {type:'text'|'inline'|'display', content:string}
  function tokenise(str) {
    const tokens = [];
    // Combined regex: \[...\], \(...\), or $...$
    // We use a single pass so delimiters don't nest or interfere.
    const re = /\\\[([^]*?)\\\]|\\\(([^]*?)\\\)|\$([^$]+)\$/g;
    let lastIndex = 0;
    let match;

    while ((match = re.exec(str)) !== null) {
      // Any plain text before this match
      if (match.index > lastIndex) {
        tokens.push({ type: 'text', content: str.slice(lastIndex, match.index) });
      }
      if (match[1] !== undefined) {
        // \[...\]  display math
        tokens.push({ type: 'display', content: match[1] });
      } else if (match[2] !== undefined) {
        // \(...\)  inline math
        tokens.push({ type: 'inline', content: match[2] });
      } else if (match[3] !== undefined) {
        // $...$    inline math
        tokens.push({ type: 'inline', content: match[3] });
      }
      lastIndex = re.lastIndex;
    }

    // Remaining plain text after last match
    if (lastIndex < str.length) {
      tokens.push({ type: 'text', content: str.slice(lastIndex) });
    }
    return tokens;
  }

  const tokens = tokenise(text);

  // If nothing math-like was found, just set plain text and return
  if (tokens.length === 1 && tokens[0].type === 'text') {
    element.textContent = text;
    return;
  }

  element.innerHTML = '';

  tokens.forEach(({ type, content }) => {
    if (type === 'text') {
      if (content) element.appendChild(document.createTextNode(content));
    } else {
      // Render math with KaTeX
      const mathSpan = document.createElement('span');
      mathSpan.className = type === 'display' ? 'math-display' : 'math-inline';
      try {
        if (typeof katex !== 'undefined') {
          katex.render(content, mathSpan, {
            throwOnError: false,
            displayMode: type === 'display',
            trust: false,
            strict: 'ignore',
          });
        } else {
          mathSpan.textContent = content;
        }
      } catch (err) {
        mathSpan.textContent = content;
        console.warn('KaTeX render failed:', err.message);
      }
      element.appendChild(mathSpan);
    }
  });
}
// ============================================================

const App = (() => {
  let exam = null;
  let timer = null;
  let finalResult = null;
  let currentPatternKey = null;
  let currentPattern = null;
  let isTestRunning = false;
  let fullscreenExitCount = 0;

  // ---------- View elements ----------
  const views = {
    home: document.getElementById("view-home"),
    exam: document.getElementById("view-exam"),
    sectionIntro: document.getElementById("view-section-intro"),
    result: document.getElementById("view-result"),
    review: document.getElementById("view-review"),
  };

  function showView(name) {
    Object.values(views).forEach((el) => el.classList.add("hidden"));
    views[name].classList.remove("hidden");
    window.scrollTo(0, 0);
  }

  // ---------- Home view ----------

function initHome() {
  // Start test buttons
  document
    .getElementById("start-fast-btn")
    .addEventListener("click", () => startExam("fast"));
  document
    .getElementById("start-nust-btn")
    .addEventListener("click", () => startExam("nust"));
  
  // Merit calculator buttons - clean floating images
  const fastMeritBtn = document.getElementById("fast-merit-btn");
  const nustMeritBtn = document.getElementById("nust-merit-btn");
  
  if (fastMeritBtn) {
    fastMeritBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = 'merit-calculator.html?univ=fast';
    });
  }
  
  if (nustMeritBtn) {
    nustMeritBtn.addEventListener("click", function(e) {
      e.preventDefault();
      e.stopPropagation();
      window.location.href = 'merit-calculator.html?univ=nust';
    });
  }
}

  function startExam(patternKey) {
    currentPatternKey = patternKey;
    currentPattern = window.EXAM_PATTERNS[patternKey];
    exam = new ExamEngine(
      QuestionBank.buildExam(patternKey),
      currentPattern.mode,
    );
    finalResult = null;
    fullscreenExitCount = 0;

    resetExamChrome();

    const examLogo = document.getElementById("exam-logo");
    if (examLogo) {
      examLogo.src = `data/${patternKey}.png`;
      examLogo.classList.remove("hidden");
    }

    if (currentPattern.mode === "sequential") {
      showSectionIntro();
    } else {
      beginFreeModeExam();
    }
  }

  // ---------- Section intro (FAST only -- shown before each section starts) ----------

  function showSectionIntro() {
    const section = exam.currentSection;
    const sectionNum = exam.currentSectionIndex + 1;
    const totalSections = exam.sections.length;

    document.getElementById("intro-section-name").textContent = section.title;
    document.getElementById("intro-section-progress").textContent =
      `Section ${sectionNum} of ${totalSections}`;
    document.getElementById("intro-question-count").textContent =
      section.questions.length;
    document.getElementById("intro-duration").textContent =
      section.durationMinutes;

    const beginBtn = document.getElementById("begin-section-btn");
    beginBtn.onclick = beginCurrentSection;

    showView("sectionIntro");
  }

  function beginCurrentSection() {
    renderExamShell();
    renderQuestion();
    renderPalette();
    startSectionTimer();
    isTestRunning = true;
    enterFullscreen();
    showView("exam");
  }

  // ---------- NUST: free-navigation mode setup ----------

  function beginFreeModeExam() {
    document.getElementById("section-tabs").classList.remove("hidden");
    document.getElementById("nust-overall-progress").classList.remove("hidden");
    document.getElementById("finish-section-btn").classList.add("hidden");
    document.getElementById("submit-exam-btn").classList.remove("hidden");
    document.getElementById("timer-label-text").textContent = "Total Time Left";

    exam.switchToSection(0);
    renderSectionTabs();
    renderExamShell();
    renderQuestion();
    renderPalette();
    renderOverallProgress();
    startSharedTimer();
    isTestRunning = true;
    enterFullscreen();
    showView("exam");
  }

  function renderSectionTabs() {
    const container = document.getElementById("section-tabs");
    container.innerHTML = "";

    exam.sections.forEach((section, i) => {
      const state = exam.sectionState[i];
      const answeredCount = state.answers.filter((a) => a !== null).length;

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className =
        "section-tab-btn" +
        (i === exam.currentSectionIndex ? " section-tab-active" : "");
      btn.innerHTML = `${section.title} <span class="section-tab-progress">(${answeredCount}/${section.questions.length})</span>`;
      btn.addEventListener("click", () => {
        exam.switchToSection(i);
        renderSectionTabs();
        renderExamShell();
        renderQuestion();
        renderPalette();
      });
      container.appendChild(btn);
    });
  }

  function renderOverallProgress() {
    const progress = exam.overallProgress;
    document.getElementById("overall-answered-count").textContent =
      progress.answered;
    document.getElementById("overall-total-count").textContent = progress.total;
  }

  // ---------- Timer ----------

  function startSectionTimer() {
    const section = exam.currentSection;
    timer = new SectionTimer(
      section.durationMinutes,
      (secondsLeft) => updateTimerDisplay(secondsLeft),
      () => onSectionTimeExpired(),
    );
    timer.start();
  }

  function startSharedTimer() {
    timer = new SectionTimer(
      currentPattern.totalDurationMinutes,
      (secondsLeft) => updateTimerDisplay(secondsLeft),
      () => onSharedTimeExpired(),
    );
    timer.start();
  }

  function updateTimerDisplay(secondsLeft) {
    const el = document.getElementById("timer-display");
    el.textContent = SectionTimer.formatTime(secondsLeft);
    el.classList.toggle("timer-low", secondsLeft <= 60);
  }

  function onSectionTimeExpired() {
    finishSection({ autoSubmitted: true });
  }

  function onSharedTimeExpired() {
    finishWholeExam();
  }

  // ---------- Exam shell / question rendering ----------

  function renderExamShell() {
    const section = exam.currentSection;
    const sectionNum = exam.currentSectionIndex + 1;
    const totalSections = exam.sections.length;

    document.getElementById("exam-section-title").textContent = section.title;
    document.getElementById("exam-section-progress").textContent =
      `Section ${sectionNum} of ${totalSections}`;
  }

  function renderQuestion() {
    const state = exam.currentState;
    const q = exam.currentQuestion;
    const idx = state.currentQuestionIndex;
    const total = exam.currentSection.questions.length;

    document.getElementById("question-number").textContent =
      `Question ${idx + 1} of ${total}`;
    
    const questionTextEl = document.getElementById("question-text");
    renderMath(questionTextEl, q.question);

    const optionsContainer = document.getElementById("options-container");
    optionsContainer.innerHTML = "";

    q.options.forEach((opt) => {
      const selected = state.answers[idx] === opt.key;

      const label = document.createElement("label");
      label.className = "option" + (selected ? " option-selected" : "");

      const input = document.createElement("input");
      input.type = "radio";
      input.name = "option";
      input.value = opt.key;
      input.checked = selected;
      input.addEventListener("change", () => {
        exam.selectAnswer(opt.key);
        renderQuestion();
        renderPalette();
        if (currentPattern.mode === "free") {
          renderSectionTabs();
          renderOverallProgress();
        }
      });

      const keySpan = document.createElement("span");
      keySpan.className = "option-key";
      keySpan.textContent = opt.key;

      const textSpan = document.createElement("span");
      textSpan.className = "option-text";
      renderMath(textSpan, opt.text);

      label.appendChild(input);
      label.appendChild(keySpan);
      label.appendChild(textSpan);
      optionsContainer.appendChild(label);
    });

    // Mark-for-review button state
    const markBtn = document.getElementById("mark-review-btn");
    markBtn.classList.toggle("btn-active", state.status[idx] === STATUS.MARKED);

    // Clear-answer button only useful if an answer is selected
    document.getElementById("clear-answer-btn").disabled =
      state.answers[idx] === null;

    // Prev/Next disabled states at the boundaries
    document.getElementById("prev-question-btn").disabled = idx === 0;
    document.getElementById("next-question-btn").disabled = idx === total - 1;
    
    // Auto-scroll palette to current question
    setTimeout(scrollPaletteToCurrentQuestion, 50);
  }

   function renderPalette() {
    const state = exam.currentState;
    const total = exam.currentSection.questions.length;
    const palette = document.getElementById("question-palette");
    palette.innerHTML = "";

    for (let i = 0; i < total; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "palette-btn palette-" + state.status[i];
      btn.textContent = i + 1;
      btn.title = `Question ${i + 1}: ${statusLabel(state.status[i])}`;
      if (i === state.currentQuestionIndex) {
        btn.classList.add("palette-current");
      }
      btn.addEventListener("click", () => {
        exam.visitQuestion(i);
        renderQuestion();
        renderPalette();
        // Scroll to current question after rendering
        setTimeout(scrollPaletteToCurrentQuestion, 50);
      });
      palette.appendChild(btn);
    }

    updatePaletteLegendCounts(state, total);
    
    // Auto-scroll to current question after rendering
    setTimeout(scrollPaletteToCurrentQuestion, 50);
  }

  function statusLabel(status) {
    switch (status) {
      case STATUS.NOT_VISITED:
        return "Not Visited";
      case STATUS.VISITED:
        return "Visited";
      case STATUS.ANSWERED:
        return "Answered";
      case STATUS.MARKED:
        return "Marked for Review";
      default:
        return "";
    }
  }

  function updatePaletteLegendCounts(state, total) {
    const counts = { answered: 0, marked: 0, visited: 0, notVisited: 0 };
    state.status.forEach((s) => {
      if (s === STATUS.ANSWERED) counts.answered++;
      else if (s === STATUS.MARKED) counts.marked++;
      else if (s === STATUS.VISITED) counts.visited++;
      else counts.notVisited++;
    });
    document.getElementById("count-answered").textContent = counts.answered;
    document.getElementById("count-marked").textContent = counts.marked;
    document.getElementById("count-visited").textContent = counts.visited;
    document.getElementById("count-not-visited").textContent =
      counts.notVisited;
  }

  // ---------- Question-level controls ----------

  function initExamControls() {
    document
      .getElementById("prev-question-btn")
      .addEventListener("click", () => {
        exam.goPrevious();
        renderQuestion();
        renderPalette();
      });

    document
      .getElementById("next-question-btn")
      .addEventListener("click", () => {
        exam.goNext();
        renderQuestion();
        renderPalette();
      });

    document
      .getElementById("clear-answer-btn")
      .addEventListener("click", () => {
        exam.clearAnswer();
        renderQuestion();
        renderPalette();
        if (currentPattern.mode === "free") {
          renderSectionTabs();
          renderOverallProgress();
        }
      });

    document.getElementById("mark-review-btn").addEventListener("click", () => {
      exam.toggleMarkForReview();
      renderQuestion();
      renderPalette();
    });

    document
      .getElementById("finish-section-btn")
      .addEventListener("click", () => {
        openConfirmModal();
      });

    document.getElementById("submit-exam-btn").addEventListener("click", () => {
      openSubmitExamModal();
    });
  }

  // ---------- Finish-section confirmation modal (FAST) ----------

  function openConfirmModal() {
    document.getElementById("confirm-modal").classList.remove("hidden");
  }

  function closeConfirmModal() {
    document.getElementById("confirm-modal").classList.add("hidden");
  }

  function initConfirmModal() {
    document
      .getElementById("confirm-cancel-btn")
      .addEventListener("click", closeConfirmModal);
    document
      .getElementById("confirm-finish-btn")
      .addEventListener("click", () => {
        closeConfirmModal();
        finishSection({ autoSubmitted: false });
      });
  }

  // ---------- Submit whole exam confirmation modal (NUST) ----------

  function openSubmitExamModal() {
    const progress = exam.overallProgress;
    const unanswered = progress.total - progress.answered;
    document.getElementById("submit-exam-summary").textContent =
      `You've answered ${progress.answered} of ${progress.total} questions` +
      (unanswered > 0 ? ` (${unanswered} unattempted).` : ".") +
      " You won't be able to change any answers after this.";
    document.getElementById("submit-exam-modal").classList.remove("hidden");
  }

  function closeSubmitExamModal() {
    document.getElementById("submit-exam-modal").classList.add("hidden");
  }

  function initSubmitExamModal() {
    document
      .getElementById("submit-exam-cancel-btn")
      .addEventListener("click", closeSubmitExamModal);
    document
      .getElementById("submit-exam-confirm-btn")
      .addEventListener("click", () => {
        closeSubmitExamModal();
        finishWholeExam();
      });
  }

  // ---------- Section finish / advance (FAST) ----------

  function finishSection({ autoSubmitted }) {
    if (timer) timer.stop();
    exam.submitCurrentSection();

    const hasMore = exam.advanceToNextSection();
    if (hasMore) {
      showSectionIntro();
    } else {
      isTestRunning = false;
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }
      renderResult();
    }
  }

  // ---------- Whole-exam finish (NUST) ----------

  function finishWholeExam() {
    isTestRunning = false;
    if (timer) timer.stop();
    exam.submitWholeExam();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    renderResult();
  }

  // ---------- Result view ----------

  function renderResult() {
    finalResult = exam.computeFinalResult();

    document.getElementById("result-total-score").textContent =
      finalResult.totals.score;
    document.getElementById("result-max-score").textContent =
      finalResult.maxPossible;
    document.getElementById("result-percentage").textContent =
      finalResult.percentage + "%";
    document.getElementById("result-correct").textContent =
      finalResult.totals.correct;
    document.getElementById("result-wrong").textContent =
      finalResult.totals.wrong;
    document.getElementById("result-unattempted").textContent =
      finalResult.totals.unattempted;

    const passBadge = document.getElementById("result-pass-badge");
    const passPercentage = currentPattern.passPercentage;
    if (passPercentage === null || passPercentage === undefined) {
      passBadge.classList.add("hidden");
    } else {
      const passed = finalResult.percentage >= passPercentage;
      passBadge.classList.remove("hidden");
      passBadge.textContent = passed ? "PASS" : "FAIL";
      passBadge.className = "pass-badge " + (passed ? "pass-yes" : "pass-no");
    }

    const sectionList = document.getElementById("result-section-list");
    sectionList.innerHTML = "";
    finalResult.sectionResults.forEach((r) => {
      const row = document.createElement("div");
      row.className = "section-result-row";
      row.innerHTML = `
        <div class="section-result-name">${r.sectionTitle}</div>
        <div class="section-result-stats">
          <span>Score: <strong>${r.score}</strong> / ${r.total}</span>
          <span class="stat-correct">${r.correct} correct</span>
          <span class="stat-wrong">${r.wrong} wrong</span>
          <span class="stat-unattempted">${r.unattempted} unattempted</span>
        </div>
      `;
      sectionList.appendChild(row);
    });

    // Pre-populate the calculator with this attempt's score
    setupAggregateForPattern(
      currentPatternKey,
      finalResult.totals.score,
      finalResult.maxPossible,
    );

    showView("result");
  }

  // ---------- Aggregate Calculator ----------

  function initAggregateCalculator() {
    // Recalculate whenever any input changes
    [
      "calc-matric-obt",
      "calc-matric-tot",
      "calc-fsc-obt",
      "calc-fsc-tot",
      "calc-test-obt",
      "calc-test-tot",
    ].forEach((id) => {
      document.getElementById(id).addEventListener("input", computeAggregate);
    });
  }

  function setupAggregateForPattern(patternKey, testScore, testMax) {
    const nameEl = document.getElementById("calc-university-name");
    const formulaEl = document.getElementById("calc-formula-desc");
    const testObtEl = document.getElementById("calc-test-obt");
    const testTotEl = document.getElementById("calc-test-tot");

    // Reset matric / fsc obtained to 0 (totals stay 1100); test score pre-filled from result
    document.getElementById("calc-matric-obt").value = 0;
    document.getElementById("calc-matric-tot").value = 1100;
    document.getElementById("calc-fsc-obt").value = 0;
    document.getElementById("calc-fsc-tot").value = 1100;
    testObtEl.value = testScore;
    testTotEl.value = testMax;

    if (patternKey === "nust") {
      nameEl.textContent = "NUST";
      formulaEl.textContent =
        "Formula: 10% Matric + 15% Intermediate + 75% NET Score";
    } else {
      nameEl.textContent = "FAST";
      formulaEl.textContent =
        "Formula: 10% Matric + 40% Intermediate + 50% Entry Test Score";
    }

    computeAggregate();
  }

  function computeAggregate() {
    const matricObt =
      parseFloat(document.getElementById("calc-matric-obt").value) || 0;
    const matricTot =
      parseFloat(document.getElementById("calc-matric-tot").value) || 1100;
    const fscObt =
      parseFloat(document.getElementById("calc-fsc-obt").value) || 0;
    const fscTot =
      parseFloat(document.getElementById("calc-fsc-tot").value) || 1100;
    const testObt =
      parseFloat(document.getElementById("calc-test-obt").value) || 0;
    const testTot =
      parseFloat(document.getElementById("calc-test-tot").value) || 1;

    const matricPct = matricTot > 0 ? (matricObt / matricTot) * 100 : 0;
    const fscPct = fscTot > 0 ? (fscObt / fscTot) * 100 : 0;
    const testPct = testTot > 0 ? (testObt / testTot) * 100 : 0;

    let aggregate;
    if (currentPatternKey === "nust") {
      // NUST: 75% NET + 15% Intermediate + 10% Matric
      aggregate = testPct * 0.75 + fscPct * 0.15 + matricPct * 0.1;
    } else {
      // FAST: 50% Entry Test + 40% FSc + 10% Matric
      aggregate = testPct * 0.5 + fscPct * 0.4 + matricPct * 0.1;
    }

    document.getElementById("calc-aggregate-value").textContent =
      aggregate.toFixed(2) + "%";
  }

  function initResultControls() {
    document
      .getElementById("view-review-btn")
      .addEventListener("click", renderReview);
    document
      .getElementById("retake-test-btn")
      .addEventListener("click", () => startExam(currentPatternKey));
    document
      .getElementById("choose-different-test-btn")
      .addEventListener("click", () => {
        if (timer) timer.stop();
        showView("home");
      });
    initAggregateCalculator();
  }

  // ---------- Review view ----------

  function renderReview() {
    const reviewData = exam.buildReviewData();
    const container = document.getElementById("review-container");
    container.innerHTML = "";

    reviewData.forEach((section) => {
      const sectionHeader = document.createElement("h3");
      sectionHeader.className = "review-section-title";
      sectionHeader.textContent = section.sectionTitle;
      container.appendChild(sectionHeader);

      section.questions.forEach((q, i) => {
        const card = document.createElement("div");
        card.className = "review-card review-" + q.result;

        const qHeader = document.createElement("div");
        qHeader.className = "review-question";

        const qNumber = document.createElement("span");
        qNumber.textContent = `${i + 1}. `;
        const qText = document.createElement("span");
        renderMath(qText, q.question);
        qHeader.appendChild(qNumber);
        qHeader.appendChild(qText);
        card.appendChild(qHeader);

        const optList = document.createElement("div");
        optList.className = "review-options";

        q.options.forEach((opt) => {
          const optDiv = document.createElement("div");
          let cls = "review-option";
          if (opt.key === q.correctAnswer) {
            cls += " review-option-correct";
          } else if (
            opt.key === q.givenAnswer &&
            q.givenAnswer !== q.correctAnswer
          ) {
            cls += " review-option-incorrect";
          }
          optDiv.className = cls;

          const optKey = document.createElement("span");
          optKey.textContent = `${opt.key}) `;
          const optText = document.createElement("span");
          renderMath(optText, opt.text);
          optDiv.appendChild(optKey);
          optDiv.appendChild(optText);
          optList.appendChild(optDiv);
        });
        card.appendChild(optList);

        const footer = document.createElement("div");
        footer.className = "review-footer";
        const givenText = q.givenAnswer ? q.givenAnswer : "—";
        footer.innerHTML = `
          <span>Your answer: <strong>${givenText}</strong></span>
          <span>Correct answer: <strong>${q.correctAnswer}</strong></span>
          <span class="review-tag review-tag-${q.result}">${reviewTagLabel(q.result)}</span>
        `;
        card.appendChild(footer);

        container.appendChild(card);
      });
    });

    showView("review");
  }

  function reviewTagLabel(result) {
    if (result === "correct") return "Correct";
    if (result === "incorrect") return "Incorrect";
    return "Unattempted";
  }

  function initReviewControls() {
    document
      .getElementById("back-to-result-btn")
      .addEventListener("click", () => showView("result"));
  }

  // ---------- Reset exam-view chrome between attempts ----------

  function resetExamChrome() {
    document.getElementById("section-tabs").classList.add("hidden");
    document.getElementById("section-tabs").innerHTML = "";
    document.getElementById("nust-overall-progress").classList.add("hidden");
    document.getElementById("finish-section-btn").classList.remove("hidden");
    document.getElementById("submit-exam-btn").classList.add("hidden");
    document.getElementById("timer-label-text").textContent = "Time Left";

    const examLogo = document.getElementById("exam-logo");
    if (examLogo) {
      examLogo.classList.add("hidden");
      examLogo.src = "";
    }
  }
  // ---------- Palette auto-scroll and expand ----------
  
  function scrollPaletteToCurrentQuestion() {
    const container = document.getElementById('palette-scroll-container');
    const palette = document.getElementById('question-palette');
    const currentBtn = palette?.querySelector('.palette-current');
    
    if (!container || !currentBtn) return;
    
    // Get the position of the current button relative to the container
    const containerRect = container.getBoundingClientRect();
    const btnRect = currentBtn.getBoundingClientRect();
    
    // Check if button is outside the visible area
    const isAbove = btnRect.top < containerRect.top;
    const isBelow = btnRect.bottom > containerRect.bottom;
    
    if (isAbove || isBelow) {
      // Calculate scroll position to center the button
      const scrollOffset = currentBtn.offsetTop - (container.clientHeight / 2) + (currentBtn.offsetHeight / 2);
      container.scrollTo({
        top: scrollOffset,
        behavior: 'smooth'
      });
    }
  }

  function initPaletteControls() {
    // Expand/Collapse palette
    const expandBtn = document.getElementById('palette-expand-btn');
    const paletteCard = document.querySelector('.palette-card');
    let isExpanded = false;
    
    if (expandBtn && paletteCard) {
      expandBtn.addEventListener('click', () => {
        isExpanded = !isExpanded;
        paletteCard.classList.toggle('expanded', isExpanded);
        expandBtn.textContent = isExpanded ? 'Collapse' : 'Expand';
        
        // If expanding, scroll to current question after animation
        if (isExpanded) {
          setTimeout(scrollPaletteToCurrentQuestion, 350);
        }
      });
    }
  }
  // ---------- Fullscreen Proctoring ----------

  function enterFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn("Fullscreen request rejected:", err);
      });
    }
  }

  function onFullscreenExitDetected() {
    if (!isTestRunning) return;
    if (exam && exam.isExamComplete) return;

    fullscreenExitCount++;

    if (fullscreenExitCount >= 5) {
      isTestRunning = false;
      document.getElementById("fullscreen-modal").classList.add("hidden");
      alert(
        "Test Ended: You exited fullscreen mode 5 times. Your current answers have been submitted.",
      );

      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      if (currentPatternKey === "fast") {
        exam.submitCurrentSection();
        while (exam.advanceToNextSection()) {
          exam.submitCurrentSection();
        }
        renderResult();
      } else {
        finishWholeExam();
      }
    } else {
      const modal = document.getElementById("fullscreen-modal");
      const text = document.getElementById("fullscreen-warning-text");
      if (modal && text) {
        text.innerHTML = `You must stay in fullscreen mode during the test. Exiting fullscreen is not allowed.<br><br><span style="color: var(--color-wrong); font-weight: 700;">Warning: Attempt ${fullscreenExitCount} of 5.</span> If you exit fullscreen again, your test will be ended automatically.`;
        modal.classList.remove("hidden");
      }
    }
  }

  function initFullscreenControls() {
    document.addEventListener("fullscreenchange", () => {
      if (isTestRunning && !document.fullscreenElement) {
        onFullscreenExitDetected();
      }
    });

    const resumeBtn = document.getElementById("fullscreen-resume-btn");
    if (resumeBtn) {
      resumeBtn.addEventListener("click", () => {
        document.getElementById("fullscreen-modal").classList.add("hidden");
        enterFullscreen();
      });
    }
  }

  // ---------- Init ----------

  function init() {
    initHome();
    initExamControls();
    initConfirmModal();
    initSubmitExamModal();
    initFullscreenControls();
    initResultControls();
    initReviewControls();
    initPaletteControls(); // <-- ADD THIS LINE
    showView("home");
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", App.init);