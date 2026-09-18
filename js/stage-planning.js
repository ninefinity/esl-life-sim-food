'use strict';

const MEAL_GLYPHS = {
  pbj_sandwich: '🥪',
  oatmeal: '🥣',
  garden_salad: '🥗',
  cereal_and_milk: '🥛',
  grilled_cheese: '🧀',
  fruit_smoothie: '🥤',
  scrambled_eggs: '🍳',
  veggie_soup: '🍲',
  spaghetti_with_sauce: '🍝',
  fruit_salad: '🍎',
  chocolate_chip_cookies: '🍪',
  corn_chowder: '🌽',
  grilled_corn: '🌽',
  hearty_stew: '🍲',
  frozen_pizza: '🍕',
  frozen_fries: '🍟',
  croissant_breakfast: '🥐',
};

/** Category label + ribbon asset (flat AVIF with PNG fallback). */
const CATEGORY_META = {
  breakfast: { label: 'Breakfast', italic: false },
  lunch: { label: 'Lunch', italic: false },
  dinner: { label: 'Dinner', italic: false },
  snack: { label: 'Snack', italic: false },
  dessert: { label: 'Dessert', italic: false },
  surprise: { label: 'Surprise', italic: true },
};

const TAB_ORDER = ['breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'surprise'];

/** Flat ribbon image + optional dice for Surprise. */
function buildBookmarkMarkup(id, meta) {
  const dice = id === 'surprise'
    ? `<img class="bookmark-dice" src="assets/images/ui/dice.png" alt="" width="160" height="160" decoding="async" draggable="false"/>`
    : '';
  return `
    <span class="tab-shell">
      <picture>
        <source srcset="assets/images/bookmarks/ribbon-${id}.avif" type="image/avif"/>
        <img
          class="bookmark-img"
          src="assets/images/bookmarks/ribbon-${id}.png"
          alt=""
          width="237"
          height="616"
          decoding="async"
          draggable="false"
        />
      </picture>
      ${dice}
    </span>
  `;
}

const StagePlanning = {
  category: null,
  mealIndex: 0,
  meals: [],
  flipping: false,
  tabIds: TAB_ORDER.slice(),

  init() {
    this.root = document.getElementById('stage-planning');
    this.tabs = document.getElementById('recipe-tabs');
    this.activeRibbon = document.getElementById('recipe-ribbon-active');
    this.panel = document.getElementById('recipe-panel');
    this.spread = document.getElementById('recipe-spread');
    this.left = document.getElementById('recipe-left');
    this.right = document.getElementById('recipe-right');
    this.flipEl = document.getElementById('recipe-flip');
    this.prevBtn = document.getElementById('recipe-prev');
    this.nextBtn = document.getElementById('recipe-next');
    this.pageLabel = document.getElementById('recipe-page-label');
    this.continueBtn = document.getElementById('planning-continue');
    this.fullVersionModal = document.getElementById('full-version-recipe-modal');

    this.continueBtn?.addEventListener('click', () => {
      if (!GameState.selectedMealId) return;
      if (!DataMeals.isMealPlayable(GameState.selectedMealId, GameState.getUnlockedStoreIds())) return;
      GameState.beginShoppingRun(GameState.selectedMealId);
    });

    document.getElementById('full-version-recipe-close-btn')?.addEventListener('click', () => {
      this.fullVersionModal?.classList.add('hidden');
    });

    this.spread?.addEventListener('click', () => {
      const meal = this.meals[this.mealIndex];
      if (!meal) return;
      if (!DataMeals.isMealPlayable(meal.id, GameState.getUnlockedStoreIds())) {
        this.fullVersionModal?.classList.remove('hidden');
      }
    });

    this.prevBtn?.addEventListener('click', () => this.turnPage(-1));
    this.nextBtn?.addEventListener('click', () => this.turnPage(1));

    // Page flip arrows only when focus is not inside the tablist
    document.addEventListener('keydown', (e) => {
      if (GameState.currentStage !== 1) return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      if (e.target?.closest?.('.recipe-tabs')) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        this.turnPage(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        this.turnPage(1);
      }
    });

    this.render();
  },

  render() {
    if (!this.tabs) return;
    this.renderTabs();

    const categories = DataMeals.getAllCategories();
    const start = categories.find((c) => DataMeals.getMealsByCategory(c).length) || categories[0];
    this.openCategory(start, 0, { animate: false });
  },

  renderTabs() {
    this.tabs.innerHTML = '';

    this.tabIds.forEach((id, index) => {
      const meta = CATEGORY_META[id];
      if (!meta) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `recipe-tab recipe-tab--${id}`;
      btn.id = `recipe-tab-${id}`;
      btn.dataset.category = id;

      if (id === 'surprise') {
        // Permanent on-page ribbon with dice — click to randomize
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', 'Roll the dice for a random recipe');
        btn.tabIndex = 0;
      } else {
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', 'false');
        btn.setAttribute('aria-controls', 'recipe-panel');
        btn.setAttribute('aria-label', meta.label);
        btn.tabIndex = -1;
      }

      // Ribbon image + label; tab-shell handles the extend motion
      btn.innerHTML = buildBookmarkMarkup(id, meta);

      btn.addEventListener('click', () => this.activateTab(id));
      btn.addEventListener('keydown', (e) => this.onTabKeydown(e, index));

      this.tabs.appendChild(btn);
    });
  },

  onTabKeydown(e, index) {
    const last = this.tabIds.length - 1;
    let next = null;

    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      next = index === last ? 0 : index + 1;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      next = index === 0 ? last : index - 1;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = last;
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Native button already activates on Enter/Space; keep preventDefault for Space scroll
      if (e.key === ' ') e.preventDefault();
      this.activateTab(this.tabIds[index]);
      return;
    }

    if (next === null) return;
    e.preventDefault();
    const target = this.tabs.querySelector(`[data-category="${this.tabIds[next]}"]`);
    target?.focus();
  },

  activateTab(id) {
    if (id === 'surprise') {
      this.onSurprise();
      return;
    }
    this.openCategory(id, 0, { animate: true });
  },

  syncTabState() {
    const activeId = this.category;
    this.tabs?.querySelectorAll('.recipe-tab').forEach((btn) => {
      const id = btn.dataset.category;
      // Surprise is a permanent on-page action, not a meal-type tab
      if (id === 'surprise') {
        btn.classList.remove('recipe-tab--active');
        btn.setAttribute('aria-selected', 'false');
        btn.tabIndex = 0;
        return;
      }
      const isActive = id === activeId;
      btn.classList.toggle('recipe-tab--active', isActive);
      btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
      btn.tabIndex = isActive ? 0 : -1;
    });

    if (this.panel && activeId) {
      this.panel.setAttribute('aria-labelledby', `recipe-tab-${activeId}`);
    }

    this.syncActiveRibbon();
  },

  /** Open category always shows its ribbon hanging on the left page. */
  syncActiveRibbon() {
    if (!this.activeRibbon) return;
    const id = this.category;
    const meta = id && CATEGORY_META[id];
    if (!meta || id === 'surprise') {
      this.activeRibbon.innerHTML = '';
      return;
    }
    this.activeRibbon.innerHTML = buildBookmarkMarkup(id, meta);
  },

  getSortedMeals(category) {
    const meals = DataMeals.getMealsByCategory(category);
    const unlocked = GameState.getUnlockedStoreIds();
    return meals.sort((a, b) => {
      const pa = RecipeShopping.recipeIsPlayable(a, unlocked);
      const pb = RecipeShopping.recipeIsPlayable(b, unlocked);
      if (pa === pb) return 0;
      return pa ? -1 : 1;
    });
  },

  openCategory(category, index = 0, { animate = true } = {}) {
    const meals = this.getSortedMeals(category);
    const sameSpot = this.category === category && this.mealIndex === index && meals.length > 0;

    this.category = category;
    this.meals = meals;
    this.mealIndex = meals.length ? Math.min(Math.max(0, index), meals.length - 1) : 0;
    GameState.selectCategory(category);
    this.syncTabState();

    if (!meals.length) {
      this.renderEmpty();
      return;
    }

    if (sameSpot) {
      this.showCurrentMeal();
      return;
    }

    if (animate) {
      this.animateTurn(1, () => this.showCurrentMeal());
    } else {
      this.showCurrentMeal();
    }
  },

  onSurprise() {
    const dice = this.tabs?.querySelector('.recipe-tab--surprise .bookmark-dice');
    dice?.classList.remove('is-rolling');
    // Retrigger animation
    void dice?.offsetWidth;
    dice?.classList.add('is-rolling');

    const meal = DataMeals.getRandomPlayableMeal(GameState.getUnlockedStoreIds());
    if (!meal) return;
    const meals = this.getSortedMeals(meal.category);
    const index = meals.findIndex((m) => m.id === meal.id);
    this.category = meal.category;
    this.meals = meals;
    this.mealIndex = index >= 0 ? index : 0;
    GameState.selectCategory(meal.category);
    this.syncTabState();
    this.animateTurn(1, () => this.showCurrentMeal());
  },

  turnPage(dir) {
    if (this.flipping || !this.meals.length) return;
    const next = this.mealIndex + dir;
    if (next < 0 || next >= this.meals.length) return;
    this.mealIndex = next;
    this.animateTurn(dir, () => this.showCurrentMeal());
  },

  animateTurn(dir, onDone) {
    if (!this.flipEl || !this.spread) {
      onDone();
      return;
    }
    if (this.flipping) return;
    this.flipping = true;

    const source = dir > 0 ? this.right : this.left;
    this.flipEl.innerHTML = source?.innerHTML || '';
    this.flipEl.className = `recipe-flip recipe-flip--${dir > 0 ? 'forward' : 'back'} is-on`;
    this.spread.classList.add(dir > 0 ? 'is-flipping-next' : 'is-flipping-prev');

    window.setTimeout(() => {
      onDone();
    }, 180);

    window.setTimeout(() => {
      this.flipEl.className = 'recipe-flip';
      this.flipEl.innerHTML = '';
      this.spread.classList.remove('is-flipping-next', 'is-flipping-prev');
      this.flipping = false;
    }, 520);
  },

  showCurrentMeal() {
    const meal = this.meals[this.mealIndex];
    if (!meal) {
      this.renderEmpty();
      return;
    }

    GameState.selectMeal(meal.id);
    this.renderMealPages(meal);
    this.updatePager();

    const playable = DataMeals.isMealPlayable(meal.id, GameState.getUnlockedStoreIds());
    this.spread?.classList.toggle('is-locked-meal', !playable);
    if (playable) this.continueBtn?.classList.remove('hidden');
    else this.continueBtn?.classList.add('hidden');
  },

  renderEmpty() {
    const meta = CATEGORY_META[this.category] || { label: 'Recipes' };
    if (this.left) {
      this.left.innerHTML = `
        <h2 class="recipe-title">Empty chapter</h2>
        <p class="recipe-lede">No recipes here yet. Try another bookmark.</p>
        <div class="recipe-leaf-footer">
          <p class="recipe-kicker">${escapeHtml(meta.label)}</p>
        </div>
      `;
    }
    if (this.right) {
      this.right.innerHTML = `
        <p class="recipe-blank">Flip to another section of the book.</p>
      `;
    }
    GameState.selectMeal(null);
    this.spread?.classList.remove('is-locked-meal');
    this.updatePager();
    this.continueBtn?.classList.add('hidden');
  },

  renderMealPages(meal) {
    const meta = CATEGORY_META[meal.category] || { label: meal.category };
    const playable = DataMeals.isMealPlayable(meal.id, GameState.getUnlockedStoreIds());
    const glyph = MEAL_GLYPHS[meal.id] || '🍽️';
    const level = Math.min(5, Math.max(1, meal.difficulty || 1));
    const starsFilled = '★'.repeat(level);
    const starsEmpty = '☆'.repeat(5 - level);
    const imageSrc = typeof meal.image === 'string' && meal.image.startsWith('assets/')
      ? meal.image
      : null;
    const portrait = imageSrc
      ? `<span class="recipe-portrait__frame"><img class="recipe-portrait__img" src="${escapeHtml(imageSrc)}" alt="" loading="lazy"></span>`
      : `<span class="recipe-portrait__glyph">${glyph}</span>`;
    const lockBadge = playable ? '' : '<span class="recipe-lock-badge" aria-hidden="true">🔒</span>';

    const requirements = RecipeShopping.normalizeRequirements(meal);
    const ingredients = requirements.map((req) => {
      const label = RecipeShopping.getRequirementLabel(req);
      const firstId = req.type === 'generic' ? req.acceptsAnyOf?.[0] : req.ingredientId;
      const item = firstId ? DataItems.getItem(firstId) : null;
      const emoji = item?.emoji || '📦';
      return `<li class="recipe-ingredient"><span class="recipe-ingredient__mark">${emoji}</span><span>${escapeHtml(label)}</span></li>`;
    }).join('');

    const stepsPreview = (meal.recipeSteps || [])
      .slice(0, 3)
      .map((step, i) => `<li class="recipe-step-line"><span class="recipe-step-num">${i + 1}.</span> ${escapeHtml(step.text)}</li>`)
      .join('');

    if (this.left) {
      this.left.innerHTML = `
        ${lockBadge}
        <div class="recipe-title-slot">
          <h2 class="recipe-title">${escapeHtml(meal.label)}</h2>
        </div>
        <p class="recipe-difficulty" aria-label="Difficulty ${level} of 5">
          <span class="recipe-difficulty__text">Difficulty</span>
          <span class="recipe-difficulty__stars" aria-hidden="true">
            <span class="recipe-difficulty__stars-on">${starsFilled}</span><span class="recipe-difficulty__stars-off">${starsEmpty}</span>
          </span>
        </p>
        <div class="recipe-portrait" aria-hidden="true">
          ${portrait}
        </div>
        <div class="recipe-leaf-footer">
          <p class="recipe-kicker">${escapeHtml(meta.label)}</p>
        </div>
      `;
    }

    if (this.right) {
      this.right.innerHTML = `
        <h3 class="recipe-section-heading recipe-section-heading--ingredients">Ingredients</h3>
        <ul class="recipe-ingredient-list">${ingredients}</ul>
        <h3 class="recipe-section-heading">Instructions</h3>
        <ol class="recipe-step-list">${stepsPreview}</ol>
      `;
    }
  },

  updatePager() {
    const total = this.meals.length;
    const page = total ? this.mealIndex + 1 : 0;
    const hasPrev = total > 0 && this.mealIndex > 0;
    const hasNext = total > 0 && this.mealIndex < total - 1;

    if (this.pageLabel) this.pageLabel.textContent = total ? String(page) : '';

    if (this.prevBtn) {
      this.prevBtn.hidden = !hasPrev;
      this.prevBtn.disabled = !hasPrev;
    }
    if (this.nextBtn) {
      this.nextBtn.hidden = !hasNext;
      this.nextBtn.disabled = !hasNext;
    }
  },
};

window.StagePlanning = StagePlanning;
