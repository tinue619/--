// ========== DIMENSIONS MODULE ==========
// Отображение размеров ячеек (по аналогии с логикой ящиков)

import { CONFIG } from '../config.js';

/**
 * Найти границы ячейки для точки (x, y)
 * Использует ту же логику что и addDrawer
 * @param {App} app - Экземпляр приложения
 * @param {number} x - X координата
 * @param {number} y - Y координата
 * @returns {Object} - { bottomShelf, topShelf, leftDivider, rightDivider }
 */
function findCellBounds(app, x, y) {
  let bottomShelf = null, topShelf = null, leftDivider = null, rightDivider = null;
  
  // Находим полки снизу и сверху
  for (let panel of app.panels.values()) {
    if (!panel.isHorizontal) continue;
    
    if (x >= panel.bounds.startX && x <= panel.bounds.endX) {
      if (panel.position.y <= y) {
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
    
    if (y >= panel.bounds.startY && y <= panel.bounds.endY) {
      if (panel.position.x <= x) {
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
      bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP }
    };
  }
  
  if (!topShelf) {
    topShelf = {
      type: 'top',
      id: 'virtual-top',
      position: { y: app.cabinet.height - CONFIG.DSP/2 },
      bounds: { startX: CONFIG.DSP, endX: app.cabinet.width - CONFIG.DSP }
    };
  }
  
  if (!leftDivider) {
    leftDivider = {
      type: 'left',
      id: 'virtual-left',
      position: { x: CONFIG.DSP/2 },
      bounds: { startY: 0, endY: app.cabinet.height }
    };
  }
  
  if (!rightDivider) {
    rightDivider = {
      type: 'right',
      id: 'virtual-right',
      position: { x: app.cabinet.width - CONFIG.DSP/2 },
      bounds: { startY: 0, endY: app.cabinet.height }
    };
  }
  
  return { bottomShelf, topShelf, leftDivider, rightDivider };
}

/**
 * Генерировать все уникальные ячейки в шкафу
 * @param {App} app - Экземпляр приложения
 * @returns {Array} - Массив уникальных ячеек
 */
function generateAllCells(app) {
  const testPoints = [];
  const cells = [];
  const cellSignatures = new Set(); // Для проверки уникальности
  
  // Собираем все Y координаты (полки + границы)
  const yCoords = [
    app.cabinet.base, // Дно
    app.cabinet.height - CONFIG.DSP // Крыша
  ];
  
  for (let panel of app.panels.values()) {
    if (panel.isHorizontal) {
      yCoords.push(panel.position.y);
    }
  }
  
  // Собираем все X координаты (разделители + границы)
  const xCoords = [
    CONFIG.DSP, // Левая стенка
    app.cabinet.width - CONFIG.DSP // Правая стенка
  ];
  
  for (let panel of app.panels.values()) {
    if (!panel.isHorizontal) {
      xCoords.push(panel.position.x);
    }
  }
  
  // Сортируем
  yCoords.sort((a, b) => a - b);
  xCoords.sort((a, b) => a - b);
  
  // Генерируем тестовые точки между всеми соседними координатами
  for (let i = 0; i < yCoords.length - 1; i++) {
    for (let j = 0; j < xCoords.length - 1; j++) {
      // Точка в центре между координатами
      const testX = (xCoords[j] + xCoords[j + 1]) / 2;
      const testY = (yCoords[i] + yCoords[i + 1]) / 2;
      testPoints.push({ x: testX, y: testY });
    }
  }
  
  // Для каждой тестовой точки находим границы
  for (let point of testPoints) {
    const bounds = findCellBounds(app, point.x, point.y);
    
    // Создаём уникальную подпись ячейки
    const signature = `${bounds.bottomShelf.id}_${bounds.topShelf.id}_${bounds.leftDivider.id}_${bounds.rightDivider.id}`;
    
    if (!cellSignatures.has(signature)) {
      cellSignatures.add(signature);
      cells.push(bounds);
    }
  }
  
  return cells;
}

/**
 * Вычислить размеры ячейки
 * @param {Object} cell - Границы ячейки
 * @param {App} app - Экземпляр приложения
 * @returns {Object} - { width, height, centerX, centerY }
 */
function calculateCellDimensions(cell, app) {
  const { bottomShelf, topShelf, leftDivider, rightDivider } = cell;
  
  // Вычисляем границы по Y
  let bottomY, topY;
  
  if (bottomShelf.type === 'bottom') {
    bottomY = app.cabinet.base;
  } else {
    bottomY = bottomShelf.position.y + CONFIG.DSP / 2;
  }
  
  if (topShelf.type === 'top') {
    topY = app.cabinet.height - CONFIG.DSP;
  } else {
    topY = topShelf.position.y - CONFIG.DSP / 2;
  }
  
  // Вычисляем границы по X
  let leftX, rightX;
  
  if (leftDivider.type === 'left') {
    leftX = CONFIG.DSP;
  } else {
    leftX = leftDivider.position.x + CONFIG.DSP / 2;
  }
  
  if (rightDivider.type === 'right') {
    rightX = app.cabinet.width - CONFIG.DSP;
  } else {
    rightX = rightDivider.position.x - CONFIG.DSP / 2;
  }
  
  const width = rightX - leftX;
  const height = topY - bottomY;
  const centerX = (leftX + rightX) / 2;
  const centerY = (bottomY + topY) / 2;
  
  return { width, height, centerX, centerY };
}

/**
 * Нарисовать стрелку на конце размерной линии
 * @param {CanvasRenderingContext2D} ctx - Canvas контекст
 * @param {number} x - X координата кончика стрелки
 * @param {number} y - Y координата кончика стрелки
 * @param {number} angle - Угол направления стрелки (в радианах)
 * @param {number} size - Размер стрелки
 */
function drawArrow(ctx, x, y, angle, size = 5) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size);
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, size);
  ctx.stroke();
  ctx.restore();
}

/**
 * Отрисовать размеры одной ячейки с размерными линиями
 * @param {CanvasRenderingContext2D} ctx - Canvas контекст
 * @param {Object} cell - Границы ячейки
 * @param {App} app - Экземпляр приложения
 * @param {number} scale - Масштаб canvas
 * @param {Function} toY - Функция преобразования Y координат
 */
function drawCellDimensions(ctx, cell, app, scale, toY) {
  const dims = calculateCellDimensions(cell, app);
  
  // Вычисляем границы ячейки
  const { bottomShelf, topShelf, leftDivider, rightDivider } = cell;
  
  let leftX, rightX, bottomY, topY;
  
  // Левая граница
  if (leftDivider.type === 'left') {
    leftX = CONFIG.DSP;
  } else {
    leftX = leftDivider.position.x + CONFIG.DSP / 2;
  }
  
  // Правая граница
  if (rightDivider.type === 'right') {
    rightX = app.cabinet.width - CONFIG.DSP;
  } else {
    rightX = rightDivider.position.x - CONFIG.DSP / 2;
  }
  
  // Нижняя граница
  if (bottomShelf.type === 'bottom') {
    bottomY = app.cabinet.base;
  } else {
    bottomY = bottomShelf.position.y + CONFIG.DSP / 2;
  }
  
  // Верхняя граница
  if (topShelf.type === 'top') {
    topY = app.cabinet.height - CONFIG.DSP;
  } else {
    topY = topShelf.position.y - CONFIG.DSP / 2;
  }
  
  // Применяем масштаб и преобразование Y
  leftX *= scale;
  rightX *= scale;
  const bottomYCanvas = toY(bottomY);
  const topYCanvas = toY(topY);
  
  ctx.save();
  
  // Настройки для размерных линий
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]); // Пунктирная линия
  ctx.font = '11px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  const offset = 15; // Отступ размерных линий от краёв
  
  // ===== ГОРИЗОНТАЛЬНАЯ РАЗМЕРНАЯ ЛИНИЯ (ширина) =====
  const horizY = bottomYCanvas - offset; // Вниз от нижней границы
  
  // Вертикальные выноски слева и справа
  ctx.beginPath();
  ctx.moveTo(leftX, bottomYCanvas - 5);
  ctx.lineTo(leftX, horizY - 8);
  ctx.moveTo(rightX, bottomYCanvas - 5);
  ctx.lineTo(rightX, horizY - 8);
  ctx.stroke();
  
  // Горизонтальная линия со стрелками
  ctx.setLineDash([]); // Сплошная для основной линии
  ctx.beginPath();
  ctx.moveTo(leftX, horizY);
  ctx.lineTo(rightX, horizY);
  ctx.stroke();
  
  // Стрелки
  drawArrow(ctx, leftX, horizY, Math.PI, 4);
  drawArrow(ctx, rightX, horizY, 0, 4);
  
  // Текст ширины
  const widthText = Math.round(dims.width).toString();
  const centerX = (leftX + rightX) / 2;
  
  // Белый фон под текстом
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const textWidth = ctx.measureText(widthText).width;
  ctx.fillRect(centerX - textWidth / 2 - 2, horizY - 7, textWidth + 4, 14);
  
  // Текст
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillText(widthText, centerX, horizY);
  
  // ===== ВЕРТИКАЛЬНАЯ РАЗМЕРНАЯ ЛИНИЯ (высота) =====
  const vertX = leftX + offset;
  
  // Горизонтальные выноски снизу и сверху
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(leftX + 5, bottomYCanvas);
  ctx.lineTo(vertX + 8, bottomYCanvas);
  ctx.moveTo(leftX + 5, topYCanvas);
  ctx.lineTo(vertX + 8, topYCanvas);
  ctx.stroke();
  
  // Вертикальная линия со стрелками
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(vertX, bottomYCanvas);
  ctx.lineTo(vertX, topYCanvas);
  ctx.stroke();
  
  // Стрелки
  drawArrow(ctx, vertX, bottomYCanvas, -Math.PI / 2, 4); // Вниз (в canvas Y увеличивается вниз)
  drawArrow(ctx, vertX, topYCanvas, Math.PI / 2, 4); // Вверх
  
  // Текст высоты (повёрнутый)
  const heightText = Math.round(dims.height).toString();
  const centerYCanvas = (bottomYCanvas + topYCanvas) / 2;
  
  ctx.save();
  ctx.translate(vertX, centerYCanvas);
  ctx.rotate(-Math.PI / 2);
  
  // Белый фон
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  const heightTextWidth = ctx.measureText(heightText).width;
  ctx.fillRect(-heightTextWidth / 2 - 2, -7, heightTextWidth + 4, 14);
  
  // Текст
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillText(heightText, 0, 0);
  
  ctx.restore();
  ctx.restore();
}

/**
 * Главная функция отрисовки всех размеров
 * Вызывается из render2D после отрисовки панелей и ящиков
 * @param {CanvasRenderingContext2D} ctx - Canvas контекст
 * @param {App} app - Экземпляр приложения
 * @param {number} scale - Масштаб canvas
 * @param {Function} toY - Функция преобразования Y координат
 */
export function renderDimensions(ctx, app, scale, toY) {
  // Проверяем что режим включен
  if (!app.showDimensions) return;
  
  const cells = generateAllCells(app);
  
  for (let cell of cells) {
    drawCellDimensions(ctx, cell, app, scale, toY);
  }
}
