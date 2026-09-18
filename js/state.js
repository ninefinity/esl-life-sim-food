'use strict';

const STORAGE_KEY_UNLOCKED = 'unlockedShops';

const DEFAULT_UNLOCKED_STORES = {
  home: true,
  'corner-shop': true,
  supermarket: true,
  'farmers-market': true,
  'department-store': false,
  'frozen-goods': false,
  delicacies: false,
  bakery: false,
};

const GameState = {
  /** @type {1|2|3|4} */
  currentStage: 1,
  /** @type {string|null} */
  selectedCategory: null,
  /** @type {string|null} */
  selectedMealId: null,
  /** @type {{ id: string, [key: string]: unknown }|null} */
  selectedRecipe: null,
  /** @type {object[]} */
  requiredIngredients: [],
  /** @type {string[]} */
  requiredStores: [],
  /** @type {Record<string, boolean>} */
  unlockedStores: { ...DEFAULT_UNLOCKED_STORES },
  /** @type {string[]} */
  visitedStores: [],
  /** @type {Record<string, number>} */
  cart: {},
  /** @type {Record<string, number>} */
  purchasedIngredients: {},
  /** @type {Record<string, number>} notes and coins */
  wallet: {},
  /** @type {number} */
  miniGamesPlayed: 0,
  /** @type {number} */
  wordollarsEarned: 0,
  /** @type {string|null} */
  currentStore: null,
  /** @type {'map'|'store'|'checkout'|'games'} */
  shoppingPhase: 'map',
  /** @type {'reveal'|'locked'|'submitted'} */
  cookingPhase: 'reveal',
  /** @type {Record<number, string>} */
  cookingAnswers: {},
  /** @type {'easy'|'hard'} */
  cookingDifficulty: 'easy',

  /** @deprecated use unlockedStores */
  get unlockedShops() {
    return {
      corner: this.unlockedStores['corner-shop'],
      market: this.unlockedStores['farmers-market'],
      supermarket: this.unlockedStores.supermarket,
    };
  },

  getUnlockedStoreIds() {
    return Object.entries(this.unlockedStores)
      .filter(([, v]) => v)
      .map(([id]) => id);
  },

  migrateLegacyUnlocks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_UNLOCKED);
      if (!raw) return;
      const legacy = JSON.parse(raw);
      if (legacy.corner) this.unlockedStores['corner-shop'] = true;
      if (legacy.market) this.unlockedStores['farmers-market'] = true;
      if (legacy.supermarket) this.unlockedStores.supermarket = true;
      localStorage.removeItem(STORAGE_KEY_UNLOCKED);
      window.GamePersistence?.save();
    } catch {
      /* ignore */
    }
  },

  setStage(n) {
    this.currentStage = n;
    document.querySelectorAll('[data-stage]').forEach((el) => {
      el.classList.toggle('hidden', Number(el.dataset.stage) !== n);
    });
    window.dispatchEvent(new CustomEvent('stagechange', { detail: { stage: n } }));
  },

  setShoppingPhase(phase) {
    this.shoppingPhase = phase;
    window.dispatchEvent(new CustomEvent('shoppingphasechange', { detail: { phase } }));
  },

  selectCategory(category) {
    this.selectedCategory = category;
  },

  selectMeal(mealId) {
    this.selectedMealId = mealId;
  },

  unlockStore(storeId) {
    this.unlockedStores[storeId] = true;
    window.GamePersistence?.save();
  },

  persist() {
    window.GamePersistence?.save();
  },

  beginShoppingRun(mealId) {
    const meal = DataMeals.getMeal(mealId);
    if (!meal) return;

    this.selectedMealId = mealId;
    this.selectedRecipe = { id: mealId, ...meal };
    this.requiredIngredients = RecipeShopping.normalizeRequirements(meal);
    this.requiredStores = RecipeShopping.recomputeRequiredStores(
      this.requiredIngredients,
      {},
      this.getUnlockedStoreIds(),
    );
    this.visitedStores = [];
    this.cart = {};
    this.purchasedIngredients = {};
    this.currentStore = null;
    this.shoppingPhase = 'map';

    if (typeof WordWallet !== 'undefined') {
      if (WordWallet.hasFunds(this.wallet)) {
        this.wallet = WordWallet.normalizeWallet(this.wallet);
        WordWallet.rebalanceSkewedWallet(this.wallet);
      } else {
        WordWallet.seedInitialWallet();
      }
      WordWallet.ensureWalletForRun(this.selectedRecipe);
    }

    this.setStage(2);
  },

  recomputeRequiredStores() {
    this.requiredStores = RecipeShopping.recomputeRequiredStores(
      this.requiredIngredients,
      this.purchasedIngredients,
      this.getUnlockedStoreIds(),
    );
  },

  allIngredientsPurchased() {
    return RecipeShopping.allRequirementsMet(
      this.requiredIngredients,
      this.purchasedIngredients,
    );
  },

  /** Clears run progress; keeps unlockedStores and wallet. Returns to Stage 1. */
  resetRun() {
    this.selectedCategory = null;
    this.selectedMealId = null;
    this.selectedRecipe = null;
    this.requiredIngredients = [];
    this.requiredStores = [];
    this.visitedStores = [];
    this.cart = {};
    this.purchasedIngredients = {};
    this.currentStore = null;
    this.shoppingPhase = 'map';
    this.cookingPhase = 'reveal';
    this.cookingAnswers = {};
    this.setStage(1);
  },
};

window.GameState = GameState;
