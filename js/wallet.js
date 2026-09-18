'use strict';

const MONEY_DENOMS = [
  { id: 'note-5', kind: 'note', cents: 500, short: '5 WD', image: 'assets/images/money/5WD.png' },
  { id: 'note-2', kind: 'note', cents: 200, short: '2 WD', image: 'assets/images/money/2WD.png' },
  { id: 'note-1', kind: 'note', cents: 100, short: '1 WD', image: 'assets/images/money/1WD.png' },
  { id: 'coin-50', kind: 'coin', cents: 50, short: '50¢', image: 'assets/images/money/50coin.png' },
  { id: 'coin-10', kind: 'coin', cents: 10, short: '10¢', image: 'assets/images/money/10coin.png' },
  { id: 'coin-5', kind: 'coin', cents: 5, short: '5¢', image: 'assets/images/money/5coin.png' },
  { id: 'coin-1', kind: 'coin', cents: 1, short: '1¢', image: 'assets/images/money/1coin.png' },
];

const DEFAULT_WALLET = {
  'note-5': 2,
  'note-2': 3,
  'note-1': 5,
  'coin-50': 4,
  'coin-10': 4,
  'coin-5': 4,
  'coin-1': 4,
};

const SKEW_QTY_LIMIT = 6;

function clampDifficulty(recipe) {
  return Math.min(5, Math.max(1, recipe?.difficulty || 1));
}

function formatWdAndCents(wd, c) {
  if (wd > 0 && c > 0) return `${wd} WD ${c}¢`;
  if (wd > 0) return `${wd} WD`;
  return `${c}¢`;
}

const WordWallet = {
  MONEY_DENOMS,
  DEFAULT_WALLET,

  normalizePrice(raw) {
    if (!raw || typeof raw !== 'object') return { wd: 0, c: 0 };
    return {
      wd: Math.max(0, Number(raw.wd) || 0),
      c: Math.min(99, Math.max(0, Number(raw.c) || 0)),
    };
  },

  priceToCents(price) {
    const p = this.normalizePrice(price);
    return p.wd * 100 + p.c;
  },

  itemPriceCents(itemId) {
    const item = DataItems.getItem(itemId);
    return this.priceToCents(item?.price || { wd: 0, c: 50 });
  },

  formatPriceShort(price) {
    const p = this.normalizePrice(price);
    return formatWdAndCents(p.wd, p.c);
  },

  formatCentsShort(totalCents) {
    const wd = Math.floor(totalCents / 100);
    const c = totalCents % 100;
    return formatWdAndCents(wd, c);
  },

  cloneWallet(source = {}) {
    const copy = {};
    MONEY_DENOMS.forEach((denom) => {
      copy[denom.id] = Math.max(0, Number(source[denom.id]) || 0);
    });
    return copy;
  },

  normalizeWallet(raw) {
    if (!this.isWalletObject(raw)) return this.cloneWallet(DEFAULT_WALLET);
    return this.cloneWallet(raw);
  },

  sumCounts(counts) {
    return MONEY_DENOMS.reduce(
      (sum, denom) => sum + (counts[denom.id] || 0) * denom.cents,
      0,
    );
  },

  isWalletObject(wallet) {
    return wallet != null && typeof wallet === 'object' && !Array.isArray(wallet);
  },

  hasFunds(wallet) {
    return this.isWalletObject(wallet) && this.getWalletTotalCents(wallet) > 0;
  },

  getWalletTotalCents(wallet) {
    if (!this.isWalletObject(wallet)) return 0;
    return this.sumCounts(wallet);
  },

  formatWalletLabel(wallet) {
    return `Wallet: ${this.formatCentsShort(this.getWalletTotalCents(wallet))}`;
  },

  ensureSeeded() {
    if (this.hasFunds(GameState.wallet)) return;
    this.seedInitialWallet();
  },

  pickRandomDenom() {
    return MONEY_DENOMS[randInt(0, MONEY_DENOMS.length - 1)];
  },

  /** Add random notes/coins so totals can be made in many ways. */
  addRandomFunds(wallet, targetExtraCents) {
    if (!this.isWalletObject(wallet) || targetExtraCents <= 0) return;
    let added = 0;
    let guard = 0;
    while (added < targetExtraCents && guard < 300) {
      guard += 1;
      const denom = this.pickRandomDenom();
      wallet[denom.id] = (wallet[denom.id] || 0) + 1;
      added += denom.cents;
    }
  },

  fundWalletToAtLeast(wallet, minimumCents) {
    const shortfall = minimumCents - this.getWalletTotalCents(wallet);
    if (shortfall > 0) this.addRandomFunds(wallet, shortfall);
  },

  maxDenomQuantity(wallet) {
    return MONEY_DENOMS.reduce(
      (max, d) => Math.max(max, wallet[d.id] || 0),
      0,
    );
  },

  /** Remix a lopsided purse (e.g. many 5 WD notes) into mixed notes/coins. */
  rebalanceSkewedWallet(wallet) {
    if (!this.isWalletObject(wallet)) return;
    const total = this.getWalletTotalCents(wallet);
    if (total <= 0 || this.maxDenomQuantity(wallet) <= SKEW_QTY_LIMIT) return;

    const remixed = this.buildRandomWallet(total);
    MONEY_DENOMS.forEach((d) => {
      wallet[d.id] = remixed[d.id];
    });
  },

  buildRandomWallet(targetCents) {
    const wallet = this.cloneWallet(DEFAULT_WALLET);
    MONEY_DENOMS.forEach((denom) => {
      wallet[denom.id] += randInt(0, 2);
    });
    this.fundWalletToAtLeast(wallet, targetCents);
    return wallet;
  },

  estimateRecipeCostCents(recipe) {
    return RecipeShopping.normalizeRequirements(recipe).reduce(
      (sum, req) => sum + RecipeShopping.cheapestRequirementCost(req),
      0,
    );
  },

  averagePlayableMealCostCents() {
    const meals = DataMeals.getPlayableMeals(GameState.getUnlockedStoreIds());
    if (!meals.length) return 500;
    const total = meals.reduce((sum, meal) => sum + this.estimateRecipeCostCents(meal), 0);
    return Math.max(200, Math.round(total / meals.length));
  },

  seedInitialWallet() {
    const target = this.averagePlayableMealCostCents() * randInt(2, 3);
    GameState.wallet = this.buildRandomWallet(target);
    GameState.persist();
  },

  ensureWalletForRun(recipe) {
    if (!this.isWalletObject(GameState.wallet)) this.seedInitialWallet();
    const headroom = (randInt(2, 4) + clampDifficulty(recipe)) * 50;
    this.fundWalletToAtLeast(GameState.wallet, this.estimateRecipeCostCents(recipe) + headroom);
    GameState.persist();
  },

  migrateLegacyWallet(raw) {
    if (this.isWalletObject(raw) && MONEY_DENOMS.some((d) => raw[d.id] != null)) {
      return this.normalizeWallet(raw);
    }
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      return this.buildRandomWallet(Math.max(500, raw * 100));
    }
    return null;
  },

  miniGamePayoutCents(recipe, rounds = 3) {
    const cost = this.estimateRecipeCostCents(recipe);
    const difficulty = clampDifficulty(recipe);
    const base = Math.max(200, Math.round(cost * 0.75));
    return base + difficulty * 50 + rounds * 25;
  },

  isLowBalance(recipe) {
    return this.getWalletTotalCents(GameState.wallet) < this.estimateRecipeCostCents(recipe);
  },
};

window.WordWallet = WordWallet;
