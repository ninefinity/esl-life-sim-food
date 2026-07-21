'use strict';

const { escapeHtml } = window.GameUtils;

const SHOPS = [
  { id: 'corner', label: 'Corner Shop', desc: 'Small local shop — unlocked' },
  { id: 'market', label: 'Market', desc: 'More variety — locked' },
  { id: 'supermarket', label: 'Supermarket', desc: 'Biggest selection — locked' },
];

const StageShopSelect = {
  init() {
    this.root = document.getElementById('stage-shop-select');
    this.cardsEl = document.getElementById('shop-cards');
    this.render();
  },

  render() {
    if (!this.cardsEl) return;
    this.cardsEl.innerHTML = '';

    SHOPS.forEach((shop) => {
      const unlocked = GameState.unlockedShops[shop.id];
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'shop-card' + (unlocked ? '' : ' shop-card--locked');
      card.disabled = !unlocked;
      card.title = unlocked ? shop.desc : `${shop.desc} (unlock later)`;

      card.innerHTML = `
        <span class="shop-card__label">${escapeHtml(shop.label)}</span>
        <span class="shop-card__desc">${escapeHtml(shop.desc)}</span>
        ${unlocked ? '' : '<span class="shop-card__lock">🔒</span>'}
      `;

      if (unlocked) {
        card.addEventListener('click', () => {
          GameState.selectShop(shop.id);
          GameState.setStage(3);
        });
      }

      this.cardsEl.appendChild(card);
    });
  },
};

window.StageShopSelect = StageShopSelect;
