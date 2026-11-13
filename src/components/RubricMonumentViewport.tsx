import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  type MonumentPillarDatum,
  RubricMonumentController,
} from '../three/rubricMonument.ts';
import { STUDIO_THEMES, type StudioThemeId } from '../three/themes.ts';
import type { ReadinessLabel } from '../types/buildrank.ts';

export type CameraPresetId = 'isometric' | 'top' | 'hero';

export interface RubricMonumentViewportProps {
  pillars: MonumentPillarDatum[];
  overallScore: number;
  readinessLabel: ReadinessLabel;
  themeId: StudioThemeId;
  cameraPreset: CameraPresetId;
  presetTrigger: number;
  autoOrbit: boolean;
  selectedIndex: number | null;
  onSelectPillar?: (index: number | null) => void;
  onHoverPillar?: (index: number | null) => void;
  compact?: boolean;
}

const PRESET_VIEWS: Record<
  CameraPresetId,
  { pos: [number, number, number]; target: [number, number, number] }
> = {
  isometric: { pos: [4.6, 3.6, 4.9], target: [0, 1.05, 0] },
  top: { pos: [0.01, 6.2, 1.8], target: [0, 0.45, 0] },
  hero: { pos: [3.9, 1.85, 4.3], target: [0, 1.25, 0] },
};

function detectSoftwareWebGL(gl: WebGLRenderingContext | WebGL2RenderingContext): boolean {
  try {
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (!ext) return false;
    const renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) ?? '');
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(renderer);
  } catch {
    return false;
  }
}

export const RubricMonumentViewport: React.FC<RubricMonumentViewportProps> = ({
  pillars,
  overallScore,
  readinessLabel,
  themeId,
  cameraPreset,
  presetTrigger,
  autoOrbit,
  selectedIndex,
  onSelectPillar,
  onHoverPillar,
  compact = false,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Mutable refs read inside the single long-lived animation loop (zero effect restarts)
  const controllerRef = useRef<RubricMonumentController | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const fillLightRef = useRef<THREE.HemisphereLight | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  const hoveredIndexRef = useRef<number | null>(null);
  const selectedIndexRef = useRef<number | null>(selectedIndex);
  const autoOrbitRef = useRef<boolean>(autoOrbit);
  const userInteractingRef = useRef<boolean>(false);

  const cameraTransitionRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    targetLook: THREE.Vector3;
  }>({
    active: false,
    targetPos: new THREE.Vector3(...PRESET_VIEWS.isometric.pos),
    targetLook: new THREE.Vector3(...PRESET_VIEWS.isometric.target),
  });

  const onSelectRef = useRef(onSelectPillar);
  const onHoverRef = useRef(onHoverPillar);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    autoOrbitRef.current = autoOrbit;
  }, [autoOrbit]);

  useEffect(() => {
    onSelectRef.current = onSelectPillar;
  }, [onSelectPillar]);

  useEffect(() => {
    onHoverRef.current = onHoverPillar;
  }, [onHoverPillar]);

  // One-time WebGL setup & teardown
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = Math.max(240, container.clientWidth);
    const height = Math.max(200, container.clientHeight);

    let renderer: THREE.WebGLRenderer;
    try {
      // Probe software GL before creating final renderer parameters
      const probeCanvas = document.createElement('canvas');
      const probeGl =
        probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!probeGl) {
        setWebglError('WebGL is not enabled in this browser environment.');
        return;
      }
      const isSoftwareGl = detectSoftwareWebGL(probeGl);

      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
        alpha: false,
      });

      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height, false);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.outline = 'none';

      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const initialTheme = STUDIO_THEMES[themeId];
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(initialTheme.backgroundHex);
      scene.fog = new THREE.FogExp2(initialTheme.fogHex, initialTheme.fogDensity);
      sceneRef.current = scene;

      // Studio PMREM lighting environment on every device
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const roomEnv = new RoomEnvironment();
      const envRT = pmremGenerator.fromScene(roomEnv, 0.04);
      scene.environment = envRT.texture;
      scene.environmentIntensity = 0.72;
      roomEnv.dispose();
      pmremGenerator.dispose();

      const camera = new THREE.PerspectiveCamera(compact ? 38 : 40, width / height, 0.1, 80);
      const initialView = PRESET_VIEWS[cameraPreset];
      camera.position.set(...initialView.pos);
      cameraRef.current = camera;

      // Warm key directional light + cool fill hemisphere + subtle rim light
      const keyLight = new THREE.DirectionalLight(initialTheme.keyLightHex, 2.25);
      keyLight.position.set(5.4, 8.2, 4.8);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.set(isSoftwareGl ? 512 : 1024, isSoftwareGl ? 512 : 1024);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 22;
      keyLight.shadow.camera.left = -3.8;
      keyLight.shadow.camera.right = 3.8;
      keyLight.shadow.camera.top = 3.8;
      keyLight.shadow.camera.bottom = -3.8;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
      scene.add(keyLight);
      keyLightRef.current = keyLight;

      const fillLight = new THREE.HemisphereLight(
        initialTheme.fillSkyHex,
        initialTheme.fillGroundHex,
        0.65
      );
      scene.add(fillLight);
      fillLightRef.current = fillLight;

      const rimLight = new THREE.DirectionalLight('#ffdfbf', 0.55);
      rimLight.position.set(-5.2, 4.4, -4.6);
      scene.add(rimLight);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.target.set(...initialView.target);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.065;
      controls.enablePan = false;
      controls.minDistance = 3.1;
      controls.maxDistance = 11.0;
      controls.minPolarAngle = 0.18;
      controls.maxPolarAngle = Math.PI * 0.47;
      controls.update();
      controlsRef.current = controls;

      const monument = new RubricMonumentController(
        themeId,
        renderer.capabilities.getMaxAnisotropy()
      );
      monument.setData(pillars, overallScore, readinessLabel);
      scene.add(monument.root);
      controllerRef.current = monument;

      // Raycasting & interaction (click vs drag threshold)
      const raycaster = new THREE.Raycaster();
      const pointerNdc = new THREE.Vector2();
      let downX = 0;
      let downY = 0;

      const updatePointer = (ev: PointerEvent) => {
        const rect = renderer.domElement.getBoundingClientRect();
        pointerNdc.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        pointerNdc.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
      };

      const pickCriterionIndex = (): number | null => {
        if (monument.pickTargets.length === 0) return null;
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(monument.pickTargets, false);
        if (hits.length === 0) return null;
        const idx = hits[0].object.userData.criterionIndex;
        return typeof idx === 'number' ? idx : null;
      };

      const handlePointerMove = (ev: PointerEvent) => {
        updatePointer(ev);
        const idx = pickCriterionIndex();
        if (hoveredIndexRef.current !== idx) {
          hoveredIndexRef.current = idx;
          renderer.domElement.style.cursor = idx !== null ? 'pointer' : 'grab';
          onHoverRef.current?.(idx);
        }
      };

      const handlePointerLeave = () => {
        if (hoveredIndexRef.current !== null) {
          hoveredIndexRef.current = null;
          renderer.domElement.style.cursor = 'grab';
          onHoverRef.current?.(null);
        }
      };

      const handlePointerDown = (ev: PointerEvent) => {
        downX = ev.clientX;
        downY = ev.clientY;
        userInteractingRef.current = true;
        cameraTransitionRef.current.active = false;
        renderer.domElement.style.cursor = 'grabbing';
      };

      const handlePointerUp = (ev: PointerEvent) => {
        userInteractingRef.current = false;
        const dx = ev.clientX - downX;
        const dy = ev.clientY - downY;
        if (Math.hypot(dx, dy) < 6) {
          updatePointer(ev);
          const idx = pickCriterionIndex();
          onSelectRef.current?.(idx);
        }
        renderer.domElement.style.cursor = hoveredIndexRef.current !== null ? 'pointer' : 'grab';
      };

      const handleContextLost = (ev: Event) => {
        ev.preventDefault();
        setContextLost(true);
      };

      const handleContextRestored = () => {
        setContextLost(false);
      };

      renderer.domElement.style.cursor = 'grab';
      renderer.domElement.addEventListener('pointermove', handlePointerMove);
      renderer.domElement.addEventListener('pointerleave', handlePointerLeave);
      renderer.domElement.addEventListener('pointerdown', handlePointerDown);
      renderer.domElement.addEventListener('pointerup', handlePointerUp);
      renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const nextW = Math.max(200, Math.floor(entry.contentRect.width));
        const nextH = Math.max(180, Math.floor(entry.contentRect.height));
        camera.aspect = nextW / nextH;
        camera.updateProjectionMatrix();
        renderer.setSize(nextW, nextH, false);
      });
      resizeObserver.observe(container);

      let rafId = 0;
      let timerId: number | null = null;
      let disposed = false;
      const clock = new THREE.Clock();
      const _offset = new THREE.Vector3();

      const renderFrame = () => {
        if (disposed) return;
        const delta = clock.getDelta();
        const elapsed = clock.elapsedTime;
        const dt = Math.min(delta, 0.08);

        // Smooth camera preset transitions (damped, cancelled cleanly on user drag)
        if (cameraTransitionRef.current.active) {
          const { targetPos, targetLook } = cameraTransitionRef.current;
          camera.position.x = THREE.MathUtils.damp(camera.position.x, targetPos.x, 6.5, dt);
          camera.position.y = THREE.MathUtils.damp(camera.position.y, targetPos.y, 6.5, dt);
          camera.position.z = THREE.MathUtils.damp(camera.position.z, targetPos.z, 6.5, dt);

          controls.target.x = THREE.MathUtils.damp(controls.target.x, targetLook.x, 7.0, dt);
          controls.target.y = THREE.MathUtils.damp(controls.target.y, targetLook.y, 7.0, dt);
          controls.target.z = THREE.MathUtils.damp(controls.target.z, targetLook.z, 7.0, dt);

          if (
            camera.position.distanceTo(targetPos) < 0.015 &&
            controls.target.distanceTo(targetLook) < 0.015
          ) {
            camera.position.copy(targetPos);
            controls.target.copy(targetLook);
            cameraTransitionRef.current.active = false;
          }
        } else if (autoOrbitRef.current && !userInteractingRef.current) {
          // Gentle horizontal orbit around target using pre-allocated scratch vector
          _offset.copy(camera.position).sub(controls.target);
          const angle = dt * 0.2;
          const cos = Math.cos(angle);
          const sin = Math.sin(angle);
          const nextX = _offset.x * cos - _offset.z * sin;
          const nextZ = _offset.x * sin + _offset.z * cos;
          _offset.x = nextX;
          _offset.z = nextZ;
          camera.position.copy(controls.target).add(_offset);
        }

        controls.update();
        monument.update(dt, elapsed, hoveredIndexRef.current, selectedIndexRef.current);
        renderer.render(scene, camera);

        if (isSoftwareGl) {
          timerId = window.setTimeout(() => {
            if (!disposed) rafId = window.requestAnimationFrame(renderFrame);
          }, 34);
        } else {
          rafId = window.requestAnimationFrame(renderFrame);
        }
      };

      rafId = window.requestAnimationFrame(renderFrame);

      return () => {
        disposed = true;
        window.cancelAnimationFrame(rafId);
        if (timerId !== null) window.clearTimeout(timerId);
        resizeObserver.disconnect();

        renderer.domElement.removeEventListener('pointermove', handlePointerMove);
        renderer.domElement.removeEventListener('pointerleave', handlePointerLeave);
        renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
        renderer.domElement.removeEventListener('pointerup', handlePointerUp);
        renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
        renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

        controls.dispose();
        monument.dispose();
        envRT.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
      };
    } catch {
      setWebglError('Interactive 3D view is unavailable in this browser.');
      return;
    }
    // Intentionally initialize WebGL once on mount; live prop updates use dedicated effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync rubric data updates smoothly without remounting WebGL
  useEffect(() => {
    controllerRef.current?.setData(pillars, overallScore, readinessLabel);
  }, [pillars, overallScore, readinessLabel]);

  // Sync studio finish theme cleanly
  useEffect(() => {
    const theme = STUDIO_THEMES[themeId];
    controllerRef.current?.applyTheme(themeId);
    if (sceneRef.current) {
      sceneRef.current.background = new THREE.Color(theme.backgroundHex);
      sceneRef.current.fog = new THREE.FogExp2(theme.fogHex, theme.fogDensity);
    }
    if (keyLightRef.current) {
      keyLightRef.current.color.set(theme.keyLightHex);
    }
    if (fillLightRef.current) {
      fillLightRef.current.color.set(theme.fillSkyHex);
      fillLightRef.current.groundColor.set(theme.fillGroundHex);
    }
  }, [themeId]);

  // Smoothly damp camera when preset or reset trigger changes
  useEffect(() => {
    if (presetTrigger === 0) return;
    const preset = PRESET_VIEWS[cameraPreset];
    cameraTransitionRef.current.targetPos.set(...preset.pos);
    cameraTransitionRef.current.targetLook.set(...preset.target);
    cameraTransitionRef.current.active = true;
  }, [cameraPreset, presetTrigger]);

  if (webglError || contextLost) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f3ebe0] text-[#5c5048] p-6 text-center">
        <div className="max-w-xs space-y-2">
          <p className="font-serif text-lg font-semibold text-[#2a221d]">
            {contextLost ? '3D view paused' : '3D view unavailable'}
          </p>
          <p className="text-xs leading-relaxed">
            {webglError ??
              'The browser temporarily paused graphics acceleration. Switch views or refresh to restore the 3D rubric studio.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      aria-label="Interactive 3D rubric readiness monument"
      className="w-full h-full select-none"
    />
  );
};
