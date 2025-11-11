import { App } from './App.js';
import { updateDrawerMeshes } from './modules/render3D.js';
import { render2D } from './modules/render2D.js';

// ========== ЗАПУСК ==========
const app = new App();
app.init();

// Экспортируем для доступа из консоли браузера (для отладки)
window.cabinetApp = app;
window.updateDrawerMeshes = updateDrawerMeshes;
window.render2D = render2D;
