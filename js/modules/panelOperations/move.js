// ========== PANEL OPERATIONS: MOVE ==========
// Перемещение панелей, боковин, дна и крыши

import { CONFIG } from '../../config.js';
import { render2D } from '../render2D.js';
import { renderAll3D, updateMesh, updateDrawerMeshes } from '../render3D.js';
import { getPanelCoord, getDrawerLimitsForPanel } from './utils.js';

/**
 * Переместить панель
 * @param {App} app - Экземпляр приложения
 * @param {Panel} panel - Перемещаемая панель
 * @param {{x: number, y: number}} coords - Новые координаты
 */
export function movePanel(app, panel, coords) {
  // Особая обработка для боковин
  if (panel.type === 'side') {
    moveSide(app, panel, coords.x);
    return;
  }
  
  // Особая обработка для дна и крыши
  if (panel.type === 'horizontal-side') {
    moveHorizontalSide(app, panel, coords.y);
    return;
  }
  
  const newPos = panel.isHorizontal ? coords.y : coords.x;
  
  // Проверяем, является ли панель границей стека ящиков
  const isPanelStackBoundary = Array.from(app.drawers.values()).some(d => {
    const conn = d.connections;
    return d.stackId && (
      conn.bottomShelf === panel || conn.topShelf === panel ||
      conn.leftDivider === panel || conn.rightDivider === panel
    );
  });
  
  // Находим ограничения от других панелей того же типа
  let min = panel.isHorizontal ? app.cabinet.base + CONFIG.MIN_GAP : CONFIG.DSP + CONFIG.MIN_GAP;
  let max = panel.isHorizontal ? app.cabinet.height - CONFIG.DSP - CONFIG.MIN_GAP : app.cabinet.width - CONFIG.DSP - CONFIG.MIN_GAP;
  
  // Если панель - граница стека, НЕ применяем MIN_GAP к другим панелям
  if (!isPanelStackBoundary) {
    for (let other of app.panels.values()) {
      if (other === panel || other.type !== panel.type) continue;
      
      const overlap1 = Math.max(panel.start, other.start);
      const overlap2 = Math.min(panel.end, other.end);
      
      if (overlap2 > overlap1) {
        if (other.mainPosition < panel.mainPosition && other.mainPosition + CONFIG.MIN_GAP > min) {
          min = other.mainPosition + CONFIG.MIN_GAP;
        }
        if (other.mainPosition > panel.mainPosition && other.mainPosition - CONFIG.MIN_GAP < max) {
          max = other.mainPosition - CONFIG.MIN_GAP;
        }
      }
    }
  }
  
  // Добавляем ограничения от ящиков
  const drawerLimits = getDrawerLimitsForPanel(app, panel);
  if (drawerLimits.min > -Infinity) {
    min = Math.max(min, drawerLimits.min);
  }
  if (drawerLimits.max < Infinity) {
    max = Math.min(max, drawerLimits.max);
  }
  
  // Обновляем позицию панели
  panel.mainPosition = Math.round(Math.max(min, Math.min(max, newPos)));
  
  // Обновляем bounds и connections связанных панелей
  updateConnectedPanels(app, panel);
  
  render2D(app);
  renderAll3D(app);
}

/**
 * Переместить боковину (изменение ширины шкафа)
 * @param {App} app - Экземпляр приложения
 * @param {Object} side - Виртуальная боковина
 * @param {number} newX - Новая X координата
 */
export function moveSide(app, side, newX) {
  const isLeftSide = side.id === 'left-side';
  
  const MIN_CABINET_WIDTH = 400;
  const MAX_CABINET_WIDTH = 3000;
  
  let minX, maxX;
  
  if (isLeftSide) {
    minX = app.cabinet.width - MAX_CABINET_WIDTH + CONFIG.DSP/2;
    
    let leftmostDivider = null;
    for (let panel of app.panels.values()) {
      if (!panel.isHorizontal) {
        if (!leftmostDivider || panel.position.x < leftmostDivider.position.x) {
          leftmostDivider = panel;
        }
      }
    }
    
    if (leftmostDivider) {
      maxX = leftmostDivider.position.x - CONFIG.MIN_GAP - CONFIG.DSP/2;
    } else {
      maxX = app.cabinet.width - MIN_CABINET_WIDTH + CONFIG.DSP/2;
    }
  } else {
    maxX = MAX_CABINET_WIDTH - CONFIG.DSP/2;
    
    let rightmostDivider = null;
    for (let panel of app.panels.values()) {
      if (!panel.isHorizontal) {
        if (!rightmostDivider || panel.position.x > rightmostDivider.position.x) {
          rightmostDivider = panel;
        }
      }
    }
    
    if (rightmostDivider) {
      minX = rightmostDivider.position.x + CONFIG.MIN_GAP + CONFIG.DSP/2;
    } else {
      minX = MIN_CABINET_WIDTH - CONFIG.DSP/2;
    }
  }
  
  newX = Math.round(Math.max(minX, Math.min(maxX, newX)));
  
  const oldWidth = app.cabinet.width;
  if (isLeftSide) {
    const shift = CONFIG.DSP/2 - newX;
    app.cabinet.width = oldWidth + shift;
    
    for (let panel of app.panels.values()) {
      if (!panel.isHorizontal) {
        panel.position.x += shift;
      } else {
        panel.bounds.startX = Math.max(CONFIG.DSP, panel.bounds.startX + shift);
        panel.bounds.endX = Math.min(app.cabinet.width - CONFIG.DSP, panel.bounds.endX + shift);
      }
    }
  } else {
    app.cabinet.width = newX + CONFIG.DSP/2;
  }
  
  app.updateCalc();
  
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) {
      if (!panel.connections.left) {
        panel.bounds.startX = CONFIG.DSP;
      }
      if (!panel.connections.right) {
        panel.bounds.endX = app.cabinet.width - CONFIG.DSP;
      }
      panel.updateRibs(app.panels, app.cabinet.width);
    }
  }
  
  for (let drawer of app.drawers.values()) {
    drawer.updateParts(app);
    updateDrawerMeshes(app, drawer);
  }
  
  app.updateCanvas();
  render2D(app);
  
  if (app.viewer3D) {
    app.viewer3D.rebuildCabinet();
  }
  
  renderAll3D(app);
  app.updateCabinetInfo();
}

/**
 * Переместить дно или крышу (изменение высоты/цоколя)
 * @param {App} app - Экземпляр приложения
 * @param {Object} side - Виртуальная панель дна/крыши
 * @param {number} newY - Новая Y координата
 */
export function moveHorizontalSide(app, side, newY) {
  const isBottom = side.id === 'bottom-side';
  
  if (isBottom) {
    const MIN_BASE_HEIGHT = 60;
    
    let minBase = MIN_BASE_HEIGHT;
    let maxBase = app.cabinet.height - CONFIG.DSP - CONFIG.MIN_SIZE;
    
    for (let panel of app.panels.values()) {
      if (panel.isHorizontal) {
        const minPossibleBase = panel.position.y - CONFIG.MIN_GAP - CONFIG.DSP;
        if (minPossibleBase < maxBase) {
          maxBase = minPossibleBase;
        }
      }
    }
    
    const virtualBottom = {
      type: 'bottom',
      id: 'virtual-bottom',
      position: { y: app.cabinet.base },
      isHorizontal: true
    };
    
    const drawerLimits = getDrawerLimitsForPanel(app, virtualBottom);
    
    if (drawerLimits.max < Infinity) {
      const maxBaseFromDrawers = drawerLimits.max;
      if (maxBaseFromDrawers < maxBase) {
        maxBase = maxBaseFromDrawers;
      }
    }
    
    const requestedBase = newY + CONFIG.DSP/2;
    const oldBase = app.cabinet.base;
    const newBase = Math.round(Math.max(minBase, Math.min(maxBase, requestedBase)));
    
    if (newBase === oldBase) return;
    
    app.cabinet.base = newBase;
    
    for (let panel of app.panels.values()) {
      if (!panel.isHorizontal) {
        if (!panel.connections.bottom) {
          panel.bounds.startY = app.cabinet.base;
        }
        panel.position.y = (panel.bounds.startY + panel.bounds.endY) / 2;
        updateMesh(app, panel);
      }
    }
  } else {
    let minHeight = app.cabinet.base + CONFIG.MIN_SIZE + CONFIG.DSP;
    let maxHeight = 3000;
    
    for (let panel of app.panels.values()) {
      if (panel.isHorizontal) {
        const minPossibleHeight = panel.position.y + CONFIG.DSP + CONFIG.MIN_GAP;
        if (minPossibleHeight > minHeight) {
          minHeight = minPossibleHeight;
        }
      }
    }
    
    const virtualTop = {
      type: 'top',
      id: 'virtual-top',
      position: { y: app.cabinet.height - CONFIG.DSP },
      isHorizontal: true
    };
    
    const drawerLimits = getDrawerLimitsForPanel(app, virtualTop);
    
    if (drawerLimits.min > -Infinity) {
      const minHeightFromDrawers = drawerLimits.min + CONFIG.DSP;
      if (minHeightFromDrawers > minHeight) {
        minHeight = minHeightFromDrawers;
      }
    }
    
    const requestedHeight = newY + CONFIG.DSP/2;
    const oldHeight = app.cabinet.height;
    const newHeight = Math.round(Math.max(minHeight, Math.min(maxHeight, requestedHeight)));
    
    if (newHeight === oldHeight) return;
    
    app.cabinet.height = newHeight;
    
    for (let panel of app.panels.values()) {
      if (!panel.isHorizontal) {
        if (!panel.connections.top) {
          panel.bounds.endY = app.cabinet.height - CONFIG.DSP;
          panel.position.y = (panel.bounds.startY + panel.bounds.endY) / 2;
          updateMesh(app, panel);
        }
      }
    }
  }
  
  app.updateCalc();
  
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) {
      panel.updateRibs(app.panels, app.cabinet.width);
    }
  }
  
  for (let drawer of app.drawers.values()) {
    drawer.updateParts(app);
    updateDrawerMeshes(app, drawer);
  }
  
  app.updateCanvas();
  render2D(app);
  
  if (app.viewer3D) {
    app.viewer3D.rebuildCabinet();
  }
  
  renderAll3D(app);
  app.updateCabinetInfo();
}

/**
 * Обновить связанные панели после перемещения
 * @param {App} app - Экземпляр приложения
 * @param {Panel} movedPanel - Перемещённая панель
 */
export function updateConnectedPanels(app, movedPanel) {
  const affectedShelves = new Set();
  
  if (movedPanel.isHorizontal) {
    for (let panel of app.panels.values()) {
      if (panel.isHorizontal) continue;
      
      if (panel.connections.bottom === movedPanel) {
        panel.bounds.startY = movedPanel.position.y + CONFIG.DSP;
      }
      if (panel.connections.top === movedPanel) {
        panel.bounds.endY = movedPanel.position.y;
      }
    }
    
    movedPanel.updateRibs(app.panels, app.cabinet.width);
  } else {
    for (let panel of app.panels.values()) {
      if (!panel.isHorizontal) continue;
      
      if (panel.connections.left === movedPanel) {
        panel.bounds.startX = movedPanel.position.x + CONFIG.DSP;
        affectedShelves.add(panel);
      }
      if (panel.connections.right === movedPanel) {
        panel.bounds.endX = movedPanel.position.x;
        affectedShelves.add(panel);
      }
      
      if (panel.bounds.startX <= movedPanel.position.x && 
          panel.bounds.endX >= movedPanel.position.x &&
          movedPanel.bounds.startY <= panel.position.y &&
          movedPanel.bounds.endY >= panel.position.y) {
        affectedShelves.add(panel);
      }
    }
    
    for (let shelf of affectedShelves) {
      shelf.updateRibs(app.panels, app.cabinet.width);
    }
  }
  
  for (let drawer of app.drawers.values()) {
    const connections = drawer.connections;
    if (connections.bottomShelf === movedPanel || 
        connections.topShelf === movedPanel ||
        connections.leftDivider === movedPanel ||
        connections.rightDivider === movedPanel) {
      drawer.updateParts(app);
      updateDrawerMeshes(app, drawer);
    }
  }
}