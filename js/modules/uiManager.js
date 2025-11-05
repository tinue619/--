// ========== UI MANAGER ==========
// Управление элементами интерфейса, режимами и статистикой

import { render2D } from './render2D.js';
import { initViewer3D } from './render3D.js';
import { clearHistoryLog, toggleHistoryCollapse, copyHistoryLogs, setupHistoryDrag } from './historyLogging.js';

/**
 * Настройка всех обработчиков событий UI
 * @param {App} app - Экземпляр приложения
 */
export function setupEvents(app) {
  // UI элементы
  const addListener = (selector, event, handler) => {
    const el = selector instanceof Element ? selector : document.querySelector(selector);
    if (el) el.addEventListener(event, handler);
  };
  
  document.querySelectorAll('.tab').forEach(tab => 
    addListener(tab, 'click', () => switchTab(app, tab))
  );
  
  document.querySelectorAll('.mode-btn').forEach(btn => 
    addListener(btn, 'click', () => setMode(app, btn.dataset.mode))
  );
  
  addListener('.clear-btn', 'click', () => app.clearAll());
  addListener('#mirror-btn', 'click', () => app.mirrorContent());
  addListener('#undo-btn', 'click', () => app.undo());
  addListener('#redo-btn', 'click', () => app.redo());
  addListener('#clear-history-btn', 'click', () => clearHistoryLog());
  addListener('#collapse-history-btn', 'click', () => toggleHistoryCollapse());
  addListener('#copy-history-btn', 'click', () => copyHistoryLogs(app));
  
  // Перетаскивание панели истории
  setupHistoryDrag();
  
  // Canvas события
  const canvas = app.canvas.element;
  const pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
  pointerEvents.forEach(event => 
    addListener(canvas, event, (e) => app.handlePointer(e), { passive: false })
  );
  
  window.addEventListener('resize', () => app.updateCanvas());
}

/**
 * Установить режим редактирования
 * @param {App} app - Экземпляр приложения
 * @param {string} mode - Режим (shelf, divider, drawer, move, delete)
 */
export function setMode(app, mode) {
  app.mode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
  updateStatus(app);
}

/**
 * Обновить строку статуса
 * @param {App} app - Экземпляр приложения
 * @param {string} temp - Временное сообщение (опционально)
 */
export function updateStatus(app, temp = null) {
  const messages = {
    shelf: 'Режим: Добавление полки',
    divider: 'Режим: Добавление разделителя',
    drawer: 'Режим: Добавление ящика',
    move: 'Режим: Перемещение',
    delete: 'Режим: Удаление'
  };
  
  const text = temp || messages[app.mode];
  document.getElementById('status-text').textContent = text;
  
  if (temp) {
    setTimeout(() => updateStatus(app), 3000);
  }
}

/**
 * Переключить вкладку
 * @param {App} app - Экземпляр приложения
 * @param {Element} tab - DOM элемент вкладки
 */
export function switchTab(app, tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  
  tab.classList.add('active');
  document.getElementById(tab.dataset.panel).classList.add('active');
  
  if (tab.dataset.panel === 'viewer-panel') {
    setTimeout(() => {
      if (!app.viewer3D) initViewer3D(app);
      if (app.viewer3D) app.viewer3D.resize();
    }, 50);
  } else {
    app.updateCanvas();
  }
}

/**
 * Обновить статистику панелей
 * @param {App} app - Экземпляр приложения
 */
export function updateStats(app) {
  const shelves = Array.from(app.panels.values()).filter(p => p.type === 'shelf');
  const dividers = Array.from(app.panels.values()).filter(p => p.type === 'divider');
  
  document.getElementById('stat-shelves').textContent = shelves.length;
  document.getElementById('stat-dividers').textContent = dividers.length;
  
  // Обновляем размеры шкафа
  updateCabinetInfo(app);
}

/**
 * Обновить информацию о размерах шкафа
 * @param {App} app - Экземпляр приложения
 */
export function updateCabinetInfo(app) {
  document.getElementById('stat-width').textContent = `${Math.round(app.cabinet.width)} мм`;
  document.getElementById('stat-height').textContent = `${Math.round(app.cabinet.height)} мм`;
  document.getElementById('stat-depth').textContent = `${Math.round(app.cabinet.depth)} мм`;
}