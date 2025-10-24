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
  CABINET: {
    WIDTH: 1000,
    HEIGHT: 2000,
    DEPTH: 600,
    BASE: 100
  },
  UI: {
    MIN_MOVE: 5,
    SNAP: 15,
    SCALE_PADDING: 0.85,
    MAX_HISTORY: 50,
    SAVE_DELAY: 500
  },
  COLORS: {
    DSP: 0x8B6633,
    HDF: 0xf5f5dc,
    PLINTH: 0x654321,
    RIB: 0x7A5A2F,  // Чуть темнее для ребра
    ACTIVE: '#2196F3'
  }
};

// Предвычисленные константы
export const CALC = {
  innerWidth: CONFIG.CABINET.WIDTH - CONFIG.DSP * 2,
  innerDepth: CONFIG.CABINET.DEPTH - CONFIG.HDF,  // 600 - 3 = 597мм
  workHeight: CONFIG.CABINET.HEIGHT - CONFIG.CABINET.BASE - CONFIG.DSP
};
