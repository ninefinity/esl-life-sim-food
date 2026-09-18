'use strict';

const StageCooking = {
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
      const stepIndex = Number(blank.dataset.step);
      GameState.cookingAnswers[stepIndex] = verb;
      blank.textContent = verb;
      blank.classList.add('recipe-blank--filled');
    });
  },

  enter() {
    GameState.cookingPhase = 'reveal';
    GameState.cookingAnswers = {};
    this.render();
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
        const blanked = step.text.replace(/^\w+/, '___');
        const answer = GameState.cookingAnswers[i] || '';
        return `<li class="recipe-step">
          ${escapeHtml(blanked.split('___')[0])}
          <span class="recipe-blank${answer ? ' recipe-blank--filled' : ''}" data-step="${i}">${escapeHtml(answer) || '___'}</span>
          ${escapeHtml(blanked.split('___')[1] || '')}
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
      `<span class="verb-chip" draggable="true" data-verb="${escapeHtml(verb)}">${escapeHtml(verb)}</span>`
    )).join('');
  },

  submit() {
    const meal = DataMeals.getMeal(GameState.selectedMealId);
    if (!meal) return;

    const allCorrect = meal.recipeSteps.every((step, i) => {
      const answer = (GameState.cookingAnswers[i] || '').toLowerCase();
      return answer === step.verb.toLowerCase();
    });

    GameState.cookingPhase = 'submitted';
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
