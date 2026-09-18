'use strict';

const DB_NAME = 'esl-life-sim';
const DB_VERSION = 1;
const STORE_NAME = 'gameState';
const STATE_KEY = 'current';

const PERSISTED_KEYS = [
  'unlockedStores',
  'wallet',
  'miniGamesPlayed',
  'wordollarsEarned',
];

let saveTimer = null;

const GamePersistence = {
  /** @type {IDBDatabase|null} */
  db: null,

  openDb() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        resolve(this.db);
        return;
      }
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = () => reject(request.error);
    });
  },

  applyPersistedSnapshot(raw) {
    if (!raw || typeof raw !== 'object') return;
    if (raw.unlockedStores) GameState.unlockedStores = { ...raw.unlockedStores };
    if (raw.miniGamesPlayed != null) GameState.miniGamesPlayed = raw.miniGamesPlayed;
    if (raw.wordollarsEarned != null) GameState.wordollarsEarned = raw.wordollarsEarned;

    if (raw.wallet == null) return;
    const migrated = WordWallet.migrateLegacyWallet(raw.wallet);
    if (migrated) {
      GameState.wallet = migrated;
    } else if (WordWallet.isWalletObject(raw.wallet)) {
      GameState.wallet = WordWallet.normalizeWallet(raw.wallet);
    }
  },

  async load() {
    try {
      const db = await this.openDb();
      const raw = await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(STATE_KEY);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });

      this.applyPersistedSnapshot(raw);
      GameState.migrateLegacyUnlocks();
      WordWallet.ensureSeeded();
      return true;
    } catch {
      GameState.migrateLegacyUnlocks();
      WordWallet.ensureSeeded();
      return false;
    }
  },

  getSnapshot() {
    const snapshot = {};
    PERSISTED_KEYS.forEach((key) => {
      snapshot[key] = GameState[key];
    });
    return snapshot;
  },

  save() {
    if (saveTimer) window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      this.saveNow().catch(() => {});
    }, 300);
  },

  async saveNow() {
    const db = await this.openDb();
    const snapshot = this.getSnapshot();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(snapshot, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

window.GamePersistence = GamePersistence;
