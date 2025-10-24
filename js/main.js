import { App } from './App.js';

// ========== ЗАПУСК ==========
const app = new App();
app.init();

// Экспортируем для доступа из консоли браузера (для отладки)
window.cabinetApp = app;
