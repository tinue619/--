// ========== PANEL OPERATIONS: ADD ==========
// Добавление панелей (полки, разделители)

import { CONFIG } from '../../config.js';
import { Panel } from '../../Panel.js';
import { render2D } from '../render2D.js';
import { renderAll3D } from '../render3D.js';

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
