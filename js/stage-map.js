'use strict';

const STORE_ANCHORS = {
  home: { x: 100, y: 95 },
  'corner-shop': { x: 360, y: 95 },
  'department-store': { x: 480, y: 95 },
  'frozen-goods': { x: 95, y: 245 },
  delicacies: { x: 95, y: 385 },
  supermarket: { x: 395, y: 400 },
  'farmers-market': { x: 660, y: 95 },
  bakery: { x: 680, y: 400 },
  'word-games': { x: 220, y: 445 },
};

const TRAVEL_PATHS = {
  'corner-shop': [{ x: 100, y: 95 }, { x: 100, y: 173 }, { x: 360, y: 173 }, { x: 360, y: 95 }],
  'department-store': [{ x: 100, y: 95 }, { x: 100, y: 173 }, { x: 480, y: 173 }, { x: 480, y: 95 }],
  'frozen-goods': [{ x: 100, y: 95 }, { x: 100, y: 173 }, { x: 95, y: 173 }, { x: 95, y: 245 }],
  delicacies: [{ x: 100, y: 95 }, { x: 100, y: 313 }, { x: 95, y: 313 }, { x: 95, y: 385 }],
  supermarket: [{ x: 100, y: 95 }, { x: 100, y: 453 }, { x: 395, y: 453 }, { x: 395, y: 400 }],
  'farmers-market': [{ x: 100, y: 95 }, { x: 273, y: 95 }, { x: 273, y: 173 }, { x: 660, y: 173 }, { x: 660, y: 95 }],
  bakery: [{ x: 100, y: 95 }, { x: 100, y: 453 }, { x: 680, y: 453 }, { x: 680, y: 400 }],
  'word-games': [{ x: 100, y: 95 }, { x: 100, y: 453 }, { x: 220, y: 453 }, { x: 220, y: 445 }],
};

const StageMap = {
  traveling: false,
  lowBalanceDismissed: false,

  init() {
    this.mapView = document.getElementById('town-map-view');
    this.storeView = document.getElementById('town-store-view');
    this.gamesView = document.getElementById('town-games-view');
    this.mapEl = document.getElementById('town-map');
    this.playerEl = document.getElementById('map-player');
    this.highlightsEl = document.getElementById('map-highlights');
    this.titleEl = document.getElementById('town-map-title');
    this.subtitleEl = document.getElementById('town-map-subtitle');
    this.walletEl = document.getElementById('town-wallet-display');
    this.gamesWalletEl = document.getElementById('games-wallet-display');
    this.gamesRecipeLabel = document.getElementById('games-recipe-label');
    this.lowBalanceToast = document.getElementById('town-low-balance-toast');

    this.lockedModal = document.getElementById('locked-store-modal');
    this.missingModal = document.getElementById('missing-ingredients-modal');
    this.missingList = document.getElementById('missing-ingredients-list');

    document.getElementById('locked-store-back-btn')?.addEventListener('click', () => {
      this.hideModal(this.lockedModal);
    });
    document.getElementById('locked-store-unlock-btn')?.addEventListener('click', () => {
      this.hideModal(this.lockedModal);
    });
    document.getElementById('missing-ingredients-back-btn')?.addEventListener('click', () => {
      this.hideModal(this.missingModal);
    });

    document.getElementById('town-low-balance-games-btn')?.addEventListener('click', () => {
      this.openGames();
    });
    document.getElementById('town-low-balance-dismiss')?.addEventListener('click', () => {
      this.lowBalanceDismissed = true;
      this.hideLowBalanceToast();
    });

    this.mapEl?.querySelectorAll('.map-building[data-store-id]').forEach((node) => {
      node.addEventListener('click', () => {
        const storeId = node.dataset.storeId;
        if (storeId) this.onBuildingTap(storeId);
      });
      node.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          const storeId = node.dataset.storeId;
          if (storeId) this.onBuildingTap(storeId);
        }
      });
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
    });

    window.addEventListener('shoppingphasechange', () => this.syncViews());
  },

  enter() {
    this.syncViews();
    this.render();
    this.movePlayerTo('home', false);
  },

  syncViews() {
    const phase = GameState.shoppingPhase;
    const onMap = phase === 'map';
    const inStore = phase === 'store' || phase === 'checkout';
    const inGames = phase === 'games';

    this.mapView?.classList.toggle('hidden', !onMap);
    this.storeView?.classList.toggle('hidden', !inStore);
    this.gamesView?.classList.toggle('hidden', !inGames);
  },

  render() {
    const recipe = GameState.selectedRecipe;
    if (this.titleEl) {
      this.titleEl.textContent = recipe?.label ? `Shopping for: ${recipe.label}` : 'Town Map';
    }
    if (this.subtitleEl) {
      this.subtitleEl.textContent = 'Tap a highlighted shop to buy ingredients.';
    }
    if (this.gamesRecipeLabel) {
      this.gamesRecipeLabel.textContent = recipe?.label || 'your recipe';
    }
    this.renderWallet();
    this.renderHighlights();
    this.updateBuildingStates();
    this.renderLowBalanceToast();
  },

  renderWallet() {
    WordWallet.ensureSeeded();
    const text = WordWallet.formatWalletLabel(GameState.wallet);

    if (this.walletEl) this.walletEl.textContent = text;
    if (this.gamesWalletEl) this.gamesWalletEl.textContent = text;

    const storeWallet = document.getElementById('store-wallet-display');
    if (storeWallet) storeWallet.textContent = text;
  },

  renderLowBalanceToast() {
    if (!this.lowBalanceToast || GameState.shoppingPhase !== 'map') return;

    const recipe = GameState.selectedRecipe;
    if (recipe && !WordWallet.isLowBalance(recipe)) {
      this.lowBalanceDismissed = false;
    }

    const show = !this.lowBalanceDismissed
      && recipe
      && WordWallet.isLowBalance(recipe);

    this.lowBalanceToast.classList.toggle('hidden', !show);
  },

  hideLowBalanceToast() {
    this.lowBalanceToast?.classList.add('hidden');
  },

  updateBuildingStates() {
    this.mapEl?.querySelectorAll('.map-building[data-store-id]').forEach((node) => {
      const id = node.dataset.storeId;

      if (id === 'word-games') {
        node.classList.remove('map-building--locked', 'map-building--required');
        return;
      }

      const isLocked = id !== 'home' && !GameState.unlockedStores[id];
      node.classList.toggle('map-building--locked', isLocked);
      node.classList.toggle(
        'map-building--required',
        GameState.requiredStores.includes(id) && !isLocked && id !== 'home',
      );
    });
  },

  renderHighlights() {
    if (!this.highlightsEl) return;
    this.highlightsEl.innerHTML = '';
    const required = GameState.requiredStores || [];
    const unlocked = new Set(GameState.getUnlockedStoreIds());

    required.forEach((storeId) => {
      if (!unlocked.has(storeId) || storeId === 'home') return;
      const anchor = STORE_ANCHORS[storeId];
      if (!anchor) return;
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
      ring.setAttribute('class', 'map-highlight-ring');
      ring.setAttribute('cx', String(anchor.x));
      ring.setAttribute('cy', String(anchor.y));
      ring.setAttribute('rx', '52');
      ring.setAttribute('ry', '38');
      this.highlightsEl.appendChild(ring);
    });
  },

  onBuildingTap(storeId) {
    if (this.traveling) return;

    if (storeId === 'home') {
      this.onHomeTap();
      return;
    }

    if (storeId === 'word-games') {
      this.animateAlongPath(storeId, () => this.openGames());
      return;
    }

    if (!DataStores.getStore(storeId)) return;

    if (!GameState.unlockedStores[storeId]) {
      this.showModal(this.lockedModal);
      return;
    }

    if (!GameState.requiredStores.includes(storeId)) return;

    this.animateAlongPath(storeId, () => this.openStore(storeId));
  },

  onHomeTap() {
    if (GameState.allIngredientsPurchased()) {
      GameState.setStage(3);
      return;
    }

    const unmet = RecipeShopping.getUnmetRequirements(
      GameState.requiredIngredients,
      GameState.purchasedIngredients,
    );
    if (this.missingList) {
      this.missingList.innerHTML = unmet
        .map((req) => `<li>${escapeHtml(RecipeShopping.getRequirementEslLabel(req))}</li>`)
        .join('');
    }
    this.showModal(this.missingModal);
  },

  pathForStore(storeId) {
    return TRAVEL_PATHS[storeId] || [STORE_ANCHORS.home, STORE_ANCHORS[storeId]].filter(Boolean);
  },

  animateAlongPath(storeId, onArrive) {
    const path = this.pathForStore(storeId);
    if (!path.length || !this.playerEl) {
      onArrive();
      return;
    }

    this.traveling = true;
    this.playerEl.classList.add('is-traveling');

    let step = 0;
    const advance = () => {
      if (step >= path.length) {
        this.playerEl.classList.remove('is-traveling');
        this.traveling = false;
        onArrive();
        return;
      }
      const pt = path[step];
      this.playerEl.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
      step += 1;
      window.setTimeout(advance, 650);
    };

    advance();
  },

  movePlayerTo(storeId, animate) {
    const pt = STORE_ANCHORS[storeId] || STORE_ANCHORS.home;
    if (!this.playerEl) return;
    if (animate) this.playerEl.classList.add('is-traveling');
    else this.playerEl.classList.remove('is-traveling');
    this.playerEl.setAttribute('transform', `translate(${pt.x}, ${pt.y})`);
  },

  openStore(storeId) {
    GameState.currentStore = storeId;
    StageShopping.enterStore(storeId);
    GameState.setShoppingPhase('store');
    this.syncViews();
  },

  openGames() {
    GameState.currentStore = null;
    GameState.setShoppingPhase('games');
    this.syncViews();
    MiniGames.enter();
    this.renderWallet();
  },

  returnToMap() {
    GameState.currentStore = null;
    GameState.cart = {};
    GameState.setShoppingPhase('map');
    this.syncViews();
    this.movePlayerTo('home', true);
    this.render();
  },

  showModal(el) {
    el?.classList.remove('hidden');
  },

  hideModal(el) {
    el?.classList.add('hidden');
  },
};

window.StageMap = StageMap;
