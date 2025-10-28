# Cabinet Editor - Структура приложения

## 📁 Архитектура проекта

```
cabinet-editor/
├── js/
│   ├── App.js           (~865 строк) - CORE логика
│   ├── Panel.js         (~120 строк) - Класс панели
│   ├── Viewer3D.js      (~180 строк) - 3D визуализация
│   ├── config.js        (~35 строк)  - Конфигурация
│   ├── main.js          (~10 строк)  - Точка входа
│   └── modules/         - Вспомогательные модули
│       ├── historyLogging.js  (~235 строк)
│       ├── historyDebug.js    (~130 строк)
│       ├── render2D.js        (~85 строк)
│       └── render3D.js        (~95 строк)
├── css/
│   └── styles.css
├── index.html
└── docs/
```

---

## 🎯 App.js (CORE - 865 строк)

### Конструктор и утилиты
- `constructor()` - Инициализация состояния
- `updateCalc()` - Пересчёт размеров

### Инициализация
- `init()` - Запуск приложения
- `setupEvents()` - Привязка событий

### Управление режимами
- `setMode(mode)` - Смена режима работы
- `updateStatus(temp)` - Обновление статуса
- `switchTab(tab)` - Переключение вкладок

### Canvas утилиты
- `updateCanvas()` - Обновление canvas
- `getCoords(e)` - Получение координат

### Обработка событий
- `handlePointer(e)` - Обработка pointer событий
- `startInteraction(coords)` - Начало взаимодействия
- `updateInteraction(coords)` - Обновление взаимодействия
- `endInteraction(coords)` - Завершение взаимодействия
- `findPanelAt(coords)` - Поиск панели по координатам

### Операции с панелями
- `addPanel(type, mainPos, crossPos)` - Добавление панели
- `movePanel(panel, coords)` - Перемещение панели
- `moveSide(side, newX)` - Перемещение боковины
- `updateConnectedPanels(movedPanel)` - Обновление связей
- `deletePanel(panel)` - Удаление панели
- `recalculatePanelBounds(panel)` - Пересчёт границ
- `clearAll()` - Очистка всего

### Сериализация
- `serializeConnections(connections)` - Сериализация связей
- `deserializeConnections(connectionsData)` - Десериализация связей

### История Undo/Redo
- `saveHistory()` - Сохранение в историю
- `undo()` - Отмена действия
- `redo()` - Повтор действия
- `restoreState(state)` - Восстановление состояния
- `updateHistoryButtons()` - Обновление кнопок

### Отладка (обёртки)
- `debugHistory()` - Отладка истории
- `debugCurrentState()` - Отладка текущего состояния
- `compareStates(index1, index2)` - Сравнение состояний

### Persistence
- `scheduleSave()` - Планирование сохранения
- `saveToStorage()` - Сохранение в localStorage
- `loadState()` - Загрузка состояния
- `showSaved()` - Индикатор сохранения
- `updateStats()` - Обновление статистики
- `updateCabinetInfo()` - Обновление инфо шкафа

---

## 📦 Модули (545 строк)

### modules/historyLogging.js (~235 строк)
**UI логирование истории изменений**

#### Экспорты:
- `setupHistoryDrag()` - Drag & drop панели истории
- `toggleHistoryCollapse()` - Сворачивание панели
- `copyHistoryLogs(app)` - Копирование логов в буфер
- `logToHistory(action, details)` - Добавление записи в лог
- `clearHistoryLog()` - Очистка лога
- `compareStatesForLog(oldState, newState)` - Сравнение для лога

#### Использование:
```javascript
import { logToHistory, compareStatesForLog } from './modules/historyLogging.js';

// В App.js
const changes = compareStatesForLog(prevState, state);
if (changes.length > 0) {
  logToHistory('save', changes);
}
```

---

### modules/historyDebug.js (~130 строк)
**Отладка истории состояний**

#### Экспорты:
- `debugHistory(app)` - Отладка всей истории
- `debugCurrentState(app)` - Отладка текущего состояния
- `compareStates(app, index1, index2)` - Сравнение состояний

#### Использование:
```javascript
import { debugHistory, debugCurrentState, compareStates } from './modules/historyDebug.js';

// В консоли браузера
window.app.debugHistory()
window.app.debugCurrentState()
window.app.compareStates(0, 5)
```

---

### modules/render2D.js (~85 строк)
**2D отрисовка на canvas**

#### Экспорты:
- `render2D(app)` - Отрисовка 2D вида

#### Использование:
```javascript
import { render2D } from './modules/render2D.js';

// В App.js
this.updateCanvas();
render2D(this);
```

#### Что рисует:
- Фон кабинета
- Корпус (боковины, дно, крыша, цоколь)
- Панели (полки и разделители)
- Ребра жёсткости
- Подсветка активных элементов

---

### modules/render3D.js (~95 строк)
**3D визуализация (Three.js)**

#### Экспорты:
- `initViewer3D(app)` - Инициализация 3D viewer
- `renderAll3D(app)` - Полная перерисовка 3D
- `updateMesh(app, panel)` - Обновление mesh панели
- `removeMesh(app, panel)` - Удаление mesh панели

#### Использование:
```javascript
import { initViewer3D, renderAll3D, updateMesh, removeMesh } from './modules/render3D.js';

// Инициализация
initViewer3D(this);

// Обновление
renderAll3D(this);

// Работа с отдельной панелью
updateMesh(this, panel);
removeMesh(this, panel);
```

#### Что делает:
- Создаёт 3D mesh для панелей
- Обновляет позиции и размеры
- Управляет рёбрами жёсткости в 3D
- Удаляет mesh при удалении панелей

---

## 🔄 Потоки данных

### Добавление панели
```
User Click → addPanel() → Panel created → 
  → updateRibs() → 
  → saveHistory() → 
  → render2D() → 
  → renderAll3D() → 
  → updateStats()
```

### Перемещение панели
```
Pointer Down → startInteraction() → findPanelAt() →
Pointer Move → updateInteraction() → movePanel() →
  → updateConnectedPanels() → 
  → render2D() → 
  → renderAll3D()
Pointer Up → endInteraction() → saveHistory() → logToHistory()
```

### Undo/Redo
```
Undo Click → undo() → 
  → compareStatesForLog() → 
  → restoreState() → 
  → render2D() → 
  → renderAll3D() → 
  → logToHistory('undo')
```

---

## 📊 Статистика кода

| Файл | Строк | Описание |
|------|-------|----------|
| **App.js** | ~865 | Core логика |
| **Panel.js** | ~120 | Класс панели |
| **Viewer3D.js** | ~180 | 3D сцена |
| **config.js** | ~35 | Константы |
| **main.js** | ~10 | Entry point |
| **historyLogging.js** | ~235 | UI логирование |
| **historyDebug.js** | ~130 | Отладка истории |
| **render2D.js** | ~85 | 2D отрисовка |
| **render3D.js** | ~95 | 3D отрисовка |
| **ИТОГО** | ~1755 | Весь JS код |

### Декомпозиция:
- ✅ **Core (App.js)**: 865 строк (49%)
- ✅ **Модули**: 545 строк (31%)
- ✅ **Классы**: 300 строк (17%)
- ✅ **Прочее**: 45 строк (3%)

---

## 🎨 Архитектурные решения

### Почему модули?
1. **Разделение ответственности** - каждый модуль решает одну задачу
2. **Переиспользование** - функции можно использовать независимо
3. **Тестируемость** - легче писать unit-тесты
4. **Читаемость** - меньше кода в одном файле

### Почему App.js всё ещё большой?
App.js - это **оркестратор**:
- Управляет состоянием
- Координирует модули
- Обрабатывает события
- Содержит бизнес-логику

Дальнейшее разделение может усложнить понимание потока данных.

### Что можно вынести дальше?
При необходимости:
- **panelOperations.js** - addPanel, movePanel, deletePanel
- **sideOperations.js** - moveSide и связанная логика
- **persistence.js** - saveToStorage, loadState
- **canvasUtils.js** - updateCanvas, getCoords

---

## 🚀 Дальнейшее развитие

### Возможные улучшения:
1. **TypeScript** - типизация для надёжности
2. **Web Workers** - вычисления в фоне
3. **State Manager** - Redux/MobX для сложного состояния
4. **Testing** - Jest/Vitest unit-тесты
5. **Build Tool** - Vite/Webpack для оптимизации

### Рекомендации:
- Не усложнять без необходимости
- Модули добавлять по мере роста функциональности
- Сохранять баланс между модульностью и простотой

---

**Версия:** 3.3  
**Дата:** 28.10.2025  
**Автор:** Cabinet Editor Team
