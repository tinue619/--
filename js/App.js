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
import { 
  hasDrawerInArea,
  addPanel,
  getPanelCoord,
  getDrawerLimitsForPanel,
  movePanel,
  moveSide,
  moveHorizontalSide,
  updateConnectedPanels,
  deletePanel,
  recalculatePanelBounds,
  clearAll,
  mirrorContent
} from './modules/panelOperations.js';

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
    return hasDrawerInArea(this, isHorizontal, mainPos, startCross, endCross);
  }
  
  addPanel(type, mainPos, crossPos) {
    addPanel(this, type, mainPos, crossPos);
  }
  
  /**
   * Получить координату панели (реальной или виртуальной)
   */
  getPanelCoord(panel, axis) {
    return getPanelCoord(this, panel, axis);
  }
  
  /**
   * Получить ограничения от ящиков для перемещаемой панели
   * @param {Panel} panel - Перемещаемая панель
   * @returns {{min: number, max: number}} - Ограничения
   */
  getDrawerLimitsForPanel(panel) {
    return getDrawerLimitsForPanel(this, panel);
  }
  
  // ========== ПЕРЕМЕЩЕНИЕ ПАНЕЛЕЙ ==========
  movePanel(panel, coords) {
    movePanel(this, panel, coords);
  }

  
  // ========== ПЕРЕМЕЩЕНИЕ БОКОВИН ==========
  moveSide(side, newX) {
    moveSide(this, side, newX);
  }
  
  // ========== ПЕРЕМЕЩЕНИЕ ДНА И КРЫШИ ==========
  moveHorizontalSide(side, newY) {
    moveHorizontalSide(this, side, newY);
  }
  
  // ========== ОБНОВЛЕНИЕ СВЯЗАННЫХ ПАНЕЛЕЙ ==========
  updateConnectedPanels(movedPanel) {
    updateConnectedPanels(this, movedPanel);
  }
  
  // ========== УДАЛЕНИЕ ==========
  deletePanel(panel) {
    deletePanel(this, panel);
  }
  
  // ========== ПЕРЕСЧЕТ ГРАНИЦ ПАНЕЛИ ==========
  recalculatePanelBounds(panel) {
    recalculatePanelBounds(this, panel);
  }
  
  clearAll() {
    clearAll(this);
  }
  
  // ========== ОТЗЕРКАЛИВАНИЕ ==========
  mirrorContent() {
    mirrorContent(this);
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
