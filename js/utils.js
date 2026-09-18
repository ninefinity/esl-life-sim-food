'use strict';

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function spawnConfetti() {
  const layer = document.getElementById('confetti-layer');
  if (!layer) return;
  layer.innerHTML = '';
  const colors = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];
  for (let i = 0; i < 40; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.left = `${randInt(0, 100)}%`;
    piece.style.background = colors[randInt(0, colors.length - 1)];
    piece.style.animationDelay = `${randInt(0, 500)}ms`;
    layer.appendChild(piece);
  }
}

function clearConfetti() {
  const layer = document.getElementById('confetti-layer');
  if (layer) layer.innerHTML = '';
}

window.escapeHtml = escapeHtml;
window.randInt = randInt;
window.shuffle = shuffle;
window.spawnConfetti = spawnConfetti;
window.clearConfetti = clearConfetti;

window.GameUtils = {
  escapeHtml,
  randInt,
  shuffle,
  spawnConfetti,
  clearConfetti,
};
