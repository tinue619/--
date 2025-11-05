import { App } from './App.js';
import { updateDrawerMeshes } from './modules/render3D.js';

// ========== ЗАПУСК ==========
const app = new App();
app.init();

// Экспортируем для доступа из консоли браузера (для отладки)
window.cabinetApp = app;
window.updateDrawerMeshes = updateDrawerMeshes;
