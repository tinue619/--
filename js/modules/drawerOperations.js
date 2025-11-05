// ========== DRAWER OPERATIONS ==========
// Управление ящиками (добавление, создание стеков)

import { CONFIG } from '../config.js';
import { Drawer } from '../Drawer.js';
import { render2D } from './render2D.js';
import { renderAll3D, removeDrawerMeshes } from './render3D.js';

/**
 * Добавить ящик по клику
 * @param {App} app - Экземпляр приложения
 * @param {{x: number, y: number}} coords - Координаты клика
 */
export function addDrawer(app, coords) {
  console.log('addDrawer called:', coords, 'drawerCount:', app.drawerCount);
  
  // Найдем 4 панели, которые ограничивают область клика
  let bottomShelf = null, topShelf = null, leftDivider = null, rightDivider = null;
  
  // Находим полки снизу и сверху
  for (let panel of app.panels.values()) {
    if (!panel.isHorizontal) continue;
    
    if (coords.x >= panel.bounds.startX && coords.x <= panel.bounds.endX) {
      if (panel.position.y <= coords.y) {
        if (!bottomShelf || panel.position.y > bottomShelf.position.y) {
          bottomShelf = panel;
        }
      } else {
        if (!topShelf || panel.position.y < topShelf.position.y) {
          topShelf = panel;
        }
      }
    }
  }
  
  // Находим разделители слева и справа
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) continue;
    
    if (coords.y >= panel.bounds.startY && coords.y <= panel.bounds.endY) {
      if (panel.position.x <= coords.x) {
        if (!leftDivider || panel.position.x > leftDivider.position.x) {
          leftDivider = panel;
        }
      } else {
        if (!rightDivider || panel.position.x < rightDivider.position.x) {
          rightDivider = panel;
        }
      }
    }
  }
  
  // Если не нашли полки - используем дно/крышу
  if (!bottomShelf) {
    bottomShelf = {
      type: 'bottom',
      id: 'virtual-bottom',
      position: { y: app.cabinet.base - CONFIG.DSP/2 },
      bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
      connections: {},
      isHorizontal: true
    };
  }
  
  if (!topShelf) {
    topShelf = {
      type: 'top',
      id: 'virtual-top',
      position: { y: app.cabinet.height - CONFIG.DSP/2 },
      bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
      connections: {},
      isHorizontal: true
    };
  }
  
  if (!leftDivider) {
    leftDivider = {
      type: 'left',
      id: 'virtual-left',
      position: { x: CONFIG.DSP/2 },
      bounds: { startY: 0, endY: app.cabinet.height },
      connections: {},
      isHorizontal: false
    };
  }
  
  if (!rightDivider) {
    rightDivider = {
      type: 'right',
      id: 'virtual-right',
      position: { x: app.cabinet.width - CONFIG.DSP/2 },
      bounds: { startY: 0, endY: app.cabinet.height },
      connections: {},
      isHorizontal: false
    };
  }
  
  // Создаём стек ящиков
  const baseConnections = { bottomShelf, topShelf, leftDivider, rightDivider };
  const success = createDrawerStack(app, baseConnections, app.drawerCount);
  
  if (!success) {
    app.updateStatus('Не удалось создать ящики - проверьте размеры области');
    return;
  }
  
  app.saveHistory();
  render2D(app);
  renderAll3D(app);
  app.updateStats();
}

/**
 * Создать стек из N ящиков, равномерно разделяя высоту секции
 * @param {App} app - Экземпляр приложения
 * @param {Object} baseConnections - Базовые границы секции { bottomShelf, topShelf, leftDivider, rightDivider }
 * @param {number} count - Количество ящиков (1-5)
 * @returns {boolean} - Успех создания
 */
export function createDrawerStack(app, baseConnections, count) {
  const { bottomShelf, topShelf, leftDivider, rightDivider } = baseConnections;
  
  // Высчитываем общую высоту секции
  const bottomY = bottomShelf.type === 'bottom' ? app.cabinet.base : (bottomShelf.position.y + CONFIG.DSP);
  const topY = topShelf.type === 'top' ? (app.cabinet.height - CONFIG.DSP) : topShelf.position.y;
  const totalHeight = topY - bottomY;
  
  // Высота одного ящика
  const drawerHeight = totalHeight / count;
  
  // Проверка минимальной высоты
  if (drawerHeight < CONFIG.DRAWER.MIN_HEIGHT) {
    console.error(`Высота одного ящика слишком мала: ${Math.round(drawerHeight)}mm < ${CONFIG.DRAWER.MIN_HEIGHT}mm`);
    return false;
  }
  
  // Создаём виртуальные полки для разделения стека
  const virtualShelves = [];
  for (let i = 0; i <= count; i++) {
    const y = bottomY + (drawerHeight * i);
    
    if (i === 0) {
      virtualShelves.push(bottomShelf);
    } else if (i === count) {
      virtualShelves.push(topShelf);
    } else {
      // Создаём виртуальную полку для разделения
      virtualShelves.push({
        type: 'virtual-shelf',
        id: `virtual-shelf-${i}`,
        position: { y: y },
        bounds: { 
          startX: leftDivider.type === 'left' ? CONFIG.DSP : (leftDivider.position.x + CONFIG.DSP),
          endX: rightDivider.type === 'right' ? (app.cabinet.width - CONFIG.DSP) : rightDivider.position.x
        },
        connections: {},
        isHorizontal: true
      });
    }
  }
  
  // Создаём ящики
  const createdDrawers = [];
  for (let i = 0; i < count; i++) {
    const id = `drawer-${app.nextDrawerId++}`;
    const connections = {
      bottomShelf: virtualShelves[i],
      topShelf: virtualShelves[i + 1],
      leftDivider: leftDivider,
      rightDivider: rightDivider
    };
    
    const drawer = new Drawer(id, connections);
    const success = drawer.calculateParts(app);
    
    if (!success) {
      // Откатываем создание - удаляем уже созданные
      for (let d of createdDrawers) {
        removeDrawerMeshes(app, d);
        app.drawers.delete(d.id);
      }
      return false;
    }
    
    app.drawers.set(id, drawer);
    createdDrawers.push(drawer);
  }
  
  console.log(`Создан стек из ${count} ящиков, высота каждого: ${Math.round(drawerHeight)}mm`);
  return true;
}