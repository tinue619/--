// ========== 3D ВИЗУАЛИЗАЦИЯ ==========

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Viewer3D } from '../Viewer3D.js';

/**
 * Инициализация 3D viewer
 */
export function initViewer3D(app) {
  app.viewer3D = new Viewer3D(app);
  renderAll3D(app);
}

/**
 * Полная перерисовка всех 3D объектов
 */
export function renderAll3D(app) {
  if (!app.viewer3D) return;
  
  for (let panel of app.panels.values()) {
    updateMesh(app, panel);
  }
}

/**
 * Обновление 3D mesh для панели
 */
export function updateMesh(app, panel) {
  if (!app.viewer3D) return;
  
  let mesh = app.mesh3D.get(panel.id);
  const geometry = panel.getGeometry(app.cabinet.depth, app);  // Передаём app для расчёта rank
  
  if (!mesh) {
    const geom = new THREE.BoxGeometry(geometry.width, geometry.height, geometry.depth);
    mesh = new THREE.Mesh(geom, app.viewer3D.materials.dsp);
    app.viewer3D.addEdgesToMesh(mesh);  // Добавляем рёбра
    app.viewer3D.dynamicGroup.add(mesh);
    app.mesh3D.set(panel.id, mesh);
  } else {
    const params = mesh.geometry.parameters;
    if (params.width !== geometry.width || params.height !== geometry.height) {
      // Удаляем старые рёбра
      const oldEdges = mesh.children.find(child => child.type === 'LineSegments');
      if (oldEdges) {
        mesh.remove(oldEdges);
        oldEdges.geometry.dispose();
      }
      
      mesh.geometry.dispose();
      mesh.geometry = new THREE.BoxGeometry(geometry.width, geometry.height, geometry.depth);
      app.viewer3D.addEdgesToMesh(mesh);  // Добавляем новые рёбра
    }
  }
  
  mesh.position.copy(panel.get3DPosition(app.cabinet.width, app.cabinet.depth));
  
  // Обрабатываем ребра жесткости для полок
  if (panel.isHorizontal) {
    // Удаляем все старые ребра
    for (let i = 0; i < 10; i++) {  // Максимум 10 ребер на полку
      const ribId = `${panel.id}-rib-${i}`;
      const oldRib = app.mesh3D.get(ribId);
      if (oldRib) {
        app.viewer3D.dynamicGroup.remove(oldRib);
        oldRib.geometry.dispose();
        app.mesh3D.delete(ribId);
      }
    }
    
    // Создаем новые ребра
    panel.ribs.forEach((rib, index) => {
      const ribId = `${panel.id}-rib-${index}`;
      const ribWidth = rib.endX - rib.startX;
      
      // Ребро с меньшей глубиной, прижатое к задней стенке
      const ribGeom = new THREE.BoxGeometry(
        ribWidth,
        CONFIG.RIB.HEIGHT,
        CONFIG.RIB.DEPTH
      );
      const ribMesh = new THREE.Mesh(ribGeom, app.viewer3D.materials.rib);
      app.viewer3D.addEdgesToMesh(ribMesh);  // Добавляем рёбра
      
      // Позиционируем ребро под полкой в правильном пролете
      // Y: на 100мм ниже полки
      // Z: z = 3 (в экспорте), для 3D: -depth/2 + 3 + CONFIG.RIB.DEPTH/2
      ribMesh.position.set(
        (rib.startX + rib.endX) / 2 - app.cabinet.width / 2,
        panel.position.y - CONFIG.RIB.HEIGHT/2,
        -app.cabinet.depth/2 + CONFIG.HDF + CONFIG.RIB.DEPTH/2
      );
      
      app.viewer3D.dynamicGroup.add(ribMesh);
      app.mesh3D.set(ribId, ribMesh);
    });
  }
}

/**
 * Удаление 3D mesh панели
 */
export function removeMesh(app, panel) {
  if (!app.viewer3D) return;
  
  // Удаляем основную панель
  const mesh = app.mesh3D.get(panel.id);
  if (mesh) {
    app.viewer3D.dynamicGroup.remove(mesh);
    mesh.geometry.dispose();
    app.mesh3D.delete(panel.id);
  }
  
  // Удаляем ребра, если есть
  if (panel.isHorizontal) {
    for (let i = 0; i < 10; i++) {  // Максимум 10 ребер на полку
      const ribId = `${panel.id}-rib-${i}`;
      const ribMesh = app.mesh3D.get(ribId);
      if (ribMesh) {
        app.viewer3D.dynamicGroup.remove(ribMesh);
        ribMesh.geometry.dispose();
        app.mesh3D.delete(ribId);
      }
    }
  }
}
