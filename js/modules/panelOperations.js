// ========== PANEL OPERATIONS ==========
// Управление панелями (добавление, перемещение, удаление)

import { CONFIG } from '../config.js';
import { Panel } from '../Panel.js';
import { render2D } from './render2D.js';
import { renderAll3D, updateMesh, removeMesh, updateDrawerMeshes, removeDrawerMeshes } from './render3D.js';

/**
 * Проверяет, нет ли ящика в области, которую пересекает новая панель
 * @param {App} app - Экземпляр приложения
 * @param {boolean} isHorizontal - Полка (true) или разделитель (false)
 * @param {number} mainPos - Позиция панели по главной оси (Y для полки, X для разделителя)
 * @param {number} startCross - Начало по перпендикулярной оси
 * @param {number} endCross - Конец по перпендикулярной оси
 * @returns {boolean} - true если есть ящик в области
 */
export function hasDrawerInArea(app, isHorizontal, mainPos, startCross, endCross) {
  for (let drawer of app.drawers.values()) {
    if (!drawer.volume) continue;
    
    if (isHorizontal) {
      // Проверяем полку: пересекает ли она ящик по Y
      const shelfY = mainPos;
      const shelfStartX = startCross;
      const shelfEndX = endCross;
      
      if (shelfY > drawer.volume.y.start && shelfY < drawer.volume.y.end) {
        if (!(shelfEndX <= drawer.volume.x.start || shelfStartX >= drawer.volume.x.end)) {
          return true;
        }
      }
    } else {
      // Проверяем разделитель: пересекает ли он ящик по X
      const dividerX = mainPos;
      const dividerStartY = startCross;
      const dividerEndY = endCross;
      
      if (dividerX > drawer.volume.x.start && dividerX < drawer.volume.x.end) {
        if (!(dividerEndY <= drawer.volume.y.start || dividerStartY >= drawer.volume.y.end)) {
          return true;
        }
      }
    }
  }
  
  return false;
}

/**
 * Добавить панель (полку или разделитель)
 * @param {App} app - Экземпляр приложения
 * @param {string} type - Тип панели ('shelf' или 'divider')
 * @param {number} mainPos - Позиция по главной оси
 * @param {number} crossPos - Позиция по перпендикулярной оси (для определения секции)
 */
export function addPanel(app, type, mainPos, crossPos) {
  const isHorizontal = type === 'shelf';
  
  // Ограничения позиции
  if (isHorizontal) {
    mainPos = Math.max(app.cabinet.base, Math.min(app.cabinet.height - CONFIG.DSP, mainPos));
  } else {
    mainPos = Math.max(CONFIG.DSP + CONFIG.MIN_GAP, Math.min(app.cabinet.width - CONFIG.DSP - CONFIG.MIN_GAP, mainPos));
  }
  
  // Находим пересечения с перпендикулярными панелями
  const perpType = isHorizontal ? 'divider' : 'shelf';
  const intersecting = Array.from(app.panels.values())
    .filter(p => p.type === perpType && p.intersects(mainPos, isHorizontal ? 'y' : 'x'))
    .sort((a, b) => a.mainPosition - b.mainPosition);
  
  // Определяем границы новой панели
  let bounds, connections = {};
  if (isHorizontal) {
    let startX = CONFIG.DSP;
    let endX = app.cabinet.width - CONFIG.DSP;
    
    if (intersecting.length > 0) {
      const points = [
        { x: CONFIG.DSP, panel: null },
        ...intersecting.map(d => ({ x: d.position.x, panel: d })),
        { x: app.cabinet.width - CONFIG.DSP, panel: null }
      ];
      
      for (let i = 0; i < points.length - 1; i++) {
        if (crossPos >= points[i].x && crossPos <= points[i + 1].x) {
          startX = points[i].x + (points[i].panel ? CONFIG.DSP : 0);
          endX = points[i + 1].x;
          connections.left = points[i].panel;
          connections.right = points[i + 1].panel;
          break;
        }
      }
    }
    
    if (endX - startX < CONFIG.MIN_SIZE) {
      app.updateStatus(`Слишком узкая секция! Минимум ${CONFIG.MIN_SIZE} мм`);
      return;
    }
    
    bounds = { startX, endX };
  } else {
    let startY = app.cabinet.base;
    let endY = app.cabinet.height - CONFIG.DSP;
    
    if (intersecting.length > 0) {
      const points = [
        { y: app.cabinet.base, panel: null },
        ...intersecting.map(s => ({ y: s.position.y, panel: s })),
        { y: app.cabinet.height - CONFIG.DSP, panel: null }
      ];
      
      for (let i = 0; i < points.length - 1; i++) {
        if (crossPos >= points[i].y && crossPos <= points[i + 1].y) {
          startY = points[i].y + (points[i].panel ? CONFIG.DSP : 0);
          endY = points[i + 1].y;
          connections.bottom = points[i].panel;
          connections.top = points[i + 1].panel;
          break;
        }
      }
    }
    
    if (endY - startY < CONFIG.MIN_SIZE) {
      app.updateStatus(`Слишком низкая секция! Минимум ${CONFIG.MIN_SIZE} мм`);
      return;
    }
    
    bounds = { startY, endY };
  }
  
  // Проверяем, нет ли ящика в этой области
  if (isHorizontal) {
    if (hasDrawerInArea(app, true, mainPos, bounds.startX, bounds.endX)) {
      app.updateStatus('Нельзя добавить полку - в этой области есть ящик');
      return;
    }
  } else {
    if (hasDrawerInArea(app, false, mainPos, bounds.startY, bounds.endY)) {
      app.updateStatus('Нельзя добавить разделитель - в этой области есть ящик');
      return;
    }
  }
  
  const id = `${type}-${app.nextId++}`;
  const position = isHorizontal ? { y: mainPos } : { x: mainPos };
  const panel = new Panel(type, id, position, bounds, connections);
  
  app.panels.set(id, panel);
  
  // Обновляем ребра
  if (isHorizontal) {
    panel.updateRibs(app.panels, app.cabinet.width);
  } else {
    for (let p of app.panels.values()) {
      if (p.isHorizontal && 
          p.bounds.startX <= panel.position.x && 
          p.bounds.endX >= panel.position.x &&
          panel.bounds.startY <= p.position.y &&
          panel.bounds.endY >= p.position.y) {
        p.updateRibs(app.panels, app.cabinet.width);
      }
    }
  }
  
  app.saveHistory();
  render2D(app);
  renderAll3D(app);
  app.updateStats();
}

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
 * @param {App} app - Экземпляр приложения
 * @param {Panel} panel - Перемещаемая панель
 * @returns {{min: number, max: number}} - Ограничения
 */
export function getDrawerLimitsForPanel(app, panel) {
  let min = -Infinity;
  let max = Infinity;
  
  for (let drawer of app.drawers.values()) {
    const conn = drawer.connections;
    
    if (panel.isHorizontal) {
      // Перемещаем полку
      if (conn.bottomShelf === panel || 
          (conn.bottomShelf?.id && conn.bottomShelf.id === panel.id)) {
        const topY = getPanelCoord(app, conn.topShelf, 'y');
        if (topY !== null) {
          const maxY = topY - CONFIG.DRAWER.MIN_HEIGHT;
          if (maxY < max) max = maxY;
        }
      }
      
      if (conn.topShelf === panel || 
          (conn.topShelf?.id && conn.topShelf.id === panel.id)) {
        const bottomY = getPanelCoord(app, conn.bottomShelf, 'y');
        if (bottomY !== null) {
          const effectiveBottomY = conn.bottomShelf.type === 'bottom' ? bottomY : (bottomY + CONFIG.DSP);
          const minY = effectiveBottomY + CONFIG.DRAWER.MIN_HEIGHT;
          if (minY > min) min = minY;
        }
      }
    } else {
      // Перемещаем разделитель
      if (conn.leftDivider === panel || 
          (conn.leftDivider?.id && conn.leftDivider.id === panel.id)) {
        const rightX = getPanelCoord(app, conn.rightDivider, 'x');
        if (rightX !== null) {
          const effectiveRightX = conn.rightDivider.type === 'right' ? rightX : (rightX - CONFIG.DSP);
          const maxX = effectiveRightX - CONFIG.DRAWER.MIN_WIDTH;
          if (maxX < max) max = maxX;
        }
      }
      
      if (conn.rightDivider === panel || 
          (conn.rightDivider?.id && conn.rightDivider.id === panel.id)) {
        const leftX = getPanelCoord(app, conn.leftDivider, 'x');
        if (leftX !== null) {
          const effectiveLeftX = conn.leftDivider.type === 'left' ? leftX : (leftX + CONFIG.DSP);
          const minX = effectiveLeftX + CONFIG.DRAWER.MIN_WIDTH;
          if (minX > min) min = minX;
        }
      }
    }
  }
  
  return { min, max };
}

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
  
  // Находим ограничения от других панелей того же типа
  let min = panel.isHorizontal ? app.cabinet.base + CONFIG.MIN_GAP : CONFIG.DSP + CONFIG.MIN_GAP;
  let max = panel.isHorizontal ? app.cabinet.height - CONFIG.DSP - CONFIG.MIN_GAP : app.cabinet.width - CONFIG.DSP - CONFIG.MIN_GAP;
  
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

/**
 * Удалить панель с каскадным удалением зависимых
 * @param {App} app - Экземпляр приложения
 * @param {Panel} panel - Удаляемая панель
 */
export function deletePanel(app, panel) {
  if (panel.type === 'drawer') {
    removeDrawerMeshes(app, panel);
    app.drawers.delete(panel.id);
    app.saveHistory();
    render2D(app);
    renderAll3D(app);
    app.updateStats();
    return;
  }
  
  const toDelete = new Set([panel]);
  
  const findDependent = (current) => {
    for (let other of app.panels.values()) {
      if (toDelete.has(other)) continue;
      
      if (current.isHorizontal) {
        if (!other.isHorizontal) {
          if (other.connections.bottom === current || other.connections.top === current) {
            toDelete.add(other);
            findDependent(other);
          }
        }
      } else {
        if (other.isHorizontal) {
          if (other.connections.left === current || other.connections.right === current) {
            toDelete.add(other);
            findDependent(other);
          }
        }
      }
    }
  };
  
  findDependent(panel);
  
  const affectedPanels = new Set();
  for (let remaining of app.panels.values()) {
    if (toDelete.has(remaining)) continue;
    
    for (let deleted of toDelete) {
      if (Object.values(remaining.connections).includes(deleted)) {
        affectedPanels.add(remaining);
      }
    }
  }
  
  for (let p of toDelete) {
    removeMesh(app, p);
    app.panels.delete(p.id);
  }
  
  for (let affected of affectedPanels) {
    recalculatePanelBounds(app, affected);
  }
  
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) {
      panel.updateRibs(app.panels, app.cabinet.width);
    }
  }
  
  for (let drawer of app.drawers.values()) {
    const connections = drawer.connections;
    if (toDelete.has(connections.bottomShelf) || 
        toDelete.has(connections.topShelf) ||
        toDelete.has(connections.leftDivider) ||
        toDelete.has(connections.rightDivider)) {
      removeDrawerMeshes(app, drawer);
      app.drawers.delete(drawer.id);
    } else {
      drawer.updateParts(app);
      updateDrawerMeshes(app, drawer);
    }
  }
  
  app.saveHistory();
  render2D(app);
  renderAll3D(app);
  app.updateStats();
}

/**
 * Пересчитать границы панели после удаления связанных
 * @param {App} app - Экземпляр приложения
 * @param {Panel} panel - Панель для пересчёта
 */
export function recalculatePanelBounds(app, panel) {
  if (panel.isHorizontal) {
    const dividers = Array.from(app.panels.values())
      .filter(p => !p.isHorizontal && 
                  p.bounds.startY <= panel.position.y && 
                  p.bounds.endY >= panel.position.y)
      .sort((a, b) => a.position.x - b.position.x);
    
    const points = [
      { x: CONFIG.DSP, panel: null },
      ...dividers.map(d => ({ x: d.position.x, panel: d })),
      { x: app.cabinet.width - CONFIG.DSP, panel: null }
    ];
    
    const center = (panel.bounds.startX + panel.bounds.endX) / 2;
    
    for (let i = 0; i < points.length - 1; i++) {
      const segmentStart = points[i].x + (points[i].panel ? CONFIG.DSP : 0);
      const segmentEnd = points[i + 1].x;
      
      if (center >= points[i].x && center <= points[i + 1].x) {
        panel.bounds.startX = segmentStart;
        panel.bounds.endX = segmentEnd;
        panel.connections.left = points[i].panel;
        panel.connections.right = points[i + 1].panel;
        panel.updateRibs(app.panels, app.cabinet.width);
        break;
      }
    }
  } else {
    const shelves = Array.from(app.panels.values())
      .filter(p => p.isHorizontal && 
                  p.bounds.startX <= panel.position.x && 
                  p.bounds.endX >= panel.position.x)
      .sort((a, b) => a.position.y - b.position.y);
    
    const points = [
      { y: app.cabinet.base, panel: null },
      ...shelves.map(s => ({ y: s.position.y, panel: s })),
      { y: app.cabinet.height - CONFIG.DSP, panel: null }
    ];
    
    const center = (panel.bounds.startY + panel.bounds.endY) / 2;
    
    for (let i = 0; i < points.length - 1; i++) {
      const segmentStart = points[i].y + (points[i].panel ? CONFIG.DSP : 0);
      const segmentEnd = points[i + 1].y;
      
      if (center >= points[i].y && center <= points[i + 1].y) {
        panel.bounds.startY = segmentStart;
        panel.bounds.endY = segmentEnd;
        panel.connections.bottom = points[i].panel;
        panel.connections.top = points[i + 1].panel;
        break;
      }
    }
  }
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