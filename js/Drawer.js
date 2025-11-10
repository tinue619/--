// js/Drawer.js
import { CONFIG } from './config.js';

/**
 * Класс выдвижного ящика
 * Ящик определяется 4 связями: bottomShelf, topShelf, leftDivider, rightDivider
 */
export class Drawer {
  constructor(id, connections, stackId = null, stackIndex = 0, stackCount = 1) {
    this.type = 'drawer';
    this.id = id;
    this.connections = connections; // { bottomShelf, topShelf, leftDivider, rightDivider }
    this.stackId = stackId; // ID стека, если ящик в стеке
    this.stackIndex = stackIndex; // Индекс ящика в стеке (0, 1, 2...)
    this.stackCount = stackCount; // Общее количество ящиков в стеке
    this.parts = null;
    this.boxLength = null;
    this.volume = null;
  }

  /**
   * Рассчитать volume от connections
   * Для стеков: каждый ящик занимает свою часть общей высоты
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
    const leftEdge = leftDivider.type === 'left' 
      ? CONFIG.DSP
      : leftDivider.position.x + CONFIG.DSP;
    
    const rightEdge = rightDivider.type === 'right'
      ? app.cabinet.width - CONFIG.DSP
      : rightDivider.position.x;
    
    // Рассчитываем общую высоту стека
    const stackBottomEdge = bottomShelf.type === 'bottom'
      ? app.cabinet.base
      : bottomShelf.position.y + CONFIG.DSP;
    
    const stackTopEdge = topShelf.type === 'top'
      ? app.cabinet.height - CONFIG.DSP
      : topShelf.position.y;
    
    const stackHeight = stackTopEdge - stackBottomEdge;
    const drawerHeight = stackHeight / this.stackCount;
    
    // Рассчитываем границы этого ящика в стеке
    const bottomEdge = stackBottomEdge + (this.stackIndex * drawerHeight);
    const topEdge = bottomEdge + drawerHeight;

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
        start: CONFIG.DSP,  // 16мм отступ от задней стенки
        end: minDepth - 2  // отступ 2мм от самой утопленной панели
      }
    };

    return volume;
  }

  /**
   * Выбрать boxLength из стандартных размеров
   * Если секция слишком глубокая - берём максимальный короб и прижимаем к фасаду
   */
  calculateBoxLength(volDepth) {
    // Добавляем DSP к volDepth, т.к. volume не включает переднюю панель
    const availableDepth = volDepth + CONFIG.DSP;
    
    const suitable = CONFIG.DRAWER.SIZES.filter(s => s <= availableDepth);
    
    if (suitable.length > 0) {
      // Есть подходящий размер - берём максимальный из подходящих
      return suitable[suitable.length - 1];
    } else if (availableDepth >= CONFIG.DRAWER.SIZES[0]) {
      // Секция глубже максимального короба - берём максимальный короб
      return CONFIG.DRAWER.SIZES[CONFIG.DRAWER.SIZES.length - 1];
    } else {
      // Секция слишком мелкая даже для минимального короба
      return null;
    }
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

    // Проверка минимальных и максимальных размеров ящика
    if (volWidth < CONFIG.DRAWER.MIN_WIDTH) {
      console.error(`Drawer ${this.id}: width too small (${Math.round(volWidth)}mm < ${CONFIG.DRAWER.MIN_WIDTH}mm)`);
      return false;
    }
    if (volWidth > CONFIG.DRAWER.MAX_WIDTH) {
      console.error(`Drawer ${this.id}: width too large (${Math.round(volWidth)}mm > ${CONFIG.DRAWER.MAX_WIDTH}mm)`);
      return false;
    }
    if (volHeight < CONFIG.DRAWER.MIN_HEIGHT) {
      console.error(`Drawer ${this.id}: height too small (${Math.round(volHeight)}mm < ${CONFIG.DRAWER.MIN_HEIGHT}mm)`);
      return false;
    }
    
    // Если высота секции больше максимальной - ограничиваем высоту ящика и размещаем его внизу
    const effectiveHeight = Math.min(volHeight, CONFIG.DRAWER.MAX_HEIGHT);

    const boxLength = this.calculateBoxLength(volDepth);
    if (!boxLength) {
      console.error(`Drawer ${this.id}: volume too small (min ${CONFIG.DRAWER.SIZES[0]}mm required)`);
      return false;
    }

    this.boxLength = boxLength;

    // Общие расчеты (используем effectiveHeight вместо volHeight)
    const sideHeight = effectiveHeight - 56;
    const sideDepth = boxLength - 26;
    const bottomDepth = boxLength - 44;

    // Z-координаты (критично!)
    const frontZ = vol.z.end;
    const sidesZ2 = frontZ - CONFIG.DSP;
    const sidesZ1 = sidesZ2 - sideDepth;
    const backZ = sidesZ1 + CONFIG.DRAWER.BACK_OFFSET;
    const bottomZ1 = sidesZ1 + CONFIG.DSP + CONFIG.DRAWER.BOTTOM_OFFSET;
    const bottomZ2 = bottomZ1 + bottomDepth;

    // Рассчитываем все 5 частей (ящик размещается внизу секции)
    this.parts = {
      front: {
        width: volWidth - 4,
        height: effectiveHeight - 30,
        depth: CONFIG.DSP,
        position: {
          x: (vol.x.start + vol.x.end) / 2,
          y: vol.y.start + (effectiveHeight - 26) / 2,
          z: frontZ - CONFIG.DSP / 2
        },
        bounds: {
          x1: vol.x.start + CONFIG.DRAWER.GAP_FRONT,
          x2: vol.x.end - CONFIG.DRAWER.GAP_FRONT,
          y1: vol.y.start + CONFIG.DRAWER.GAP_BOTTOM,
          y2: vol.y.start + effectiveHeight - CONFIG.DRAWER.GAP_TOP
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
        height: effectiveHeight - 68,
        depth: CONFIG.DSP,
        position: {
          x: (vol.x.start + vol.x.end) / 2,
          y: vol.y.start + 27 + (effectiveHeight - 68) / 2,
          z: backZ + CONFIG.DSP / 2
        },
        bounds: {
          x1: vol.x.start + CONFIG.DRAWER.INNER_OFFSET,
          x2: vol.x.end - CONFIG.DRAWER.INNER_OFFSET,
          y1: vol.y.start + 27,
          y2: vol.y.start + effectiveHeight - 41,
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
    // Сериализуем connections, сохраняя информацию о виртуальных панелях
    const serializeConnection = (connection) => {
      if (!connection) return null;
      
      // Виртуальные панели: сохраняем только тип
      if (connection.type === 'left' || connection.type === 'right' || 
          connection.type === 'bottom' || connection.type === 'top') {
        return { virtual: true, type: connection.type };
      }
      
      // Реальные панели: сохраняем ID
      return { virtual: false, id: connection.id };
    };
    
    return {
      type: this.type,
      id: this.id,
      connections: {
        bottomShelf: serializeConnection(this.connections.bottomShelf),
        topShelf: serializeConnection(this.connections.topShelf),
        leftDivider: serializeConnection(this.connections.leftDivider),
        rightDivider: serializeConnection(this.connections.rightDivider)
      }
    };
  }

  /**
   * Десериализация
   */
  static fromJSON(data, panels, app) {
    // Восстанавливаем connections, создавая виртуальные панели если нужно
    const deserializeConnection = (connectionData, connectionKey) => {
      // ВАЖНО: null имеет тип 'object' в JavaScript!
      if (connectionData === null || connectionData === undefined) {
        return null;
      }
      
      // НОВЫЙ ФОРМАТ: Виртуальная панель: создаём новый объект
      if (connectionData.virtual) {
        const type = connectionData.type;
        
        if (type === 'left') {
          return {
            type: 'left',
            id: 'virtual-left',
            position: { x: CONFIG.DSP/2 },
            bounds: { startY: 0, endY: app.cabinet.height },
            connections: {},
            isHorizontal: false
          };
        }
        
        if (type === 'right') {
          return {
            type: 'right',
            id: 'virtual-right',
            position: { x: app.cabinet.width - CONFIG.DSP/2 },
            bounds: { startY: 0, endY: app.cabinet.height },
            connections: {},
            isHorizontal: false
          };
        }
        
        if (type === 'bottom') {
          return {
            type: 'bottom',
            id: 'virtual-bottom',
            position: { y: app.cabinet.base - CONFIG.DSP/2 },
            bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
            connections: {},
            isHorizontal: true
          };
        }
        
        if (type === 'top') {
          return {
            type: 'top',
            id: 'virtual-top',
            position: { y: app.cabinet.height - CONFIG.DSP/2 },
            bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
            connections: {},
            isHorizontal: true
          };
        }
      }
      
      // СТАРЫЙ ФОРМАТ (для обратной совместимости): connectionData это ID строка
      if (typeof connectionData === 'string') {
        // Если это ID виртуальной панели
        if (connectionData === 'virtual-left') {
          return {
            type: 'left',
            id: 'virtual-left',
            position: { x: CONFIG.DSP/2 },
            bounds: { startY: 0, endY: app.cabinet.height },
            connections: {},
            isHorizontal: false
          };
        }
        if (connectionData === 'virtual-right') {
          return {
            type: 'right',
            id: 'virtual-right',
            position: { x: app.cabinet.width - CONFIG.DSP/2 },
            bounds: { startY: 0, endY: app.cabinet.height },
            connections: {},
            isHorizontal: false
          };
        }
        if (connectionData === 'virtual-bottom') {
          return {
            type: 'bottom',
            id: 'virtual-bottom',
            position: { y: app.cabinet.base - CONFIG.DSP/2 },
            bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
            connections: {},
            isHorizontal: true
          };
        }
        if (connectionData === 'virtual-top') {
          return {
            type: 'top',
            id: 'virtual-top',
            position: { y: app.cabinet.height - CONFIG.DSP/2 },
            bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
            connections: {},
            isHorizontal: true
          };
        }
        // Это ID реальной панели
        return panels.get(connectionData) || null;
      }
      
      // НОВЫЙ ФОРМАТ: Реальная панель с объектом { virtual: false, id: ... }
      if (connectionData.id) {
        return panels.get(connectionData.id) || null;
      }
      
      return null;
    };
    
    const connections = {
      bottomShelf: deserializeConnection(data.connections.bottomShelf, 'bottomShelf'),
      topShelf: deserializeConnection(data.connections.topShelf, 'topShelf'),
      leftDivider: deserializeConnection(data.connections.leftDivider, 'leftDivider'),
      rightDivider: deserializeConnection(data.connections.rightDivider, 'rightDivider')
    };
    
    // ФИКС для старых данных: если все connections null, создаём виртуальные панели по периметру
    if (!connections.bottomShelf && !connections.topShelf && 
        !connections.leftDivider && !connections.rightDivider) {
      
      connections.bottomShelf = {
        type: 'bottom',
        id: 'virtual-bottom',
        position: { y: app.cabinet.base - CONFIG.DSP/2 },
        bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
        connections: {},
        isHorizontal: true
      };
      
      connections.topShelf = {
        type: 'top',
        id: 'virtual-top',
        position: { y: app.cabinet.height - CONFIG.DSP/2 },
        bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP },
        connections: {},
        isHorizontal: true
      };
      
      connections.leftDivider = {
        type: 'left',
        id: 'virtual-left',
        position: { x: CONFIG.DSP/2 },
        bounds: { startY: 0, endY: app.cabinet.height },
        connections: {},
        isHorizontal: false
      };
      
      connections.rightDivider = {
        type: 'right',
        id: 'virtual-right',
        position: { x: app.cabinet.width - CONFIG.DSP/2 },
        bounds: { startY: 0, endY: app.cabinet.height },
        connections: {},
        isHorizontal: false
      };
    }

    return new Drawer(data.id, connections);
  }
}
