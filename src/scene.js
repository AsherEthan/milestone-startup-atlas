import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const THEMES = {
  light: {
    background: 0xeef2e9, floor: 0xeef2e9, grid: 0xd9e0d2,
    terrain: 0xe0e7d7, selected: 0xc0d4ab, contour: 0xb9c8ac, selectedContour: 0x829e70,
    accent: 0x218b64, flag: 0x879b7b, pad: 0xffffff, pole: 0x668171,
    rock: 0xbccbad, dot: 0x718977, traveler: 0xfffffb, hemisphere: 2.6, sunlight: 3.1,
  },
  dark: {
    background: 0x15241f, floor: 0x15241f, grid: 0x304638,
    terrain: 0x2a4538, selected: 0x426c50, contour: 0x4b6652, selectedContour: 0x86a774,
    accent: 0x2dab7c, flag: 0x78947b, pad: 0x8da58c, pole: 0x9cb79a,
    rock: 0x547449, dot: 0x78947b, traveler: 0xd3ebd7, hemisphere: 1.7, sunlight: 2.0,
  },
};
const POSITIONS = [
  [-9.6, 1.0, 2.0], [-4.8, 1.65, -1.5], [0, 2.3, 1.35],
  [4.8, 3.0, -1.5], [9.6, 3.7, 1.1],
];

function islandGeometry(radius, height, seed) {
  const segments = 72;
  const levels = 14;
  const vertices = [];
  const indices = [];
  const edge = (angle) => 1 + 0.065 * Math.sin(angle * 3 + seed) + 0.035 * Math.cos(angle * 5 + seed * 2);
  for (let j = 0; j <= levels; j++) {
    const t = j / levels;
    const r = radius * (1 - 0.31 * t - 0.1 * Math.sin(t * Math.PI));
    for (let i = 0; i <= segments; i++) {
      const angle = i / segments * Math.PI * 2;
      vertices.push(Math.cos(angle) * r * edge(angle), t * height, Math.sin(angle) * r * edge(angle));
      if (j < levels && i < segments) {
        const a = j * (segments + 1) + i;
        const b = a + segments + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const center = vertices.length / 3;
  vertices.push(0, height, 0);
  for (let i = 0; i < segments; i++) {
    const a = levels * (segments + 1) + i;
    indices.push(center, a + 1, a);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, edge };
}

export class StartupScene {
  constructor(container, labels, onSelect, onHover) {
    this.container = container;
    this.labels = labels;
    this.onSelect = onSelect;
    this.onHover = onHover;
    this.selected = 0;
    this.hovered = -1;
    this.palette = THEMES.light;
    this.themedMaterials = [];
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.onMotionChange = (event) => { this.reducedMotion = event.matches; };
    this.motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
    this.motionQuery.addEventListener('change', this.onMotionChange);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xf1f3ed);
    this.scene.fog = new THREE.Fog(0xf1f3ed, 40, 85);
    this.camera = new THREE.OrthographicCamera(-16, 16, 10, -10, 0.1, 140);
    this.homePosition = new THREE.Vector3(11, 19, 27);
    this.homeTarget = new THREE.Vector3(0, 1.1, 0);
    this.camera.position.copy(this.homePosition);
    this.camera.lookAt(this.homeTarget);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.prepend(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    // Keep vertical page scrolling and browser pinch zoom available on touch screens.
    this.renderer.domElement.style.touchAction = 'pan-y pinch-zoom';
    this.controls.target.copy(this.homeTarget);
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.dampingFactor = 0.08;
    this.controls.enablePan = false;
    this.controls.minZoom = 0.7;
    this.controls.maxZoom = 1.65;
    this.controls.minPolarAngle = Math.PI / 8;
    this.controls.maxPolarAngle = Math.PI / 2.7;
    this.controls.minAzimuthAngle = -0.4;
    this.controls.maxAzimuthAngle = 0.8;
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.pickables = [];
    this.islands = [];
    this.build();
    this.setTheme(document.documentElement.dataset.theme);
    this.bindEvents();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    this.frame = requestAnimationFrame(this.animate);
  }

  themedMaterial(material, role) {
    this.themedMaterials.push({ material, role });
    return material;
  }

  build() {
    this.hemisphere = new THREE.HemisphereLight(0xffffff, 0xd2d8c8, 2.6);
    this.scene.add(this.hemisphere);
    const sun = new THREE.DirectionalLight(0xffffff, 3.1);
    this.sun = sun;
    sun.position.set(-10, 23, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 17, bottom: -17, near: 1, far: 65 });
    sun.shadow.normalBias = 0.055;
    sun.shadow.bias = -0.0002;
    sun.shadow.radius = 5;
    this.scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), this.themedMaterial(new THREE.MeshStandardMaterial({ color: this.palette.floor, roughness: 1 }), 'floor'));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.13;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const grid = new THREE.GridHelper(100, 100, 0xd9dfd2, 0xdfe5d9);
    this.grid = grid;
    grid.material.vertexColors = false;
    grid.material.transparent = true;
    grid.material.opacity = 0.46;
    grid.position.y = -0.11;
    this.scene.add(grid);

    POSITIONS.forEach(([x, h, z], index) => {
      const group = new THREE.Group();
      group.position.set(x, 0, z);
      const { geometry, edge } = islandGeometry(2.45, h, index * 1.7);
      const material = new THREE.MeshStandardMaterial({ color: 0xe5e9db, roughness: 0.95 });
      const terrain = new THREE.Mesh(geometry, material);
      terrain.castShadow = true;
      terrain.receiveShadow = true;
      terrain.userData.index = index;
      group.add(terrain);
      this.pickables.push(terrain);
      const contourMaterial = new THREE.LineBasicMaterial({ color: 0xc2cdbb, transparent: true, opacity: 0.65 });
      for (let j = 0; j <= 12; j++) {
        const t = j / 14;
        const r = 2.45 * (1 - 0.31 * t - 0.1 * Math.sin(t * Math.PI)) + 0.012;
        const points = Array.from({ length: 97 }, (_, i) => {
          const a = i / 96 * Math.PI * 2;
          return new THREE.Vector3(Math.cos(a) * r * edge(a), t * h + 0.015, Math.sin(a) * r * edge(a));
        });
        group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), contourMaterial));
      }
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.67, 0.16, 48), this.themedMaterial(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }), 'pad'));
      pad.position.y = h + 0.08;
      pad.receiveShadow = true;
      pad.castShadow = true;
      pad.userData.index = index;
      group.add(pad);
      this.pickables.push(pad);
      const ringMaterial = new THREE.MeshBasicMaterial({ color: this.palette.accent, transparent: true, opacity: 0.28 });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.83, 64), ringMaterial);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = h + 0.02;
      group.add(ring);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 1.35, 12), this.themedMaterial(new THREE.MeshStandardMaterial({ color: 0x668171 }), 'pole'));
      pole.position.set(0, h + 0.85, 0);
      pole.castShadow = true;
      group.add(pole);
      const flagShape = new THREE.Shape();
      flagShape.moveTo(0, 0);
      flagShape.lineTo(0.78, -0.04);
      flagShape.lineTo(0.61, -0.28);
      flagShape.lineTo(0.78, -0.51);
      flagShape.lineTo(0, -0.48);
      flagShape.closePath();
      const flagMaterial = new THREE.MeshStandardMaterial({ color: this.palette.accent, side: THREE.DoubleSide, roughness: 0.8 });
      const flag = new THREE.Mesh(new THREE.ShapeGeometry(flagShape), flagMaterial);
      flag.position.set(0.025, h + 1.5, 0);
      group.add(flag);
      const hit = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.y = h + 0.7;
      hit.userData.index = index;
      group.add(hit);
      this.pickables.push(hit);
      // Small stones are decorative, not an encoding of quantitative values.
      for (let k = 0; k < 3; k++) {
        const a = index * 1.7 + k * 2.1;
        const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13 + k * 0.035), this.themedMaterial(new THREE.MeshStandardMaterial({ color: 0xc4cfba, roughness: 1 }), 'rock'));
        rock.position.set(Math.cos(a) * 1.04, h + 0.09, Math.sin(a) * 1.04);
        rock.scale.set(1, 0.6, 0.8);
        rock.castShadow = true;
        group.add(rock);
      }
      this.scene.add(group);
      this.islands.push({ group, material, contourMaterial, flagMaterial, ring, h });
    });
    const routePoints = [];
    POSITIONS.forEach(([x, h, z], i) => {
      if (i === 0) routePoints.push(new THREE.Vector3(x - 3.2, 0.15, z + 0.8));
      routePoints.push(new THREE.Vector3(x, h + 0.22, z));
      if (i < POSITIONS.length - 1) {
        const next = POSITIONS[i + 1];
        routePoints.push(new THREE.Vector3((x + next[0]) / 2, (h + next[1]) / 2 + 0.15, (z + next[2]) / 2));
      } else routePoints.push(new THREE.Vector3(x + 2.5, h + 0.35, z - 0.5));
    });
    this.route = new THREE.CatmullRomCurve3(routePoints, false, 'catmullrom', 0.35);
    const tube = new THREE.Mesh(new THREE.TubeGeometry(this.route, 220, 0.042, 8, false), this.themedMaterial(new THREE.MeshStandardMaterial({ color: this.palette.accent, roughness: 0.75 }), 'accent'));
    this.scene.add(tube);
    for (let i = 0; i < 60; i++) {
      const point = this.route.getPointAt(i / 60);
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.036, 6, 4), this.themedMaterial(new THREE.MeshBasicMaterial({ color: 0x718977 }), 'dot'));
      dot.position.copy(point).add(new THREE.Vector3(0, 0.02, 0.13));
      this.scene.add(dot);
    }
    this.traveler = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), this.themedMaterial(new THREE.MeshStandardMaterial({ color: 0xfdfdf9, emissive: this.palette.accent, emissiveIntensity: 0.14 }), 'traveler'));
    this.scene.add(this.traveler);
    this.setSelected(0);
  }

  bindEvents() {
    this.onMove = (event) => {
      if (event.pointerType === 'touch') return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.pickables)[0];
      const index = hit ? hit.object.userData.index : -1;
      if (index !== this.hovered) {
        this.hovered = index;
        this.renderer.domElement.style.cursor = index >= 0 ? 'pointer' : 'grab';
        this.onHover(index, event.clientX - rect.left, event.clientY - rect.top);
      } else if (index >= 0) this.onHover(index, event.clientX - rect.left, event.clientY - rect.top);
    };
    this.onDown = (event) => { this.down = [event.clientX, event.clientY]; };
    this.onUp = (event) => {
      if (!this.down || Math.hypot(event.clientX - this.down[0], event.clientY - this.down[1]) > 6) return;
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const hit = this.raycaster.intersectObjects(this.pickables)[0];
      if (hit) this.onSelect(hit.object.userData.index);
    };
    this.onLeave = () => { this.hovered = -1; this.onHover(-1); };
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointermove', this.onMove);
    canvas.addEventListener('pointerdown', this.onDown);
    canvas.addEventListener('pointerup', this.onUp);
    canvas.addEventListener('pointerleave', this.onLeave);
    canvas.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      this.container.dispatchEvent(new CustomEvent('scene-error'));
    });
  }

  setTheme(theme) {
    this.theme = theme === 'dark' ? 'dark' : 'light';
    this.palette = THEMES[this.theme];
    const palette = this.palette;
    this.scene.background.setHex(palette.background);
    this.scene.fog.color.setHex(palette.background);
    this.grid.material.color.setHex(palette.grid);
    this.hemisphere.intensity = palette.hemisphere;
    this.sun.intensity = palette.sunlight;
    this.themedMaterials.forEach(({ material, role }) => material.color.setHex(palette[role]));
    this.traveler.material.emissive.setHex(palette.accent);
    this.setSelected(this.selected);
    this.islands.forEach(island => island.material.color.copy(island.targetColor));
    this.container.dataset.sceneTheme = this.theme;
  }

  setSelected(index) {
    this.selected = index;
    const palette = this.palette;
    this.islands.forEach((island, i) => {
      island.targetColor = new THREE.Color(i === index ? palette.selected : palette.terrain);
      island.contourMaterial.color.setHex(i === index ? palette.selectedContour : palette.contour);
      island.flagMaterial.color.setHex(i === index ? palette.accent : palette.flag);
      island.ring.material.color.setHex(palette.accent);
      island.ring.material.opacity = i === index ? 0.9 : 0.2;
      if (this.reducedMotion) island.material.color.copy(island.targetColor);
    });
  }

  resize() {
    const { width, height } = this.container.getBoundingClientRect();
    if (width < 1 || height < 1) return;
    this.renderer.setSize(width, height);
    const aspect = width / height;
    const horizontal = width < 600 ? 15.5 : 15.3;
    this.camera.left = -horizontal;
    this.camera.right = horizontal;
    this.camera.top = horizontal / aspect;
    this.camera.bottom = -horizontal / aspect;
    this.camera.updateProjectionMatrix();
  }

  reset() {
    this.camera.position.copy(this.homePosition);
    this.controls.target.copy(this.homeTarget);
    this.camera.zoom = 1;
    this.camera.updateProjectionMatrix();
    this.controls.update();
  }

  zoom(direction) {
    this.camera.zoom = THREE.MathUtils.clamp(this.camera.zoom * (direction > 0 ? 1.12 : 0.89), 0.7, 1.65);
    this.camera.updateProjectionMatrix();
  }

  animate() {
    this.frame = requestAnimationFrame(this.animate);
    if (document.hidden || !this.container.offsetParent) return;
    const elapsed = this.clock.getElapsedTime();
    this.controls.enableDamping = !this.reducedMotion;
    this.controls.update();
    this.camera.updateMatrixWorld();
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const projected = new THREE.Vector3();
    this.islands.forEach((island, index) => {
      island.material.color.lerp(island.targetColor, this.reducedMotion ? 1 : 0.07);
      projected.set(POSITIONS[index][0], island.h + 2.0, POSITIONS[index][2]).project(this.camera);
      const x = (projected.x + 1) * width / 2;
      const y = (-projected.y + 1) * height / 2;
      const label = this.labels[index];
      label.style.left = `${x}px`;
      label.style.top = `${y}px`;
      label.style.visibility = projected.z > 1 || x < 35 || x > width - 35 || y < 25 || y > height - 25 ? 'hidden' : 'visible';
    });
    this.traveler.position.copy(this.route.getPointAt(this.reducedMotion ? 0.04 : (elapsed * 0.018) % 1));
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.motionQuery.removeEventListener('change', this.onMotionChange);
    this.controls.dispose();
    this.scene.traverse((object) => {
      object.geometry?.dispose();
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose());
      }
    });
    this.renderer.dispose();
  }
}
