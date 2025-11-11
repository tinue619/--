// ========== DRAWER ANIMATION ==========
// Анимация выдвижения ящиков в 3D виде

/**
 * Анимировать выдвижение/задвижение ящика
 * @param {App} app - Экземпляр приложения
 * @param {Drawer} drawer - Ящик для анимации
 * @param {number} duration - Длительность анимации в мс (по умолчанию 400мс)
 */
export function animateDrawer(app, drawer, duration = 400) {
  if (!drawer.boxLength || !drawer.parts) return;
  
  // Переключаем состояние
  drawer.isOpen = !drawer.isOpen;
  
  // Расстояние выдвижения - 70% длины короба
  const slideDistance = drawer.boxLength * 0.7;
  const targetOffset = drawer.isOpen ? slideDistance : 0;
  
  // Части ящика для анимации
  const partNames = ['front', 'leftSide', 'rightSide', 'back', 'bottom'];
  
  // Сохраняем начальные позиции
  const startPositions = {};
  partNames.forEach(partName => {
    const mesh = app.mesh3D.get(`${drawer.id}-${partName}`);
    if (mesh) {
      startPositions[partName] = mesh.position.z;
    }
  });
  
  const startTime = Date.now();
  
  function animate() {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function - ease-in-out cubic
    const eased = progress < 0.5 
      ? 4 * progress * progress * progress 
      : 1 - Math.pow(-2 * progress + 2, 3) / 2;
    
    // Обновляем позицию каждой части
    partNames.forEach(partName => {
      const mesh = app.mesh3D.get(`${drawer.id}-${partName}`);
      if (mesh && startPositions[partName] !== undefined) {
        const startZ = startPositions[partName];
        const deltaZ = drawer.isOpen ? targetOffset : -slideDistance;
        mesh.position.z = startZ + deltaZ * eased;
      }
    });
    
    // Продолжаем анимацию или завершаем
    if (progress < 1) {
      requestAnimationFrame(animate);
    }
  }
  
  animate();
}

/**
 * Обработать клик по 3D сцене для выдвижения ящика
 * @param {App} app - Экземпляр приложения
 * @param {MouseEvent} event - Событие клика
 */
export function handleDrawerClick(app, event) {
  if (!app.viewer3D || !app.viewer3D.raycaster) return;
  
  const canvas = app.viewer3D.renderer.domElement;
  const rect = canvas.getBoundingClientRect();
  
  // Нормализованные координаты мыши (-1 до +1)
  const mouse = {
    x: ((event.clientX - rect.left) / rect.width) * 2 - 1,
    y: -((event.clientY - rect.top) / rect.height) * 2 + 1
  };
  
  // Настраиваем raycaster
  app.viewer3D.raycaster.setFromCamera(mouse, app.viewer3D.camera);
  
  // Находим все пересечения - включаем ВСЁ в сцене (корпус + панели + ящики)
  const intersects = app.viewer3D.raycaster.intersectObjects(
    app.viewer3D.scene.children,
    true  // recursive - проверяем вложенные объекты
  );
  
  if (intersects.length === 0) return;
  
  // Получаем кликнутый меш
  const clickedMesh = intersects[0].object;
  
  // Определяем, к какому ящику относится меш
  for (let drawer of app.drawers.values()) {
    const partNames = ['front', 'leftSide', 'rightSide', 'back', 'bottom'];
    
    for (let partName of partNames) {
      const mesh = app.mesh3D.get(`${drawer.id}-${partName}`);
      if (mesh === clickedMesh) {
        // Нашли ящик - анимируем его
        animateDrawer(app, drawer);
        return;
      }
    }
  }
}
