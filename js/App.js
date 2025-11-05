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
    // UI элементы
    const addListener = (selector, event, handler) => {
      const el = selector instanceof Element ? selector : document.querySelector(selector);
      if (el) el.addEventListener(event, handler);
    };
    
    document.querySelectorAll('.tab').forEach(tab => 
      addListener(tab, 'click', () => this.switchTab(tab))
    );
    
    document.querySelectorAll('.mode-btn').forEach(btn => 
      addListener(btn, 'click', () => this.setMode(btn.dataset.mode))
    );
    
    addListener('.clear-btn', 'click', () => this.clearAll());
    addListener('#mirror-btn', 'click', () => this.mirrorContent());
    addListener('#undo-btn', 'click', () => this.undo());
    addListener('#redo-btn', 'click', () => this.redo());
    addListener('#clear-history-btn', 'click', () => clearHistoryLog());
    addListener('#collapse-history-btn', 'click', () => toggleHistoryCollapse());
    addListener('#copy-history-btn', 'click', () => copyHistoryLogs(this));
    
    // Перетаскивание панели истории
    setupHistoryDrag();
    
    // Canvas события
    const canvas = this.canvas.element;
    const pointerEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'];
    pointerEvents.forEach(event => 
      addListener(canvas, event, (e) => this.handlePointer(e), { passive: false })
    );
    
    window.addEventListener('resize', () => this.updateCanvas());
  }
  
  // ========== УПРАВЛЕНИЕ РЕЖИМАМИ ==========
  setMode(mode) {
    this.mode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-mode="${mode}"]`).classList.add('active');
    this.updateStatus();
  }
  
  updateStatus(temp = null) {
    const messages = {
      shelf: 'Режим: Добавление полки',
      divider: 'Режим: Добавление разделителя',
      drawer: 'Режим: Добавление ящика',
      move: 'Режим: Перемещение',
      delete: 'Режим: Удаление'
    };
    
    const text = temp || messages[this.mode];
    document.getElementById('status-text').textContent = text;
    
    if (temp) {
      setTimeout(() => this.updateStatus(), 3000);
    }
  }
  
  switchTab(tab) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(tab.dataset.panel).classList.add('active');
    
    if (tab.dataset.panel === 'viewer-panel') {
      setTimeout(() => {
        if (!this.viewer3D) initViewer3D(this);
        if (this.viewer3D) this.viewer3D.resize();
      }, 50);
    } else {
      this.updateCanvas();
    }
  }
  
  // ========== CANVAS УТИЛИТЫ ==========
  updateCanvas() {
    const container = this.canvas.element.parentElement;
    const width = container.clientWidth - 30;
    const height = container.clientHeight - 30;
    
    this.canvas.size = Math.min(width, height, 800);
    this.canvas.element.width = this.canvas.size;
    this.canvas.element.height = this.canvas.size;
    this.canvas.element.style.width = this.canvas.size + 'px';
    this.canvas.element.style.height = this.canvas.size + 'px';
    
    const scaleX = this.canvas.size / this.cabinet.width;
    const scaleY = this.canvas.size / this.cabinet.height;
    this.canvas.scale = Math.min(scaleX, scaleY) * CONFIG.UI.SCALE_PADDING;
    
    this.canvas.offset.x = (this.canvas.size - this.cabinet.width * this.canvas.scale) / 2;
    this.canvas.offset.y = (this.canvas.size - this.cabinet.height * this.canvas.scale) / 2;
    
    render2D(this);
  }
  
  getCoords(e) {
    const rect = this.canvas.element.getBoundingClientRect();
    const point = e.touches?.[0] || e.changedTouches?.[0] || e;
    
    const canvasX = (point.clientX - rect.left) * (this.canvas.size / rect.width);
    const canvasY = (point.clientY - rect.top) * (this.canvas.size / rect.height);
    
    return {
      x: (canvasX - this.canvas.offset.x) / this.canvas.scale,
      y: (this.canvas.size - canvasY - this.canvas.offset.y) / this.canvas.scale
    };
  }
  
  // ========== ОБРАБОТКА СОБЫТИЙ ==========
  handlePointer(e) {
    e.preventDefault();
    const coords = this.getCoords(e);
    
    const handlers = {
      pointerdown: () => this.startInteraction(coords),
      pointermove: () => this.updateInteraction(coords),
      pointerup: () => this.endInteraction(coords),
      pointercancel: () => this.endInteraction(coords)
    };
    
    handlers[e.type]?.();
  }
  
  startInteraction(coords) {
    this.interaction.start = coords;
    this.interaction.hasMoved = false;
    this.interaction.boundsSnapshot = null;  // Сбрасываем снапшот
    
    if (this.mode === 'move') {
      this.interaction.dragging = this.findPanelAt(coords);
      if (this.interaction.dragging) {
        this.interaction.originalPos = this.interaction.dragging.mainPosition;
        
        // Если тянем боковину - сохраняем bounds всех полок
        if (this.interaction.dragging.type === 'side') {
          this.interaction.boundsSnapshot = new Map();
          for (let panel of this.panels.values()) {
            if (panel.isHorizontal) {
              this.interaction.boundsSnapshot.set(panel.id, {
                startX: panel.bounds.startX,
                endX: panel.bounds.endX
              });
            }
          }
        }
      }
    } else if (this.mode === 'delete') {
      const panel = this.findPanelAt(coords);
      if (panel) this.deletePanel(panel);
    }
  }
  
  updateInteraction(coords) {
    if (!this.interaction.start) return;
    
    const distance = Math.hypot(
      coords.x - this.interaction.start.x,
      coords.y - this.interaction.start.y
    );
    
    if (distance > CONFIG.UI.MIN_MOVE) {
      this.interaction.hasMoved = true;
    }
    
    if (this.interaction.dragging && this.interaction.hasMoved) {
      this.movePanel(this.interaction.dragging, coords);
    }
  }
  
  endInteraction(coords) {
    if (!this.interaction.hasMoved && this.mode !== 'move' && this.mode !== 'delete' && this.interaction.start) {
      if (this.mode === 'shelf') {
        this.addPanel('shelf', coords.y, coords.x);
      } else if (this.mode === 'divider') {
        this.addPanel('divider', coords.x, coords.y);
      } else if (this.mode === 'drawer') {
        this.addDrawer(coords);
      }
    }
    
    if (this.interaction.dragging) {
      if (this.interaction.hasMoved) {
        this.saveHistory();
      } else {
        this.interaction.dragging.mainPosition = this.interaction.originalPos;
        render2D(this);
        updateMesh(this, this.interaction.dragging);
      }
    }
    
    this.interaction = { 
      dragging: null, 
      start: null, 
      hasMoved: false,
      boundsSnapshot: null  // Очищаем снапшот
    };
  }
  
  findPanelAt(coords) {
    // Сначала проверяем боковины (они приоритетнее обычных панелей)
    // Левая боковина
    if (Math.abs(coords.x - CONFIG.DSP/2) < CONFIG.UI.SNAP && 
        coords.y >= 0 && coords.y <= this.cabinet.height) {
      return {
        type: 'side',
        id: 'left-side',
        position: { x: CONFIG.DSP/2 },
        isHorizontal: false,
        mainPosition: CONFIG.DSP/2,
        start: 0,
        end: this.cabinet.height
      };
    }
    
    // Правая боковина
    if (Math.abs(coords.x - (this.cabinet.width - CONFIG.DSP/2)) < CONFIG.UI.SNAP && 
        coords.y >= 0 && coords.y <= this.cabinet.height) {
      return {
        type: 'side',
        id: 'right-side',
        position: { x: this.cabinet.width - CONFIG.DSP/2 },
        isHorizontal: false,
        mainPosition: this.cabinet.width - CONFIG.DSP/2,
        start: 0,
        end: this.cabinet.height
      };
    }
    
    // Дно (управляет высотой цоколя)
    if (Math.abs(coords.y - (this.cabinet.base - CONFIG.DSP/2)) < CONFIG.UI.SNAP && 
        coords.x >= CONFIG.DSP && coords.x <= this.cabinet.width - CONFIG.DSP) {
      return {
        type: 'horizontal-side',
        id: 'bottom-side',
        position: { y: this.cabinet.base - CONFIG.DSP/2 },
        isHorizontal: true,
        mainPosition: this.cabinet.base - CONFIG.DSP/2,
        start: CONFIG.DSP,
        end: this.cabinet.width - CONFIG.DSP
      };
    }
    
    // Крыша (управляет общей высотой шкафа)
    if (Math.abs(coords.y - (this.cabinet.height - CONFIG.DSP/2)) < CONFIG.UI.SNAP && 
        coords.x >= CONFIG.DSP && coords.x <= this.cabinet.width - CONFIG.DSP) {
      return {
        type: 'horizontal-side',
        id: 'top-side',
        position: { y: this.cabinet.height - CONFIG.DSP/2 },
        isHorizontal: true,
        mainPosition: this.cabinet.height - CONFIG.DSP/2,
        start: CONFIG.DSP,
        end: this.cabinet.width - CONFIG.DSP
      };
    }
    
    // Затем проверяем обычные панели
    for (let panel of this.panels.values()) {
      const axis = panel.isHorizontal ? 'y' : 'x';
      const pos = coords[axis];
      const cross = coords[panel.isHorizontal ? 'x' : 'y'];
      
      if (panel.intersects(pos, axis) && panel.intersects(cross, panel.isHorizontal ? 'x' : 'y')) {
        return panel;
      }
    }
    
    // Наконец проверяем ящики (низкий приоритет)
    for (let drawer of this.drawers.values()) {
      if (!drawer.volume) continue;
      
      // Проверяем, попадает ли клик в область ящика
      if (coords.x >= drawer.volume.x.start && coords.x <= drawer.volume.x.end &&
          coords.y >= drawer.volume.y.start && coords.y <= drawer.volume.y.end) {
        return drawer;  // Возвращаем сам ящик
      }
    }
    
    return null;
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
    // Конвертируем Panel ссылки в ID для сохранения
    const serialized = {};
    for (let key in connections) {
      serialized[key] = connections[key] ? connections[key].id : null;
    }
    return serialized;
  }
  
  deserializeConnections(connectionsData) {
    // Конвертируем ID обратно в Panel ссылки
    const deserialized = {};
    for (let key in connectionsData) {
      const panelId = connectionsData[key];
      deserialized[key] = panelId ? this.panels.get(panelId) : null;
    }
    return deserialized;
  }
  
  // ========== ИСТОРИЯ ==========
  saveHistory() {
    // Получаем предыдущее состояние для сравнения
    // Если есть boundsSnapshot (перемещение боковины), создаем искусственное состояние
    let prevState;
    if (this.interaction.boundsSnapshot && this.history.index >= 0) {
      // Используем снапшот bounds ДО изменения
      const historicalState = this.history.states[this.history.index];
      prevState = {
        cabinet: historicalState.cabinet,
        panels: historicalState.panels.map(p => {
          // Если есть снапшот для этой панели, используем его
          const snapshot = this.interaction.boundsSnapshot.get(p.id);
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
      prevState = this.history.index >= 0 ? this.history.states[this.history.index] : null;
    }
    const state = {
      cabinet: {
        width: this.cabinet.width,
        height: this.cabinet.height,
        depth: this.cabinet.depth,
        base: this.cabinet.base
      },
      panels: Array.from(this.panels.values()).map(p => ({
        type: p.type,
        id: p.id,
        position: { ...p.position },
        bounds: { ...p.bounds },
        connections: this.serializeConnections(p.connections)
      })),
      drawers: Array.from(this.drawers.values()).map(d => d.toJSON()),
      nextId: this.nextId,
      nextDrawerId: this.nextDrawerId
    };
    
    if (this.history.index < this.history.states.length - 1) {
      this.history.states = this.history.states.slice(0, this.history.index + 1);
    }
    
    this.history.states.push(state);
    if (this.history.states.length > CONFIG.UI.MAX_HISTORY) {
      this.history.states.shift();
    } else {
      this.history.index++;
    }
    
    this.updateHistoryButtons();
    this.scheduleSave();
    
    // Логируем изменения
    const changes = compareStatesForLog(prevState, state);
    if (changes.length > 0) {
      logToHistory('save', changes);
    }
  }
  
  undo() {
    if (this.history.index <= 0) return;
    
    const currentState = this.history.states[this.history.index];
    const prevState = this.history.states[this.history.index - 1];
    
    this.history.index--;
    this.restoreState(prevState);
    
    // Логируем отмену: сравниваем ТЕКУЩЕЕ состояние из истории с ПРЕДЫДУЩИМ
    const changes = compareStatesForLog(currentState, prevState);
    if (changes.length > 0) {
      logToHistory('undo', changes);
    }
  }
  
  redo() {
    if (this.history.index >= this.history.states.length - 1) return;
    
    const currentState = this.history.states[this.history.index];
    const nextState = this.history.states[this.history.index + 1];
    
    this.history.index++;
    this.restoreState(nextState);
    
    // Логируем повтор: сравниваем ТЕКУЩЕЕ состояние с СЛЕДУЮЩИМ
    const changes = compareStatesForLog(currentState, nextState);
    if (changes.length > 0) {
      logToHistory('redo', changes);
    }
  }
  
  restoreState(state) {
    // Восстанавливаем размеры шкафа, если они есть в состоянии
    if (state.cabinet) {
      this.cabinet.width = state.cabinet.width;
      this.cabinet.height = state.cabinet.height;
      this.cabinet.depth = state.cabinet.depth;
      this.cabinet.base = state.cabinet.base;
      this.updateCalc();
      
      // Обновляем canvas с новыми размерами
      this.updateCanvas();
      
      // Перестраиваем 3D корпус
      if (this.viewer3D) {
        this.viewer3D.rebuildCabinet();
      }
    }
    
    // Очищаем текущие панели
    for (let panel of this.panels.values()) {
      removeMesh(this, panel);
    }
    this.panels.clear();
    
    // Очищаем текущие ящики
    for (let drawer of this.drawers.values()) {
      removeDrawerMeshes(this, drawer);
    }
    this.drawers.clear();
    
    // Сначала создаем все панели без connections
    state.panels.forEach(data => {
      const panel = new Panel(data.type, data.id, data.position, data.bounds, {});
      this.panels.set(data.id, panel);
    });
    
    // Теперь восстанавливаем connections с правильными ссылками
    state.panels.forEach(data => {
      const panel = this.panels.get(data.id);
      panel.connections = this.deserializeConnections(data.connections);
    });
    
    this.nextId = state.nextId;
    
    // Восстанавливаем ящики, если они есть в состоянии
    if (state.drawers) {
      state.drawers.forEach(drawerData => {
        const drawer = Drawer.fromJSON(drawerData, this.panels, this);
        drawer.calculateParts(this);  // Пересчитываем части
        this.drawers.set(drawer.id, drawer);
      });
      
      if (state.nextDrawerId !== undefined) {
        this.nextDrawerId = state.nextDrawerId;
      }
    }
    
    // Обновляем ребра для всех полок
    for (let panel of this.panels.values()) {
      if (panel.isHorizontal) {
        panel.updateRibs(this.panels, this.cabinet.width);
      }
    }
    
    render2D(this);
    renderAll3D(this);
    this.updateStats();
    this.updateHistoryButtons();
  }
  
  updateHistoryButtons() {
    document.getElementById('undo-btn').disabled = this.history.index <= 0;
    document.getElementById('redo-btn').disabled = this.history.index >= this.history.states.length - 1;
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
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.saveToStorage(), CONFIG.UI.SAVE_DELAY);
  }
  
  saveToStorage() {
    try {
      localStorage.setItem('cabinetDesignV3', JSON.stringify({
        cabinet: {
          width: this.cabinet.width,
          height: this.cabinet.height,
          depth: this.cabinet.depth,
          base: this.cabinet.base
        },
        panels: Array.from(this.panels.values()).map(p => ({
          type: p.type,
          id: p.id,
          position: { ...p.position },
          bounds: { ...p.bounds },
          connections: this.serializeConnections(p.connections)
        })),
        drawers: Array.from(this.drawers.values()).map(d => d.toJSON()),
        nextId: this.nextId,
        nextDrawerId: this.nextDrawerId,
        history: this.history
      }));
      this.showSaved();
    } catch (e) {
      console.error('Save error:', e);
    }
  }
  
  loadState() {
    try {
      const data = JSON.parse(localStorage.getItem('cabinetDesignV3') || '{}');
      
      // Загружаем размеры шкафа, если они есть
      if (data.cabinet) {
        this.cabinet.width = data.cabinet.width;
        this.cabinet.height = data.cabinet.height;
        this.cabinet.depth = data.cabinet.depth;
        this.cabinet.base = data.cabinet.base;
        this.updateCalc();
        
        // Обновляем 3D корпус если он уже инициализирован
        if (this.viewer3D) {
          this.viewer3D.rebuildCabinet();
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
          this.panels.set(panelData.id, panel);
        });
        
        // Теперь восстанавливаем connections с правильными ссылками
        data.panels.forEach(panelData => {
          const panel = this.panels.get(panelData.id);
          panel.connections = this.deserializeConnections(panelData.connections);
        });
        
        this.nextId = data.nextId || 0;
        
        // Загружаем ящики, если они есть
        if (data.drawers) {
          data.drawers.forEach(drawerData => {
            const drawer = Drawer.fromJSON(drawerData, this.panels, this);
            drawer.calculateParts(this);  // Пересчитываем части
            this.drawers.set(drawer.id, drawer);
          });
          
          if (data.nextDrawerId !== undefined) {
            this.nextDrawerId = data.nextDrawerId;
          }
        }
        
        this.history = data.history || { states: [], index: -1 };
        
        // Обновляем ребра для всех загруженных полок
        for (let panel of this.panels.values()) {
          if (panel.isHorizontal) {
            panel.updateRibs(this.panels, this.cabinet.width);
          }
        }
      }
      
      if (this.history.states.length === 0) {
        this.saveHistory();
      }
      
      this.updateHistoryButtons();
    } catch (e) {
      console.error('Load error:', e);
      this.saveHistory();
    }
  }
  
  showSaved() {
    const indicator = document.getElementById('saved-indicator');
    indicator.classList.add('show');
    setTimeout(() => indicator.classList.remove('show'), 2000);
  }
  
  updateStats() {
    const shelves = Array.from(this.panels.values()).filter(p => p.type === 'shelf');
    const dividers = Array.from(this.panels.values()).filter(p => p.type === 'divider');
    
    document.getElementById('stat-shelves').textContent = shelves.length;
    document.getElementById('stat-dividers').textContent = dividers.length;
    
    // Обновляем размеры шкафа
    this.updateCabinetInfo();
  }
  
  updateCabinetInfo() {
    document.getElementById('stat-width').textContent = `${Math.round(this.cabinet.width)} мм`;
    document.getElementById('stat-height').textContent = `${Math.round(this.cabinet.height)} мм`;
    document.getElementById('stat-depth').textContent = `${Math.round(this.cabinet.depth)} мм`;
  }
  
  // ========== ЯЩИКИ ==========
  addDrawer(coords) {
    console.log('addDrawer called:', coords);
    // Найдем 4 панели, которые ограничивают область клика
    let bottomShelf = null, topShelf = null, leftDivider = null, rightDivider = null;
    
    // Находим полки снизу и сверху
    for (let panel of this.panels.values()) {
      if (!panel.isHorizontal) continue;
      
      // Проверяем, что клик в горизонтальных границах полки
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
    for (let panel of this.panels.values()) {
      if (panel.isHorizontal) continue;
      
      // Проверяем, что клик в вертикальных границах разделителя
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
      // Создаем виртуальную панель для дна
      bottomShelf = {
        type: 'bottom',
        id: 'virtual-bottom',
        position: { y: this.cabinet.base - CONFIG.DSP/2 },
        bounds: { startX: CONFIG.DSP, endX: this.cabinet.width - CONFIG.DSP },
        connections: {},
        isHorizontal: true
      };
    }
    
    if (!topShelf) {
      // Создаем виртуальную панель для крыши
      topShelf = {
        type: 'top',
        id: 'virtual-top',
        position: { y: this.cabinet.height - CONFIG.DSP/2 },
        bounds: { startX: CONFIG.DSP, endX: this.cabinet.width - CONFIG.DSP },
        connections: {},
        isHorizontal: true
      };
    }
    
    if (!leftDivider) {
      // Создаем виртуальную панель для левой боковины
      leftDivider = {
        type: 'left',
        id: 'virtual-left',
        position: { x: CONFIG.DSP/2 },
        bounds: { startY: 0, endY: this.cabinet.height },
        connections: {},
        isHorizontal: false
      };
    }
    
    if (!rightDivider) {
      // Создаем виртуальную панель для правой боковины
      rightDivider = {
        type: 'right',
        id: 'virtual-right',
        position: { x: this.cabinet.width - CONFIG.DSP/2 },
        bounds: { startY: 0, endY: this.cabinet.height },
        connections: {},
        isHorizontal: false
      };
    }
    
    // Создаем ящик
    const id = `drawer-${this.nextDrawerId++}`;
    const connections = { bottomShelf, topShelf, leftDivider, rightDivider };
    const drawer = new Drawer(id, connections);
    
    // Рассчитываем части ящика
    const success = drawer.calculateParts(this);
    
    console.log('Drawer calculation:', { success, drawer, connections: { bottomShelf, topShelf, leftDivider, rightDivider } });
    
    if (!success) {
      this.updateStatus('Не удалось создать ящик - проверьте размеры области');
      return;
    }
    
    this.drawers.set(id, drawer);
    
    this.saveHistory();
    render2D(this);
    renderAll3D(this);
    this.updateStats();
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
