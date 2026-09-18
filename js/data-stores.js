'use strict';

const DataStores = {
  /** @type {Record<string, object>} */
  stores: {},

  async load() {
    try {
      const res = await fetch('./data/stores.json');
      if (!res.ok) throw new Error('Failed to load stores');
      const data = await res.json();
      this.stores = data.stores && typeof data.stores === 'object' ? data.stores : {};
      return Object.keys(this.stores).length > 0;
    } catch {
      this.stores = {};
      return false;
    }
  },

  getStore(id) {
    return this.stores[id] || null;
  },

  getAll() {
    return Object.entries(this.stores).map(([id, store]) => ({ id, ...store }));
  },

  getStoreIds() {
    return Object.keys(this.stores);
  },
};

window.DataStores = DataStores;
