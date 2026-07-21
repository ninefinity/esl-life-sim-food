'use strict';

const STORAGE_KEY_UNLOCKED = 'unlockedShops';

const DEFAULT_UNLOCKED = {
  corner: true,
  market: false,
  supermarket: false,
};

function loadUnlockedShops() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_UNLOCKED);
    if (!raw) return { ...DEFAULT_UNLOCKED };
    return { ...DEFAULT_UNLOCKED, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_UNLOCKED };
  }
}

function saveUnlockedShops(unlocked) {
  localStorage.setItem(STORAGE_KEY_UNLOCKED, JSON.stringify(unlocked));
}

const GameState = {
  /** @type {1|2|3|4|5} */
  currentStage: 1,
  /** @type {string|null} breakfast|lunch|dinner|snack|dessert|surprise */
  selectedCategory: null,
  /** @type {string|null} meal id from meals.json */
  selectedMealId: null,
  /** @type {'corner'|'market'|'supermarket'|null} */
  selectedShop: null,
  unlockedShops: loadUnlockedShops(),
  /** @type {{ id: string }[]} shopping cart (Stage 3) */
  cart: [],
  /** @type {'reveal'|'locked'|'submitted'} cooking sub-phase */
  cookingPhase: 'reveal',
  /** @type {Record<number, string>} stepIndex -> chosen verb */
  cookingAnswers: {},
  /** @type {'easy'|'hard'} easy=drag-drop; hard=typed (stub) */
  cookingDifficulty: 'easy',

  setStage(n) {
    this.currentStage = n;
    document.querySelectorAll('[data-stage]').forEach((el) => {
      el.classList.toggle('hidden', Number(el.dataset.stage) !== n);
    });
    window.dispatchEvent(new CustomEvent('stagechange', { detail: { stage: n } }));
  },

  selectCategory(category) {
    this.selectedCategory = category;
  },

  selectMeal(mealId) {
    this.selectedMealId = mealId;
  },

  selectShop(shopId) {
    this.selectedShop = shopId;
  },

  unlockShop(shopId) {
    this.unlockedShops[shopId] = true;
    saveUnlockedShops(this.unlockedShops);
  },

  /** Clears run progress; keeps unlockedShops. Returns to Stage 1. */
  resetRun() {
    this.selectedCategory = null;
    this.selectedMealId = null;
    this.selectedShop = null;
    this.cart = [];
    this.cookingPhase = 'reveal';
    this.cookingAnswers = {};
    this.setStage(1);
  },
};

window.GameState = GameState;
