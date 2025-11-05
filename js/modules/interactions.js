// ========== INTERACTIONS MODULE ==========
// Обработка всех пользовательских взаимодействий с canvas

import { CONFIG } from '../config.js';
import { render2D } from './render2D.js';
import { updateMesh } from './render3D.js';

/**
 * Обновить размеры и масштаб canvas
 * @param {App} app - Экземпляр приложения
 */
export function updateCanvas(app) {
  const container = app.canvas.element.parentElement;
  const width = container.clientWidth - 30;
  const height = container.clientHeight - 30;
  
  app.canvas.size = Math.min(width, height, 800);
  app.canvas.element.width = app.canvas.size;
  app.canvas.element.height = app.canvas.size;
  app.canvas.element.style.width = app.canvas.size + 'px';
  app.canvas.element.style.height = app.canvas.size + 'px';
  
  const scaleX = app.canvas.size / app.cabinet.width;
  const scaleY = app.canvas.size / app.cabinet.height;
  app.canvas.scale = Math.min(scaleX, scaleY) * CONFIG.UI.SCALE_PADDING;
  
  app.canvas.offset.x = (app.canvas.size - app.cabinet.width * app.canvas.scale) / 2;
  app.canvas.offset.y = (app.canvas.size - app.cabinet.height * app.canvas.scale) / 2;
  
  render2D(app);
}

/**
 * Преобразовать координаты события в координаты шкафа
 * @param {App} app - Экземпляр приложения
 * @param {PointerEvent} e - Событие указателя
 * @returns {{x: number, y: number}} - Координаты в мм от начала шкафа
 */
export function getCoords(app, e) {
  const rect = app.canvas.element.getBoundingClientRect();
  const point = e.touches?.[0] || e.changedTouches?.[0] || e;
  
  const canvasX = (point.clientX - rect.left) * (app.canvas.size / rect.width);
  const canvasY = (point.clientY - rect.top) * (app.canvas.size / rect.height);
  
  return {
    x: (canvasX - app.canvas.offset.x) / app.canvas.scale,
    y: (app.canvas.size - canvasY - app.canvas.offset.y) / app.canvas.scale
  };
}

/**
 * Главный обработчик всех pointer событий
 * @param {App} app - Экземпляр приложения
 * @param {PointerEvent} e - Событие указателя
 */
export function handlePointer(app, e) {
  e.preventDefault();
  const coords = getCoords(app, e);
  
  const handlers = {
    pointerdown: () => startInteraction(app, coords),
    pointermove: () => updateInteraction(app, coords),
    pointerup: () => endInteraction(app, coords),
    pointercancel: () => endInteraction(app, coords)
  };
  
  handlers[e.type]?.();
}

/**
 * Начало взаимодействия (клик, начало драга)
 * @param {App} app - Экземпляр приложения
 * @param {{x: number, y: number}} coords - Координаты клика
 */
export function startInteraction(app, coords) {
  app.interaction.start = coords;
  app.interaction.hasMoved = false;
  app.interaction.boundsSnapshot = null;  // Сбрасываем снапшот
  
  if (app.mode === 'move') {
    app.interaction.dragging = findPanelAt(app, coords);
    if (app.interaction.dragging) {
      app.interaction.originalPos = app.interaction.dragging.mainPosition;
      
      // Если тянем боковину - сохраняем bounds всех полок
      if (app.interaction.dragging.type === 'side') {
        app.interaction.boundsSnapshot = new Map();
        for (let panel of app.panels.values()) {
          if (panel.isHorizontal) {
            app.interaction.boundsSnapshot.set(panel.id, {
              startX: panel.bounds.startX,
              endX: panel.bounds.endX
            });
          }
        }
      }
    }
  } else if (app.mode === 'delete') {
    const panel = findPanelAt(app, coords);
    if (panel) app.deletePanel(panel);
  }
}

/**
 * Обновление во время драга
 * @param {App} app - Экземпляр приложения
 * @param {{x: number, y: number}} coords - Текущие координаты
 */
export function updateInteraction(app, coords) {
  if (!app.interaction.start) return;
  
  const distance = Math.hypot(
    coords.x - app.interaction.start.x,
    coords.y - app.interaction.start.y
  );
  
  if (distance > CONFIG.UI.MIN_MOVE) {
    app.interaction.hasMoved = true;
  }
  
  if (app.interaction.dragging && app.interaction.hasMoved) {
    app.movePanel(app.interaction.dragging, coords);
  }
}

/**
 * Завершение взаимодействия (отпускание кнопки)
 * @param {App} app - Экземпляр приложения
 * @param {{x: number, y: number}} coords - Координаты отпускания
 */
export function endInteraction(app, coords) {
  if (!app.interaction.hasMoved && app.mode !== 'move' && app.mode !== 'delete' && app.interaction.start) {
    if (app.mode === 'shelf') {
      app.addPanel('shelf', coords.y, coords.x);
    } else if (app.mode === 'divider') {
      app.addPanel('divider', coords.x, coords.y);
    } else if (app.mode === 'drawer') {
      app.addDrawer(coords);
    }
  }
  
  if (app.interaction.dragging) {
    if (app.interaction.hasMoved) {
      app.saveHistory();
    } else {
      app.interaction.dragging.mainPosition = app.interaction.originalPos;
      render2D(app);
      updateMesh(app, app.interaction.dragging);
    }
  }
  
  app.interaction = { 
    dragging: null, 
    start: null, 
    hasMoved: false,
    boundsSnapshot: null  // Очищаем снапшот
  };
}

/**
 * Найти панель или ящик в заданных координатах
 * @param {App} app - Экземпляр приложения
 * @param {{x: number, y: number}} coords - Координаты для поиска
 * @returns {Panel|Drawer|Object|null} - Найденная панель, ящик или виртуальная боковина
 */
export function findPanelAt(app, coords) {
  // Сначала проверяем боковины (они приоритетнее обычных панелей)
  // Левая боковина
  if (Math.abs(coords.x - CONFIG.DSP/2) < CONFIG.UI.SNAP && 
      coords.y >= 0 && coords.y <= app.cabinet.height) {
    return {
      type: 'side',
      id: 'left-side',
      position: { x: CONFIG.DSP/2 },
      isHorizontal: false,
      mainPosition: CONFIG.DSP/2,
      start: 0,
      end: app.cabinet.height
    };
  }
  
  // Правая боковина
  if (Math.abs(coords.x - (app.cabinet.width - CONFIG.DSP/2)) < CONFIG.UI.SNAP && 
      coords.y >= 0 && coords.y <= app.cabinet.height) {
    return {
      type: 'side',
      id: 'right-side',
      position: { x: app.cabinet.width - CONFIG.DSP/2 },
      isHorizontal: false,
      mainPosition: app.cabinet.width - CONFIG.DSP/2,
      start: 0,
      end: app.cabinet.height
    };
  }
  
  // Дно (управляет высотой цоколя)
  if (Math.abs(coords.y - (app.cabinet.base - CONFIG.DSP/2)) < CONFIG.UI.SNAP && 
      coords.x >= CONFIG.DSP && coords.x <= app.cabinet.width - CONFIG.DSP) {
    return {
      type: 'horizontal-side',
      id: 'bottom-side',
      position: { y: app.cabinet.base - CONFIG.DSP/2 },
      isHorizontal: true,
      mainPosition: app.cabinet.base - CONFIG.DSP/2,
      start: CONFIG.DSP,
      end: app.cabinet.width - CONFIG.DSP
    };
  }
  
  // Крыша (управляет общей высотой шкафа)
  if (Math.abs(coords.y - (app.cabinet.height - CONFIG.DSP/2)) < CONFIG.UI.SNAP && 
      coords.x >= CONFIG.DSP && coords.x <= app.cabinet.width - CONFIG.DSP) {
    return {
      type: 'horizontal-side',
      id: 'top-side',
      position: { y: app.cabinet.height - CONFIG.DSP/2 },
      isHorizontal: true,
      mainPosition: app.cabinet.height - CONFIG.DSP/2,
      start: CONFIG.DSP,
      end: app.cabinet.width - CONFIG.DSP
    };
  }
  
  // Затем проверяем обычные панели
  for (let panel of app.panels.values()) {
    const axis = panel.isHorizontal ? 'y' : 'x';
    const pos = coords[axis];
    const cross = coords[panel.isHorizontal ? 'x' : 'y'];
    
    if (panel.intersects(pos, axis) && panel.intersects(cross, panel.isHorizontal ? 'x' : 'y')) {
      return panel;
    }
  }
  
  // Наконец проверяем ящики (низкий приоритет)
  for (let drawer of app.drawers.values()) {
    if (!drawer.volume) continue;
    
    // Проверяем, попадает ли клик в область ящика
    if (coords.x >= drawer.volume.x.start && coords.x <= drawer.volume.x.end &&
        coords.y >= drawer.volume.y.start && coords.y <= drawer.volume.y.end) {
      return drawer;  // Возвращаем сам ящик
    }
  }
  
  return null;
}