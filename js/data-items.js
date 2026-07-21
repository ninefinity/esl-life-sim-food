'use strict';

const DataItems = {
  /** @type {Record<string, object>} */
  items: {},

  async load() {
    try {
      const res = await fetch('./data/levels.json');
      if (!res.ok) throw new Error('Failed to load items');
      const data = await res.json();
      this.items = data.items && typeof data.items === 'object' ? data.items : {};
      return Object.keys(this.items).length > 0;
    } catch {
      this.items = {};
      return false;
    }
  },

  getItem(id) {
    return this.items[id] || null;
  },

  getAllIds() {
    return Object.keys(this.items);
  },

  getCategories() {
    const cats = new Set();
    Object.values(this.items).forEach((item) => {
      if (item.category) cats.add(item.category);
    });
    return [...cats].sort();
  },

  getItemsByCategory(category) {
    return Object.entries(this.items)
      .filter(([, item]) => item.category === category)
      .map(([id, item]) => ({ id, ...item }));
  },
};

window.DataItems = DataItems;
