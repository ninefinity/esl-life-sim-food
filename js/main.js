'use strict';

async function boot() {
  const [mealsOk, itemsOk] = await Promise.all([
    window.DataMeals.load(),
    window.DataItems.load(),
  ]);

  if (!mealsOk || !itemsOk) {
    const el = document.getElementById('boot-error');
    if (el) el.classList.remove('hidden');
    return;
  }

  window.StagePlanning.init();
  window.StageShopSelect.init();
  window.StageShopping.init();
  window.StageCooking.init();
  window.StageEating.init();
  window.Pictionary.init();

  window.addEventListener('stagechange', (e) => {
    const stage = e.detail.stage;
    if (stage === 1) window.StagePlanning.render();
    if (stage === 2) window.StageShopSelect.render();
    if (stage === 3) window.StageShopping.enter();
    if (stage === 4) window.StageCooking.enter();
    if (stage === 5) window.StageEating.render();
  });

  document.getElementById('pictionary-open')?.addEventListener('click', () => {
    window.Pictionary.open();
  });

  GameState.setStage(1);
}

document.addEventListener('DOMContentLoaded', boot);
