// ========== ИСТОРИЯ: ЛОГИРОВАНИЕ И UI ==========

/**
 * Настройка перетаскивания панели истории
 */
export function setupHistoryDrag() {
  const historyPanel = document.getElementById('history-panel');
  const historyHeader = document.getElementById('history-header');
  if (!historyPanel || !historyHeader) return;
  
  let isDragging = false;
  let currentX, currentY, initialX, initialY;
  
  const dragStart = (e) => {
    // Не драгать если кликнули по кнопке
    if (e.target.closest('button')) return;
    
    // Только на desktop
    if (window.innerWidth <= 1024) return;
    
    isDragging = true;
    
    const rect = historyPanel.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    currentX = e.clientX;
    currentY = e.clientY;
    
    historyPanel.style.transition = 'none';
  };
  
  const drag = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    
    const dx = e.clientX - currentX;
    const dy = e.clientY - currentY;
    
    const newX = initialX + dx;
    const newY = initialY + dy;
    
    // Ограничения по экрану
    const maxX = window.innerWidth - historyPanel.offsetWidth;
    const maxY = window.innerHeight - historyPanel.offsetHeight;
    
    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));
    
    historyPanel.style.left = boundedX + 'px';
    historyPanel.style.top = boundedY + 'px';
    historyPanel.style.right = 'auto';
    historyPanel.style.bottom = 'auto';
  };
  
  const dragEnd = () => {
    isDragging = false;
    historyPanel.style.transition = '';
  };
  
  historyHeader.addEventListener('mousedown', dragStart);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', dragEnd);
}

/**
 * Сворачивание/разворачивание панели истории
 */
export function toggleHistoryCollapse() {
  const historyPanel = document.getElementById('history-panel');
  const collapseBtn = document.getElementById('collapse-history-btn');
  if (!historyPanel || !collapseBtn) return;
  
  historyPanel.classList.toggle('collapsed');
  collapseBtn.textContent = historyPanel.classList.contains('collapsed') ? '▲' : '▼';
}

/**
 * Копирование логов истории в буфер обмена
 */
export function copyHistoryLogs(app) {
  const historyContent = document.getElementById('history-content');
  if (!historyContent) return;
  
  const entries = historyContent.querySelectorAll('.history-entry');
  if (entries.length === 0) {
    app.updateStatus('История пуста');
    return;
  }
  
  let logText = 'ИСТОРИЯ ИЗМЕНЕНИЙ CABINET EDITOR\n';
  logText += '='.repeat(50) + '\n\n';
  
  entries.forEach((entry, index) => {
    const time = entry.querySelector('.history-time')?.textContent || '';
    const action = entry.querySelector('.history-action')?.textContent || '';
    const details = entry.querySelector('.history-details');
    
    logText += `${time} ${action}\n`;
    
    if (details) {
      const changes = details.querySelectorAll('.history-change');
      changes.forEach(change => {
        // Удаляем HTML теги и форматируем текст
        const text = change.textContent
          .replace(/\s+/g, ' ')
          .trim();
        logText += `  • ${text}\n`;
      });
    }
    
    logText += '\n';
  });
  
  logText += '='.repeat(50) + '\n';
  logText += `Всего записей: ${entries.length}\n`;
  logText += `Дата: ${new Date().toLocaleString('ru-RU')}\n`;
  
  // Копируем в буфер обмена
  navigator.clipboard.writeText(logText).then(() => {
    app.updateStatus('✅ Логи скопированы в буфер обмена!');
  }).catch(err => {
    console.error('Ошибка копирования:', err);
    app.updateStatus('❌ Ошибка копирования');
  });
}

/**
 * Добавление записи в лог истории
 */
export function logToHistory(action, details) {
  const historyContent = document.getElementById('history-content');
  if (!historyContent) return;
  
  // Удаляем сообщение "История пуста"
  const emptyMsg = historyContent.querySelector('.history-empty');
  if (emptyMsg) emptyMsg.remove();
  
  // Создаем новую запись
  const entry = document.createElement('div');
  entry.className = `history-entry ${action}`;
  
  const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  let actionText = '';
  let actionIcon = '';
  
  switch(action) {
    case 'save':
      actionIcon = '💾';
      actionText = 'Сохранено';
      break;
    case 'undo':
      actionIcon = '⏮️';
      actionText = 'Отменено';
      break;
    case 'redo':
      actionIcon = '⏭️';
      actionText = 'Возвращено';
      break;
  }
  
  let html = `
    <span class="history-time">[${time}]</span>
    <span class="history-action">${actionIcon} ${actionText}</span>
  `;
  
  // Добавляем детали изменений
  if (details && details.length > 0) {
    html += '<div class="history-details">';
    details.forEach(detail => {
      html += `<div class="history-change">${detail}</div>`;
    });
    html += '</div>';
  }
  
  entry.innerHTML = html;
  historyContent.insertBefore(entry, historyContent.firstChild);
  
  // Ограничиваем количество записей
  const allEntries = historyContent.querySelectorAll('.history-entry');
  if (allEntries.length > 50) {
    allEntries[allEntries.length - 1].remove();
  }
  
  // Авто-скролл вверх к новой записи
  historyContent.scrollTop = 0;
}

/**
 * Очистка лога истории
 */
export function clearHistoryLog() {
  const historyContent = document.getElementById('history-content');
  if (!historyContent) return;
  
  historyContent.innerHTML = '<div class="history-empty">История пуста</div>';
}

/**
 * Сравнение двух состояний для логирования
 */
export function compareStatesForLog(oldState, newState) {
  const changes = [];
  
  // Проверяем изменение размеров шкафа
  if (oldState && newState) {
    if (oldState.cabinet && newState.cabinet) {
      const oldWidth = oldState.cabinet.width;
      const newWidth = newState.cabinet.width;
      
      if (Math.abs(oldWidth - newWidth) > 0.1) {
        const diff = newWidth - oldWidth;
        const diffClass = diff > 0 ? '' : 'negative';
        const diffText = diff > 0 ? `+${Math.round(diff)}` : Math.round(diff);
        
        changes.push(`
          <span>Ширина шкафа:</span>
          <span class="history-change-value">${Math.round(oldWidth)}мм</span>
          <span class="history-change-arrow">→</span>
          <span class="history-change-value">${Math.round(newWidth)}мм</span>
          <span class="history-change-diff ${diffClass}">(${diffText}мм)</span>
        `);
      }
    }
    
    // Проверяем изменения панелей
    const oldPanels = new Map(oldState.panels.map(p => [p.id, p]));
    const newPanels = new Map(newState.panels.map(p => [p.id, p]));
    
    // Новые панели
    const added = newState.panels.filter(p => !oldPanels.has(p.id));
    if (added.length > 0) {
      added.forEach(p => {
        const icon = p.type === 'shelf' ? '📏' : '📐';
        const typeName = p.type === 'shelf' ? 'Полка' : 'Разделитель';
        changes.push(`<span>${icon} Добавлен: ${typeName}</span>`);
      });
    }
    
    // Удаленные панели
    const removed = oldState.panels.filter(p => !newPanels.has(p.id));
    if (removed.length > 0) {
      removed.forEach(p => {
        const icon = p.type === 'shelf' ? '📏' : '📐';
        const typeName = p.type === 'shelf' ? 'Полка' : 'Разделитель';
        changes.push(`<span>${icon} Удален: ${typeName}</span>`);
      });
    }
    
    // Измененные размеры панелей
    for (let [id, oldPanel] of oldPanels) {
      const newPanel = newPanels.get(id);
      if (!newPanel) continue;
      
      const oldSize = oldPanel.type === 'shelf' 
        ? oldPanel.bounds.endX - oldPanel.bounds.startX
        : oldPanel.bounds.endY - oldPanel.bounds.startY;
      const newSize = newPanel.type === 'shelf'
        ? newPanel.bounds.endX - newPanel.bounds.startX
        : newPanel.bounds.endY - newPanel.bounds.startY;
      
      if (Math.abs(oldSize - newSize) > 0.1) {
        const icon = oldPanel.type === 'shelf' ? '📏' : '📐';
        const diff = newSize - oldSize;
        const diffClass = diff > 0 ? '' : 'negative';
        const diffText = diff > 0 ? `+${Math.round(diff)}` : Math.round(diff);
        
        changes.push(`
          <span>${icon} ${id}:</span>
          <span class="history-change-value">${Math.round(oldSize)}мм</span>
          <span class="history-change-arrow">→</span>
          <span class="history-change-value">${Math.round(newSize)}мм</span>
          <span class="history-change-diff ${diffClass}">(${diffText}мм)</span>
        `);
      }
    }
  }
  
  return changes;
}
