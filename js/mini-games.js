'use strict';

const MiniGames = {
  types: {
    spelling: { label: 'Spelling', ready: true },
    unscramble: { label: 'Unscramble letters', ready: false },
    sentence: { label: 'Unscramble sentence', ready: false },
    fillBlank: { label: 'Fill in the word', ready: false },
    match: { label: 'Matching', ready: false },
    wordsearch: { label: 'Word search', ready: false },
  },

  init() {
    this.root = document.getElementById('town-games-view');
    this.pickerEl = document.getElementById('mini-games-picker');
    this.panelEl = document.getElementById('mini-games-panel');
    this.resultEl = document.getElementById('mini-games-result');

    document.getElementById('town-back-map-from-games')?.addEventListener('click', () => {
      StageMap.returnToMap();
    });

    this.renderPicker();
  },

  enter() {
    this.renderPicker();
    if (this.panelEl) this.panelEl.innerHTML = '';
    if (this.resultEl) this.resultEl.textContent = '';
    StageMap.renderWallet?.();
    const label = document.getElementById('games-recipe-label');
    if (label) label.textContent = GameState.selectedRecipe?.label || 'your recipe';
  },

  renderPicker() {
    if (!this.pickerEl) return;
    this.pickerEl.innerHTML = '';

    Object.entries(this.types).forEach(([id, meta]) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mini-game-card' + (meta.ready ? '' : ' mini-game-card--soon');
      btn.innerHTML = `
        <span class="mini-game-card__title">${escapeHtml(meta.label)}</span>
        <span class="mini-game-card__meta">${meta.ready ? 'Play' : 'Coming soon'}</span>
      `;
      btn.disabled = !meta.ready;
      if (meta.ready) {
        btn.addEventListener('click', () => this.play(id));
      }
      this.pickerEl.appendChild(btn);
    });
  },

  play(type) {
    const recipe = GameState.selectedRecipe;
    const vocab = RecipeVocab.recipeVocab(recipe);
    const difficulty = Math.min(5, Math.max(1, recipe?.difficulty || 1));

    if (type === 'spelling') {
      this.playSpelling(vocab, difficulty, recipe);
      return;
    }

    this.renderStub(type);
  },

  renderStub(type) {
    const meta = this.types[type];
    if (this.panelEl) {
      this.panelEl.innerHTML = `
        <p class="mini-games-soon">${escapeHtml(meta?.label || type)} is coming soon!</p>
      `;
    }
  },

  playSpelling(vocab, difficulty, recipe) {
    const pool = [...vocab.ingredients, ...vocab.verbs];
    if (!pool.length) {
      if (this.panelEl) this.panelEl.innerHTML = '<p>Pick a recipe first!</p>';
      return;
    }

    const rounds = Math.min(5, Math.max(3, 2 + difficulty));
    const cards = shuffle(pool).slice(0, Math.min(rounds, pool.length));
    let index = 0;
    let correct = 0;

    const renderRound = () => {
      if (index >= cards.length) {
        this.finish(correct, cards.length, recipe);
        return;
      }

      const card = cards[index];
      const prompt = card.emoji
        ? `<span class="mini-spell__emoji">${card.emoji}</span>`
        : '';
      const hint = card.definition
        ? `<p class="mini-spell__hint">${escapeHtml(card.definition)}</p>`
        : '';

      if (this.panelEl) {
        this.panelEl.innerHTML = `
          <p class="mini-spell__progress">Word ${index + 1} of ${cards.length}</p>
          ${prompt}
          ${hint}
          <label class="mini-spell__label" for="mini-spell-input">Type the word:</label>
          <input id="mini-spell-input" class="mini-spell__input" type="text" autocomplete="off" />
          <button id="mini-spell-check" class="btn btn--primary" type="button">Check</button>
          <p id="mini-spell-feedback" class="mini-spell__feedback" aria-live="polite"></p>
        `;
      }

      const input = document.getElementById('mini-spell-input');
      const feedback = document.getElementById('mini-spell-feedback');
      input?.focus();

      const check = () => {
        const answer = (input?.value || '').trim().toLowerCase();
        if (!answer) {
          if (feedback) feedback.textContent = 'Type a word first.';
          return;
        }
        if (answer === card.word.toLowerCase()) {
          correct += 1;
          index += 1;
          renderRound();
        } else if (feedback) {
          feedback.textContent = `Try again! The word starts with "${card.word[0]}".`;
        }
      };

      document.getElementById('mini-spell-check')?.addEventListener('click', check);
      input?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') check();
      });
    };

    renderRound();
  },

  payoutForScore(correct, total, recipe) {
    const full = WordWallet.miniGamePayoutCents(recipe, total);
    if (correct >= Math.ceil(total / 2)) return full;
    return Math.max(100, Math.round(full * 0.5));
  },

  finish(correct, total, recipe) {
    const payoutCents = this.payoutForScore(correct, total, recipe);
    WordWallet.ensureSeeded();
    WordWallet.addRandomFunds(GameState.wallet, payoutCents);
    GameState.miniGamesPlayed = (GameState.miniGamesPlayed || 0) + 1;
    GameState.wordollarsEarned = (GameState.wordollarsEarned || 0) + payoutCents;
    GameState.persist();
    StageMap.renderWallet?.();
    StageMap.hideLowBalanceToast?.();

    const payoutLabel = WordWallet.formatCentsShort(payoutCents);
    if (this.panelEl) {
      this.panelEl.innerHTML = `
        <p class="mini-games-win">Great job! You earned <strong>${escapeHtml(payoutLabel)}</strong>.</p>
        <button class="btn btn--primary" type="button" id="mini-games-again">Play again</button>
      `;
    }
    if (this.resultEl) {
      this.resultEl.textContent = `+${payoutLabel} added to your wallet.`;
    }

    document.getElementById('mini-games-again')?.addEventListener('click', () => this.play('spelling'));
  },
};

window.MiniGames = MiniGames;
