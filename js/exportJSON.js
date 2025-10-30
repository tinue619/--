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
      nameEn: 'Left_Side',
      type: 'left-side',
      rank: 0,  // Базовая панель
      x: 0, 
      y: 0,
      z: 3,
      width: 16, 
      height: cab.height,
      depth: cab.depth - 3,
      thickness: 16
    },
    { 
      name: 'Правая боковина',
      nameEn: 'Right_Side',
      type: 'right-side',
      rank: 0,  // Базовая панель
      x: cab.width - 16, 
      y: 0,
      z: 3,
      width: 16, 
      height: cab.height,
      depth: cab.depth - 3,
      thickness: 16
    },
    { 
      name: 'Дно',
      nameEn: 'Bottom',
      type: 'bottom',
      rank: 1,  // Крепится к боковинам
      x: 16, 
      y: cab.base - 16,
      z: 3,
      width: cab.width - 32, 
      height: 16,
      depth: cab.depth - 3 - 1,  // (cabDepth - 3) - rank = 597 - 1 = 596
      thickness: 16
    },
    { 
      name: 'Крыша',
      nameEn: 'Top',
      type: 'top',
      rank: 1,  // Крепится к боковинам
      x: 16, 
      y: cab.height - 16,
      z: 3,
      width: cab.width - 32, 
      height: 16,
      depth: cab.depth - 3 - 1,  // (cabDepth - 3) - rank = 597 - 1 = 596
      thickness: 16
    },
    {
      name: 'Задняя стенка ХДФ',
      nameEn: 'Back_HDF',
      type: 'back-hdf',
      rank: -1,  // ХДФ - самая задняя
      x: 1,
      y: cab.base + 1,
      z: 0,
      width: cab.width - 2,
      height: cab.height - cab.base - 2,
      depth: 3,
      thickness: 3
    },
    {
      name: 'Передняя планка цоколя',
      nameEn: 'Front_Plinth',
      type: 'front-plinth',
      rank: 1,  // Крепится к боковинам
      x: 16,
      y: 0,
      z: cab.depth - 16 - 1,
      width: cab.width - 32,
      height: cab.base - 16,
      depth: 16,  // Цоколь всегда 16мм глубиной
      thickness: 16
    },
    {
      name: 'Задняя планка цоколя',
      nameEn: 'Back_Plinth',
      type: 'back-plinth',
      rank: 1,  // Крепится к боковинам
      x: 16,
      y: 0,
      z: 0 + 30 + 16,
      width: cab.width - 32,
      height: cab.base - 16,
      depth: 16,  // Цоколь всегда 16мм глубиной
      thickness: 16
    }
  ];

  // Добавляем пользовательские панели
  let shelfIndex = 1;
  let dividerIndex = 1;

  Array.from(app.panels.values()).forEach(p => {
    let name = p.type;
    let panelData = {};
    
    // Вычисляем rank для каждой панели
    const rank = app.calculatePanelRank(p);
    const depth = (cab.depth - 3) - rank;  // Глубина с учётом утопления
    
    if (p.type === 'shelf') {
      name = `Полка ${shelfIndex++}`;
      // Горизонтальная панель
      panelData = {
        name: name,
        nameEn: `Shelf_${shelfIndex - 1}`,
        type: p.type,
        rank: rank,
        x: Math.round(p.bounds.startX),
        y: Math.round(p.position.y),
        z: 3,
        width: Math.round(p.bounds.endX - p.bounds.startX),
        height: 16,
        depth: depth,
        thickness: 16
      };
    } else if (p.type === 'divider') {
      name = `Разделитель ${dividerIndex++}`;
      // Вертикальная панель
      panelData = {
        name: name,
        nameEn: `Divider_${dividerIndex - 1}`,
        type: p.type,
        rank: rank,
        x: Math.round(p.position.x),
        y: Math.round(p.bounds.startY),
        z: 3,
        width: 16,
        height: Math.round(p.bounds.endY - p.bounds.startY),
        depth: depth,
        thickness: 16
      };
    }

    allPanels.push(panelData);
    
    // Добавляем рёбра жёсткости для полок
    if (p.type === 'shelf' && p.ribs && p.ribs.length > 0) {
      p.ribs.forEach((rib, index) => {
        allPanels.push({
          name: `Ребро для ${name} #${index + 1}`,
          nameEn: `Rib_${panelData.nameEn}_${index + 1}`,
          type: 'rib',
          rank: rank,  // Рёбра наследуют rank полки
          x: Math.round(rib.startX),
          y: Math.round(p.position.y) - 100,
          z: 3,
          width: Math.round(rib.endX - rib.startX),
          height: 100,
          depth: 16,
          thickness: 16
        });
      });
    }
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
