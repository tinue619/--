import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CONFIG, CALC } from './config.js';

// ========== 3D VIEWER CLASS ==========
export class Viewer3D {
  constructor(app) {
    this.app = app;
    this.container = document.getElementById('three-container');
    
    if (!this.container || this.container.clientWidth === 0) {
      setTimeout(() => this.init(), 100);
      return;
    }
    
    this.init();
  }
  
  init() {
    // Сцена
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe8eaf6);
    this.scene.fog = new THREE.Fog(0xe8eaf6, 100, 1);
    
    // Камера
    this.camera = new THREE.PerspectiveCamera(
      45,
      this.container.clientWidth / this.container.clientHeight,
      1,
      10000
    );
    this.camera.position.set(1500, 1000, 1500);
    
    // Рендерер
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.container.appendChild(this.renderer.domElement);
    
    // Контролы
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.target.set(0, this.app.cabinet.height / 2, 0);
    
    // Материалы
    this.materials = {
      dsp: new THREE.MeshStandardMaterial({ 
        color: CONFIG.COLORS.DSP,
        roughness: 0.8,
        metalness: 0.2
      }),
      hdf: new THREE.MeshStandardMaterial({ 
        color: CONFIG.COLORS.HDF,
        roughness: 0.9
      }),
      plinth: new THREE.MeshStandardMaterial({ 
        color: CONFIG.COLORS.PLINTH,
        roughness: 0.9
      }),
      rib: new THREE.MeshStandardMaterial({ 
        color: CONFIG.COLORS.RIB,
        roughness: 0.8,
        metalness: 0.2
      })
    };
    
    // Освещение
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(500, 1000, 500);
    directionalLight.castShadow = true;
    directionalLight.shadow.camera.near = 100;
    directionalLight.shadow.camera.far = 5000;
    directionalLight.shadow.camera.left = -2000;
    directionalLight.shadow.camera.right = 2000;
    directionalLight.shadow.camera.top = 2000;
    directionalLight.shadow.camera.bottom = -2000;
    this.scene.add(directionalLight);
    
    // Сетка
    const grid = new THREE.GridHelper(3000, 30, 0x888888, 0xcccccc);
    grid.position.y = -1;
    this.scene.add(grid);
    
    // Статический кабинет
    this.createCabinet();
    
    // Группа для динамических элементов
    this.dynamicGroup = new THREE.Group();
    this.scene.add(this.dynamicGroup);
    
    // Анимация
    this.animate();
    
    // Resize
    window.addEventListener('resize', () => this.resize());
  }
  
  createCabinet() {
    // Удаляем старый корпус, если есть
    if (this.cabinetGroup) {
      this.scene.remove(this.cabinetGroup);
      // Очищаем геометрию и материалы
      this.cabinetGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
      });
    }
    
    this.cabinetGroup = new THREE.Group();
    const cabinet = this.cabinetGroup;
    
    // Используем динамические размеры из app.cabinet
    const width = this.app.cabinet.width;
    const height = this.app.cabinet.height;
    const depth = this.app.cabinet.depth;
    const base = this.app.cabinet.base;
    const innerWidth = width - CONFIG.DSP * 2;
    const innerDepth = depth - CONFIG.HDF;
    
    // Боковины
    const sideGeom = new THREE.BoxGeometry(CONFIG.DSP, height, innerDepth);
    
    const leftSide = new THREE.Mesh(sideGeom, this.materials.dsp);
    leftSide.position.set(-width/2 + CONFIG.DSP/2, height/2, CONFIG.HDF/2);
    leftSide.castShadow = true;
    leftSide.receiveShadow = true;
    cabinet.add(leftSide);
    
    const rightSide = new THREE.Mesh(sideGeom, this.materials.dsp);
    rightSide.position.set(width/2 - CONFIG.DSP/2, height/2, CONFIG.HDF/2);
    rightSide.castShadow = true;
    rightSide.receiveShadow = true;
    cabinet.add(rightSide);
    
    // Дно
    const bottomGeom = new THREE.BoxGeometry(innerWidth, CONFIG.DSP, innerDepth);
    const bottom = new THREE.Mesh(bottomGeom, this.materials.dsp);
    bottom.position.set(0, base - CONFIG.DSP/2, CONFIG.HDF/2);
    bottom.castShadow = true;
    bottom.receiveShadow = true;
    cabinet.add(bottom);
    
    // Крыша
    const top = new THREE.Mesh(bottomGeom, this.materials.dsp);
    top.position.set(0, height - CONFIG.DSP/2, CONFIG.HDF/2);
    top.castShadow = true;
    top.receiveShadow = true;
    cabinet.add(top);
    
    // Цоколь - две планки (передняя и задняя)
    const plinthHeight = base - CONFIG.DSP; // Высота цоколя
    const plinthThickness = CONFIG.DSP; // Толщина планки цоколя
    
    // Передняя планка цоколя
    // z = depth - 16 - 1 (в экспорте)
    // Для 3D: -depth/2 + (depth - 16 - 1) + plinthThickness/2
    const frontPlinthGeom = new THREE.BoxGeometry(
      innerWidth,
      plinthHeight,
      plinthThickness
    );
    const frontPlinth = new THREE.Mesh(frontPlinthGeom, this.materials.plinth);
    frontPlinth.position.set(
      0, 
      plinthHeight/2, 
      -depth/2 + (depth - CONFIG.DSP - 1) + plinthThickness/2
    );
    frontPlinth.castShadow = true;
    frontPlinth.receiveShadow = true;
    cabinet.add(frontPlinth);
    
    // Задняя планка цоколя
    // z = 0 + 30 + 16 = 46 (в экспорте)
    // Для 3D: -depth/2 + 46 + plinthThickness/2
    const backPlinthGeom = new THREE.BoxGeometry(
      innerWidth,
      plinthHeight,
      plinthThickness
    );
    const backPlinth = new THREE.Mesh(backPlinthGeom, this.materials.plinth);
    backPlinth.position.set(
      0, 
      plinthHeight/2, 
      -depth/2 + 30 + CONFIG.DSP + plinthThickness/2
    );
    backPlinth.castShadow = true;
    backPlinth.receiveShadow = true;
    cabinet.add(backPlinth);
    
    // Задняя стенка ХДФ
    const backGeom = new THREE.BoxGeometry(
      width - 2,
      height - base - 2,
      CONFIG.HDF
    );
    const back = new THREE.Mesh(backGeom, this.materials.hdf);
    back.position.set(0, base + (height - base) / 2 + 1, -depth/2 + CONFIG.HDF/2);
    cabinet.add(back);
    
    this.scene.add(cabinet);
  }
  
  // Метод для перестроения корпуса при изменении размеров
  rebuildCabinet() {
    this.createCabinet();
    // Обновляем точку фокуса камеры
    this.controls.target.set(0, this.app.cabinet.height / 2, 0);
  }
  
  animate() {
    requestAnimationFrame(() => this.animate());
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
  
  resize() {
    if (!this.container || this.container.clientWidth === 0) return;
    
    this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
  }
}
