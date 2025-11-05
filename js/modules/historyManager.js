// ========== HISTORY MANAGER ==========
// Управление историей изменений (undo/redo)

import { CONFIG } from '../config.js';
import { Panel } from '../Panel.js';
import { Drawer } from '../Drawer.js';
import { serializeConnections, deserializeConnections, scheduleSave } from './stateManager.js';
import { compareStatesForLog, logToHistory } from './historyLogging.js';
import { render2D } from './render2D.js';
import { renderAll3D, removeMesh, removeDrawerMeshes } from './render3D.js';

/**
 * Сохранить текущее состояние в историю
 * @param {App} app - Экземпляр приложения
 */
export function saveHistory(app) {
  // Получаем предыдущее состояние для сравнения
  // Если есть boundsSnapshot (перемещение боковины), создаем искусственное состояние
  let prevState;
  if (app.interaction.boundsSnapshot && app.history.index >= 0) {
    // Используем снапшот bounds ДО изменения
    const historicalState = app.history.states[app.history.index];
    prevState = {
      cabinet: historicalState.cabinet,
      panels: historicalState.panels.map(p => {
        // Если есть снапшот для этой панели, используем его
        const snapshot = app.interaction.boundsSnapshot.get(p.id);
        if (snapshot && p.type === 'shelf') {
          return {
            ...p,
            bounds: {
              startX: snapshot.startX,
              endX: snapshot.endX
            }
          };
        }
        return p;
      })
    };
  } else {
    prevState = app.history.index >= 0 ? app.history.states[app.history.index] : null;
  }
  
  const state = {
    cabinet: {
      width: app.cabinet.width,
      height: app.cabinet.height,
      depth: app.cabinet.depth,
      base: app.cabinet.base
    },
    panels: Array.from(app.panels.values()).map(p => ({
      type: p.type,
      id: p.id,
      position: { ...p.position },
      bounds: { ...p.bounds },
      connections: serializeConnections(app, p.connections)
    })),
    drawers: Array.from(app.drawers.values()).map(d => d.toJSON()),
    nextId: app.nextId,
    nextDrawerId: app.nextDrawerId
  };
  
  if (app.history.index < app.history.states.length - 1) {
    app.history.states = app.history.states.slice(0, app.history.index + 1);
  }
  
  app.history.states.push(state);
  if (app.history.states.length > CONFIG.UI.MAX_HISTORY) {
    app.history.states.shift();
  } else {
    app.history.index++;
  }
  
  updateHistoryButtons(app);
  scheduleSave(app);
  
  // Логируем изменения
  const changes = compareStatesForLog(prevState, state);
  if (changes.length > 0) {
    logToHistory('save', changes);
  }
}

/**
 * Отменить последнее действие
 * @param {App} app - Экземпляр приложения
 */
export function undo(app) {
  if (app.history.index <= 0) return;
  
  const currentState = app.history.states[app.history.index];
  const prevState = app.history.states[app.history.index - 1];
  
  app.history.index--;
  restoreState(app, prevState);
  
  // Логируем отмену: сравниваем ТЕКУЩЕЕ состояние из истории с ПРЕДЫДУЩИМ
  const changes = compareStatesForLog(currentState, prevState);
  if (changes.length > 0) {
    logToHistory('undo', changes);
  }
}

/**
 * Повторить отменённое действие
 * @param {App} app - Экземпляр приложения
 */
export function redo(app) {
  if (app.history.index >= app.history.states.length - 1) return;
  
  const currentState = app.history.states[app.history.index];
  const nextState = app.history.states[app.history.index + 1];
  
  app.history.index++;
  restoreState(app, nextState);
  
  // Логируем повтор: сравниваем ТЕКУЩЕЕ состояние с СЛЕДУЮЩИМ
  const changes = compareStatesForLog(currentState, nextState);
  if (changes.length > 0) {
    logToHistory('redo', changes);
  }
}

/**
 * Восстановить состояние из истории
 * @param {App} app - Экземпляр приложения
 * @param {Object} state - Состояние для восстановления
 */
export function restoreState(app, state) {
  // Восстанавливаем размеры шкафа, если они есть в состоянии
  if (state.cabinet) {
    app.cabinet.width = state.cabinet.width;
    app.cabinet.height = state.cabinet.height;
    app.cabinet.depth = state.cabinet.depth;
    app.cabinet.base = state.cabinet.base;
    app.updateCalc();
    
    // Обновляем canvas с новыми размерами
    app.updateCanvas();
    
    // Перестраиваем 3D корпус
    if (app.viewer3D) {
      app.viewer3D.rebuildCabinet();
    }
  }
  
  // Очищаем текущие панели
  for (let panel of app.panels.values()) {
    removeMesh(app, panel);
  }
  app.panels.clear();
  
  // Очищаем текущие ящики
  for (let drawer of app.drawers.values()) {
    removeDrawerMeshes(app, drawer);
  }
  app.drawers.clear();
  
  // Сначала создаем все панели без connections
  state.panels.forEach(data => {
    const panel = new Panel(data.type, data.id, data.position, data.bounds, {});
    app.panels.set(data.id, panel);
  });
  
  // Теперь восстанавливаем connections с правильными ссылками
  state.panels.forEach(data => {
    const panel = app.panels.get(data.id);
    panel.connections = deserializeConnections(app, data.connections);
  });
  
  app.nextId = state.nextId;
  
  // Восстанавливаем ящики, если они есть в состоянии
  if (state.drawers) {
    state.drawers.forEach(drawerData => {
      const drawer = Drawer.fromJSON(drawerData, app.panels, app);
      drawer.calculateParts(app);  // Пересчитываем части
      app.drawers.set(drawer.id, drawer);
    });
    
    if (state.nextDrawerId !== undefined) {
      app.nextDrawerId = state.nextDrawerId;
    }
  }
  
  // Обновляем ребра для всех полок
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) {
      panel.updateRibs(app.panels, app.cabinet.width);
    }
  }
  
  render2D(app);
  renderAll3D(app);
  app.updateStats();
  updateHistoryButtons(app);
}

/**
 * Обновить состояние кнопок undo/redo
 * @param {App} app - Экземпляр приложения
 */
export function updateHistoryButtons(app) {
  document.getElementById('undo-btn').disabled = app.history.index <= 0;
  document.getElementById('redo-btn').disabled = app.history.index >= app.history.states.length - 1;
}