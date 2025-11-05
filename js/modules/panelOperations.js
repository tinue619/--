// ========== PANEL OPERATIONS ==========
// Главный модуль для операций с панелями
// Реэкспортирует функции из подмодулей для удобства импорта

// Добавление панелей
export { 
  hasDrawerInArea,
  addPanel 
} from './panelOperations/add.js';

// Перемещение панелей
export { 
  movePanel,
  moveSide,
  moveHorizontalSide,
  updateConnectedPanels
} from './panelOperations/move.js';

// Удаление панелей
export { 
  deletePanel,
  recalculatePanelBounds
} from './panelOperations/delete.js';

// Вспомогательные функции и операции
export { 
  getPanelCoord,
  getDrawerLimitsForPanel,
  clearAll,
  mirrorContent
} from './panelOperations/utils.js';

/**
 * СТРУКТУРА МОДУЛЯ:
 * 
 * panelOperations/
 * ├── add.js    (~180 строк) - hasDrawerInArea, addPanel
 * ├── move.js   (~320 строк) - movePanel, moveSide, moveHorizontalSide, updateConnectedPanels
 * ├── delete.js (~160 строк) - deletePanel, recalculatePanelBounds
 * └── utils.js  (~120 строк) - getPanelCoord, getDrawerLimitsForPanel, clearAll, mirrorContent
 * 
 * Общий размер подмодулей: ~780 строк
 * Главный файл (этот): ~50 строк
 */

// DEPRECATED: старая версия была монолитным файлом на 819 строк
// Теперь разбито на 4 логических подмодуля для лучшей поддерживаемости
