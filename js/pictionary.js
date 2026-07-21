'use strict';

const { escapeHtml } = window.GameUtils;

const Pictionary = {
  init() {
    this.modal = document.getElementById('pictionary-modal');
    this.searchInput = document.getElementById('pictionary-search');
    this.listEl = document.getElementById('pictionary-list');
    this.closeBtn = document.getElementById('pictionary-close');

    this.closeBtn?.addEventListener('click', () => this.close());
    this.modal?.addEventListener('click', (e) => {
      if (e.target === this.modal) this.close();
    });
    this.searchInput?.addEventListener('input', () => this.renderList(this.searchInput.value));
  },

  open() {
    this.modal?.classList.remove('hidden');
    if (this.searchInput) {
      this.searchInput.value = '';
      this.searchInput.focus();
    }
    this.renderList('');
  },

  close() {
    this.modal?.classList.add('hidden');
  },

  getAllEntries() {
    /** @type {{ id: string, label: string, definition: string, emoji: string, type: string }[]} */
    const entries = [];

    Object.entries(DataItems.items).forEach(([id, item]) => {
      entries.push({
        id,
        label: item.label || id,
        definition: item.definition || '',
        emoji: item.emoji || '📦',
        type: 'noun',
      });
    });

    Object.entries(DataMeals.verbs).forEach(([id, verb]) => {
      entries.push({
        id,
        label: verb.label || id,
        definition: verb.definition || '',
        emoji: '✏️',
        type: 'verb',
      });
    });

    return entries.sort((a, b) => a.label.localeCompare(b.label));
  },

  renderList(query) {
    if (!this.listEl) return;
    const q = query.trim().toLowerCase();
    const entries = this.getAllEntries().filter((e) => {
      if (!q) return true;
      return e.label.toLowerCase().includes(q)
        || e.definition.toLowerCase().includes(q)
        || e.type.includes(q);
    });

    if (!entries.length) {
      this.listEl.innerHTML = '<p class="placeholder-text">No matches.</p>';
      return;
    }

    this.listEl.innerHTML = entries.map((e) => `
      <div class="pictionary-entry">
        <span class="pictionary-entry__emoji">${escapeHtml(e.emoji)}</span>
        <div class="pictionary-entry__body">
          <strong>${escapeHtml(e.label)}</strong>
          <span class="pictionary-entry__type">${escapeHtml(e.type)}</span>
          <p>${escapeHtml(e.definition)}</p>
        </div>
      </div>
    `).join('');
  },
};

window.Pictionary = Pictionary;
