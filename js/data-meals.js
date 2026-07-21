'use strict';

const DataMeals = {
  /** @type {Record<string, object>} */
  meals: {},
  /** @type {Record<string, object>} */
  verbs: {},

  async load() {
    try {
      const res = await fetch('./data/meals.json');
      if (!res.ok) throw new Error('Failed to load meals');
      const data = await res.json();
      this.meals = data.meals && typeof data.meals === 'object' ? data.meals : {};
      this.verbs = data.verbs && typeof data.verbs === 'object' ? data.verbs : {};
      return Object.keys(this.meals).length > 0;
    } catch {
      this.meals = {};
      this.verbs = {};
      return false;
    }
  },

  getMeal(id) {
    return this.meals[id] || null;
  },

  getMealsByCategory(category) {
    return Object.entries(this.meals)
      .filter(([, meal]) => meal.category === category)
      .map(([id, meal]) => ({ id, ...meal }));
  },

  getAllCategories() {
    return ['breakfast', 'lunch', 'dinner', 'snack', 'dessert'];
  },

  getRandomMeal() {
    const ids = Object.keys(this.meals);
    if (!ids.length) return null;
    const id = ids[Math.floor(Math.random() * ids.length)];
    return { id, ...this.meals[id] };
  },
};

window.DataMeals = DataMeals;
