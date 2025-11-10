// ========== PANEL OPERATIONS: DELETE ==========
// Удаление панелей с каскадом и пересчёт границ

import { CONFIG } from '../../config.js';
import { render2D } from '../render2D.js';
import { renderAll3D, removeMesh, updateDrawerMeshes, removeDrawerMeshes } from '../render3D.js';

/**
 * Удалить панель с каскадным удалением зависимых
 * @param {App} app - Экземпляр приложения
 * @param {Panel} panel - Удаляемая панель
 */
export function deletePanel(app, panel) {
  if (panel.type === 'drawer') {
    // Если ящик в стеке - удаляем весь стек
    if (panel.stackId) {
      const stackDrawers = Array.from(app.drawers.values())
        .filter(d => d.stackId === panel.stackId);
      
      for (let drawer of stackDrawers) {
        removeDrawerMeshes(app, drawer);
        app.drawers.delete(drawer.id);
      }
    } else {
      // Одиночный ящик - удаляем только его
      removeDrawerMeshes(app, panel);
      app.drawers.delete(panel.id);
    }
    
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