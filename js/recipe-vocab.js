'use strict';

const RecipeVocab = {
  recipeVocab(recipe) {
    if (!recipe) return { ingredients: [], verbs: [], all: [] };

    const requirements = RecipeShopping.normalizeRequirements(recipe);
    const ingredients = [];
    const seen = new Set();

    requirements.forEach((req) => {
      const ids = RecipeShopping.getAcceptedIds(req);
      ids.forEach((id) => {
        const item = DataItems.getItem(id);
        // `label` is a shopping string ("jar of peanut butter"); `word` is the
        // lexical item the learner is actually being taught.
        const word = item?.word || item?.label || id;
        const key = word.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        ingredients.push({
          word,
          label: RecipeShopping.getRequirementLabel(req),
          emoji: item?.emoji || '📦',
          definition: item?.definition || '',
        });
      });
    });

    const verbs = [];
    const verbSeen = new Set();
    (recipe.recipeSteps || []).forEach((step) => {
      const v = step.verb;
      if (!v || verbSeen.has(v)) return;
      verbSeen.add(v);
      const meta = DataMeals.verbs?.[v] || {};
      verbs.push({
        word: v,
        definition: meta.definition || '',
      });
    });

    const all = [...new Set([
      ...ingredients.map((i) => i.word),
      ...verbs.map((v) => v.word),
    ])];

    return { ingredients, verbs, all };
  },
};

window.RecipeVocab = RecipeVocab;
