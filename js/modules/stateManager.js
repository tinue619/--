// ========== STATE MANAGER ==========
// Управление сохранением и загрузкой состояния приложения

import { CONFIG } from '../config.js';
import { Panel } from '../Panel.js';
import { Drawer } from '../Drawer.js';

/**
 * Конвертировать Panel ссылки в ID для сохранения
 * @param {App} app - Экземпляр приложения
 * @param {Object} connections - Объект с connections (ссылки на Panel)
 * @returns {Object} - Объект с ID вместо ссылок
 */
export function serializeConnections(app, connections) {
  const serialized = {};
  for (let key in connections) {
    serialized[key] = connections[key] ? connections[key].id : null;
  }
  return serialized;
}

/**
 * Конвертировать ID обратно в Panel ссылки
 * @param {App} app - Экземпляр приложения
 * @param {Object} connectionsData - Объект с ID
 * @returns {Object} - Объект со ссылками на Panel
 */
export function deserializeConnections(app, connectionsData) {
  const deserialized = {};
  for (let key in connectionsData) {
    const panelId = connectionsData[key];
    deserialized[key] = panelId ? app.panels.get(panelId) : null;
  }
  return deserialized;
}

/**
 * Запланировать сохранение с задержкой
 * @param {App} app - Экземпляр приложения
 */
export function scheduleSave(app) {
  if (app.saveTimer) clearTimeout(app.saveTimer);
  app.saveTimer = setTimeout(() => saveToStorage(app), CONFIG.UI.SAVE_DELAY);
}

/**
 * Сохранить состояние в localStorage
 * @param {App} app - Экземпляр приложения
 */
export function saveToStorage(app) {
  try {
    localStorage.setItem('cabinetDesignV3', JSON.stringify({
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
      nextDrawerId: app.nextDrawerId,
      history: app.history
    }));
    showSaved(app);
  } catch (e) {
    console.error('Save error:', e);
  }
}

/**
 * Загрузить состояние из localStorage
 * @param {App} app - Экземпляр приложения
 */
export function loadState(app) {
  try {
    const data = JSON.parse(localStorage.getItem('cabinetDesignV3') || '{}');
    
    // Загружаем размеры шкафа, если они есть
    if (data.cabinet) {
      app.cabinet.width = data.cabinet.width;
      app.cabinet.height = data.cabinet.height;
      app.cabinet.depth = data.cabinet.depth;
      app.cabinet.base = data.cabinet.base;
      app.updateCalc();
      
      // Обновляем 3D корпус если он уже инициализирован
      if (app.viewer3D) {
        app.viewer3D.rebuildCabinet();
      }
    }
    
    if (data.panels) {
      // Сначала создаем все панели без connections
      data.panels.forEach(panelData => {
        // Округляем координаты при загрузке старых данных
        const position = {};
        if (panelData.position.x !== undefined) {
          position.x = Math.round(panelData.position.x);
        }
        if (panelData.position.y !== undefined) {
          position.y = Math.round(panelData.position.y);
        }
        
        const panel = new Panel(
          panelData.type,
          panelData.id,
          position,
          panelData.bounds,
          {}
        );
        app.panels.set(panelData.id, panel);
      });
      
      // Теперь восстанавливаем connections с правильными ссылками
      data.panels.forEach(panelData => {
        const panel = app.panels.get(panelData.id);
        panel.connections = deserializeConnections(app, panelData.connections);
      });
      
      app.nextId = data.nextId || 0;
      
      // Загружаем ящики, если они есть
      if (data.drawers) {
        data.drawers.forEach(drawerData => {
          const drawer = Drawer.fromJSON(drawerData, app.panels, app);
          drawer.calculateParts(app);  // Пересчитываем части
          app.drawers.set(drawer.id, drawer);
        });
        
        if (data.nextDrawerId !== undefined) {
          app.nextDrawerId = data.nextDrawerId;
        }
      }
      
      app.history = data.history || { states: [], index: -1 };
      
      // Обновляем ребра для всех загруженных полок
      for (let panel of app.panels.values()) {
        if (panel.isHorizontal) {
          panel.updateRibs(app.panels, app.cabinet.width);
        }
      }
    }
    
    if (app.history.states.length === 0) {
      app.saveHistory();
    }
    
    app.updateHistoryButtons();
  } catch (e) {
    console.error('Load error:', e);
    app.saveHistory();
  }
}

/**
 * Показать индикатор сохранения
 * @param {App} app - Экземпляр приложения
 */
export function showSaved(app) {
  const indicator = document.getElementById('saved-indicator');
  indicator.classList.add('show');
  setTimeout(() => indicator.classList.remove('show'), 2000);
}