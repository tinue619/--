// ========== 2D ОТРИСОВКА ==========

import { CONFIG } from '../config.js';

/**
 * Отрисовка 2D вида шкафа на canvas
 */
export function render2D(app) {
  const ctx = app.canvas.ctx;
  const { size, scale, offset } = app.canvas;
  
  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(offset.x, offset.y);
  
  const toY = (y) => size - offset.y * 2 - (y * scale);
  
  // Фон кабинета
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(
    CONFIG.DSP * scale,
    toY(app.cabinet.height - CONFIG.DSP),
    app.calc.innerWidth * scale,
    app.calc.workHeight * scale
  );
  
  // Корпус
  ctx.fillStyle = '#8B6633';
  
  // Боковины (подсвечиваем если двигаем)
  const isLeftSideActive = app.interaction.dragging && app.interaction.dragging.id === 'left-side';
  const isRightSideActive = app.interaction.dragging && app.interaction.dragging.id === 'right-side';
  
  ctx.fillStyle = isLeftSideActive ? CONFIG.COLORS.ACTIVE : '#8B6633';
  ctx.fillRect(0, toY(app.cabinet.height), CONFIG.DSP * scale, app.cabinet.height * scale);
  
  ctx.fillStyle = isRightSideActive ? CONFIG.COLORS.ACTIVE : '#8B6633';
  ctx.fillRect((app.cabinet.width - CONFIG.DSP) * scale, toY(app.cabinet.height), CONFIG.DSP * scale, app.cabinet.height * scale);
  
  // Дно
  ctx.fillStyle = '#8B6633';
  ctx.fillRect(CONFIG.DSP * scale, toY(app.cabinet.base), app.calc.innerWidth * scale, CONFIG.DSP * scale);
  
  // Крыша
  ctx.fillRect(CONFIG.DSP * scale, toY(app.cabinet.height), app.calc.innerWidth * scale, CONFIG.DSP * scale);
  
  // Цоколь
  ctx.fillStyle = '#654321';
  ctx.fillRect(
    CONFIG.DSP * scale,
    toY(app.cabinet.base - CONFIG.DSP),
    app.calc.innerWidth * scale,
    (app.cabinet.base - CONFIG.DSP) * scale
  );
  
  // Панели
  for (let panel of app.panels.values()) {
    ctx.fillStyle = app.interaction.dragging === panel ? CONFIG.COLORS.ACTIVE : '#8B6633';
    
    if (panel.isHorizontal) {
      // Полка
      ctx.fillRect(
        panel.bounds.startX * scale,
        toY(panel.position.y + CONFIG.DSP),
        panel.size * scale,
        CONFIG.DSP * scale
      );
      
      // Ребра жесткости (если есть) - прижаты к низу полки
      if (panel.ribs.length > 0) {
        ctx.fillStyle = '#7A5A2F';  // Чуть темнее для ребра
        for (let rib of panel.ribs) {
          ctx.fillRect(
            rib.startX * scale,
            toY(panel.position.y),  // Верх ребра = низ полки
            (rib.endX - rib.startX) * scale,
            CONFIG.RIB.HEIGHT * scale
          );
        }
        // Восстанавливаем цвет для следующих элементов
        ctx.fillStyle = app.interaction.dragging === panel ? CONFIG.COLORS.ACTIVE : '#8B6633';
      }
    } else {
      // Разделитель
      ctx.fillRect(
        panel.position.x * scale,
        toY(panel.bounds.endY),
        CONFIG.DSP * scale,
        panel.size * scale
      );
    }
  }
  
  // Ящики - отрисовываем только фасад
  for (let drawer of app.drawers.values()) {
    if (!drawer.parts) continue;
    
    const front = drawer.parts.front;
    
    // Белый прямоугольник фасада
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(
      front.bounds.x1 * scale,
      toY(front.bounds.y2),
      (front.bounds.x2 - front.bounds.x1) * scale,
      (front.bounds.y2 - front.bounds.y1) * scale
    );
    
    // Черная рамка вокруг фасада
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(
      front.bounds.x1 * scale,
      toY(front.bounds.y2),
      (front.bounds.x2 - front.bounds.x1) * scale,
      (front.bounds.y2 - front.bounds.y1) * scale
    );
  }
  
  ctx.restore();
}
