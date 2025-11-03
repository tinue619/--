// ========== КОНФИГУРАЦИЯ ==========
export const CONFIG = {
  DSP: 16,
  HDF: 3,
  MIN_GAP: 150,  // Минимальное расстояние между панелями
  MIN_SIZE: 150,
  RIB: {
    HEIGHT: 100,    // Высота ребра жесткости
    DEPTH: 16,      // Толщина ребра (ДСП панель)
    MIN_SPAN: 800   // Минимальный пролет для ребра
  },
  DRAWER: {
    SIZES: [270, 320, 370, 420, 470, 520, 570, 620],  // Стандартные длины коробов
    GAP_FRONT: 2,      // Зазор фасада от границ объема
    GAP_TOP: 28,       // Зазор сверху
    GAP_BOTTOM: 2,     // Зазор снизу
    SIDE_OFFSET_X: 5,  // Отступ боковин от разделителей
    SIDE_OFFSET_Y: 17, // Отступ боковин от дна
    INNER_OFFSET: 21,  // Отступ задней стенки/дна от границ объема
    BACK_OFFSET: 2,    // Отступ задней стенки от заднего края боковин
    BOTTOM_OFFSET: 2   // Отступ дна вперед от (боковины + DSP)
  },
  CABINET: {
    WIDTH: 1000,
    HEIGHT: 2000,
    DEPTH: 600,
    BASE: 100
  },
  UI: {
    MIN_MOVE: 5,
    SNAP: 45,  // Увеличено для удобного touch захвата (было 15)
    SCALE_PADDING: 0.85,
    MAX_HISTORY: 50,
    SAVE_DELAY: 500
  },
  COLORS: {
    DSP: 0x8B6633,
    HDF: 0xf5f5dc,
    PLINTH: 0x654321,
    RIB: 0x7A5A2F,  // Чуть темнее для ребра
    DRAWER_FRONT: 0xFFFFFF,  // Белый фасад
    DRAWER_SIDE: 0xC0C0C0,   // Серые боковины
    ACTIVE: '#2196F3'
  }
};

// Предвычисленные константы
export const CALC = {
  innerWidth: CONFIG.CABINET.WIDTH - CONFIG.DSP * 2,
  innerDepth: CONFIG.CABINET.DEPTH - CONFIG.HDF,  // 600 - 3 = 597мм
  workHeight: CONFIG.CABINET.HEIGHT - CONFIG.CABINET.BASE - CONFIG.DSP
};
