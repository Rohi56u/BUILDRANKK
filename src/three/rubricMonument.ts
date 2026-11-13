import * as THREE from 'three';
import {
  createBrushedMetalRoughnessTexture,
  createContactShadowTexture,
  createDialScaleTexture,
  createStoneTextures,
} from './textures.ts';
import { STUDIO_THEMES, type StudioThemeConfig, type StudioThemeId } from './themes.ts';
import type { ReadinessLabel } from '../types/buildrank.ts';

export interface MonumentPillarDatum {
  id: string;
  name: string;
  score: number;
  weight: number;
  weightedContribution: number;
  evidenceStatus: 'Sufficient evidence' | 'Partial evidence' | 'Not enough information';
  missingInformation?: string | null;
  followUpQuestion?: string | null;
}

interface PillarNode {
  group: THREE.Group;
  pedestal: THREE.Mesh;
  shaft: THREE.Mesh;
  cap: THREE.Mesh;
  arcMesh: THREE.Mesh;
  shaftMat: THREE.MeshStandardMaterial;
  capMat: THREE.MeshStandardMaterial;
  arcMat: THREE.MeshStandardMaterial;
  targetHeight: number;
  currentHeight: number;
  currentGlow: number;
  datum: MonumentPillarDatum;
  angle: number;
}

const PLINTH_H = 0.24;
const COLLAR_H = 0.14;
const DECK_TOP_Y = PLINTH_H + COLLAR_H + 0.03; // ~0.41
const PEDESTAL_H = 0.14;
const PILLAR_RADIUS = 1.66;
const MIN_SHAFT_H = 0.22;
const MAX_SHAFT_H = 2.05;

function createOctagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createHexagonShape(radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function createBracketShape(): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(0.28, 0);
  s.lineTo(0.28, 0.1);
  s.lineTo(0.14, 0.28);
  s.lineTo(0.08, 0.56);
  s.lineTo(0, 0.56);
  s.closePath();
  return s;
}

export class RubricMonumentController {
  public readonly root = new THREE.Group();
  public readonly pickTargets: THREE.Object3D[] = [];

  private readonly floorMesh: THREE.Mesh;
  private readonly floorMat: THREE.MeshStandardMaterial;
  private readonly contactShadowMesh: THREE.Mesh;
  private readonly contactShadowMat: THREE.MeshBasicMaterial;

  private readonly plinthMat: THREE.MeshStandardMaterial;
  private readonly collarMat: THREE.MeshStandardMaterial;
  private readonly dialMat: THREE.MeshStandardMaterial;
  private readonly metalPrimaryMat: THREE.MeshStandardMaterial;
  private readonly metalAccentMat: THREE.MeshStandardMaterial;
  private readonly coreGlowMat: THREE.MeshStandardMaterial;

  private readonly outerRingGroup = new THREE.Group();
  private readonly innerRingGroup = new THREE.Group();
  private readonly coreSpireGroup = new THREE.Group();
  private readonly pillarsGroup = new THREE.Group();

  private readonly disposableGeometries: THREE.BufferGeometry[] = [];
  private readonly disposableTextures: THREE.Texture[] = [];

  private stoneMap: THREE.CanvasTexture;
  private stoneRoughnessMap: THREE.CanvasTexture;
  private dialMap: THREE.CanvasTexture;
  private metalRoughnessMap: THREE.CanvasTexture;
  private contactShadowMap: THREE.CanvasTexture;

  private pillars: PillarNode[] = [];
  private targetCoreY = 0.9;
  private currentCoreY = 0.9;
  private targetCoreColor = new THREE.Color('#c2652a');

  // Pre-allocated scratch colors/vectors for zero per-frame allocations
  private readonly _scratchColorA = new THREE.Color();
  private readonly _scratchColorB = new THREE.Color();

  private theme: StudioThemeConfig;
  private readonly anisotropy: number;

  constructor(initialThemeId: StudioThemeId, maxAnisotropy: number) {
    this.theme = STUDIO_THEMES[initialThemeId];
    this.anisotropy = Math.min(8, Math.max(1, maxAnisotropy));

    const stone = createStoneTextures(this.theme.plinthHex, this.anisotropy);
    this.stoneMap = stone.map;
    this.stoneRoughnessMap = stone.roughnessMap;
    this.dialMap = createDialScaleTexture(this.theme, this.anisotropy);
    this.metalRoughnessMap = createBrushedMetalRoughnessTexture(this.anisotropy);
    this.contactShadowMap = createContactShadowTexture();

    this.disposableTextures.push(this.metalRoughnessMap, this.contactShadowMap);

    // 1. Studio Floor (matte mineral surface fading into FogExp2)
    const floorGeo = new THREE.CircleGeometry(32, 64);
    floorGeo.rotateX(-Math.PI / 2);
    this.disposableGeometries.push(floorGeo);

    this.floorMat = new THREE.MeshStandardMaterial({
      color: this.theme.floorHex,
      roughness: 0.94,
      metalness: 0.0,
    });
    this.floorMesh = new THREE.Mesh(floorGeo, this.floorMat);
    this.floorMesh.receiveShadow = true;
    this.floorMesh.position.y = 0;
    this.root.add(this.floorMesh);

    // 2. Soft Contact Shadow Plane flush under the octagonal plinth
    const shadowGeo = new THREE.PlaneGeometry(6.4, 6.4);
    shadowGeo.rotateX(-Math.PI / 2);
    this.disposableGeometries.push(shadowGeo);
    this.contactShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowMap,
      transparent: true,
      depthWrite: false,
      opacity: this.theme.isDark ? 0.52 : 0.42,
    });
    this.contactShadowMesh = new THREE.Mesh(shadowGeo, this.contactShadowMat);
    this.contactShadowMesh.position.y = 0.003;
    this.root.add(this.contactShadowMesh);

    // Shared PBR Materials with deliberate roughness/metalness contrast >= 0.25
    this.plinthMat = new THREE.MeshStandardMaterial({
      map: this.stoneMap,
      roughnessMap: this.stoneRoughnessMap,
      roughness: 0.84,
      metalness: 0.03,
    });

    this.collarMat = new THREE.MeshStandardMaterial({
      color: this.theme.collarHex,
      roughnessMap: this.metalRoughnessMap,
      roughness: 0.48,
      metalness: 0.28,
    });

    this.dialMat = new THREE.MeshStandardMaterial({
      map: this.dialMap,
      roughness: 0.56,
      metalness: 0.12,
    });

    this.metalPrimaryMat = new THREE.MeshStandardMaterial({
      color: this.theme.metalPrimaryHex,
      roughnessMap: this.metalRoughnessMap,
      roughness: 0.34,
      metalness: 0.82,
    });

    this.metalAccentMat = new THREE.MeshStandardMaterial({
      color: this.theme.metalAccentHex,
      roughnessMap: this.metalRoughnessMap,
      roughness: 0.24,
      metalness: 0.88,
    });

    this.coreGlowMat = new THREE.MeshStandardMaterial({
      color: this.theme.corePromisingHex,
      emissive: this.theme.corePromisingHex,
      emissiveIntensity: 0.45,
      roughness: 0.25,
      metalness: 0.65,
    });

    // 3. Stepped Octagonal Travertine Plinth (ExtrudeGeometry + Bevel)
    const octShape = createOctagonShape(2.42);
    const plinthGeo = new THREE.ExtrudeGeometry(octShape, {
      steps: 1,
      depth: PLINTH_H - 0.04,
      bevelEnabled: true,
      bevelThickness: 0.04,
      bevelSize: 0.05,
      bevelSegments: 3,
    });
    plinthGeo.rotateX(-Math.PI / 2);
    plinthGeo.translate(0, 0.04, 0); // bottom flush at y = 0
    this.disposableGeometries.push(plinthGeo);

    const plinthMesh = new THREE.Mesh(plinthGeo, this.plinthMat);
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    this.root.add(plinthMesh);

    // 4. Turned Stepped Collar Ring (LatheGeometry)
    const collarPoints = [
      new THREE.Vector2(1.42, 0),
      new THREE.Vector2(2.24, 0),
      new THREE.Vector2(2.24, 0.06),
      new THREE.Vector2(2.14, 0.11),
      new THREE.Vector2(2.14, COLLAR_H),
      new THREE.Vector2(2.04, COLLAR_H + 0.03),
      new THREE.Vector2(1.42, COLLAR_H + 0.03),
    ];
    const collarGeo = new THREE.LatheGeometry(collarPoints, 64);
    this.disposableGeometries.push(collarGeo);

    const collarMesh = new THREE.Mesh(collarGeo, this.collarMat);
    collarMesh.position.y = PLINTH_H;
    collarMesh.castShadow = true;
    collarMesh.receiveShadow = true;
    this.root.add(collarMesh);

    // 5. Azimuth Dial Deck Surface
    const dialGeo = new THREE.CylinderGeometry(2.05, 2.05, 0.025, 64);
    this.disposableGeometries.push(dialGeo);
    const dialMesh = new THREE.Mesh(dialGeo, [
      this.metalPrimaryMat,
      this.dialMat,
      this.collarMat,
    ]);
    dialMesh.position.y = DECK_TOP_Y - 0.012;
    dialMesh.receiveShadow = true;
    this.root.add(dialMesh);

    // Brass perimeter bezel ring around the dial deck
    const bezelGeo = new THREE.TorusGeometry(2.07, 0.028, 16, 72);
    bezelGeo.rotateX(Math.PI / 2);
    this.disposableGeometries.push(bezelGeo);
    const bezelMesh = new THREE.Mesh(bezelGeo, this.metalAccentMat);
    bezelMesh.position.y = DECK_TOP_Y;
    bezelMesh.castShadow = true;
    this.root.add(bezelMesh);

    // 6. Central Astrolabe Assembly (Brackets + Dual Precision Rings + Readiness Core Spire)
    this.buildCentralAstrolabe();

    // 7. Dynamic Weighted Rubric Pillars Container
    this.root.add(this.pillarsGroup);
  }

  private buildCentralAstrolabe() {
    // Center stepped turntable plinth
    const hubPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.76, 0),
      new THREE.Vector2(0.74, 0.06),
      new THREE.Vector2(0.62, 0.09),
      new THREE.Vector2(0.58, 0.15),
      new THREE.Vector2(0, 0.15),
    ];
    const hubGeo = new THREE.LatheGeometry(hubPoints, 48);
    this.disposableGeometries.push(hubGeo);
    const hubMesh = new THREE.Mesh(hubGeo, this.collarMat);
    hubMesh.position.y = DECK_TOP_Y;
    hubMesh.castShadow = true;
    hubMesh.receiveShadow = true;
    this.root.add(hubMesh);

    // Four beveled architectural gimbal mounting brackets
    const bracketGeo = new THREE.ExtrudeGeometry(createBracketShape(), {
      steps: 1,
      depth: 0.06,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: 2,
    });
    bracketGeo.translate(0.32, 0, -0.03);
    this.disposableGeometries.push(bracketGeo);

    for (let i = 0; i < 4; i++) {
      const bMesh = new THREE.Mesh(bracketGeo, this.metalPrimaryMat);
      bMesh.position.y = DECK_TOP_Y + 0.08;
      bMesh.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
      bMesh.castShadow = true;
      this.root.add(bMesh);
    }

    // Outer gimbal calibration ring
    this.outerRingGroup.position.y = DECK_TOP_Y + 0.72;
    const outerTorusGeo = new THREE.TorusGeometry(0.62, 0.022, 16, 64);
    this.disposableGeometries.push(outerTorusGeo);
    const outerRing = new THREE.Mesh(outerTorusGeo, this.metalPrimaryMat);
    outerRing.castShadow = true;
    this.outerRingGroup.add(outerRing);

    // Four precision cardinal index nodes on outer ring
    const nodeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.06, 16);
    this.disposableGeometries.push(nodeGeo);
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const node = new THREE.Mesh(nodeGeo, this.metalAccentMat);
      node.position.set(Math.cos(angle) * 0.62, Math.sin(angle) * 0.62, 0);
      node.rotation.z = angle + Math.PI / 2;
      this.outerRingGroup.add(node);
    }
    this.root.add(this.outerRingGroup);

    // Inner sienna brass gimbal ring
    this.innerRingGroup.position.y = DECK_TOP_Y + 0.72;
    const innerTorusGeo = new THREE.TorusGeometry(0.46, 0.018, 16, 56);
    this.disposableGeometries.push(innerTorusGeo);
    const innerRing = new THREE.Mesh(innerTorusGeo, this.metalAccentMat);
    innerRing.rotation.x = Math.PI / 3;
    innerRing.castShadow = true;
    this.innerRingGroup.add(innerRing);
    this.root.add(this.innerRingGroup);

    // Central Readiness Core Spire (LatheGeometry architectural finial + illuminated collar)
    const spirePoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.18, 0),
      new THREE.Vector2(0.16, 0.12),
      new THREE.Vector2(0.11, 0.24),
      new THREE.Vector2(0.13, 0.28),
      new THREE.Vector2(0.06, 0.52),
      new THREE.Vector2(0, 0.64),
    ];
    const spireGeo = new THREE.LatheGeometry(spirePoints, 24);
    this.disposableGeometries.push(spireGeo);
    const spireMesh = new THREE.Mesh(spireGeo, this.plinthMat);
    spireMesh.castShadow = true;
    this.coreSpireGroup.add(spireMesh);

    const coreCollarGeo = new THREE.TorusGeometry(0.145, 0.022, 16, 36);
    coreCollarGeo.rotateX(Math.PI / 2);
    this.disposableGeometries.push(coreCollarGeo);
    const coreCollar = new THREE.Mesh(coreCollarGeo, this.coreGlowMat);
    coreCollar.position.y = 0.26;
    this.coreSpireGroup.add(coreCollar);

    this.coreSpireGroup.position.y = DECK_TOP_Y + 0.25;
    this.root.add(this.coreSpireGroup);
  }

  public setData(
    items: MonumentPillarDatum[],
    overallScore: number,
    readinessLabel: ReadinessLabel
  ) {
    // Update central spire target poise and semantic accent color
    const normalizedScore = Math.max(0, Math.min(100, overallScore)) / 100;
    this.targetCoreY = DECK_TOP_Y + 0.18 + normalizedScore * 0.42;

    if (readinessLabel === 'Demo-ready') {
      this.targetCoreColor.set(this.theme.coreReadyHex);
    } else if (readinessLabel === 'Promising') {
      this.targetCoreColor.set(this.theme.corePromisingHex);
    } else {
      this.targetCoreColor.set(this.theme.coreNeedsDetailHex);
    }

    const sameIds =
      items.length === this.pillars.length &&
      items.every((item, idx) => item.id === this.pillars[idx]?.datum.id && item.weight === this.pillars[idx]?.datum.weight);

    if (sameIds) {
      // Smoothly update existing pillar target heights and status colors without rebuilding meshes
      for (let i = 0; i < items.length; i++) {
        const node = this.pillars[i];
        node.datum = items[i];
        const frac = Math.max(0, Math.min(100, items[i].score)) / 100;
        node.targetHeight = MIN_SHAFT_H + frac * (MAX_SHAFT_H - MIN_SHAFT_H);
        const isInsufficient = items[i].evidenceStatus === 'Not enough information';
        node.shaftMat.color.set(
          isInsufficient ? this.theme.pillarInsufficientHex : this.theme.pillarStoneHex
        );
      }
      return;
    }

    this.rebuildPillars(items);
  }

  private clearPillars() {
    this.pickTargets.length = 0;
    for (const node of this.pillars) {
      this.pillarsGroup.remove(node.group);
      this.pillarsGroup.remove(node.arcMesh);
      node.pedestal.geometry.dispose();
      node.shaft.geometry.dispose();
      node.cap.geometry.dispose();
      node.arcMesh.geometry.dispose();
      node.shaftMat.dispose();
      node.capMat.dispose();
      node.arcMat.dispose();
    }
    this.pillars = [];
  }

  private rebuildPillars(items: MonumentPillarDatum[]) {
    this.clearPillars();
    if (items.length === 0) return;

    const count = items.length;
    const totalWeight = items.reduce((acc, item) => acc + Math.max(1, item.weight), 0);

    // Shared pedestal and cap Lathe profiles generated per rebuild
    const pedPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.24, 0),
      new THREE.Vector2(0.24, 0.04),
      new THREE.Vector2(0.20, 0.08),
      new THREE.Vector2(0.19, PEDESTAL_H),
      new THREE.Vector2(0, PEDESTAL_H),
    ];

    const capPoints = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(0.20, 0),
      new THREE.Vector2(0.21, 0.04),
      new THREE.Vector2(0.14, 0.09),
      new THREE.Vector2(0.05, 0.13),
      new THREE.Vector2(0, 0.13),
    ];

    const hexGeo = new THREE.ExtrudeGeometry(createHexagonShape(0.165), {
      steps: 1,
      depth: 1.0, // normalized height 1.0 scaled smoothly by currentHeight
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
    });
    hexGeo.rotateX(-Math.PI / 2);
    hexGeo.translate(0, 0.015, 0);

    let cursorAngle = -Math.PI / 2;

    items.forEach((datum, idx) => {
      const sliceSpan = (Math.max(1, datum.weight) / totalWeight) * Math.PI * 2;
      const angle = cursorAngle + sliceSpan * 0.5;
      cursorAngle += sliceSpan;

      const x = Math.cos(angle) * PILLAR_RADIUS;
      const z = Math.sin(angle) * PILLAR_RADIUS;

      const group = new THREE.Group();
      group.position.set(x, DECK_TOP_Y, z);
      group.rotation.y = -angle;

      const pedGeo = new THREE.LatheGeometry(pedPoints, 24);
      const pedestal = new THREE.Mesh(pedGeo, this.metalPrimaryMat);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      pedestal.userData.criterionIndex = idx;
      group.add(pedestal);

      const isInsufficient = datum.evidenceStatus === 'Not enough information';
      const shaftMat = new THREE.MeshStandardMaterial({
        color: isInsufficient ? this.theme.pillarInsufficientHex : this.theme.pillarStoneHex,
        map: this.stoneMap,
        roughnessMap: this.stoneRoughnessMap,
        roughness: 0.76,
        metalness: 0.04,
      });

      const shaft = new THREE.Mesh(hexGeo.clone(), shaftMat);
      shaft.position.y = PEDESTAL_H;
      shaft.castShadow = true;
      shaft.receiveShadow = true;
      shaft.userData.criterionIndex = idx;
      group.add(shaft);

      const capMat = new THREE.MeshStandardMaterial({
        color: this.theme.metalAccentHex,
        roughnessMap: this.metalRoughnessMap,
        roughness: 0.24,
        metalness: 0.88,
      });

      const capGeo = new THREE.LatheGeometry(capPoints, 24);
      const cap = new THREE.Mesh(capGeo, capMat);
      cap.castShadow = true;
      cap.userData.criterionIndex = idx;
      group.add(cap);

      // Weight proportion sector arc laid cleanly on the dial surface
      const gap = count > 1 ? 0.07 : 0;
      const arcSpan = Math.max(0.12, sliceSpan - gap);
      const arcStart = angle - arcSpan * 0.5;
      const arcGeo = new THREE.RingGeometry(1.14, 1.31, 28, 1, arcStart, arcSpan);
      arcGeo.rotateX(-Math.PI / 2);

      const arcMat = new THREE.MeshStandardMaterial({
        color: isInsufficient ? this.theme.pillarInsufficientHex : this.theme.metalAccentHex,
        roughness: 0.36,
        metalness: 0.68,
        emissive: this.theme.metalAccentHex,
        emissiveIntensity: 0.06,
      });

      const arcMesh = new THREE.Mesh(arcGeo, arcMat);
      arcMesh.position.y = DECK_TOP_Y + 0.008;
      arcMesh.userData.criterionIndex = idx;

      this.pillarsGroup.add(group);
      this.pillarsGroup.add(arcMesh);

      this.pickTargets.push(pedestal, shaft, cap, arcMesh);

      const frac = Math.max(0, Math.min(100, datum.score)) / 100;
      const targetHeight = MIN_SHAFT_H + frac * (MAX_SHAFT_H - MIN_SHAFT_H);
      const initialHeight = MIN_SHAFT_H * 0.75;

      shaft.scale.set(1, initialHeight, 1);
      cap.position.y = PEDESTAL_H + initialHeight;

      this.pillars.push({
        group,
        pedestal,
        shaft,
        cap,
        arcMesh,
        shaftMat,
        capMat,
        arcMat,
        targetHeight,
        currentHeight: initialHeight,
        currentGlow: 0,
        datum,
        angle,
      });
    });

    hexGeo.dispose();
  }

  public applyTheme(themeId: StudioThemeId) {
    if (this.theme.id === themeId) return;
    this.theme = STUDIO_THEMES[themeId];

    // Regenerate stone and dial textures for the new finish and dispose old ones
    const oldStoneMap = this.stoneMap;
    const oldStoneRough = this.stoneRoughnessMap;
    const oldDialMap = this.dialMap;

    const stone = createStoneTextures(this.theme.plinthHex, this.anisotropy);
    this.stoneMap = stone.map;
    this.stoneRoughnessMap = stone.roughnessMap;
    this.dialMap = createDialScaleTexture(this.theme, this.anisotropy);

    this.floorMat.color.set(this.theme.floorHex);
    this.contactShadowMat.opacity = this.theme.isDark ? 0.52 : 0.42;

    this.plinthMat.map = this.stoneMap;
    this.plinthMat.roughnessMap = this.stoneRoughnessMap;
    this.plinthMat.needsUpdate = true;

    this.collarMat.color.set(this.theme.collarHex);
    this.dialMat.map = this.dialMap;
    this.dialMat.needsUpdate = true;

    this.metalPrimaryMat.color.set(this.theme.metalPrimaryHex);
    this.metalAccentMat.color.set(this.theme.metalAccentHex);

    for (const node of this.pillars) {
      const isInsufficient = node.datum.evidenceStatus === 'Not enough information';
      node.shaftMat.map = this.stoneMap;
      node.shaftMat.roughnessMap = this.stoneRoughnessMap;
      node.shaftMat.color.set(
        isInsufficient ? this.theme.pillarInsufficientHex : this.theme.pillarStoneHex
      );
      node.shaftMat.needsUpdate = true;
      node.capMat.color.set(this.theme.metalAccentHex);
      node.arcMat.color.set(
        isInsufficient ? this.theme.pillarInsufficientHex : this.theme.metalAccentHex
      );
    }

    oldStoneMap.dispose();
    oldStoneRough.dispose();
    oldDialMap.dispose();
  }

  public getPillarDatum(index: number): MonumentPillarDatum | null {
    return this.pillars[index]?.datum ?? null;
  }

  public getPillarFocusPosition(index: number, out: THREE.Vector3): boolean {
    const node = this.pillars[index];
    if (!node) return false;
    out.set(
      node.group.position.x * 0.55,
      DECK_TOP_Y + node.currentHeight * 0.55,
      node.group.position.z * 0.55
    );
    return true;
  }

  /**
   * Frame-rate-independent damped animation step. Zero object allocations inside!
   */
  public update(
    delta: number,
    elapsed: number,
    hoveredIndex: number | null,
    selectedIndex: number | null
  ) {
    const dt = Math.min(delta, 0.08);

    // Smooth central spire height and readiness glow
    this.currentCoreY = THREE.MathUtils.damp(this.currentCoreY, this.targetCoreY, 6.5, dt);
    this.coreSpireGroup.position.y = this.currentCoreY + Math.sin(elapsed * 1.4) * 0.015;
    this.coreGlowMat.color.lerp(this.targetCoreColor, 1 - Math.exp(-6 * dt));
    this.coreGlowMat.emissive.copy(this.coreGlowMat.color);

    // Gentle precision astrolabe ring motion
    this.outerRingGroup.rotation.y = elapsed * 0.14;
    this.outerRingGroup.rotation.z = Math.sin(elapsed * 0.45) * 0.08;
    this.innerRingGroup.rotation.y = -elapsed * 0.22;
    this.innerRingGroup.rotation.x = Math.sin(elapsed * 0.35) * 0.18;

    // Smoothly damp every weighted pillar shaft, cap, and active highlight
    for (let i = 0; i < this.pillars.length; i++) {
      const node = this.pillars[i];
      const isActive = i === hoveredIndex || i === selectedIndex;

      node.currentHeight = THREE.MathUtils.damp(node.currentHeight, node.targetHeight, 7.5, dt);
      node.currentGlow = THREE.MathUtils.damp(node.currentGlow, isActive ? 1 : 0, 10, dt);

      const scaleXZ = 1 + node.currentGlow * 0.065;
      node.shaft.scale.set(scaleXZ, node.currentHeight, scaleXZ);
      node.cap.position.y = PEDESTAL_H + node.currentHeight + 0.015;
      node.cap.scale.setScalar(1 + node.currentGlow * 0.08);

      this._scratchColorA.set(this.theme.metalAccentHex);
      this._scratchColorB.set('#ffffff');
      node.capMat.emissive.copy(this._scratchColorA);
      node.capMat.emissiveIntensity = node.currentGlow * 0.45;
      node.arcMat.emissive.copy(this._scratchColorA);
      node.arcMat.emissiveIntensity = 0.06 + node.currentGlow * 0.55;
      node.shaftMat.emissive.copy(this._scratchColorA);
      node.shaftMat.emissiveIntensity = node.currentGlow * 0.12;
    }
  }

  public dispose() {
    this.clearPillars();
    for (const geo of this.disposableGeometries) {
      geo.dispose();
    }
    this.disposableGeometries.length = 0;

    this.stoneMap.dispose();
    this.stoneRoughnessMap.dispose();
    this.dialMap.dispose();
    for (const tex of this.disposableTextures) {
      tex.dispose();
    }
    this.disposableTextures.length = 0;

    this.floorMat.dispose();
    this.contactShadowMat.dispose();
    this.plinthMat.dispose();
    this.collarMat.dispose();
    this.dialMat.dispose();
    this.metalPrimaryMat.dispose();
    this.metalAccentMat.dispose();
    this.coreGlowMat.dispose();
  }
}
