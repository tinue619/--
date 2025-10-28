// ========== ИСТОРИЯ: ОТЛАДКА ==========

/**
 * Отладка всей истории изменений
 */
export function debugHistory(app) {
  console.group('📚 История изменений');
  console.log(`Всего состояний: ${app.history.states.length}`);
  console.log(`Текущее состояние: ${app.history.index}`);
  console.log('\n');
  
  app.history.states.forEach((state, index) => {
    const isCurrent = index === app.history.index;
    console.group(`${isCurrent ? '👉' : '  '} Состояние #${index}`);
    
    // Размеры шкафа
    if (state.cabinet) {
      console.log('🗄️ Шкаф:', {
        ширина: state.cabinet.width,
        высота: state.cabinet.height,
        глубина: state.cabinet.depth
      });
    }
    
    // Панели
    console.log(`📦 Панелей: ${state.panels.length}`);
    state.panels.forEach(panel => {
      const type = panel.type === 'shelf' ? '📏' : '📐';
      const pos = panel.type === 'shelf' ? `y:${panel.position.y}` : `x:${panel.position.x}`;
      const bounds = panel.type === 'shelf' 
        ? `[${panel.bounds.startX} - ${panel.bounds.endX}] = ${panel.bounds.endX - panel.bounds.startX}мм`
        : `[${panel.bounds.startY} - ${panel.bounds.endY}] = ${panel.bounds.endY - panel.bounds.startY}мм`;
      
      console.log(`  ${type} ${panel.id}: ${pos}, bounds: ${bounds}`);
    });
    
    console.groupEnd();
  });
  
  console.groupEnd();
}

/**
 * Отладка текущего состояния приложения
 */
export function debugCurrentState(app) {
  console.group('🔍 Текущее состояние');
  
  console.log('🗄️ Шкаф:', {
    ширина: app.cabinet.width,
    высота: app.cabinet.height,
    глубина: app.cabinet.depth
  });
  
  console.log('\n📦 Панели:');
  for (let panel of app.panels.values()) {
    const type = panel.type === 'shelf' ? '📏 Полка' : '📐 Разделитель';
    console.group(`${type}: ${panel.id}`);
    console.log('Позиция:', panel.position);
    console.log('Границы:', panel.bounds);
    console.log('Размер:', panel.size, 'мм');
    console.log('Связи:', {
      left: panel.connections.left?.id || null,
      right: panel.connections.right?.id || null,
      top: panel.connections.top?.id || null,
      bottom: panel.connections.bottom?.id || null
    });
    if (panel.ribs && panel.ribs.length > 0) {
      console.log('Ребра:', panel.ribs.map(r => `[${r.startX}-${r.endX}]=${r.endX-r.startX}мм`));
    }
    console.groupEnd();
  }
  
  console.groupEnd();
}

/**
 * Сравнение двух состояний истории
 */
export function compareStates(app, index1, index2) {
  if (index1 < 0 || index1 >= app.history.states.length ||
      index2 < 0 || index2 >= app.history.states.length) {
    console.error('Недопустимые индексы состояний');
    return;
  }
  
  const state1 = app.history.states[index1];
  const state2 = app.history.states[index2];
  
  console.group(`🔄 Сравнение состояний #${index1} и #${index2}`);
  
  // Сравниваем размеры шкафа
  if (state1.cabinet && state2.cabinet) {
    const widthChanged = state1.cabinet.width !== state2.cabinet.width;
    const heightChanged = state1.cabinet.height !== state2.cabinet.height;
    
    if (widthChanged || heightChanged) {
      console.log('🗄️ Размеры шкафа изменились:');
      if (widthChanged) {
        console.log(`  Ширина: ${state1.cabinet.width} → ${state2.cabinet.width} (${state2.cabinet.width - state1.cabinet.width > 0 ? '+' : ''}${state2.cabinet.width - state1.cabinet.width}мм)`);
      }
      if (heightChanged) {
        console.log(`  Высота: ${state1.cabinet.height} → ${state2.cabinet.height}`);
      }
    } else {
      console.log('🗄️ Размеры шкафа не изменились');
    }
  }
  
  // Сравниваем панели
  const panels1Map = new Map(state1.panels.map(p => [p.id, p]));
  const panels2Map = new Map(state2.panels.map(p => [p.id, p]));
  
  // Новые панели
  const added = state2.panels.filter(p => !panels1Map.has(p.id));
  if (added.length > 0) {
    console.log('\n➕ Добавлено панелей:', added.length);
    added.forEach(p => console.log(`  - ${p.id}`));
  }
  
  // Удаленные панели
  const removed = state1.panels.filter(p => !panels2Map.has(p.id));
  if (removed.length > 0) {
    console.log('\n➖ Удалено панелей:', removed.length);
    removed.forEach(p => console.log(`  - ${p.id}`));
  }
  
  // Измененные панели
  const changed = [];
  for (let [id, panel1] of panels1Map) {
    const panel2 = panels2Map.get(id);
    if (!panel2) continue;
    
    const posChanged = JSON.stringify(panel1.position) !== JSON.stringify(panel2.position);
    const boundsChanged = JSON.stringify(panel1.bounds) !== JSON.stringify(panel2.bounds);
    
    if (posChanged || boundsChanged) {
      changed.push({ id, panel1, panel2, posChanged, boundsChanged });
    }
  }
  
  if (changed.length > 0) {
    console.log('\n📝 Изменено панелей:', changed.length);
    changed.forEach(({ id, panel1, panel2, posChanged, boundsChanged }) => {
      console.group(`  ${id}`);
      if (posChanged) {
        console.log('Позиция:', panel1.position, '→', panel2.position);
      }
      if (boundsChanged) {
        const size1 = panel1.type === 'shelf' 
          ? panel1.bounds.endX - panel1.bounds.startX
          : panel1.bounds.endY - panel1.bounds.startY;
        const size2 = panel2.type === 'shelf'
          ? panel2.bounds.endX - panel2.bounds.startX
          : panel2.bounds.endY - panel2.bounds.startY;
        console.log('Границы:', panel1.bounds, '→', panel2.bounds);
        console.log(`Размер: ${size1}мм → ${size2}мм (${size2 - size1 > 0 ? '+' : ''}${size2 - size1}мм)`);
      }
      console.groupEnd();
    });
  }
  
  if (added.length === 0 && removed.length === 0 && changed.length === 0) {
    console.log('\n✅ Панели не изменились');
  }
  
  console.groupEnd();
}
