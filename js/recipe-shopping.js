'use strict';

const RecipeShopping = {
  getReqItemId(req) {
    return req?.itemId || req?.ingredientId || null;
  },

  isGeneric(req) {
    if (req?.group && Array.isArray(req.acceptsAnyOf) && req.acceptsAnyOf.length) return true;
    if (req?.type === 'generic') return true;
    return false;
  },

  isSpecific(req) {
    return !this.isGeneric(req) && !!this.getReqItemId(req);
  },

  normalizeRequirements(meal) {
    if (!meal) return [];

    if (Array.isArray(meal.ingredientRequirements) && meal.ingredientRequirements.length) {
      return meal.ingredientRequirements.map((req) => this.normalizeRequirement(req));
    }

    return (meal.ingredients || []).map((ingredientId) => {
      const item = DataItems.getItem(ingredientId);
      return this.normalizeRequirement({
        text: item?.label || ingredientId,
        itemId: ingredientId,
      });
    });
  },

  normalizeRequirement(req) {
    const copy = { ...req };
    const itemId = this.getReqItemId(copy);

    if (copy.group && (!copy.acceptsAnyOf || !copy.acceptsAnyOf.length)) {
      copy.acceptsAnyOf = this.idsForGroup(copy.group);
    }

    if (this.isGeneric(copy)) {
      copy.type = 'generic';
      if (!copy.text) copy.text = copy.group ? `${copy.group.replace(/-/g, ' ')}` : 'ingredient';
      return copy;
    }

    copy.type = 'specific';
    if (itemId) {
      copy.itemId = itemId;
      if (!copy.text) {
        const item = DataItems.getItem(itemId);
        copy.text = item?.label || itemId;
      }
    }
    return copy;
  },

  idsForGroup(group) {
    return Object.entries(DataItems.items || {})
      .filter(([, item]) => item.group === group)
      .map(([id]) => id);
  },

  getRequirementLabel(req) {
    if (req.text) return req.text;
    if (this.isGeneric(req)) return req.group?.replace(/-/g, ' ') || 'ingredient';
    const item = DataItems.getItem(this.getReqItemId(req));
    return item?.label || this.getReqItemId(req) || 'ingredient';
  },

  getRequirementEslLabel(req) {
    const label = this.getRequirementLabel(req);
    if (/^I need/i.test(label)) return label;
    return `I need ${label}`;
  },

  isRequirementMet(req, purchasedIngredients) {
    const purchased = purchasedIngredients || {};
    if (this.isGeneric(req)) {
      return (req.acceptsAnyOf || []).some((id) => (purchased[id] || 0) >= 1);
    }
    const id = this.getReqItemId(req);
    return id ? (purchased[id] || 0) >= 1 : false;
  },

  allRequirementsMet(requirements, purchasedIngredients) {
    return requirements.every((req) => this.isRequirementMet(req, purchasedIngredients));
  },

  getUnmetRequirements(requirements, purchasedIngredients) {
    return requirements.filter((req) => !this.isRequirementMet(req, purchasedIngredients));
  },

  getAcceptedIds(req) {
    if (this.isGeneric(req)) return req.acceptsAnyOf || [];
    const id = this.getReqItemId(req);
    return id ? [id] : [];
  },

  cheapestRequirementCost(req) {
    const ids = this.getAcceptedIds(req);
    if (!ids.length) return 5;
    return Math.min(...ids.map((id) => WordWallet.itemPriceCents(id)));
  },

  getStoresForRequirement(req) {
    const storeSet = new Set();
    this.getAcceptedIds(req).forEach((ingredientId) => {
      const item = DataItems.getItem(ingredientId);
      (item?.storeIds || []).forEach((storeId) => storeSet.add(storeId));
    });
    return [...storeSet];
  },

  recomputeRequiredStores(requirements, purchasedIngredients, unlockedStoreIds) {
    const unlocked = new Set(unlockedStoreIds || []);
    const unmet = this.getUnmetRequirements(requirements, purchasedIngredients);
    const storeSet = new Set();

    unmet.forEach((req) => {
      this.getStoresForRequirement(req).forEach((storeId) => {
        if (storeId !== 'home' && unlocked.has(storeId)) {
          storeSet.add(storeId);
        }
      });
    });

    return [...storeSet];
  },

  recipeRequiredStores(recipe, unlockedStoreIds) {
    const requirements = this.normalizeRequirements(recipe);
    return this.recomputeRequiredStores(requirements, {}, unlockedStoreIds);
  },

  recipeIsPlayable(recipe, unlockedStoreIds) {
    const requirements = this.normalizeRequirements(recipe);
    const unlocked = new Set(unlockedStoreIds || []);

    return requirements.every((req) => {
      const stores = this.getStoresForRequirement(req).filter((id) => id !== 'home');
      if (!stores.length) return false;
      return stores.some((storeId) => unlocked.has(storeId));
    });
  },

  getRelevantItemIdsForStore(storeId, requirements, purchasedIngredients) {
    const unmet = this.getUnmetRequirements(requirements, purchasedIngredients);
    const store = DataStores.getStore(storeId);
    if (!store) return [];
    const storeItems = new Set(store.itemIds || []);
    const relevant = new Set();

    unmet.forEach((req) => {
      this.getAcceptedIds(req).forEach((id) => {
        if (storeItems.has(id)) relevant.add(id);
      });
    });

    return [...relevant];
  },
};

window.RecipeShopping = RecipeShopping;
