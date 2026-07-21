'use strict';

const { escapeHtml, shuffle, randInt } = window.GameUtils;

const $ = (id) => document.getElementById(id);

const SHOP_CONFIG = {
  corner: { shelfUnits: 1, decoyCount: 4 },
  market: { shelfUnits: 2, decoyCount: 8 },
  supermarket: { shelfUnits: 3, decoyCount: 12 },
};

const MONEY_DENOMS = [
  { id: 'note-5', kind: 'note', cents: 500, short: '5 WD' },
  { id: 'note-2', kind: 'note', cents: 200, short: '2 WD' },
  { id: 'note-1', kind: 'note', cents: 100, short: '1 WD' },
  { id: 'coin-50', kind: 'coin', cents: 50, short: '50¢' },
  { id: 'coin-10', kind: 'coin', cents: 10, short: '10¢' },
  { id: 'coin-5', kind: 'coin', cents: 5, short: '5¢' },
  { id: 'coin-1', kind: 'coin', cents: 1, short: '1¢' },
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

const ONES = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
  'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

/** @type {Record<string, object>} */
let ITEMS = {};
/** @type {{ list: {id:string,qty:number}[], shelf: {id:string,qty:number}[], shelfUnits: number } | null} */
let currentRound = null;
/** @type {Map<string, number>} */
let needed = new Map();
/** @type {{ id: string }[]} */
let cart = [];
let totalNeeded = 0;
let collected = 0;
let completed = false;
/** @type {'shop' | 'checkout'} */
let phase = 'shop';
let checkoutTotalCents = 0;
/** @type {Record<string, number>} */
let walletCounts = {};
/** @type {Record<string, number>} */
let paymentCounts = {};
/** @type {string|null} */
let activeCategory = null;
let statusTimer = null;

function buildRoundFromMeal(meal, shopId) {
  const config = SHOP_CONFIG[shopId] || SHOP_CONFIG.corner;
  const catalogIds = Object.keys(ITEMS);

  const list = meal.ingredients.map((id) => ({ id, qty: 1 }));
  const listIds = list.map((e) => e.id);

  const decoyIds = shuffle(catalogIds.filter((id) => !listIds.includes(id)))
    .slice(0, Math.min(config.decoyCount, catalogIds.length - listIds.length));

  /** @type {Map<string, number>} */
  const shelfMap = new Map();
  list.forEach((entry) => shelfMap.set(entry.id, 1));
  decoyIds.forEach((id) => shelfMap.set(id, randInt(1, 2)));

  const shelf = [...shelfMap.entries()].map(([id, qty]) => ({ id, qty }));

  return {
    list,
    shelf,
    shelfUnits: config.shelfUnits,
  };
}

function normalizePrice(raw) {
  if (!raw || typeof raw !== 'object') return { wd: 0, c: 0 };
  return {
    wd: Math.max(0, Number(raw.wd) || 0),
    c: Math.min(99, Math.max(0, Number(raw.c) || 0)),
  };
}

function priceToCents(price) {
  const p = normalizePrice(price);
  return p.wd * 100 + p.c;
}

function itemPrice(itemId) {
  return normalizePrice(ITEMS[itemId]?.price);
}

function formatPriceShort(price) {
  const p = normalizePrice(price);
  if (p.wd > 0 && p.c > 0) return `${p.wd} WD ${p.c}¢`;
  if (p.wd > 0) return `${p.wd} WD`;
  return `${p.c}¢`;
}

function formatCentsShort(totalCents) {
  const wd = Math.floor(totalCents / 100);
  const c = totalCents % 100;
  if (wd > 0 && c > 0) return `${wd} WD ${c}¢`;
  if (wd > 0) return `${wd} WD`;
  return `${c}¢`;
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

function sumCounts(counts) {
  return MONEY_DENOMS.reduce((sum, denom) => {
    const qty = counts[denom.id] || 0;
    return sum + qty * denom.cents;
  }, 0);
}

function cloneWallet(source) {
  const copy = {};
  MONEY_DENOMS.forEach((denom) => {
    copy[denom.id] = source[denom.id] || 0;
  });
  return copy;
}

function resetWallet() {
  walletCounts = cloneWallet(DEFAULT_WALLET);
  paymentCounts = cloneWallet({});
}

function itemLabel(itemId) {
  return ITEMS[itemId]?.label || itemId;
}

function formatListLine(itemId, qty) {
  const item = ITEMS[itemId];
  if (!item) return `${qty} items`;
  const label = qty === 1 ? item.label : (item.plural || `${item.label}s`);
  return `${qty} ${label}`;
}

function itemVisual(itemId) {
  const item = ITEMS[itemId];
  if (!item) return '📦';
  return escapeHtml(item.emoji || '📦');
}

function cartCountFor(itemId) {
  return cart.filter((entry) => entry.id === itemId).length;
}

function remainingNeeded(itemId) {
  return needed.get(itemId) || 0;
}

function syncListProgress() {
  collected = 0;
  needed = new Map();
  if (!currentRound) return;
  currentRound.list.forEach((entry) => {
    const have = Math.min(cartCountFor(entry.id), entry.qty);
    needed.set(entry.id, entry.qty - have);
    collected += have;
  });
}

function isCartComplete() {
  if (!currentRound || totalNeeded <= 0) return false;
  if (cart.length !== totalNeeded) return false;
  return currentRound.list.every((entry) => cartCountFor(entry.id) === entry.qty);
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

function loadRound(round) {
  needed = new Map();
  cart = [];
  completed = false;
  phase = 'shop';
  checkoutTotalCents = 0;
  totalNeeded = 0;
  collected = 0;
  resetWallet();

  round.list.forEach((entry) => {
    needed.set(entry.id, entry.qty);
    totalNeeded += entry.qty;
  });

  renderPhase();
}

function renderPhase() {
  const isCheckout = phase === 'checkout';
  $('shop-shelf-wrap')?.classList.toggle('hidden', isCheckout);
  $('shop-cart-wrap')?.classList.toggle('hidden', isCheckout);
  $('shop-checkout')?.classList.toggle('hidden', !isCheckout);
  $('goto-checkout-btn')?.classList.toggle('hidden', isCheckout);

  if (isCheckout) renderCheckout();
  else {
    renderList();
    renderShelves();
    renderCart();
  }

  const scoreEl = $('score-display');
  if (scoreEl) scoreEl.textContent = `${collected}/${totalNeeded}`;
}

function renderCategoryTabs() {
  const tabs = $('shop-category-tabs');
  if (!tabs) return;
  tabs.innerHTML = '';

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

  DataItems.getCategories().forEach((cat) => {
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
  if (!rows || !currentRound) return;
  rows.innerHTML = '';

  currentRound.list.forEach((entry) => {
    const remaining = remainingNeeded(entry.id);
    const done = remaining <= 0;
    const li = document.createElement('li');
    li.className = 'shop-list__row' + (done ? ' shop-list__row--done' : '');
    li.innerHTML = `
      <span>${escapeHtml(formatListLine(entry.id, entry.qty))}</span>
      <span class="shop-list__price">${escapeHtml(formatPriceShort(itemPrice(entry.id)))}</span>
    `;
    rows.appendChild(li);
  });
}

function renderShelves() {
  const grid = $('shop-shelf-grid');
  if (!grid || !currentRound) return;
  grid.innerHTML = '';

  const visibleIds = getVisibleShelfIds();
  visibleIds.forEach((itemId) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'shop-item';
    btn.dataset.itemId = itemId;
    btn.draggable = phase === 'shop' && !completed;
    btn.disabled = phase !== 'shop' || completed;
    btn.innerHTML = `
      <span class="shop-item__visual">${itemVisual(itemId)}</span>
      <span class="shop-item__label">${escapeHtml(itemLabel(itemId))}</span>
      <span class="shop-item__price">${escapeHtml(formatPriceShort(itemPrice(itemId)))}</span>
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

  cart.forEach((entry, index) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'shop-cart__chip';
    chip.innerHTML = itemVisual(entry.id);
    chip.disabled = phase !== 'shop';
    chip.addEventListener('click', () => removeFromCart(index));
    cartEl.appendChild(chip);
  });
}

function tryAddItem(itemId) {
  if (completed || phase !== 'shop') return false;
  if (!ITEMS[itemId]) return false;
  cart.push({ id: itemId });
  syncListProgress();
  renderCart();
  renderList();
  const scoreEl = $('score-display');
  if (scoreEl) scoreEl.textContent = `${collected}/${totalNeeded}`;
  setStatus('');
  return true;
}

function removeFromCart(index) {
  if (completed || phase !== 'shop') return;
  cart.splice(index, 1);
  syncListProgress();
  renderCart();
  renderList();
  const scoreEl = $('score-display');
  if (scoreEl) scoreEl.textContent = `${collected}/${totalNeeded}`;
}

function goToCheckout() {
  if (phase !== 'shop' || completed) return;
  if (!isCartComplete()) {
    setStatus('Check your basket.');
    return;
  }
  phase = 'checkout';
  checkoutTotalCents = cart.reduce((sum, e) => sum + priceToCents(itemPrice(e.id)), 0);
  paymentCounts = cloneWallet({});
  renderPhase();
}

function leaveCheckout() {
  if (phase !== 'checkout' || completed) return;
  phase = 'shop';
  renderPhase();
}

function renderCheckout() {
  const wordsEl = $('checkout-total-words');
  const paymentEl = $('payment-amount');
  const payBtn = $('pay-btn');
  const tray = $('shop-pay-tray');
  const wallet = $('shop-wallet');

  checkoutTotalCents = cart.reduce((sum, e) => sum + priceToCents(itemPrice(e.id)), 0);
  if (wordsEl) wordsEl.textContent = formatTotalInWords(checkoutTotalCents);

  const paid = sumCounts(paymentCounts);
  if (paymentEl) {
    paymentEl.textContent = paid === 0
      ? ''
      : paid === checkoutTotalCents
        ? `(${formatCentsShort(paid)}, exact)`
        : `(${formatCentsShort(paid)} of ${formatCentsShort(checkoutTotalCents)})`;
  }

  if (tray) {
    tray.innerHTML = paid === 0
      ? '<p class="shop-pay-tray__empty">Tap notes and coins from your wallet</p>'
      : '';
    if (paid > 0) {
      MONEY_DENOMS.forEach((denom) => {
        const qty = paymentCounts[denom.id] || 0;
        for (let i = 0; i < qty; i += 1) {
          const btn = createMoneyButton(denom, { inTray: true });
          tray.appendChild(btn);
        }
      });
    }
  }

  if (wallet) {
    wallet.innerHTML = '';
    MONEY_DENOMS.forEach((denom) => {
      const available = (walletCounts[denom.id] || 0) - (paymentCounts[denom.id] || 0);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shop-money';
      btn.textContent = denom.short;
      btn.disabled = available <= 0;
      btn.addEventListener('click', () => {
        if (availableInWallet(denom.id) <= 0) return;
        paymentCounts[denom.id] = (paymentCounts[denom.id] || 0) + 1;
        renderCheckout();
      });
      const count = document.createElement('span');
      count.className = 'shop-money__count';
      count.textContent = String(available);
      btn.appendChild(count);
      wallet.appendChild(btn);
    });
  }

  if (payBtn) payBtn.disabled = paid !== checkoutTotalCents;
  renderList();
}

function availableInWallet(denomId) {
  return (walletCounts[denomId] || 0) - (paymentCounts[denomId] || 0);
}

function createMoneyButton(denom, { inTray = false } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'shop-money' + (inTray ? ' shop-money--in-tray' : '');
  btn.textContent = denom.short;
  btn.addEventListener('click', () => {
    if (inTray) {
      paymentCounts[denom.id] = Math.max(0, (paymentCounts[denom.id] || 0) - 1);
    } else if (availableInWallet(denom.id) > 0) {
      paymentCounts[denom.id] = (paymentCounts[denom.id] || 0) + 1;
    }
    renderCheckout();
  });
  return btn;
}

function submitPayment() {
  if (phase !== 'checkout' || completed) return;
  const paid = sumCounts(paymentCounts);
  if (paid !== checkoutTotalCents) {
    setStatus('Your payment must match the total exactly.');
    return;
  }
  completed = true;
  GameState.cart = cart.slice();
  GameState.setStage(4);
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

    const cartEl = $('shop-cart');
    cartEl?.addEventListener('dragover', onCartDragOver);
    cartEl?.addEventListener('dragleave', onCartDragLeave);
    cartEl?.addEventListener('drop', onCartDrop);
  },

  enter() {
    const meal = DataMeals.getMeal(GameState.selectedMealId);
    const shopId = GameState.selectedShop || 'corner';
    if (!meal) return;

    activeCategory = null;
    currentRound = buildRoundFromMeal(meal, shopId);

    const label = $('game-label');
    if (label) label.textContent = `Shopping for: ${meal.label}`;

    renderCategoryTabs();
    loadRound(currentRound);
  },
};

window.StageShopping = StageShopping;
