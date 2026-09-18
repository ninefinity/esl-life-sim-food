'use strict';

const StageEating = {
  init() {
    this.dishEl = document.getElementById('eating-dish');
    this.titleEl = document.getElementById('eating-title');
    this.msgEl = document.getElementById('eating-msg');
    this.playAgainBtn = document.getElementById('eating-play-again');
    this.nextMealBtn = document.getElementById('eating-next-meal');

    this.playAgainBtn?.addEventListener('click', () => {
      clearConfetti();
      GameState.resetRun();
    });

    this.nextMealBtn?.addEventListener('click', () => {
      clearConfetti();
      GameState.resetRun();
    });
  },

  render() {
    const meal = DataMeals.getMeal(GameState.selectedMealId);
    if (!meal) return;

    if (this.titleEl) this.titleEl.textContent = 'Bon appétit!';
    if (this.dishEl) {
      this.dishEl.innerHTML = `
        <span class="eating-dish__emoji">🍽️</span>
        <h2>${escapeHtml(meal.label)}</h2>
      `;
    }
    if (this.msgEl) {
      this.msgEl.textContent = `You shopped, cooked, and made ${meal.label}. Well done!`;
    }

    spawnConfetti();
  },
};

window.StageEating = StageEating;
