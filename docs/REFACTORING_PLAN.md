# План рефакторинга App.js (1887 строк → ~400 строк)

## 📋 Текущая структура App.js

**Основной класс:** App (1887 строк)
- Constructor + вспомогательные методы: ~200 строк
- Инициализация и UI: ~150 строк  
- Обработка взаимодействия: ~200 строк
- Работа с панелями: ~400 строк
- Перемещение (moveSide, moveHorizontalSide): ~300 строк
- Удаление и операции: ~150 строк
- История (undo/redo): ~200 строк
- Сохранение/загрузка: ~150 строк
- Ящики: ~100 строк
- Статистика: ~37 строк

---

## 🎯 Целевая структура

### Файл App.js (остаётся ~400 строк)
**Что оставляем:**
- Constructor (state initialization)
- init()
- updateCalc()
- calculatePanelRank()
- Обёртки для модулей (простые вызовы)
- window.app = this

---

## 📦 Новые модули

### 1. **modules/uiManager.js** (~150 строк) ✅ СОЗДАН
**Ответственность:** Управление UI элементами

**Методы:**
- setupEvents(app)
- setMode(app, mode)
- updateStatus(app, temp)
- switchTab(app, tab)
- updateStats(app)
- updateCabinetInfo(app)

---

### 2. **modules/interactions.js** (~350 строк) ⏳ СЛЕДУЮЩИЙ
**Ответственность:** Обработка всех пользовательских взаимодействий с canvas

**Методы:**
- updateCanvas(app)
- getCoords(app, e)
- handlePointer(app, e)
- startInteraction(app, coords)
- updateInteraction(app, coords)
- endInteraction(app, coords)
- findPanelAt(app, coords)

---

### 3. **modules/stateManager.js** (~200 строк)
**Ответственность:** Сохранение/загрузка состояния

**Методы:**
- serializeConnections(app, connections)
- deserializeConnections(app, connectionsData)
- scheduleSave(app)
- saveToStorage(app)
- loadState(app)
- showSaved(app)

---

### 4. **modules/historyManager.js** (~250 строк)
**Ответственность:** Управление историей undo/redo

**Методы:**
- saveHistory(app)
- undo(app)
- redo(app)
- restoreState(app, state)
- updateHistoryButtons(app)

---

### 5. **modules/drawerOperations.js** (~150 строк)
**Ответственность:** Работа с ящиками

**Методы:**
- addDrawer(app, coords)
- createDrawerStack(app, baseConnections, count)

---

### 6. **modules/panelOperations.js** (~500 строк)
**Ответственность:** Добавление, перемещение, удаление панелей

**Методы:**
- hasDrawerInArea(app, isHorizontal, mainPos, startCross, endCross)
- addPanel(app, type, mainPos, crossPos)
- getPanelCoord(app, panel, axis)
- getDrawerLimitsForPanel(app, panel)
- movePanel(app, panel, coords)
- moveSide(app, side, newX)
- moveHorizontalSide(app, side, newY)
- updateConnectedPanels(app, movedPanel)
- deletePanel(app, panel)
- recalculatePanelBounds(app, panel)
- clearAll(app)
- mirrorContent(app)

---

## 🔧 Порядок действий

### ✅ Шаг 1: uiManager.js - ЗАВЕРШЁН
- [x] Создан модуль
- [ ] Интегрирован в App.js
- [ ] Протестирован

### ⏳ Шаг 2: interactions.js - СЛЕДУЮЩИЙ
### 🔜 Шаг 3: stateManager.js
### 🔜 Шаг 4: historyManager.js
### 🔜 Шаг 5: drawerOperations.js
### 🔜 Шаг 6: panelOperations.js

---

## 📝 Шаблон модуля

```javascript
// js/modules/exampleModule.js

// Импорты (если нужны)
import { render2D } from './render2D.js';
import { CONFIG } from '../config.js';

/**
 * Описание функции
 * @param {App} app - Экземпляр приложения
 * @param {*} param - Другие параметры
 */
export function exampleFunction(app, param) {
  // Заменить все this. на app.
  app.panels.forEach(panel => {
    // код
  });
}
```

---

## 🎯 Итоговый результат

**До:** App.js = 1887 строк

**После:**
- App.js = ~400 строк
- uiManager.js = ~150 строк
- interactions.js = ~350 строк
- stateManager.js = ~200 строк
- historyManager.js = ~250 строк
- drawerOperations.js = ~150 строк
- panelOperations.js = ~500 строк

**Всего:** ~2000 строк (небольшое увеличение из-за экспортов/импортов)
