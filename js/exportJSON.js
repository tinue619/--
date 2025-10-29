// Экспорт спецификации в JSON

function exportPanelsToJSON() {
  if (!window.cabinetApp) {
    alert('Приложение не загружено');
    return;
  }

  const app = window.cabinetApp;
  const cab = app.cabinet;

  // Собираем все панели
  const allPanels = [
    { 
      name: 'Левая боковина',
      type: 'left-side', 
      x: 0, 
      y: 0, 
      width: 16, 
      height: cab.height,
      thickness: 16
    },
    { 
      name: 'Правая боковина',
      type: 'right-side', 
      x: cab.width - 16, 
      y: 0, 
      width: 16, 
      height: cab.height,
      thickness: 16
    },
    { 
      name: 'Дно',
      type: 'bottom', 
      x: 16, 
      y: 0, 
      width: cab.width - 32, 
      height: 16,
      thickness: 16
    },
    { 
      name: 'Крыша',
      type: 'top', 
      x: 16, 
      y: cab.height - 16, 
      width: cab.width - 32, 
      height: 16,
      thickness: 16
    }
  ];

  // Добавляем пользовательские панели
  let shelfIndex = 1;
  let dividerIndex = 1;
  let ribIndex = 1;

  Array.from(app.panels.values()).forEach(p => {
    let name = p.type;
    
    if (p.type === 'shelf') {
      name = `Полка ${shelfIndex++}`;
    } else if (p.type === 'divider') {
      name = `Разделитель ${dividerIndex++}`;
    } else if (p.type === 'rib') {
      name = `Ребро ${ribIndex++}`;
    }

    allPanels.push({
      name: name,
      type: p.type,
      x: Math.round(p.position.x),
      y: Math.round(p.position.y),
      width: Math.round(p.bounds.width),
      height: Math.round(p.bounds.height),
      thickness: 16
    });
  });

  // Формируем JSON
  const exportData = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    cabinet: {
      width: cab.width,
      height: cab.height,
      depth: cab.depth
    },
    panels: allPanels
  };

  const jsonString = JSON.stringify(exportData, null, 2);

  // Сохраняем файл через скачивание
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `cabinet_spec_${Date.now()}.json`;
  link.click();
  URL.revokeObjectURL(url);

  console.log('✓ JSON экспортирован:', allPanels.length, 'панелей');
  
  return exportData;
}

// Делаем функцию глобальной
window.exportPanelsToJSON = exportPanelsToJSON;
