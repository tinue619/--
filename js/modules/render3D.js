// ========== 3D ВИЗУАЛИЗАЦИЯ ==========

import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { Viewer3D } from '../Viewer3D.js';
import { handleDrawerClick } from './drawerAnimation.js';

/**
 * Инициализация 3D viewer
 */
export function initViewer3D(app) {
  app.viewer3D = new Viewer3D(app);
  renderAll3D(app);
  
  // Подключаем обработчик кликов по 3D сцене
  if (app.viewer3D && app.viewer3D.renderer) {
    app.viewer3D.renderer.domElement.addEventListener('click', (event) => {
      handleDrawerClick(app, event);
    });
  }
}

/**
 * Полная перерисовка всех 3D объектов
 */
export function renderAll3D(app) {
  if (!app.viewer3D) return;
  
  for (let panel of app.panels.values()) {
    updateMesh(app, panel);
  }
  
  // Отрисовываем ящики
  for (let drawer of app.drawers.values()) {
    updateDrawerMeshes(app, drawer);
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
    if (params.width !== geometry.width || params.height !== geometry.height || params.depth !== geometry.depth) {
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

/**
 * Обновление 3D meshes для ящика
 */
export function updateDrawerMeshes(app, drawer) {
  if (!app.viewer3D || !drawer.parts) return;
  
  const parts = ['front', 'leftSide', 'rightSide', 'back', 'bottom'];
  
  parts.forEach(partName => {
    const part = drawer.parts[partName];
    const meshId = `${drawer.id}-${partName}`;
    
    let mesh = app.mesh3D.get(meshId);
    
    if (!mesh) {
      // Создаем новый mesh
      const geom = new THREE.BoxGeometry(part.width, part.height, part.depth);
      
      // Материал в зависимости от части
      let material;
      if (partName === 'front') {
        material = new THREE.MeshPhongMaterial({ 
          color: CONFIG.COLORS.DRAWER_FRONT,
          shininess: 30 
        });
      } else {
        material = new THREE.MeshPhongMaterial({ 
          color: CONFIG.COLORS.DRAWER_SIDE,
          shininess: 10
        });
      }
      
      mesh = new THREE.Mesh(geom, material);
      app.viewer3D.addEdgesToMesh(mesh);
      app.viewer3D.dynamicGroup.add(mesh);
      app.mesh3D.set(meshId, mesh);
    } else {
      // Обновляем геометрию если изменились размеры
      const params = mesh.geometry.parameters;
      if (params.width !== part.width || params.height !== part.height || params.depth !== part.depth) {
        const oldEdges = mesh.children.find(child => child.type === 'LineSegments');
        if (oldEdges) {
          mesh.remove(oldEdges);
          oldEdges.geometry.dispose();
        }
        
        mesh.geometry.dispose();
        mesh.geometry = new THREE.BoxGeometry(part.width, part.height, part.depth);
        app.viewer3D.addEdgesToMesh(mesh);
      }
    }
    
    // Базовая позиция в 3D пространстве (центрированное на 0,0,0)
    let posZ = part.position.z - app.cabinet.depth / 2;
    
    // Если ящик выдвинут - добавляем смещение
    if (drawer.isOpen) {
      posZ += drawer.boxLength * 0.7;
    }
    
    mesh.position.set(
      part.position.x - app.cabinet.width / 2,
      part.position.y,
      posZ
    );
  });
}

/**
 * Удаление 3D meshes ящика
 */
export function removeDrawerMeshes(app, drawer) {
  if (!app.viewer3D) return;
  
  const parts = ['front', 'leftSide', 'rightSide', 'back', 'bottom'];
  
  parts.forEach(partName => {
    const meshId = `${drawer.id}-${partName}`;
    const mesh = app.mesh3D.get(meshId);
    
    if (mesh) {
      app.viewer3D.dynamicGroup.remove(mesh);
      mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      app.mesh3D.delete(meshId);
    }
  });
}
