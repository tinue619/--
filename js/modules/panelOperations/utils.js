// ========== PANEL OPERATIONS: UTILS ==========
// Вспомогательные функции и операции над всем шкафом

import { CONFIG } from '../../config.js';
import { render2D } from '../render2D.js';
import { renderAll3D, removeMesh, updateDrawerMeshes, removeDrawerMeshes } from '../render3D.js';

/**
 * Получить координату панели (реальной или виртуальной)
 * @param {App} app - Экземпляр приложения
 * @param {Panel|Object} panel - Панель (может быть виртуальной)
 * @param {string} axis - Ось ('x' или 'y')
 * @returns {number|null} - Координата или null
 */
export function getPanelCoord(app, panel, axis) {
  if (!panel) return null;
  
  // Виртуальные панели
  if (panel.type === 'left') return CONFIG.DSP/2;
  if (panel.type === 'right') return app.cabinet.width - CONFIG.DSP/2;
  if (panel.type === 'bottom') return app.cabinet.base;
  if (panel.type === 'top') return app.cabinet.height - CONFIG.DSP;
  if (panel.type === 'virtual-shelf') return panel.position.y;
  
  // Реальные панели
  return panel.position[axis];
}

/**
 * Получить ограничения от ящиков для перемещаемой панели
 * Для стеков: ограничиваем по MIN_HEIGHT * count и MAX_HEIGHT * count
 * @param {App} app - Экземпляр приложения
 * @param {Panel} panel - Перемещаемая панель
 * @returns {{min: number, max: number}} - Ограничения
 */
export function getDrawerLimitsForPanel(app, panel) {
  let min = -Infinity;
  let max = Infinity;
  
  // Группируем ящики по стекам
  const processedStacks = new Set();
  
  for (let drawer of app.drawers.values()) {
    const conn = drawer.connections;
    
    // Проверяем, является ли панель границей этого ящика/стека
    const isBottomBoundary = conn.bottomShelf === panel || (conn.bottomShelf?.id && conn.bottomShelf.id === panel.id);
    const isTopBoundary = conn.topShelf === panel || (conn.topShelf?.id && conn.topShelf.id === panel.id);
    const isLeftBoundary = conn.leftDivider === panel || (conn.leftDivider?.id && conn.leftDivider.id === panel.id);
    const isRightBoundary = conn.rightDivider === panel || (conn.rightDivider?.id && conn.rightDivider.id === panel.id);
    
    if (!isBottomBoundary && !isTopBoundary && !isLeftBoundary && !isRightBoundary) {
      continue; // Панель не связана с этим ящиком
    }
    
    if (drawer.stackId && !processedStacks.has(drawer.stackId)) {
      // Это стек - обрабатываем его целиком
      processedStacks.add(drawer.stackId);
      
      const stackCount = drawer.stackCount;
      
      if (panel.isHorizontal) {
        // Двигаем горизонтальную панель (полку)
        if (isBottomBoundary) {
          // Панель - нижняя граница стека
          const topY = getPanelCoord(app, conn.topShelf, 'y');
          if (topY !== null) {
            const effectiveTopY = conn.topShelf.type === 'top' ? topY : topY;
            // Минимальная высота стека = stackCount * MIN_HEIGHT
            const minStackHeight = stackCount * CONFIG.DRAWER.MIN_HEIGHT;
            const maxY = effectiveTopY - minStackHeight;
            if (maxY < max) max = maxY;
          }
        }
        
        if (isTopBoundary) {
          // Панель - верхняя граница стека
          const bottomY = getPanelCoord(app, conn.bottomShelf, 'y');
          if (bottomY !== null) {
            const effectiveBottomY = conn.bottomShelf.type === 'bottom' ? bottomY : (bottomY + CONFIG.DSP);
            // Минимальная высота стека = stackCount * MIN_HEIGHT
            const minStackHeight = stackCount * CONFIG.DRAWER.MIN_HEIGHT;
            const minY = effectiveBottomY + minStackHeight;
            if (minY > min) min = minY;
          }
        }
      } else {
        // Двигаем вертикальную панель (разделитель)
        if (isLeftBoundary) {
          const rightX = getPanelCoord(app, conn.rightDivider, 'x');
          if (rightX !== null) {
            const effectiveRightX = conn.rightDivider.type === 'right' ? rightX : (rightX - CONFIG.DSP);
            // Минимальная ширина = MIN_WIDTH
            const maxX = effectiveRightX - CONFIG.DRAWER.MIN_WIDTH;
            if (maxX < max) max = maxX;
          }
        }
        
        if (isRightBoundary) {
          const leftX = getPanelCoord(app, conn.leftDivider, 'x');
          if (leftX !== null) {
            const effectiveLeftX = conn.leftDivider.type === 'left' ? leftX : (leftX + CONFIG.DSP);
            // Минимальная ширина = MIN_WIDTH
            const minX = effectiveLeftX + CONFIG.DRAWER.MIN_WIDTH;
            if (minX > min) min = minX;
          }
        }
      }
    } else if (!drawer.stackId) {
      // Одиночный ящик - старая логика
      if (panel.isHorizontal) {
        if (isBottomBoundary) {
          const topY = getPanelCoord(app, conn.topShelf, 'y');
          if (topY !== null) {
            const maxY = topY - CONFIG.DRAWER.MIN_HEIGHT;
            if (maxY < max) max = maxY;
          }
        }
        
        if (isTopBoundary) {
          const bottomY = getPanelCoord(app, conn.bottomShelf, 'y');
          if (bottomY !== null) {
            const effectiveBottomY = conn.bottomShelf.type === 'bottom' ? bottomY : (bottomY + CONFIG.DSP);
            const minY = effectiveBottomY + CONFIG.DRAWER.MIN_HEIGHT;
            if (minY > min) min = minY;
          }
        }
      } else {
        if (isLeftBoundary) {
          const rightX = getPanelCoord(app, conn.rightDivider, 'x');
          if (rightX !== null) {
            const effectiveRightX = conn.rightDivider.type === 'right' ? rightX : (rightX - CONFIG.DSP);
            const maxX = effectiveRightX - CONFIG.DRAWER.MIN_WIDTH;
            if (maxX < max) max = maxX;
          }
        }
        
        if (isRightBoundary) {
          const leftX = getPanelCoord(app, conn.leftDivider, 'x');
          if (leftX !== null) {
            const effectiveLeftX = conn.leftDivider.type === 'left' ? leftX : (leftX + CONFIG.DSP);
            const minX = effectiveLeftX + CONFIG.DRAWER.MIN_WIDTH;
            if (minX > min) min = minX;
          }
        }
      }
    }
  }
  
  return { min, max };
}

/**
 * Очистить весь шкаф
 * @param {App} app - Экземпляр приложения
 */
export function clearAll(app) {
  if (app.panels.size === 0 && app.drawers.size === 0) return;
  
  for (let panel of app.panels.values()) {
    removeMesh(app, panel);
  }
  
  for (let drawer of app.drawers.values()) {
    removeDrawerMeshes(app, drawer);
  }
  
  app.panels.clear();
  app.drawers.clear();
  
  app.saveHistory();
  render2D(app);
  app.updateStats();
}

/**
 * Отзеркалить содержимое шкафа
 * @param {App} app - Экземпляр приложения
 */
export function mirrorContent(app) {
  if (app.panels.size === 0) {
    app.updateStatus('Нет элементов для отзеркаливания');
    return;
  }
  
  const width = app.cabinet.width;
  
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) {
      const oldStartX = panel.bounds.startX;
      const oldEndX = panel.bounds.endX;
      
      panel.bounds.startX = width - oldEndX;
      panel.bounds.endX = width - oldStartX;
      
      const tempLeft = panel.connections.left;
      panel.connections.left = panel.connections.right;
      panel.connections.right = tempLeft;
    } else {
      panel.position.x = width - (panel.position.x + CONFIG.DSP);
    }
  }
  
  for (let drawer of app.drawers.values()) {
    const tempLeft = drawer.connections.leftDivider;
    drawer.connections.leftDivider = drawer.connections.rightDivider;
    drawer.connections.rightDivider = tempLeft;
    
    if (drawer.connections.leftDivider && drawer.connections.leftDivider.type === 'right') {
      drawer.connections.leftDivider.type = 'left';
    }
    if (drawer.connections.rightDivider && drawer.connections.rightDivider.type === 'left') {
      drawer.connections.rightDivider.type = 'right';
    }
  }
  
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) {
      panel.updateRibs(app.panels, app.cabinet.width);
    }
  }
  
  for (let drawer of app.drawers.values()) {
    drawer.updateParts(app);
    updateDrawerMeshes(app, drawer);
  }
  
  app.saveHistory();
  render2D(app);
  renderAll3D(app);
  app.updateStatus('Содержимое отзеркалено');
}