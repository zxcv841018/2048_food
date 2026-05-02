// ── Game Engine ──────────────────────────────────────────────────────────────

function slideRow(row) {
  // Remove zeros, slide left
  let filtered = row.filter(v => v !== 0);
  let score = 0;
  for (let i = 0; i < filtered.length - 1; i++) {
    if (filtered[i] === filtered[i + 1]) {
      filtered[i] = filtered[i] + 1;
      score += Math.pow(2, filtered[i]);
      filtered.splice(i + 1, 1);
    }
  }
  while (filtered.length < 4) filtered.push(0);
  return { row: filtered, score };
}

function rotateGrid(grid, times) {
  let g = [...grid];
  for (let t = 0; t < times; t++) {
    let ng = Array(16).fill(0);
    for (let r = 0; r < 4; r++)
      for (let c = 0; c < 4; c++)
        ng[c * 4 + (3 - r)] = g[r * 4 + c];
    g = ng;
  }
  return g;
}

function moveGrid(grid, dir) {
  // Normalize: rotate so target direction aligns with "left", slide, rotate back
  // CCW = 3×CW. up→CCW then back CW; down→CW then back CCW
  const rotMap  = { left: 0, up: 3, right: 2, down: 1 };
  const rotBack = { left: 0, up: 1, right: 2, down: 3 };
  let g = rotateGrid(grid, rotMap[dir]);
  let totalScore = 0;
  let rows = [];
  for (let r = 0; r < 4; r++) {
    let { row, score } = slideRow([g[r*4], g[r*4+1], g[r*4+2], g[r*4+3]]);
    rows.push(...row);
    totalScore += score;
  }
  let result = rotateGrid(rows, rotBack[dir]);
  return { grid: result, score: totalScore };
}

function canMove(grid) {
  if (grid.includes(0)) return true;
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let v = grid[r*4+c];
      if (c < 3 && grid[r*4+c+1] === v) return true;
      if (r < 3 && grid[(r+1)*4+c] === v) return true;
    }
  }
  return false;
}

function addRandomTile(grid) {
  let empty = [];
  grid.forEach((v, i) => { if (v === 0) empty.push(i); });
  if (empty.length === 0) return grid;
  let idx = empty[Math.floor(Math.random() * empty.length)];
  let val = Math.random() < 0.85 ? 1 : 2;
  let ng = [...grid];
  ng[idx] = val;
  return ng;
}

// ── Pixel Sprite Renderer ─────────────────────────────────────────────────────

function drawSprite(canvas, food, size) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  const pixSize = size / 16;
  food.px.forEach((row, r) => {
    for (let c = 0; c < 16; c++) {
      const ch = row[c];
      if (ch === '0') continue;
      const palIdx = parseInt(ch) - 1;
      ctx.fillStyle = food.pal[palIdx] || '#000';
      ctx.fillRect(Math.floor(c * pixSize), Math.floor(r * pixSize),
                   Math.ceil(pixSize), Math.ceil(pixSize));
    }
  });
}

// ── State ─────────────────────────────────────────────────────────────────────

let state = {
  grid: Array(16).fill(0),
  score: 0,
  best: parseInt(localStorage.getItem('best') || '0'),
  bestFoodIdx: 0,
  prevGrid: null,
  prevScore: 0,
  isGameOver: false,
  isWin: false,
  winContinued: false
};

function newGame() {
  let grid = Array(16).fill(0);
  grid = addRandomTile(grid);
  grid = addRandomTile(grid);
  state = {
    grid,
    score: 0,
    best: state.best,
    bestFoodIdx: 0,
    prevGrid: null,
    prevScore: 0,
    isGameOver: false,
    isWin: false,
    winContinued: false
  };
  render();
}

function move(dir) {
  if (state.isGameOver) return;
  if (state.isWin && !state.winContinued) return;

  const { grid: newGrid, score: gained } = moveGrid(state.grid, dir);

  // No change - invalid move
  if (newGrid.every((v, i) => v === state.grid[i])) return;

  // Save undo state
  state.prevGrid = [...state.grid];
  state.prevScore = state.score;

  state.grid = addRandomTile(newGrid);
  state.score += gained;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('best', state.best);
  }

  const maxTile = Math.max(...state.grid);
  if (maxTile > state.bestFoodIdx) state.bestFoodIdx = maxTile;

  if (maxTile === 12 && !state.winContinued) {
    state.isWin = true;
  }

  if (!canMove(state.grid)) {
    state.isGameOver = true;
  }

  render();
}

function undo() {
  if (!state.prevGrid) return;
  state.grid = state.prevGrid;
  state.score = state.prevScore;
  state.prevGrid = null;
  state.isGameOver = false;
  render();
}

// ── DOM Helpers ───────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

let lastGrid = Array(16).fill(0);

function render() {
  // Scores
  animateScore('score-val', state.score);
  $('best-val').textContent = state.best;
  $('best-food-val').textContent = state.bestFoodIdx > 0
    ? FOODS[state.bestFoodIdx - 1].name : '—';

  // Board
  const board = $('board');
  for (let i = 0; i < 16; i++) {
    let cell = board.children[i];
    const val = state.grid[i];
    const prev = lastGrid[i];

    // Clear existing content
    cell.className = 'cell';
    cell.innerHTML = '';

    if (val === 0) {
      lastGrid[i] = 0;
      continue;
    }

    const food = FOODS[val - 1];
    cell.style.backgroundColor = food.bg;
    cell.dataset.val = val;

    // Pixel sprite
    const canvas = document.createElement('canvas');
    canvas.className = 'sprite';
    const cellSize = board.clientWidth > 0
      ? Math.floor((board.clientWidth - 5 * 8) / 4)
      : 80;
    const spriteSize = Math.floor(cellSize * 0.62);
    drawSprite(canvas, food, spriteSize);
    cell.appendChild(canvas);

    const label = document.createElement('div');
    label.className = 'cell-label';
    label.textContent = food.name;
    cell.appendChild(label);

    if (prev === 0) {
      cell.classList.add('tile-new');
    } else if (val === prev + 1 && val > prev) {
      // merged from previous move - check if this position had a merge
      cell.classList.add('tile-merge');
    }

    lastGrid[i] = val;
  }

  // Progress bar
  const pct = (state.bestFoodIdx / 12) * 100;
  $('progress-fill').style.width = pct + '%';
  $('progress-text').textContent = state.bestFoodIdx + ' / 12';

  // Next target
  const nextIdx = Math.min(state.bestFoodIdx, 11);
  const nextFood = FOODS[nextIdx];
  $('next-target-name').textContent = nextIdx === state.bestFoodIdx
    ? FOODS[nextIdx].name
    : '頂級盛宴達成！';

  const nc = $('next-target-canvas');
  drawSprite(nc, nextFood, 32);

  // Overlay
  const overlay = $('overlay');
  if (state.isWin && !state.winContinued) {
    overlay.className = 'overlay show';
    $('overlay-title').textContent = '🎉 恭喜！';
    $('overlay-sub').textContent = '頂級盛宴達成！';
    $('overlay-btn').textContent = '繼續遊戲';
  } else if (state.isGameOver) {
    overlay.className = 'overlay show';
    $('overlay-title').textContent = '遊戲結束 😢';
    $('overlay-sub').textContent = '格子已滿，無法移動';
    $('overlay-btn').textContent = '再試一次';
  } else {
    overlay.className = 'overlay';
  }
}

let lastScoreVal = 0;
function animateScore(id, val) {
  const el = $(id);
  el.textContent = val;
  if (val > lastScoreVal) {
    el.classList.remove('score-pop');
    void el.offsetWidth; // reflow
    el.classList.add('score-pop');
  }
  lastScoreVal = val;
}

// ── Help Modal ────────────────────────────────────────────────────────────────

function openHelp() {
  const modal = $('help-modal');
  modal.classList.add('show');

  // Render food grid in help
  const grid = $('help-food-grid');
  grid.innerHTML = '';
  FOODS.forEach((food, i) => {
    const item = document.createElement('div');
    item.className = 'help-food-item';

    const canvas = document.createElement('canvas');
    drawSprite(canvas, food, 40);
    item.appendChild(canvas);

    const name = document.createElement('div');
    name.className = 'help-food-name';
    name.textContent = `Lv.${i+1} ${food.name}`;
    item.appendChild(name);

    grid.appendChild(item);
  });
}

function closeHelp() {
  $('help-modal').classList.remove('show');
}

// ── Input Handling ────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  const map = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', W: 'up', s: 'down', S: 'down', a: 'left', A: 'left', d: 'right', D: 'right'
  };
  if (map[e.key]) {
    e.preventDefault();
    move(map[e.key]);
  }
  if (e.key === 'Escape') closeHelp();
});

let touchStart = null;
document.addEventListener('touchstart', e => {
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

document.addEventListener('touchend', e => {
  if (!touchStart) return;
  const dx = e.changedTouches[0].clientX - touchStart.x;
  const dy = e.changedTouches[0].clientY - touchStart.y;
  const minDist = 20;
  if (Math.abs(dx) < minDist && Math.abs(dy) < minDist) return;
  if (Math.abs(dx) > Math.abs(dy)) {
    move(dx > 0 ? 'right' : 'left');
  } else {
    move(dy > 0 ? 'down' : 'up');
  }
  touchStart = null;
}, { passive: true });

// ── Init ──────────────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  $('btn-new').addEventListener('click', newGame);
  $('btn-undo').addEventListener('click', undo);
  $('btn-help').addEventListener('click', openHelp);
  $('help-close').addEventListener('click', closeHelp);
  $('help-modal').addEventListener('click', e => {
    if (e.target === $('help-modal')) closeHelp();
  });
  $('overlay-btn').addEventListener('click', () => {
    if (state.isWin && !state.isGameOver) {
      state.winContinued = true;
      state.isWin = false;
      render();
    } else {
      newGame();
    }
  });

  newGame();
});
