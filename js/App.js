import * as THREE from 'three';
import { CONFIG, CALC } from './config.js';
import { Panel } from './Panel.js';
import { Drawer } from './Drawer.js';
import { Viewer3D } from './Viewer3D.js';

// Импорты модулей
import { 
  setupHistoryDrag, 
  toggleHistoryCollapse, 
  copyHistoryLogs, 
  logToHistory, 
  clearHistoryLog, 
  compareStatesForLog 
} from './modules/historyLogging.js';
import { debugHistory, debugCurrentState, compareStates } from './modules/historyDebug.js';
import { render2D } from './modules/render2D.js';
import { initViewer3D, renderAll3D, updateMesh, removeMesh, updateDrawerMeshes, removeDrawerMeshes } from './modules/render3D.js';
import { 
  setupEvents,
  setMode, 
  updateStatus, 
  switchTab, 
  updateStats, 
  updateCabinetInfo 
} from './modules/uiManager.js';
import { 
  updateCanvas,
  getCoords,
  handlePointer,
  startInteraction,
  updateInteraction,
  endInteraction,
  findPanelAt
} from './modules/interactions.js';
import { 
  serializeConnections,
  deserializeConnections,
  scheduleSave,
  saveToStorage,
  loadState,
  showSaved
} from './modules/stateManager.js';
import { 
  saveHistory,
  undo,
  redo,
  restoreState,
  updateHistoryButtons
} from './modules/historyManager.js';
import { 
  addDrawer,
  createDrawerStack
} from './modules/drawerOperations.js';

// ========== ГЛАВНОЕ ПРИЛОЖЕНИЕ ==========
export class App {
  constructor() {
    // Динамические размеры шкафа (вместо жестких CONFIG)
    this.cabinet = {
      width: CONFIG.CABINET.WIDTH,
      height: CONFIG.CABINET.HEIGHT,
      depth: CONFIG.CABINET.DEPTH,
      base: CONFIG.CABINET.BASE
    };
    
    // Вычисляемые размеры (аналог CALC)
    this.updateCalc();
    
    // Состояние
    this.mode = 'shelf';
    this.panels = new Map();
    this.drawers = new Map();  // Ящики
    this.nextId = 0;
    this.nextDrawerId = 0;
    this.drawerCount = 1;  // Количество ящиков в стеке (1-5)
    
    // Взаимодействие
    this.interaction = {
      dragging: null,
      start: null,
      hasMoved: false,
      boundsSnapshot: null  // Снапшот bounds для логирования
    };
    
    // История
    this.history = {
      states: [],
      index: -1
    };
    
    // Canvas
    this.canvas = {
      element: null,
      ctx: null,
      size: 0,
      scale: 1,
      offset: { x: 0, y: 0 }
    };
    
    // 3D
    this.viewer3D = null;
    this.mesh3D = new Map();
    
    // Таймеры
    this.saveTimer = null;
  }
  
  // Обновляем вычисляемые размеры
  updateCalc() {
    this.calc = {
      innerWidth: this.cabinet.width - CONFIG.DSP * 2,
      innerDepth: this.cabinet.depth - CONFIG.HDF,
      workHeight: this.cabinet.height - this.cabinet.base - CONFIG.DSP
    };
  }

  // ========== РАСЧЁТ РАНГА ПАНЕЛИ ==========
  // Ранг определяет порядок сборки и глубину утопления панели
  // Не хранится в Panel, вычисляется на лету по connections
  calculatePanelRank(panel) {
    // Фиксированные ранги
    if (panel.type === 'back') return -1;  // ХДФ задняя стенка
    if (panel.type === 'left' || panel.type === 'right') return 0;  // Боковины - база
    if (panel.type === 'bottom' || panel.type === 'top' || 
        panel.type === 'plinth' || panel.type === 'upperPlinth') return 1;  // Крепятся к боковинам
    
    // Динамический расчёт для полок и разделителей
    // Ранг = максимальный ранг родителей + 1
    let maxRank = 0;
    for (let parent of Object.values(panel.connections)) {
      if (parent && parent.type) {  // parent - это объект Panel, не ID
        const parentRank = this.calculatePanelRank(parent);  // Рекурсивно
        maxRank = Math.max(maxRank, parentRank);
      }
    }
    return maxRank + 1;
  }
  
  // ========== ИНИЦИАЛИЗАЦИЯ ==========
  init() {
    this.canvas.element = document.getElementById('editor-canvas');
    this.canvas.ctx = this.canvas.element.getContext('2d');
    
    this.setupEvents();
    this.updateCanvas();
    this.loadState();
    render2D(this);
    this.updateStats();
    
    if (window.innerWidth > 1024) {
      setTimeout(() => initViewer3D(this), 100);
    }
    
    // Для отладки - доступно в консоли через window.app
    window.app = this;
  }
  
  setupEvents() {
    setupEvents(this);
  }
  
  // ========== УПРАВЛЕНИЕ РЕЖИМАМИ ==========
  setMode(mode) {
    setMode(this, mode);
  }
  
  updateStatus(temp = null) {
    updateStatus(this, temp);
  }
  
  switchTab(tab) {
    switchTab(this, tab);
  }
  
  // ========== CANVAS УТИЛИТЫ ==========
  updateCanvas() {
    updateCanvas(this);
  }
  
  getCoords(e) {
    return getCoords(this, e);
  }
  
  // ========== ОБРАБОТКА СОБЫТИЙ ==========
  handlePointer(e) {
    handlePointer(this, e);
  }
  
  startInteraction(coords) {
    startInteraction(this, coords);
  }

  updateInteraction(coords) {
    updateInteraction(this, coords);
  }

  endInteraction(coords) {
    endInteraction(this, coords);
  }
  
  findPanelAt(coords) {
    return findPanelAt(this, coords);
  }
  
  // ========== ДОБАВЛЕНИЕ ПАНЕЛЕЙ ==========
  
  /**
   * Проверяет, нет ли ящика в области, которую пересекает новая панель
   */
  hasDrawerInArea(isHorizontal, mainPos, startCross, endCross) {
    for (let drawer of this.drawers.values()) {
      if (!drawer.volume) continue;
      
      if (isHorizontal) {
        // Проверяем полку: пересекает ли она ящик по Y
        // Полка на высоте mainPos, от startCross до endCross по X
        const shelfY = mainPos;
        const shelfStartX = startCross;
        const shelfEndX = endCross;
        
        // Проверяем, проходит ли полка через ящик
        if (shelfY > drawer.volume.y.start && shelfY < drawer.volume.y.end) {
          // Полка пересекает ящик по Y, проверяем X
          if (!(shelfEndX <= drawer.volume.x.start || shelfStartX >= drawer.volume.x.end)) {
            return true;  // Есть пересечение
          }
        }
      } else {
        // Проверяем разделитель: пересекает ли он ящик по X
        // Разделитель на позиции mainPos, от startCross до endCross по Y
        const dividerX = mainPos;
        const dividerStartY = startCross;
        const dividerEndY = endCross;
        
        // Проверяем, проходит ли разделитель через ящик
        if (dividerX > drawer.volume.x.start && dividerX < drawer.volume.x.end) {
          // Разделитель пересекает ящик по X, проверяем Y
          if (!(dividerEndY <= drawer.volume.y.start || dividerStartY >= drawer.volume.y.end)) {
            return true;  // Есть пересечение
          }
        }
      }
    }
    
    return false;  // Ящиков нет в этой области
  }
  
  addPanel(type, mainPos, crossPos) {
    const isHorizontal = type === 'shelf';
    
    // Ограничения позиции
    if (isHorizontal) {
      mainPos = Math.max(this.cabinet.base, Math.min(this.cabinet.height - CONFIG.DSP, mainPos));
    } else {
      mainPos = Math.max(CONFIG.DSP + CONFIG.MIN_GAP, Math.min(this.cabinet.width - CONFIG.DSP - CONFIG.MIN_GAP, mainPos));
    }
    
    // Находим пересечения с перпендикулярными панелями
    const perpType = isHorizontal ? 'divider' : 'shelf';
    const intersecting = Array.from(this.panels.values())
      .filter(p => p.type === perpType && p.intersects(mainPos, isHorizontal ? 'y' : 'x'))
      .sort((a, b) => a.mainPosition - b.mainPosition);
    
    // Определяем границы новой панели
    let bounds, connections = {};
    if (isHorizontal) {
      let startX = CONFIG.DSP;
      let endX = this.cabinet.width - CONFIG.DSP;
      
      if (intersecting.length > 0) {
        const points = [
          { x: CONFIG.DSP, panel: null },
          ...intersecting.map(d => ({ x: d.position.x, panel: d })),
          { x: this.cabinet.width - CONFIG.DSP, panel: null }
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
        this.updateStatus(`Слишком узкая секция! Минимум ${CONFIG.MIN_SIZE} мм`);
        return;
      }
      
      bounds = { startX, endX };
    } else {
      let startY = this.cabinet.base;
      let endY = this.cabinet.height - CONFIG.DSP;
      
      if (intersecting.length > 0) {
        const points = [
          { y: this.cabinet.base, panel: null },
          ...intersecting.map(s => ({ y: s.position.y, panel: s })),
          { y: this.cabinet.height - CONFIG.DSP, panel: null }
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
        this.updateStatus(`Слишком низкая секция! Минимум ${CONFIG.MIN_SIZE} мм`);
        return;
      }
      
      bounds = { startY, endY };
    }
    
    // Проверяем, нет ли ящика в этой области
    if (isHorizontal) {
      if (this.hasDrawerInArea(true, mainPos, bounds.startX, bounds.endX)) {
        this.updateStatus('Нельзя добавить полку - в этой области есть ящик');
        return;
      }
    } else {
      if (this.hasDrawerInArea(false, mainPos, bounds.startY, bounds.endY)) {
        this.updateStatus('Нельзя добавить разделитель - в этой области есть ящик');
        return;
      }
    }
    
    const id = `${type}-${this.nextId++}`;
    const position = isHorizontal ? { y: mainPos } : { x: mainPos };
    const panel = new Panel(type, id, position, bounds, connections);
    
    this.panels.set(id, panel);
    
    // Обновляем ребра
    if (isHorizontal) {
      // Добавлена полка - обновляем её ребра
      panel.updateRibs(this.panels, this.cabinet.width);
    } else {
      // Добавлен разделитель - обновляем ребра всех полок, которые он пересекает
      for (let p of this.panels.values()) {
        if (p.isHorizontal && 
            p.bounds.startX <= panel.position.x && 
            p.bounds.endX >= panel.position.x &&
            panel.bounds.startY <= p.position.y &&
            panel.bounds.endY >= p.position.y) {
          p.updateRibs(this.panels, this.cabinet.width);
        }
      }
    }
    
    this.saveHistory();
    render2D(this);
    renderAll3D(this);  // Обновляем весь 3D вид
    this.updateStats();
  }
  
  /**
   * Получить координату панели (реальной или виртуальной)
   */
  getPanelCoord(panel, axis) {
    if (!panel) return null;
    
    // Виртуальные панели
    if (panel.type === 'left') return CONFIG.DSP/2;
    if (panel.type === 'right') return this.cabinet.width - CONFIG.DSP/2;
    if (panel.type === 'bottom') return this.cabinet.base;
    if (panel.type === 'top') return this.cabinet.height - CONFIG.DSP;
    if (panel.type === 'virtual-shelf') return panel.position.y;
    
    // Реальные панели
    return panel.position[axis];
  }
  
  /**
   * Получить ограничения от ящиков для перемещаемой панели
   * @param {Panel} panel - Перемещаемая панель
   * @returns {{min: number, max: number}} - Ограничения
   */
  getDrawerLimitsForPanel(panel) {
    let min = -Infinity;
    let max = Infinity;
    
    for (let drawer of this.drawers.values()) {
      const conn = drawer.connections;
      
      if (panel.isHorizontal) {
        // Перемещаем полку (горизонтальную панель)
        
        // Если полка - это bottomShelf ящика
        if (conn.bottomShelf === panel || 
            (conn.bottomShelf?.id && conn.bottomShelf.id === panel.id)) {
          // Полка не может подняться выше чем (topShelf.y - MIN_HEIGHT)
          const topY = this.getPanelCoord(conn.topShelf, 'y');
          if (topY !== null) {
            const maxY = topY - CONFIG.DRAWER.MIN_HEIGHT;
            if (maxY < max) max = maxY;
          }
        }
        
        // Если полка - это topShelf ящика
        if (conn.topShelf === panel || 
            (conn.topShelf?.id && conn.topShelf.id === panel.id)) {
          // Полка не может опуститься ниже чем (bottomShelf.y + MIN_HEIGHT)
          const bottomY = this.getPanelCoord(conn.bottomShelf, 'y');
          if (bottomY !== null) {
            // Для bottom-shelf: y = base, нужно добавить DSP
            const effectiveBottomY = conn.bottomShelf.type === 'bottom' ? bottomY : (bottomY + CONFIG.DSP);
            const minY = effectiveBottomY + CONFIG.DRAWER.MIN_HEIGHT;
            if (minY > min) min = minY;
          }
        }
        
      } else {
        // Перемещаем разделитель (вертикальную панель)
        
        // Если разделитель - это leftDivider ящика
        if (conn.leftDivider === panel || 
            (conn.leftDivider?.id && conn.leftDivider.id === panel.id)) {
          // Разделитель не может сдвинуться вправо больше чем (rightDivider.x - MIN_WIDTH)
          const rightX = this.getPanelCoord(conn.rightDivider, 'x');
          if (rightX !== null) {
            // Для right-divider: нужно учесть DSP
            const effectiveRightX = conn.rightDivider.type === 'right' ? rightX : (rightX - CONFIG.DSP);
            const maxX = effectiveRightX - CONFIG.DRAWER.MIN_WIDTH;
            if (maxX < max) max = maxX;
          }
        }
        
        // Если разделитель - это rightDivider ящика
        if (conn.rightDivider === panel || 
            (conn.rightDivider?.id && conn.rightDivider.id === panel.id)) {
          // Разделитель не может сдвинуться влево больше чем (leftDivider.x + MIN_WIDTH)
          const leftX = this.getPanelCoord(conn.leftDivider, 'x');
          if (leftX !== null) {
            // Для left-divider: нужно учесть DSP
            const effectiveLeftX = conn.leftDivider.type === 'left' ? leftX : (leftX + CONFIG.DSP);
            const minX = effectiveLeftX + CONFIG.DRAWER.MIN_WIDTH;
            if (minX > min) min = minX;
          }
        }
      }
    }
    
    return { min, max };
  }
  
  // ========== ПЕРЕМЕЩЕНИЕ ПАНЕЛЕЙ ==========
  movePanel(panel, coords) {
    // Особая обработка для боковин
    if (panel.type === 'side') {
      this.moveSide(panel, coords.x);
      return;
    }
    
    // Особая обработка для дна и крыши
    if (panel.type === 'horizontal-side') {
      this.moveHorizontalSide(panel, coords.y);
      return;
    }
    
    const oldPos = panel.mainPosition;
    
    const newPos = panel.isHorizontal ? coords.y : coords.x;
    
    // Находим ограничения от других панелей того же типа
    let min = panel.isHorizontal ? this.cabinet.base + CONFIG.MIN_GAP : CONFIG.DSP + CONFIG.MIN_GAP;
    let max = panel.isHorizontal ? this.cabinet.height - CONFIG.DSP - CONFIG.MIN_GAP : this.cabinet.width - CONFIG.DSP - CONFIG.MIN_GAP;
    
    for (let other of this.panels.values()) {
      if (other === panel || other.type !== panel.type) continue;
      
      // Проверяем перекрытие по перпендикулярной оси
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
    const drawerLimits = this.getDrawerLimitsForPanel(panel);
    if (drawerLimits.min > -Infinity) {
      min = Math.max(min, drawerLimits.min);
    }
    if (drawerLimits.max < Infinity) {
      max = Math.min(max, drawerLimits.max);
    }
    
    // Отладка: выводим ограничения
    if (drawerLimits.min > -Infinity || drawerLimits.max < Infinity) {
      console.log('Panel movement limits:', {
        panelId: panel.id,
        newPos: Math.round(newPos),
        finalMin: Math.round(min),
        finalMax: Math.round(max),
        drawerLimits: {
          min: drawerLimits.min > -Infinity ? Math.round(drawerLimits.min) : 'none',
          max: drawerLimits.max < Infinity ? Math.round(drawerLimits.max) : 'none'
        }
      });
    }
    
    // Обновляем позицию панели
    panel.mainPosition = Math.round(Math.max(min, Math.min(max, newPos)));
    
    // Обновляем bounds и connections только связанных панелей (включая ребра)
    this.updateConnectedPanels(panel);
    
    render2D(this);
    renderAll3D(this);
  }
  
  // ========== ПЕРЕМЕЩЕНИЕ БОКОВИН ==========
  moveSide(side, newX) {
    const isLeftSide = side.id === 'left-side';
    
    // Минимальная и максимальная ширина шкафа
    const MIN_CABINET_WIDTH = 400;
    const MAX_CABINET_WIDTH = 3000;
    
    // Находим ограничения от вертикальных панелей
    let minX, maxX;
    
    if (isLeftSide) {
      // Левая боковина - ограничения по ширине шкафа
      // Чем меньше newX, тем шире шкаф (расширяемся влево)
      // Чем больше newX, тем уже шкаф (сужаемся)
      
      // Минимальное положение левой боковины (максимальное расширение)
      minX = this.cabinet.width - MAX_CABINET_WIDTH + CONFIG.DSP/2;
      
      // Максимальное положение левой боковины (минимальное сужение)
      // Находим самый левый разделитель
      let leftmostDivider = null;
      for (let panel of this.panels.values()) {
        if (!panel.isHorizontal) {
          if (!leftmostDivider || panel.position.x < leftmostDivider.position.x) {
            leftmostDivider = panel;
          }
        }
      }
      
      if (leftmostDivider) {
        // Не можем сдвинуть боковину ближе чем на 150мм к разделителю
        maxX = leftmostDivider.position.x - CONFIG.MIN_GAP - CONFIG.DSP/2;
      } else {
        // Максимальное сужение - минимальная ширина 400мм
        maxX = this.cabinet.width - MIN_CABINET_WIDTH + CONFIG.DSP/2;
      }
    } else {
      // Правая боковина - ищем самую правую вертикаль
      maxX = MAX_CABINET_WIDTH - CONFIG.DSP/2;  // Максимальное положение
      
      // Находим самый правый разделитель
      let rightmostDivider = null;
      for (let panel of this.panels.values()) {
        if (!panel.isHorizontal) {
          if (!rightmostDivider || panel.position.x > rightmostDivider.position.x) {
            rightmostDivider = panel;
          }
        }
      }
      
      // Минимум - 150мм от ближайшего разделителя или левой боковины
      if (rightmostDivider) {
        minX = rightmostDivider.position.x + CONFIG.MIN_GAP + CONFIG.DSP/2;
      } else {
        minX = MIN_CABINET_WIDTH - CONFIG.DSP/2;
      }
    }
    
    // Ограничиваем новое положение
    newX = Math.round(Math.max(minX, Math.min(maxX, newX)));
    
    // Обновляем размеры шкафа
    const oldWidth = this.cabinet.width;
    if (isLeftSide) {
      // Левая боковина всегда на CONFIG.DSP/2
      // newX < CONFIG.DSP/2 - тянем влево (расширяем)
      // newX > CONFIG.DSP/2 - тянем вправо (сужаем)
      const shift = CONFIG.DSP/2 - newX;
      this.cabinet.width = oldWidth + shift;
      
      // Сдвигаем все панели вправо (компенсируем сдвиг системы координат)
      for (let panel of this.panels.values()) {
        if (!panel.isHorizontal) {
          panel.position.x += shift;
        } else {
          panel.bounds.startX = Math.max(CONFIG.DSP, panel.bounds.startX + shift);
          panel.bounds.endX = Math.min(this.cabinet.width - CONFIG.DSP, panel.bounds.endX + shift);
        }
      }
    } else {
      // При движении правой боковины - меняется только ширина
      this.cabinet.width = newX + CONFIG.DSP/2;
    }
    
    // Обновляем вычисляемые размеры
    this.updateCalc();
    
    // Обновляем полки которые упираются в боковины
    for (let panel of this.panels.values()) {
      if (panel.isHorizontal) {
        // Если полка упирается в боковины, обновляем ее границы
        if (!panel.connections.left) {
          panel.bounds.startX = CONFIG.DSP;
        }
        if (!panel.connections.right) {
          panel.bounds.endX = this.cabinet.width - CONFIG.DSP;
        }
        // Обновляем ребра жесткости
        panel.updateRibs(this.panels, this.cabinet.width);
      }
    }
    
    // Пересчитываем все ящики после изменения ширины
    for (let drawer of this.drawers.values()) {
      drawer.updateParts(this);
      updateDrawerMeshes(this, drawer);  // Обновляем 3D меши
    }
    
    // Обновляем отображение
    this.updateCanvas();
    render2D(this);
    
    // Обновляем 3D корпус
    if (this.viewer3D) {
      this.viewer3D.rebuildCabinet();
    }
    
    renderAll3D(this);
    
    // Обновляем информацию о размерах шкафа
    this.updateCabinetInfo();
  }
  
  // ========== ПЕРЕМЕЩЕНИЕ ДНА И КРЫШИ ==========
  moveHorizontalSide(side, newY) {
    const isBottom = side.id === 'bottom-side';
    
    if (isBottom) {
      // ========== ДВИЖЕНИЕ ДНА ==========
      // Дно управляет высотой цоколя (base)
      const MIN_BASE_HEIGHT = 60;  // Минимальная высота цоколя 60мм
      
      // Находим ограничения
      let minBase = MIN_BASE_HEIGHT;  // Минимальная высота цоколя
      let maxBase = this.cabinet.height - CONFIG.DSP - CONFIG.MIN_SIZE;  // Максимум ограничен рабочей высотой
      
      // Ограничиваем самой нижней полкой
      for (let panel of this.panels.values()) {
        if (panel.isHorizontal) {
          const minPossibleBase = panel.position.y - CONFIG.MIN_GAP - CONFIG.DSP;
          if (minPossibleBase < maxBase) {
            maxBase = minPossibleBase;
          }
        }
      }
      // ВАЖНО: Добавляем ограничения от ящиков для виртуального дна
      // Создаём временную виртуальную панель для проверки
      const virtualBottom = {
        type: 'bottom',
        id: 'virtual-bottom',
        position: { y: this.cabinet.base },
        isHorizontal: true
      };
      
      const drawerLimits = this.getDrawerLimitsForPanel(virtualBottom);
      
      // Если дно - это bottomShelf какого-то ящика, оно не может подняться слишком высоко
      if (drawerLimits.max < Infinity) {
        // Преобразуем из координаты Y в base
        const maxBaseFromDrawers = drawerLimits.max;
        if (maxBaseFromDrawers < maxBase) {
          maxBase = maxBaseFromDrawers;
        }
      }
      
      // Отладка
      if (drawerLimits.max < Infinity) {
        console.log('Bottom movement limits from drawers:', {
          requestedBase: Math.round(newY + CONFIG.DSP/2),
          maxBase: Math.round(maxBase),
          drawerLimit: Math.round(drawerLimits.max)
        });
      }
      // newY это центр дна, преобразуем в base (верх дна = base)
      const requestedBase = newY + CONFIG.DSP/2;
      const oldBase = this.cabinet.base;
      const newBase = Math.round(Math.max(minBase, Math.min(maxBase, requestedBase)));
      
      // Рассчитываем сдвиг
      const delta = newBase - oldBase;
      
      if (delta === 0) return;  // Ничего не изменилось
      
      // Обновляем высоту цоколя
      this.cabinet.base = newBase;
      
      // ВАЖНО: При движении дна разделители РАСТЯГИВАЮТСЯ/СЖИМАЮТСЯ снизу!
      // Их верх остается на месте (привязан к полкам), низ двигается с дном
      // Полки остаются на своих абсолютных Y координатах
      for (let panel of this.panels.values()) {
        if (!panel.isHorizontal) {
          // Разделители: только startY двигается (низ), endY остается на месте
          if (!panel.connections.bottom) {
            // Если разделитель не упирается в полку снизу, его низ = base
            panel.bounds.startY = this.cabinet.base;
          }
          // Пересчитываем position (центр)
          panel.position.y = (panel.bounds.startY + panel.bounds.endY) / 2;
          // Обновляем 3D mesh для разделителя
          updateMesh(this, panel);
        }
        // Полки НЕ трогаем - они остаются на тех же абсолютных координатах
      }
      
    } else {
      // ========== ДВИЖЕНИЕ КРЫШИ ==========
      // Крыша управляет общей высотой шкафа (height)
      // Находим ограничения
      let minHeight = this.cabinet.base + CONFIG.MIN_SIZE + CONFIG.DSP;  // Минимальная рабочая высота
      let maxHeight = 3000;  // Максимальная разумная высота
      
      // Ограничиваем самой верхней полкой - крыша НЕ МОЖЕТ пройти сквозь полки
      for (let panel of this.panels.values()) {
        if (panel.isHorizontal) {
          const minPossibleHeight = panel.position.y + CONFIG.DSP + CONFIG.MIN_GAP;
          if (minPossibleHeight > minHeight) {
            minHeight = minPossibleHeight;  // Крыша должна быть выше самой верхней полки
          }
        }
      }
      // ВАЖНО: Добавляем ограничения от ящиков для виртуальной крыши
      // Создаём временную виртуальную панель для проверки
      const virtualTop = {
        type: 'top',
        id: 'virtual-top',
        position: { y: this.cabinet.height - CONFIG.DSP },
        isHorizontal: true
      };
      
      const drawerLimits = this.getDrawerLimitsForPanel(virtualTop);
      
      // Если крыша - это topShelf какого-то ящика, она не может опуститься слишком низко
      if (drawerLimits.min > -Infinity) {
        // Преобразуем из координаты Y в height
        const minHeightFromDrawers = drawerLimits.min + CONFIG.DSP;
        if (minHeightFromDrawers > minHeight) {
          minHeight = minHeightFromDrawers;
        }
      }
      
      // Отладка
      if (drawerLimits.min > -Infinity) {
        console.log('Top movement limits from drawers:', {
          requestedHeight: Math.round(newY + CONFIG.DSP/2),
          minHeight: Math.round(minHeight),
          drawerLimit: Math.round(drawerLimits.min)
        });
      }

      
      // newY это центр крыши, преобразуем в height (низ крыши = height - DSP)
      const requestedHeight = newY + CONFIG.DSP/2;
      const oldHeight = this.cabinet.height;
      const newHeight = Math.round(Math.max(minHeight, Math.min(maxHeight, requestedHeight)));
      
      if (newHeight === oldHeight) return;  // Ничего не изменилось
      
      // Обновляем высоту шкафа
      this.cabinet.height = newHeight;
      
      // Обновляем endY всех разделителей, которые упираются в крышу
      for (let panel of this.panels.values()) {
        if (!panel.isHorizontal) {
          // Если разделитель не упирается в полку сверху, растягиваем его до крыши
          if (!panel.connections.top) {
            panel.bounds.endY = this.cabinet.height - CONFIG.DSP;
            // ВАЖНО: Обновляем position разделителя (центр)
            panel.position.y = (panel.bounds.startY + panel.bounds.endY) / 2;
            // Обновляем 3D mesh для разделителя
            updateMesh(this, panel);
          }
        }
      }
    }
    
    // Обновляем вычисляемые размеры
    this.updateCalc();
    
    // Обновляем полки, которые зависят от изменившихся границ
    for (let panel of this.panels.values()) {
      if (panel.isHorizontal) {
        // Обновляем ребра жесткости для всех полок
        panel.updateRibs(this.panels, this.cabinet.width);
      }
    }
    
    // Пересчитываем все ящики после изменения высоты/цоколя
    for (let drawer of this.drawers.values()) {
      drawer.updateParts(this);
      updateDrawerMeshes(this, drawer);  // Обновляем 3D меши
    }
    
    // Обновляем отображение
    this.updateCanvas();
    render2D(this);
    
    // Обновляем 3D корпус
    if (this.viewer3D) {
      this.viewer3D.rebuildCabinet();
    }
    
    renderAll3D(this);
    
    // Обновляем информацию о размерах шкафа
    this.updateCabinetInfo();
  }
  
  // ========== ОБНОВЛЕНИЕ СВЯЗАННЫХ ПАНЕЛЕЙ ==========
  updateConnectedPanels(movedPanel) {
    const affectedShelves = new Set();  // Полки, которые нужно обновить
    
    if (movedPanel.isHorizontal) {
      // Перемещена полка - обновляем разделители, которые на ней опираются
      for (let panel of this.panels.values()) {
        if (panel.isHorizontal) continue;
        
        // Проверяем, связан ли разделитель с этой полкой
        if (panel.connections.bottom === movedPanel) {
          panel.bounds.startY = movedPanel.position.y + CONFIG.DSP;
        }
        if (panel.connections.top === movedPanel) {
          panel.bounds.endY = movedPanel.position.y;
        }
      }
      
      // Обновляем ребра перемещенной полки
      movedPanel.updateRibs(this.panels, this.cabinet.width);
    } else {
      // Перемещен разделитель - обновляем полки, которые на нем заканчиваются
      for (let panel of this.panels.values()) {
        if (!panel.isHorizontal) continue;
        
        // Проверяем, связана ли полка с этим разделителем
        if (panel.connections.left === movedPanel) {
          panel.bounds.startX = movedPanel.position.x + CONFIG.DSP;
          affectedShelves.add(panel);  // Запоминаем для обновления ребер
        }
        if (panel.connections.right === movedPanel) {
          panel.bounds.endX = movedPanel.position.x;
          affectedShelves.add(panel);  // Запоминаем для обновления ребер
        }
        
        // Также проверяем полки, которые разделитель пересекает (для ребер)
        if (panel.bounds.startX <= movedPanel.position.x && 
            panel.bounds.endX >= movedPanel.position.x &&
            movedPanel.bounds.startY <= panel.position.y &&
            movedPanel.bounds.endY >= panel.position.y) {
          affectedShelves.add(panel);
        }
      }
      
      // Обновляем ребра только затронутых полок
      for (let shelf of affectedShelves) {
        shelf.updateRibs(this.panels, this.cabinet.width);
      }
    }
    
    // Пересчитываем ящики которые связаны с перемещённой панелью
    for (let drawer of this.drawers.values()) {
      const connections = drawer.connections;
      // Проверяем, связан ли ящик с перемещённой панелью
      if (connections.bottomShelf === movedPanel || 
          connections.topShelf === movedPanel ||
          connections.leftDivider === movedPanel ||
          connections.rightDivider === movedPanel) {
        drawer.updateParts(this);
        updateDrawerMeshes(this, drawer);  // Обновляем 3D меши
      }
    }
  }
  
  // ========== УДАЛЕНИЕ ==========
  deletePanel(panel) {
    // Проверяем, не ящик ли это
    if (panel.type === 'drawer') {
      removeDrawerMeshes(this, panel);
      this.drawers.delete(panel.id);
      this.saveHistory();
      render2D(this);
      renderAll3D(this);
      this.updateStats();
      return;
    }
    
    const toDelete = new Set([panel]);
    
    const findDependent = (current) => {
      for (let other of this.panels.values()) {
        if (toDelete.has(other)) continue;
        
        // Проверяем зависимость через connections
        if (current.isHorizontal) {
          // Если удаляем полку, проверяем разделители которые на ней заканчиваются/начинаются
          if (!other.isHorizontal) {
            if (other.connections.bottom === current || other.connections.top === current) {
              toDelete.add(other);
              findDependent(other);
            }
          }
        } else {
          // Если удаляем разделитель, проверяем полки которые на нем заканчиваются/начинаются  
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
    
    // Сохраняем список панелей которые ссылались на удаляемые
    const affectedPanels = new Set();
    for (let remaining of this.panels.values()) {
      if (toDelete.has(remaining)) continue;
      
      for (let deleted of toDelete) {
        if (Object.values(remaining.connections).includes(deleted)) {
          affectedPanels.add(remaining);
        }
      }
    }
    
    // Удаляем панели и их 3D объекты
    for (let p of toDelete) {
      removeMesh(this, p);
      this.panels.delete(p.id);
    }
    
    // Восстанавливаем bounds для затронутых панелей
    for (let affected of affectedPanels) {
      this.recalculatePanelBounds(affected);
    }
    
    // Обновляем ребра для всех полок
    for (let panel of this.panels.values()) {
      if (panel.isHorizontal) {
        panel.updateRibs(this.panels, this.cabinet.width);
      }
    }
    
    // Удаляем ящики, которые связаны с удаленными панелями
    for (let drawer of this.drawers.values()) {
      const connections = drawer.connections;
      // Проверяем, связан ли ящик с удаленной панелью
      if (toDelete.has(connections.bottomShelf) || 
          toDelete.has(connections.topShelf) ||
          toDelete.has(connections.leftDivider) ||
          toDelete.has(connections.rightDivider)) {
        removeDrawerMeshes(this, drawer);  // Удаляем 3D меши
        this.drawers.delete(drawer.id);
      } else {
        // Пересчитываем оставшиеся ящики
        drawer.updateParts(this);
        updateDrawerMeshes(this, drawer);  // Обновляем 3D меши
      }
    }
    
    this.saveHistory();
    render2D(this);
    renderAll3D(this);
    this.updateStats();
  }
  
  // ========== ПЕРЕСЧЕТ ГРАНИЦ ПАНЕЛИ ==========
  recalculatePanelBounds(panel) {
    if (panel.isHorizontal) {
      // Полка: находим разделители которые её ограничивают
      const dividers = Array.from(this.panels.values())
        .filter(p => !p.isHorizontal && 
                    p.bounds.startY <= panel.position.y && 
                    p.bounds.endY >= panel.position.y)
        .sort((a, b) => a.position.x - b.position.x);
      
      // Создаем массив точек (боковины + разделители)
      const points = [
        { x: CONFIG.DSP, panel: null },
        ...dividers.map(d => ({ x: d.position.x, panel: d })),
        { x: this.cabinet.width - CONFIG.DSP, panel: null }
      ];
      
      // Находим сегмент по центру полки
      const center = (panel.bounds.startX + panel.bounds.endX) / 2;
      
      for (let i = 0; i < points.length - 1; i++) {
        const segmentStart = points[i].x + (points[i].panel ? CONFIG.DSP : 0);
        const segmentEnd = points[i + 1].x;
        
        if (center >= points[i].x && center <= points[i + 1].x) {
          panel.bounds.startX = segmentStart;
          panel.bounds.endX = segmentEnd;
          panel.connections.left = points[i].panel;
          panel.connections.right = points[i + 1].panel;
          panel.updateRibs(this.panels, this.cabinet.width);
          break;
        }
      }
    } else {
      // Разделитель: находим полки которые его ограничивают
      const shelves = Array.from(this.panels.values())
        .filter(p => p.isHorizontal && 
                    p.bounds.startX <= panel.position.x && 
                    p.bounds.endX >= panel.position.x)
        .sort((a, b) => a.position.y - b.position.y);
      
      // Создаем массив точек (дно + полки + крыша)
      const points = [
        { y: this.cabinet.base, panel: null },
        ...shelves.map(s => ({ y: s.position.y, panel: s })),
        { y: this.cabinet.height - CONFIG.DSP, panel: null }
      ];
      
      // Находим сегмент по центру разделителя
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
  
  clearAll() {
    if (this.panels.size === 0 && this.drawers.size === 0) return;
    
    for (let panel of this.panels.values()) {
      removeMesh(this, panel);
    }
    
    for (let drawer of this.drawers.values()) {
      removeDrawerMeshes(this, drawer);
    }
    
    this.panels.clear();
    this.drawers.clear();
    
    this.saveHistory();
    render2D(this);
    this.updateStats();
  }
  
  // ========== ОТЗЕРКАЛИВАНИЕ ==========
  mirrorContent() {
    if (this.panels.size === 0) {
      this.updateStatus('Нет элементов для отзеркаливания');
      return;
    }
    
    const width = this.cabinet.width;
    
    // Отзеркаливаем все панели
    for (let panel of this.panels.values()) {
      if (panel.isHorizontal) {
        // Полка: зеркалим bounds.startX и bounds.endX
        const oldStartX = panel.bounds.startX;
        const oldEndX = panel.bounds.endX;
        
        panel.bounds.startX = width - oldEndX;
        panel.bounds.endX = width - oldStartX;
        
        // Меняем местами left и right connections
        const tempLeft = panel.connections.left;
        panel.connections.left = panel.connections.right;
        panel.connections.right = tempLeft;
      } else {
        // Разделитель: position.x это ЛЕВЫЙ край, зеркалим правый край
        panel.position.x = width - (panel.position.x + CONFIG.DSP);
      }
    }
    
    // Отзеркаливаем ящики - меняем leftDivider и rightDivider местами
    for (let drawer of this.drawers.values()) {
      const tempLeft = drawer.connections.leftDivider;
      drawer.connections.leftDivider = drawer.connections.rightDivider;
      drawer.connections.rightDivider = tempLeft;
      
      // ВАЖНО: Если это виртуальные боковины, меняем их типы
      if (drawer.connections.leftDivider && drawer.connections.leftDivider.type === 'right') {
        drawer.connections.leftDivider.type = 'left';
      }
      if (drawer.connections.rightDivider && drawer.connections.rightDivider.type === 'left') {
        drawer.connections.rightDivider.type = 'right';
      }
    }
    
    // Обновляем рёбра жёсткости для всех полок
    for (let panel of this.panels.values()) {
      if (panel.isHorizontal) {
        panel.updateRibs(this.panels, this.cabinet.width);
      }
    }
    
    // Пересчитываем все ящики после отзеркаливания
    for (let drawer of this.drawers.values()) {
      drawer.updateParts(this);
      updateDrawerMeshes(this, drawer);  // Обновляем 3D меши
    }
    
    this.saveHistory();
    render2D(this);
    renderAll3D(this);
    this.updateStatus('Содержимое отзеркалено');
  }
  
  // ========== СЕРИАЛИЗАЦИЯ CONNECTIONS ==========
  serializeConnections(connections) {
    return serializeConnections(this, connections);
  }
  
  deserializeConnections(connectionsData) {
    return deserializeConnections(this, connectionsData);
  }
  
  // ========== ИСТОРИЯ ==========
  saveHistory() {
    saveHistory(this);
  }
  
  undo() {
    undo(this);
  }
  
  redo() {
    redo(this);
  }
  
  restoreState(state) {
    restoreState(this, state);
  }
  
  updateHistoryButtons() {
    updateHistoryButtons(this);
  }
  
  // ========== ОТЛАДКА ИСТОРИИ (обертки для модуля) ==========
  debugHistory() {
    debugHistory(this);
  }
  
  debugCurrentState() {
    debugCurrentState(this);
  }
  
  compareStates(index1, index2) {
    compareStates(this, index1, index2);
  }
  
  // ========== СОХРАНЕНИЕ ==========
  scheduleSave() {
    scheduleSave(this);
  }
  
  saveToStorage() {
    saveToStorage(this);
  }
  
  loadState() {
    loadState(this);
  }
  
  showSaved() {
    showSaved(this);
  }
  
  updateStats() {
    updateStats(this);
  }
  
  updateCabinetInfo() {
    updateCabinetInfo(this);
  }
  
  // ========== ЯЩИКИ ==========
  addDrawer(coords) {
    addDrawer(this, coords);
  }
  
  /**
   * Создаёт стек из N ящиков, равномерно разделяя высоту секции
   * @param {Object} baseConnections - Базовые границы секции { bottomShelf, topShelf, leftDivider, rightDivider }
   * @param {number} count - Количество ящиков (1-5)
   * @returns {boolean} - Успех создания
   */
  createDrawerStack(baseConnections, count) {
    return createDrawerStack(this, baseConnections, count);
  }
  
  // ========== 3D МЕТОДЫ ==========
  // Обертки для функций из render3D.js
  updateMesh(panel) {
    updateMesh(this, panel);
  }
  
  renderAll3D() {
    renderAll3D(this);
  }
  
  removeMesh(panel) {
    removeMesh(this, panel);
  }
}
