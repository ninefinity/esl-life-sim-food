'use strict';

const { escapeHtml } = window.GameUtils;

const StagePlanning = {
  init() {
    this.root = document.getElementById('stage-planning');
    this.categoryPicker = document.getElementById('planning-categories');
    this.mealList = document.getElementById('planning-meals');
    this.mealDetail = document.getElementById('planning-detail');
    this.continueBtn = document.getElementById('planning-continue');

    this.continueBtn?.addEventListener('click', () => {
      if (GameState.selectedMealId) GameState.setStage(2);
    });

    this.render();
  },

  render() {
    if (!this.categoryPicker) return;
    this.renderCategories();
    this.mealList.innerHTML = '';
    this.mealDetail.innerHTML = '';
    this.mealDetail.classList.add('hidden');
    this.continueBtn?.classList.add('hidden');
  },

  renderCategories() {
    const categories = DataMeals.getAllCategories();
    this.categoryPicker.innerHTML = '';

    categories.forEach((cat) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn--category';
      btn.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
      btn.addEventListener('click', () => this.onCategorySelect(cat));
      this.categoryPicker.appendChild(btn);
    });

    const surprise = document.createElement('button');
    surprise.type = 'button';
    surprise.className = 'btn btn--category btn--surprise';
    surprise.textContent = 'Surprise Me';
    surprise.addEventListener('click', () => this.onSurprise());
    this.categoryPicker.appendChild(surprise);
  },

  onCategorySelect(category) {
    GameState.selectCategory(category);
    this.renderMeals(category);
  },

  onSurprise() {
    const meal = DataMeals.getRandomMeal();
    if (!meal) return;
    GameState.selectCategory(meal.category);
    GameState.selectMeal(meal.id);
    this.renderMealDetail(meal.id);
  },

  renderMeals(category) {
    this.mealList.innerHTML = '';
    this.mealDetail.classList.add('hidden');
    this.continueBtn?.classList.add('hidden');

    const meals = DataMeals.getMealsByCategory(category);
    if (!meals.length) {
      this.mealList.innerHTML = '<p class="placeholder-text">No meals in this category yet.</p>';
      return;
    }

    meals.forEach((meal) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'meal-card';
      card.innerHTML = `
        <span class="meal-card__emoji">🍽️</span>
        <span class="meal-card__label">${escapeHtml(meal.label)}</span>
      `;
      card.addEventListener('click', () => {
        GameState.selectMeal(meal.id);
        this.renderMealDetail(meal.id);
      });
      this.mealList.appendChild(card);
    });
  },

  renderMealDetail(mealId) {
    const meal = DataMeals.getMeal(mealId);
    if (!meal) return;

    this.mealDetail.classList.remove('hidden');
    this.continueBtn?.classList.remove('hidden');

    const ingredients = meal.ingredients.map((id) => {
      const item = DataItems.getItem(id);
      const label = item?.label || id;
      const emoji = item?.emoji || '📦';
      return `<li>${emoji} ${escapeHtml(label)}</li>`;
    }).join('');

    this.mealDetail.innerHTML = `
      <h3>${escapeHtml(meal.label)}</h3>
      <p>You need:</p>
      <ul class="ingredient-list">${ingredients}</ul>
    `;
  },
};

window.StagePlanning = StagePlanning;
