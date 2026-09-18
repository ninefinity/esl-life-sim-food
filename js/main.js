'use strict';

async function boot() {
  const [mealsOk, itemsOk, storesOk] = await Promise.all([
    window.DataMeals.load(),
    window.DataItems.load(),
    window.DataStores.load(),
    window.GamePersistence.load(),
  ]);

  if (!mealsOk || !itemsOk || !storesOk) {
    const el = document.getElementById('boot-error');
    if (el) el.classList.remove('hidden');
    return;
  }

  window.StagePlanning.init();
  window.StageMap.init();
  window.StageShopping.init();
  window.MiniGames.init();
  window.StageCooking.init();
  window.StageEating.init();
  window.Pictionary.init();

  window.addEventListener('stagechange', (e) => {
    const stage = e.detail.stage;
    if (stage === 1) window.StagePlanning.render();
    if (stage === 2) {
      if (GameState.shoppingPhase === 'map') window.StageMap.enter();
      else if (GameState.shoppingPhase === 'games') window.MiniGames.enter();
      else if (GameState.currentStore && GameState.shoppingPhase !== 'checkout') {
        window.StageShopping.enterStore(GameState.currentStore);
      }
    }
    if (stage === 3) window.StageCooking.enter();
    if (stage === 4) window.StageEating.render();
  });

  window.addEventListener('shoppingphasechange', () => {
    if (GameState.currentStage !== 2) return;
    window.StageMap.syncViews();
    const phase = GameState.shoppingPhase;
    if (phase === 'map') window.StageMap.render();
    else if (phase === 'games') window.MiniGames.enter();
    else if (phase === 'store' && GameState.currentStore) {
      window.StageShopping.enterStore(GameState.currentStore, { resume: true });
    }
  });

  document.getElementById('pictionary-open')?.addEventListener('click', () => {
    window.Pictionary.open();
  });

  GameState.setStage(1);
}

document.addEventListener('DOMContentLoaded', boot);
