'use strict';

const StageCooking = {
  /** @type {string|null} verb chip armed by tap, waiting for a blank */
  selectedVerb: null,

  init() {
    this.recipeEl = document.getElementById('cooking-recipe');
    this.verbBankEl = document.getElementById('cooking-verb-bank');
    this.readyBtn = document.getElementById('cooking-ready-btn');
    this.submitBtn = document.getElementById('cooking-submit-btn');
    this.feedbackEl = document.getElementById('cooking-feedback');

    this.readyBtn?.addEventListener('click', () => {
      if (GameState.cookingPhase !== 'reveal') return;
      GameState.cookingPhase = 'locked';
      this.render();
    });

    this.submitBtn?.addEventListener('click', () => this.submit());

    this.verbBankEl?.addEventListener('dragstart', (e) => {
      const chip = e.target.closest('.verb-chip');
      if (!chip) return;
      e.dataTransfer.setData('text/plain', chip.dataset.verb);
    });

    // Tap to arm a verb, then tap a blank — drag-and-drop never fires on touch.
    this.verbBankEl?.addEventListener('click', (e) => {
      const chip = e.target.closest('.verb-chip');
      if (!chip || GameState.cookingPhase !== 'locked') return;
      const verb = chip.dataset.verb;
      this.selectVerb(this.selectedVerb === verb ? null : verb);
    });

    this.recipeEl?.addEventListener('click', (e) => {
      const blank = e.target.closest('.recipe-blank');
      if (!blank || GameState.cookingPhase !== 'locked') return;
      const stepIndex = Number(blank.dataset.step);
      if (this.selectedVerb) {
        this.placeVerb(stepIndex, this.selectedVerb);
        this.selectVerb(null);
      } else if (GameState.cookingAnswers[stepIndex]) {
        this.clearBlank(stepIndex);
      }
    });

    this.recipeEl?.addEventListener('dragover', (e) => {
      const blank = e.target.closest('.recipe-blank');
      if (!blank || GameState.cookingPhase !== 'locked') return;
      e.preventDefault();
    });

    this.recipeEl?.addEventListener('drop', (e) => {
      const blank = e.target.closest('.recipe-blank');
      if (!blank || GameState.cookingPhase !== 'locked') return;
      e.preventDefault();
      const verb = e.dataTransfer.getData('text/plain');
      if (!verb) return;
      this.placeVerb(Number(blank.dataset.step), verb);
      this.selectVerb(null);
    });
  },

  enter() {
    GameState.cookingPhase = 'reveal';
    GameState.cookingAnswers = {};
    this.selectedVerb = null;
    this.render();
  },

  selectVerb(verb) {
    this.selectedVerb = verb;
    this.verbBankEl?.querySelectorAll('.verb-chip').forEach((chip) => {
      const on = chip.dataset.verb === verb;
      chip.classList.toggle('verb-chip--selected', on);
      chip.setAttribute('aria-pressed', String(on));
    });
  },

  blankEl(stepIndex) {
    return this.recipeEl?.querySelector(`.recipe-blank[data-step="${stepIndex}"]`);
  },

  placeVerb(stepIndex, verb) {
    GameState.cookingAnswers[stepIndex] = verb;
    const blank = this.blankEl(stepIndex);
    if (!blank) return;
    blank.textContent = verb;
    blank.classList.add('recipe-blank--filled');
  },

  clearBlank(stepIndex) {
    delete GameState.cookingAnswers[stepIndex];
    const blank = this.blankEl(stepIndex);
    if (!blank) return;
    blank.textContent = '___';
    blank.classList.remove('recipe-blank--filled');
  },

  /** Split a step around its verb so the blank lands on the verb, not word one. */
  splitStepAroundVerb(text, verb) {
    const escaped = String(verb).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`\\b${escaped}\\b`, 'i').exec(text);
    if (match) {
      return {
        before: text.slice(0, match.index),
        after: text.slice(match.index + match[0].length),
      };
    }
    const firstWord = /^\w+/.exec(text);
    if (!firstWord) return { before: text, after: '' };
    return { before: '', after: text.slice(firstWord[0].length) };
  },

  render() {
    const meal = DataMeals.getMeal(GameState.selectedMealId);
    if (!meal || !this.recipeEl) return;

    this.feedbackEl.textContent = '';
    this.feedbackEl.className = 'cooking-feedback';

    const phase = GameState.cookingPhase;
    this.readyBtn?.classList.toggle('hidden', phase !== 'reveal');
    this.submitBtn?.classList.toggle('hidden', phase !== 'locked');
    this.verbBankEl?.classList.toggle('hidden', phase === 'reveal' || phase === 'submitted');

    if (phase === 'reveal') {
      this.recipeEl.innerHTML = meal.recipeSteps.map((step, i) => (
        `<li class="recipe-step">${escapeHtml(step.text)}</li>`
      )).join('');
    } else if (phase === 'locked') {
      this.recipeEl.innerHTML = meal.recipeSteps.map((step, i) => {
        const { before, after } = this.splitStepAroundVerb(step.text, step.verb);
        const answer = GameState.cookingAnswers[i] || '';
        return `<li class="recipe-step">
          ${escapeHtml(before)}
          <button type="button" class="recipe-blank${answer ? ' recipe-blank--filled' : ''}" data-step="${i}" aria-label="Verb for step ${i + 1}">${escapeHtml(answer) || '___'}</button>
          ${escapeHtml(after)}
        </li>`;
      }).join('');
      this.renderVerbBank(meal);
    } else if (phase === 'submitted') {
      this.recipeEl.innerHTML = meal.recipeSteps.map((step, i) => {
        const userAnswer = GameState.cookingAnswers[i] || '';
        const correct = userAnswer.toLowerCase() === step.verb.toLowerCase();
        return `<li class="recipe-step recipe-step--${correct ? 'correct' : 'wrong'}">
          ${escapeHtml(step.text)}
          ${correct ? ' ✓' : ` ✗ (you wrote: ${escapeHtml(userAnswer)})`}
        </li>`;
      }).join('');
    }

    // TODO: hard mode — replace drag-drop blanks with typed text inputs
    if (GameState.cookingDifficulty === 'hard') {
      // stub for typed input mode
    }
  },

  renderVerbBank(meal) {
    if (!this.verbBankEl) return;
    const verbs = [...new Set(meal.recipeSteps.map((s) => s.verb))];
    const decoys = shuffle(Object.keys(DataMeals.verbs).filter((v) => !verbs.includes(v))).slice(0, 2);
    const allVerbs = shuffle([...verbs, ...decoys]);

    this.verbBankEl.innerHTML = allVerbs.map((verb) => (
      `<button type="button" class="verb-chip" draggable="true" aria-pressed="false" data-verb="${escapeHtml(verb)}">${escapeHtml(verb)}</button>`
    )).join('');
    this.selectVerb(this.selectedVerb);
  },

  submit() {
    const meal = DataMeals.getMeal(GameState.selectedMealId);
    if (!meal) return;

    const allCorrect = meal.recipeSteps.every((step, i) => {
      const answer = (GameState.cookingAnswers[i] || '').toLowerCase();
      return answer === step.verb.toLowerCase();
    });

    GameState.cookingPhase = 'submitted';
    this.selectedVerb = null;
    this.render();

    if (allCorrect) {
      this.feedbackEl.textContent = 'Great job! Your recipe is correct.';
      this.feedbackEl.classList.add('cooking-feedback--success');
      window.setTimeout(() => GameState.setStage(4), 1500);
    } else {
      this.feedbackEl.textContent = 'Some verbs are wrong. Fix them and try again.';
      this.feedbackEl.classList.add('cooking-feedback--error');
      window.setTimeout(() => {
        GameState.cookingPhase = 'locked';
        this.render();
      }, 2000);
    }
  },
};

window.StageCooking = StageCooking;
