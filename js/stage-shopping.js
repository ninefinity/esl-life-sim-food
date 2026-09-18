'use strict';

const $ = (id) => document.getElementById(id);

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const STORE_SHELF_CONFIG = {
  'corner-shop': { decoyCount: 4 },
  supermarket: { decoyCount: 8 },
  'farmers-market': { decoyCount: 4 },
  'department-store': { decoyCount: 6 },
  'frozen-goods': { decoyCount: 2 },
  delicacies: { decoyCount: 3 },
  bakery: { decoyCount: 4 },
};

/** @type {Record<string, object>} */
let ITEMS = {};
/** @type {{ shelf: {id:string,qty:number}[] } | null} */
let currentRound = null;
/** @type {Record<string, number>} */
let cart = {};
/** @type {Record<string, number>} */
let paymentCounts = {};
let totalNeeded = 0;
let collected = 0;
let completed = false;
/** @type {'shop' | 'checkout' | 'done'} */
let phase = 'shop';
let checkoutTotalCents = 0;
/** @type {string|null} */
let activeCategory = null;
let statusTimer = null;
let currentStoreId = null;

function ensureGameWallet() {
  WordWallet.ensureSeeded();
}

function buildRoundForStore(storeId) {
  const config = STORE_SHELF_CONFIG[storeId] || { decoyCount: 4 };
  const store = DataStores.getStore(storeId);
  const requirements = GameState.requiredIngredients;
  const purchased = GameState.purchasedIngredients;

  const relevantIds = RecipeShopping.getRelevantItemIdsForStore(storeId, requirements, purchased);
  const decoyPool = (store?.itemIds || []).filter((id) => !relevantIds.includes(id));
  const decoyIds = shuffle(decoyPool).slice(0, Math.min(config.decoyCount, decoyPool.length));

  /** @type {Map<string, number>} */
  const shelfMap = new Map();
  relevantIds.forEach((id) => shelfMap.set(id, 1));
  decoyIds.forEach((id) => shelfMap.set(id, randInt(1, 2)));

  return {
    shelf: [...shelfMap.entries()].map(([id, qty]) => ({ id, qty })),
  };
}

function itemPrice(itemId) {
  return WordWallet.normalizePrice(ITEMS[itemId]?.price);
}

function itemLabel(itemId) {
  return ITEMS[itemId]?.label || itemId;
}

function itemVisual(itemId) {
  const item = ITEMS[itemId];
  if (!item) return '📦';
  return escapeHtml(item.emoji || '📦');
}

function cartEntries() {
  return Object.entries(cart).flatMap(([id, qty]) =>
    Array.from({ length: qty }, () => ({ id })),
  );
}

function cartTotalCents() {
  return Object.entries(cart).reduce(
    (sum, [id, qty]) => sum + WordWallet.itemPriceCents(id) * qty,
    0,
  );
}

function numberToWords(n) {
  const num = Math.floor(Math.max(0, n));
  if (num < 20) return ONES[num];
  if (num < 100) {
    const tens = Math.floor(num / 10);
    const ones = num % 10;
    return ones ? `${TENS[tens]}-${ONES[ones]}` : TENS[tens];
  }
  if (num < 1000) {
    const hundreds = Math.floor(num / 100);
    const rest = num % 100;
    const head = `${ONES[hundreds]} hundred`;
    if (!rest) return head;
    return `${head} and ${numberToWords(rest)}`;
  }
  return String(num);
}

function formatTotalInWords(totalCents) {
  const wd = Math.floor(totalCents / 100);
  const c = totalCents % 100;
  const parts = [];
  if (wd > 0) parts.push(`${numberToWords(wd)} wordollar${wd === 1 ? '' : 's'}`);
  if (c > 0) parts.push(`${numberToWords(c)} cent${c === 1 ? '' : 's'}`);
  if (!parts.length) return 'The total is zero cents.';
  if (parts.length === 1) return `The total is ${parts[0]}.`;
  return `The total is ${parts[0]} and ${parts[1]}.`;
}

function countMetRequirements() {
  const reqs = GameState.requiredIngredients || [];
  return reqs.filter((req) =>
    RecipeShopping.isRequirementMet(req, GameState.purchasedIngredients),
  ).length;
}

function syncProgressCounts() {
  totalNeeded = (GameState.requiredIngredients || []).length;
  collected = countMetRequirements();
}

function setStatus(text) {
  const el = $('shop-status');
  if (!el) return;
  el.textContent = text;
  if (statusTimer) window.clearTimeout(statusTimer);
  if (text) {
    statusTimer = window.setTimeout(() => {
      if (el.textContent === text) el.textContent = '';
    }, 2200);
  }
}

function loadStoreRound(round) {
  cart = {};
  paymentCounts = WordWallet.cloneWallet({});
  completed = false;
  phase = 'shop';
  checkoutTotalCents = 0;
  currentRound = round;
  syncProgressCounts();
  hidePostCheckout();
  renderPhase();
}

function hidePostCheckout() {
  $('shop-post-checkout')?.classList.add('hidden');
  $('shop-shelf-wrap')?.classList.remove('hidden');
  $('shop-cart-wrap')?.classList.remove('hidden');
  $('shop-category-tabs')?.classList.remove('hidden');
}

function showPostCheckout(allDone) {
  phase = 'done';
  $('shop-shelf-wrap')?.classList.add('hidden');
  $('shop-cart-wrap')?.classList.add('hidden');
  $('shop-checkout')?.classList.add('hidden');
  $('shop-category-tabs')?.classList.add('hidden');
  $('goto-checkout-btn')?.classList.add('hidden');

  const panel = $('shop-post-checkout');
  const msg = $('shop-post-checkout-msg');
  const homeBtn = $('shop-go-home-btn');
  if (panel) panel.classList.remove('hidden');
  if (msg) {
    msg.textContent = allDone
      ? 'You bought everything! Go home to cook.'
      : 'Nice shopping! Visit another shop on the map.';
  }
  if (homeBtn) homeBtn.classList.toggle('hidden', !allDone);
}

function renderPhase() {
  const isCheckout = phase === 'checkout';
  const isDone = phase === 'done';
  $('shop-shelf-wrap')?.classList.toggle('hidden', isCheckout || isDone);
  $('shop-cart-wrap')?.classList.toggle('hidden', isCheckout || isDone);
  $('shop-checkout')?.classList.toggle('hidden', !isCheckout);
  $('goto-checkout-btn')?.classList.toggle('hidden', isCheckout || isDone);

  if (isCheckout) renderCheckout();
  else if (!isDone) {
    renderList();
    renderShelves();
    renderCart();
  }

  const scoreEl = $('score-display');
  if (scoreEl) scoreEl.textContent = `${collected}/${totalNeeded}`;
  StageMap.renderWallet?.();
}

function renderCategoryTabs() {
  const tabs = $('shop-category-tabs');
  if (!tabs || !currentRound) return;
  tabs.innerHTML = '';

  const shelfIds = [...new Set(currentRound.shelf.map((e) => e.id))];

  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'shop-tab' + (activeCategory === null ? ' shop-tab--active' : '');
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => {
    activeCategory = null;
    renderCategoryTabs();
    renderShelves();
  });
  tabs.appendChild(allBtn);

  const cats = new Set();
  shelfIds.forEach((id) => {
    const cat = ITEMS[id]?.category;
    if (cat) cats.add(cat);
  });

  [...cats].sort().forEach((cat) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shop-tab' + (activeCategory === cat ? ' shop-tab--active' : '');
    btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    btn.addEventListener('click', () => {
      activeCategory = cat;
      renderCategoryTabs();
      renderShelves();
    });
    tabs.appendChild(btn);
  });
}

function getVisibleShelfIds() {
  if (!currentRound) return [];
  const ids = [...new Set(currentRound.shelf.map((e) => e.id))];
  if (!activeCategory) return ids;
  return ids.filter((id) => ITEMS[id]?.category === activeCategory);
}

function renderList() {
  const rows = $('shop-list-rows');
  if (!rows) return;
  rows.innerHTML = '';

  (GameState.requiredIngredients || []).forEach((req) => {
    const done = RecipeShopping.isRequirementMet(req, GameState.purchasedIngredients);
    const label = RecipeShopping.getRequirementLabel(req);
    const li = document.createElement('li');
    li.className = 'shop-list__row list-notebook-line' + (done ? ' shop-list__row--done' : '');
    li.innerHTML = `
      <span class="list-notebook-line__text">${done ? '✓ ' : ''}${escapeHtml(label)}</span>
      <span class="list-notebook-line__meta shop-list__price">${done ? '' : '…'}</span>
    `;
    rows.appendChild(li);
  });
}

function renderShelves() {
  const grid = $('shop-shelf-grid');
  if (!grid || !currentRound) return;
  grid.innerHTML = '';

  getVisibleShelfIds().forEach((itemId) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shop-item';
    btn.dataset.itemId = itemId;
    btn.draggable = phase === 'shop' && !completed;
    btn.disabled = phase !== 'shop' || completed;
    btn.innerHTML = `
      <span class="shop-item__visual">${itemVisual(itemId)}</span>
      <span class="shop-item__label">${escapeHtml(itemLabel(itemId))}</span>
      <span class="shop-item__price">${escapeHtml(WordWallet.formatPriceShort(itemPrice(itemId)))}</span>
      <span class="shop-item__add">Add</span>
    `;
    btn.addEventListener('click', () => tryAddItem(itemId));
    btn.addEventListener('dragstart', onShelfDragStart);
    btn.addEventListener('dragend', onShelfDragEnd);
    grid.appendChild(btn);
  });
}

function renderCart() {
  const cartEl = $('shop-basket-items');
  if (!cartEl) return;
  cartEl.innerHTML = '';

  Object.entries(cart).forEach(([itemId, qty]) => {
    for (let i = 0; i < qty; i += 1) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'shop-cart__chip';
      chip.dataset.itemId = itemId;
      chip.innerHTML = itemVisual(itemId);
      chip.disabled = phase !== 'shop';
      chip.addEventListener('click', () => removeOneFromCart(itemId));
      cartEl.appendChild(chip);
    }
  });
}

function tryAddItem(itemId) {
  if (completed || phase !== 'shop') return false;
  if (!ITEMS[itemId]) return false;
  cart[itemId] = (cart[itemId] || 0) + 1;
  renderCart();
  setStatus('');
  return true;
}

function removeOneFromCart(itemId) {
  if (completed || phase !== 'shop') return;
  if (!cart[itemId]) return;
  cart[itemId] -= 1;
  if (cart[itemId] <= 0) delete cart[itemId];
  renderCart();
}

function goToCheckout() {
  if (phase !== 'shop' || completed) return;
  if (!cartEntries().length) {
    setStatus('Your basket is empty.');
    return;
  }

  ensureGameWallet();
  checkoutTotalCents = cartTotalCents();
  if (WordWallet.getWalletTotalCents(GameState.wallet) < checkoutTotalCents) {
    setStatus('Not enough money. Play a mini-game on the map!');
    return;
  }

  phase = 'checkout';
  paymentCounts = WordWallet.cloneWallet({});
  GameState.setShoppingPhase('checkout');
  renderPhase();
}

function leaveCheckout() {
  if (phase !== 'checkout' || completed) return;
  phase = 'shop';
  paymentCounts = WordWallet.cloneWallet({});
  renderPhase();
}

function availableInWallet(denomId) {
  return (GameState.wallet[denomId] || 0) - (paymentCounts[denomId] || 0);
}

function moneyFaceHtml(denom) {
  if (!denom.image) return escapeHtml(denom.short);
  return `<img class="shop-money__img" src="${denom.image}" alt="" decoding="async" />`;
}

function addOneToPayment(denomId) {
  if (availableInWallet(denomId) <= 0) return;
  paymentCounts[denomId] = (paymentCounts[denomId] || 0) + 1;
  renderCheckout();
}

function removeOneFromPayment(denomId) {
  paymentCounts[denomId] = Math.max(0, (paymentCounts[denomId] || 0) - 1);
  renderCheckout();
}

function createMoneyButton(denom, { inTray = false, available = 0 } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'shop-money' + (inTray ? ' shop-money--in-tray' : '');
  btn.setAttribute(
    'aria-label',
    inTray ? denom.short : `${denom.short}, ${available} available`,
  );
  btn.disabled = !inTray && available <= 0;
  btn.innerHTML = moneyFaceHtml(denom);

  if (inTray) {
    btn.addEventListener('click', () => removeOneFromPayment(denom.id));
  } else {
    btn.addEventListener('click', () => addOneToPayment(denom.id));
    const count = document.createElement('span');
    count.className = 'shop-money__count';
    count.textContent = String(available);
    btn.appendChild(count);
  }
  return btn;
}

function paymentAmountLabel(paid) {
  if (paid === 0) return '';
  const paidText = WordWallet.formatCentsShort(paid);
  if (paid === checkoutTotalCents) return `(${paidText}, exact)`;
  return `(${paidText} of ${WordWallet.formatCentsShort(checkoutTotalCents)})`;
}

function renderPayTray(tray, paid) {
  if (!tray) return;
  if (paid === 0) {
    tray.innerHTML = '<p class="shop-pay-tray__empty">Tap notes and coins from your wallet</p>';
    return;
  }
  tray.innerHTML = '';
  WordWallet.MONEY_DENOMS.forEach((denom) => {
    const qty = paymentCounts[denom.id] || 0;
    for (let i = 0; i < qty; i += 1) {
      tray.appendChild(createMoneyButton(denom, { inTray: true }));
    }
  });
}

function renderWalletTray(walletEl) {
  if (!walletEl) return;
  walletEl.innerHTML = '';
  WordWallet.MONEY_DENOMS.forEach((denom) => {
    walletEl.appendChild(createMoneyButton(denom, {
      available: availableInWallet(denom.id),
    }));
  });
}

function renderCheckout() {
  ensureGameWallet();
  checkoutTotalCents = cartTotalCents();
  const paid = WordWallet.sumCounts(paymentCounts);

  const wordsEl = $('checkout-total-words');
  if (wordsEl) wordsEl.textContent = formatTotalInWords(checkoutTotalCents);

  const paymentEl = $('payment-amount');
  if (paymentEl) paymentEl.textContent = paymentAmountLabel(paid);

  renderPayTray($('shop-pay-tray'), paid);
  renderWalletTray($('shop-wallet'));

  const payBtn = $('pay-btn');
  if (payBtn) payBtn.disabled = paid !== checkoutTotalCents;
}

function deductPaymentFromWallet() {
  WordWallet.MONEY_DENOMS.forEach((denom) => {
    GameState.wallet[denom.id] = Math.max(
      0,
      (GameState.wallet[denom.id] || 0) - (paymentCounts[denom.id] || 0),
    );
  });
}

function mergeCartIntoPurchased() {
  Object.entries(cart).forEach(([id, qty]) => {
    GameState.purchasedIngredients[id] = (GameState.purchasedIngredients[id] || 0) + qty;
  });
}

function markStoreVisited() {
  if (currentStoreId && !GameState.visitedStores.includes(currentStoreId)) {
    GameState.visitedStores.push(currentStoreId);
  }
}

function submitPayment() {
  if (phase !== 'checkout' || completed) return;
  ensureGameWallet();
  if (WordWallet.sumCounts(paymentCounts) !== checkoutTotalCents) {
    setStatus('Your payment must match the total exactly.');
    return;
  }

  deductPaymentFromWallet();
  mergeCartIntoPurchased();
  markStoreVisited();

  cart = {};
  paymentCounts = WordWallet.cloneWallet({});
  completed = true;
  GameState.cart = {};
  GameState.persist();
  GameState.recomputeRequiredStores();
  syncProgressCounts();
  renderList();
  showPostCheckout(GameState.allIngredientsPurchased());
  StageMap.render?.();
}

function onShelfDragStart(event) {
  if (completed || phase !== 'shop') {
    event.preventDefault();
    return;
  }
  const itemId = event.currentTarget.dataset.itemId;
  if (!itemId) {
    event.preventDefault();
    return;
  }
  event.dataTransfer.setData('text/plain', JSON.stringify({ itemId }));
}

function onShelfDragEnd() {
  $('shop-cart')?.classList.remove('shop-cart--drag-over');
}

function onCartDragOver(event) {
  event.preventDefault();
  event.currentTarget.classList.add('shop-cart--drag-over');
}

function onCartDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) {
    event.currentTarget.classList.remove('shop-cart--drag-over');
  }
}

function onCartDrop(event) {
  event.preventDefault();
  event.currentTarget.classList.remove('shop-cart--drag-over');
  let payload;
  try {
    payload = JSON.parse(event.dataTransfer.getData('text/plain'));
  } catch {
    return;
  }
  if (payload?.itemId) tryAddItem(payload.itemId);
}

const StageShopping = {
  init() {
    ITEMS = DataItems.items;

    $('goto-checkout-btn')?.addEventListener('click', goToCheckout);
    $('checkout-back-btn')?.addEventListener('click', leaveCheckout);
    $('pay-btn')?.addEventListener('click', submitPayment);
    $('town-back-map-btn')?.addEventListener('click', () => StageMap.returnToMap());
    $('shop-back-map-btn')?.addEventListener('click', () => StageMap.returnToMap());
    $('shop-go-home-btn')?.addEventListener('click', () => StageMap.onHomeTap());

    const cartEl = $('shop-cart');
    cartEl?.addEventListener('dragover', onCartDragOver);
    cartEl?.addEventListener('dragleave', onCartDragLeave);
    cartEl?.addEventListener('drop', onCartDrop);
  },

  getWalletTotalCents() {
    return WordWallet.getWalletTotalCents(GameState.wallet);
  },

  setStoreHeader(store) {
    const label = $('game-label');
    if (label) label.textContent = store.name;
    const catLine = $('store-category-line');
    if (catLine) catLine.textContent = store.categoryLine || '';
  },

  canResumeStore(storeId) {
    return currentStoreId === storeId && !!currentRound && phase !== 'done';
  },

  enterStore(storeId, { resume = false } = {}) {
    const store = DataStores.getStore(storeId);
    if (!store) {
      setStatus('Could not open this shop.');
      return;
    }

    ITEMS = DataItems.items || {};
    this.setStoreHeader(store);

    if (resume && this.canResumeStore(storeId)) {
      hidePostCheckout();
      syncProgressCounts();
      renderPhase();
      return;
    }

    currentStoreId = storeId;
    activeCategory = null;
    ensureGameWallet();

    if (!GameState.requiredIngredients?.length) {
      setStatus('Pick a recipe from your book first.');
    }

    currentRound = buildRoundForStore(storeId);
    renderCategoryTabs();
    loadStoreRound(currentRound);
    renderList();
  },
};

window.StageShopping = StageShopping;
