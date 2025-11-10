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
    SIZES: [270, 320, 370, 420, 470, 520, 570, 620],  // Стандартные длины коробов (8 размеров)
    MIN_WIDTH: 150,    // Минимальная ширина ящика (как MIN_GAP)
    MAX_WIDTH: 1200,   // Максимальная ширина ящика
    MIN_HEIGHT: 120,   // Минимальная высота ящика
    MAX_HEIGHT: 400,   // Максимальная высота ящика
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
    BASE: 100,
    // Ограничения размеров шкафа
    MIN_WIDTH: 400,    // Минимальная ширина (узкий пенал)
    MAX_WIDTH: 3000,   // Максимальная ширина (стандартный лист ДСП 2800мм + запас)
    MIN_HEIGHT: 500,   // Минимальная высота (подвесной шкаф)
    MAX_HEIGHT: 2600,  // Максимальная высота (стандартная высота потолков)
    MIN_DEPTH: 300,    // Минимальная глубина (навесные шкафы)
    MAX_DEPTH: 800,    // Максимальная глубина (эргономика)
    MIN_BASE: 60       // Минимальная высота цоколя
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
