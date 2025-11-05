// js/Drawer.js
import { CONFIG } from './config.js';

/**
 * Класс выдвижного ящика
 * Ящик определяется 4 связями: bottomShelf, topShelf, leftDivider, rightDivider
 */
export class Drawer {
  constructor(id, connections) {
    this.type = 'drawer';
    this.id = id;
    this.connections = connections; // { bottomShelf, topShelf, leftDivider, rightDivider }
    this.parts = null;
    this.boxLength = null;
    this.volume = null;
  }

  /**
   * Рассчитать volume от connections
   */
  calculateVolume(app) {
    const { bottomShelf, topShelf, leftDivider, rightDivider } = this.connections;
    
    if (!bottomShelf || !topShelf || !leftDivider || !rightDivider) {
      console.warn(`Drawer ${this.id}: missing connections`);
      return null;
    }

    // Найти минимальную глубину среди подключенных панелей
    const depths = [
      (app.cabinet.depth - CONFIG.HDF) - app.calculatePanelRank(bottomShelf),
      (app.cabinet.depth - CONFIG.HDF) - app.calculatePanelRank(topShelf),
      (app.cabinet.depth - CONFIG.HDF) - app.calculatePanelRank(leftDivider),
      (app.cabinet.depth - CONFIG.HDF) - app.calculatePanelRank(rightDivider)
    ];
    const minDepth = Math.min(...depths);

    // ВАЖНО: Для виртуальных панелей берём значения из app.cabinet напрямую!
    // Это гарантирует актуальность при изменении размеров шкафа
    const leftEdge = leftDivider.type === 'left' 
      ? CONFIG.DSP  // виртуальная боковина: всегда актуальное значение
      : leftDivider.position.x + CONFIG.DSP;  // реальный разделитель
    
    const rightEdge = rightDivider.type === 'right'
      ? app.cabinet.width - CONFIG.DSP  // виртуальная боковина: всегда актуальное значение
      : rightDivider.position.x;  // реальный разделитель
    
    const bottomEdge = bottomShelf.type === 'bottom'
      ? app.cabinet.base  // виртуальное дно: всегда актуальное значение
      : bottomShelf.position.y + CONFIG.DSP;  // реальная полка
    
    const topEdge = topShelf.type === 'top'
      ? app.cabinet.height - CONFIG.DSP  // виртуальная крыша: всегда актуальное значение
      : topShelf.position.y;  // реальная полка

    const volume = {
      x: {
        start: leftEdge,
        end: rightEdge
      },
      y: {
        start: bottomEdge,
        end: topEdge
      },
      z: {
        start: 0,
        end: minDepth - 2  // отступ 2мм от самой утопленной панели
      }
    };

    return volume;
  }

  /**
   * Выбрать boxLength из стандартных размеров
   */
  calculateBoxLength(volDepth) {
    // Добавляем DSP к volDepth, т.к. volume не включает переднюю панель
    const availableDepth = volDepth + CONFIG.DSP;
    
    const suitable = CONFIG.DRAWER.SIZES.filter(s => s <= availableDepth);
    return suitable.length > 0 ? suitable[suitable.length - 1] : null;
  }

  /**
   * Рассчитать все части ящика
   */
  calculateParts(app) {
    const vol = this.calculateVolume(app);
    if (!vol) return false;

    this.volume = vol;
    
    const volWidth = vol.x.end - vol.x.start;
    const volHeight = vol.y.end - vol.y.start;
    const volDepth = vol.z.end - vol.z.start;

    const boxLength = this.calculateBoxLength(volDepth);
    if (!boxLength) {
      console.error(`Drawer ${this.id}: volume too small (min 270mm required)`);
      return false;
    }

    this.boxLength = boxLength;

    // Общие расчеты
    const sideHeight = volHeight - 56;
    const sideDepth = boxLength - 26;
    const bottomDepth = boxLength - 44;

    // Z-координаты (критично!)
    const frontZ = vol.z.end;
    const sidesZ2 = frontZ - CONFIG.DSP;
    const sidesZ1 = sidesZ2 - sideDepth;
    const backZ = sidesZ1 + CONFIG.DRAWER.BACK_OFFSET;
    const bottomZ1 = sidesZ1 + CONFIG.DSP + CONFIG.DRAWER.BOTTOM_OFFSET;
    const bottomZ2 = bottomZ1 + bottomDepth;

    // Рассчитываем все 5 частей
    this.parts = {
      front: {
        width: volWidth - 4,
        height: volHeight - 30,
        depth: CONFIG.DSP,
        position: {
          x: (vol.x.start + vol.x.end) / 2,
          y: (vol.y.start + vol.y.end - 26) / 2,
          z: frontZ - CONFIG.DSP / 2
        },
        bounds: {
          x1: vol.x.start + CONFIG.DRAWER.GAP_FRONT,
          x2: vol.x.end - CONFIG.DRAWER.GAP_FRONT,
          y1: vol.y.start + CONFIG.DRAWER.GAP_BOTTOM,
          y2: vol.y.end - CONFIG.DRAWER.GAP_TOP
        }
      },

      leftSide: {
        width: CONFIG.DSP,
        height: sideHeight,
        depth: sideDepth,
        position: {
          x: vol.x.start + CONFIG.DRAWER.SIDE_OFFSET_X + CONFIG.DSP / 2,
          y: vol.y.start + CONFIG.DRAWER.SIDE_OFFSET_Y + sideHeight / 2,
          z: (sidesZ1 + sidesZ2) / 2
        },
        bounds: {
          x: vol.x.start + CONFIG.DRAWER.SIDE_OFFSET_X,
          y1: vol.y.start + CONFIG.DRAWER.SIDE_OFFSET_Y,
          y2: vol.y.start + CONFIG.DRAWER.SIDE_OFFSET_Y + sideHeight,
          z1: sidesZ1,
          z2: sidesZ2
        }
      },

      rightSide: {
        width: CONFIG.DSP,
        height: sideHeight,
        depth: sideDepth,
        position: {
          x: vol.x.end - CONFIG.DRAWER.INNER_OFFSET + CONFIG.DSP / 2,
          y: vol.y.start + CONFIG.DRAWER.SIDE_OFFSET_Y + sideHeight / 2,
          z: (sidesZ1 + sidesZ2) / 2
        },
        bounds: {
          x: vol.x.end - CONFIG.DRAWER.INNER_OFFSET,
          y1: vol.y.start + CONFIG.DRAWER.SIDE_OFFSET_Y,
          y2: vol.y.start + CONFIG.DRAWER.SIDE_OFFSET_Y + sideHeight,
          z1: sidesZ1,
          z2: sidesZ2
        }
      },

      back: {
        width: volWidth - 42,
        height: volHeight - 68,
        depth: CONFIG.DSP,
        position: {
          x: (vol.x.start + vol.x.end) / 2,
          y: vol.y.start + 27 + (volHeight - 68) / 2,
          z: backZ + CONFIG.DSP / 2
        },
        bounds: {
          x1: vol.x.start + CONFIG.DRAWER.INNER_OFFSET,
          x2: vol.x.end - CONFIG.DRAWER.INNER_OFFSET,
          y1: vol.y.start + 27,
          y2: vol.y.end - 41,
          z: backZ
        }
      },

      bottom: {
        width: volWidth - 42,
        height: CONFIG.DSP,
        depth: bottomDepth,
        position: {
          x: (vol.x.start + vol.x.end) / 2,
          y: vol.y.start + 27 + CONFIG.DSP / 2,
          z: (bottomZ1 + bottomZ2) / 2
        },
        bounds: {
          x1: vol.x.start + CONFIG.DRAWER.INNER_OFFSET,
          x2: vol.x.end - CONFIG.DRAWER.INNER_OFFSET,
          y: vol.y.start + 27,
          z1: bottomZ1,
          z2: bottomZ2
        }
      }
    };

    return true;
  }

  /**
   * Обновить части при изменении connections
   */
  updateParts(app) {
    return this.calculateParts(app);
  }

  /**
   * Сериализация для сохранения
   */
  toJSON() {
    return {
      type: this.type,
      id: this.id,
      connections: {
        bottomShelf: this.connections.bottomShelf?.id || null,
        topShelf: this.connections.topShelf?.id || null,
        leftDivider: this.connections.leftDivider?.id || null,
        rightDivider: this.connections.rightDivider?.id || null
      }
    };
  }

  /**
   * Десериализация
   */
  static fromJSON(data, panels) {
    const connections = {
      bottomShelf: data.connections.bottomShelf ? panels.get(data.connections.bottomShelf) : null,
      topShelf: data.connections.topShelf ? panels.get(data.connections.topShelf) : null,
      leftDivider: data.connections.leftDivider ? panels.get(data.connections.leftDivider) : null,
      rightDivider: data.connections.rightDivider ? panels.get(data.connections.rightDivider) : null
    };

    return new Drawer(data.id, connections);
  }
}
