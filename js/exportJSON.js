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
      y: cab.base - 15,  // Опущена на 16мм (cab.base + 1 - 16 = cab.base - 15)
      z: 0,
      width: cab.width - 2,
      height: cab.height - cab.base + 14,  // +16мм чтобы зайти под крышу (-2 + 16 = +14)
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
      z: cab.depth - 16 - 2,  // Утоплен на 2мм от передней грани
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
  let drawerIndex = 1;

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

  // Добавляем ящики
  Array.from(app.drawers.values()).forEach(drawer => {
    if (!drawer.parts) return;

    const drawerName = `Ящик ${drawerIndex}`;
    const drawerNameEn = `Drawer_${drawerIndex}`;
    drawerIndex++;

    // Фасад
    const front = drawer.parts.front;
    allPanels.push({
      name: `${drawerName} - Фасад`,
      nameEn: `${drawerNameEn}_Front`,
      type: 'drawer-front',
      x: Math.round(front.bounds.x1),
      y: Math.round(front.bounds.y1),
      z: Math.round(front.position.z - front.depth / 2),
      width: Math.round(front.width),
      height: Math.round(front.height),
      depth: Math.round(front.depth),
      thickness: 16
    });

    // Левая боковина
    const leftSide = drawer.parts.leftSide;
    allPanels.push({
      name: `${drawerName} - Левая боковина`,
      nameEn: `${drawerNameEn}_Left_Side`,
      type: 'drawer-side',
      x: Math.round(leftSide.bounds.x),
      y: Math.round(leftSide.bounds.y1),
      z: Math.round(leftSide.bounds.z1),
      width: Math.round(leftSide.width),
      height: Math.round(leftSide.height),
      depth: Math.round(leftSide.depth),
      thickness: 16
    });

    // Правая боковина
    const rightSide = drawer.parts.rightSide;
    allPanels.push({
      name: `${drawerName} - Правая боковина`,
      nameEn: `${drawerNameEn}_Right_Side`,
      type: 'drawer-side',
      x: Math.round(rightSide.bounds.x),
      y: Math.round(rightSide.bounds.y1),
      z: Math.round(rightSide.bounds.z1),
      width: Math.round(rightSide.width),
      height: Math.round(rightSide.height),
      depth: Math.round(rightSide.depth),
      thickness: 16
    });

    // Задняя стенка
    const back = drawer.parts.back;
    allPanels.push({
      name: `${drawerName} - Задняя стенка`,
      nameEn: `${drawerNameEn}_Back`,
      type: 'drawer-back',
      x: Math.round(back.bounds.x1),
      y: Math.round(back.bounds.y1),
      z: Math.round(back.bounds.z),
      width: Math.round(back.width),
      height: Math.round(back.height),
      depth: Math.round(back.depth),
      thickness: 16
    });

    // Дно
    const bottom = drawer.parts.bottom;
    allPanels.push({
      name: `${drawerName} - Дно`,
      nameEn: `${drawerNameEn}_Bottom`,
      type: 'drawer-bottom',
      x: Math.round(bottom.bounds.x1),
      y: Math.round(bottom.bounds.y),
      z: Math.round(bottom.bounds.z1),
      width: Math.round(bottom.width),
      height: Math.round(bottom.height),
      depth: Math.round(bottom.depth),
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
