import * as THREE from 'three';
import type { StudioThemeConfig } from './themes.ts';

function seededNoise(x: number, y: number): number {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
}

/**
 * Procedural honed travertine / limestone albedo + roughness pair.
 * Albedo uses SRGBColorSpace; roughness stays in default linear color space.
 */
export function createStoneTextures(
  baseHex: string,
  anisotropy: number
): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
  const size = 512;
  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = size;
  albedoCanvas.height = size;
  const aCtx = albedoCanvas.getContext('2d')!;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = size;
  roughCanvas.height = size;
  const rCtx = roughCanvas.getContext('2d')!;

  const baseColor = new THREE.Color(baseHex);
  const rBase = Math.round(baseColor.r * 255);
  const gBase = Math.round(baseColor.g * 255);
  const bBase = Math.round(baseColor.b * 255);

  aCtx.fillStyle = `rgb(${rBase}, ${gBase}, ${bBase})`;
  aCtx.fillRect(0, 0, size, size);

  rCtx.fillStyle = 'rgb(205, 205, 205)';
  rCtx.fillRect(0, 0, size, size);

  // Subtle horizontal sedimentary veins
  for (let y = 0; y < size; y += 2) {
    const band = Math.sin(y * 0.065) * 6 + Math.sin(y * 0.21) * 3;
    const jitter = (seededNoise(y, 19) - 0.5) * 8;
    const delta = Math.round(band + jitter);

    aCtx.fillStyle = `rgba(${Math.max(0, Math.min(255, rBase + delta))}, ${Math.max(
      0,
      Math.min(255, gBase + delta)
    )}, ${Math.max(0, Math.min(255, bBase + delta - 1))}, 0.45)`;
    aCtx.fillRect(0, y, size, 2);

    const rVal = Math.max(150, Math.min(245, 206 - delta * 2));
    rCtx.fillStyle = `rgb(${rVal}, ${rVal}, ${rVal})`;
    rCtx.fillRect(0, y, size, 2);
  }

  // Fine mineral pores
  for (let i = 0; i < 1400; i++) {
    const px = seededNoise(i, 3) * size;
    const py = seededNoise(i, 11) * size;
    const w = 1 + seededNoise(i, 23) * 7;
    const h = 1 + seededNoise(i, 31) * 1.5;
    const dark = seededNoise(i, 47) > 0.45;
    aCtx.fillStyle = dark ? 'rgba(42, 34, 29, 0.045)' : 'rgba(255, 255, 255, 0.05)';
    aCtx.fillRect(px, py, w, h);

    const poreR = dark ? 235 : 182;
    rCtx.fillStyle = `rgba(${poreR}, ${poreR}, ${poreR}, 0.55)`;
    rCtx.fillRect(px, py, w, h);
  }

  const map = new THREE.CanvasTexture(albedoCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(2, 2);
  map.anisotropy = anisotropy;
  map.needsUpdate = true;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.repeat.set(2, 2);
  roughnessMap.anisotropy = anisotropy;
  roughnessMap.needsUpdate = true;

  return { map, roughnessMap };
}

/**
 * Procedural brushed metallic grain map (linear space) for anodized brass / bronze collars.
 */
export function createBrushedMetalRoughnessTexture(anisotropy: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgb(115, 115, 115)';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < size; i++) {
    const v = Math.round(92 + seededNoise(i, 71) * 52);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(0, i, size, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * High-resolution calibrated azimuth & rubric weight dial CanvasTexture (SRGBColorSpace).
 */
export function createDialScaleTexture(
  theme: StudioThemeConfig,
  anisotropy: number
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const cx = size / 2;
  const cy = size / 2;

  ctx.fillStyle = theme.dialBaseHex;
  ctx.fillRect(0, 0, size, size);

  // Subtle radial sheen gradient
  const grad = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.5);
  grad.addColorStop(0, theme.isDark ? 'rgba(214, 143, 73, 0.07)' : 'rgba(194, 101, 42, 0.06)');
  grad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.06)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Concentric calibration hairlines
  const rings = [0.22, 0.31, 0.41, 0.445, 0.47];
  rings.forEach((rFrac, idx) => {
    ctx.beginPath();
    ctx.arc(cx, cy, size * rFrac, 0, Math.PI * 2);
    ctx.strokeStyle = idx === 2 ? theme.dialAccentHex : theme.dialTickHex;
    ctx.globalAlpha = idx === 2 ? 0.45 : 0.25;
    ctx.lineWidth = idx === 2 ? 2.5 : 1.5;
    ctx.stroke();
  });
  ctx.globalAlpha = 1;

  // Degree tick marks around outer bezel
  for (let deg = 0; deg < 360; deg += 2) {
    const rad = (deg * Math.PI) / 180;
    const isMajor = deg % 30 === 0;
    const isMedium = deg % 10 === 0;
    const innerR = size * (isMajor ? 0.422 : isMedium ? 0.433 : 0.439);
    const outerR = size * 0.445;

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rad) * innerR, cy + Math.sin(rad) * innerR);
    ctx.lineTo(cx + Math.cos(rad) * outerR, cy + Math.sin(rad) * outerR);
    ctx.strokeStyle = isMajor ? theme.dialAccentHex : theme.dialTickHex;
    ctx.globalAlpha = isMajor ? 0.85 : isMedium ? 0.45 : 0.22;
    ctx.lineWidth = isMajor ? 2.6 : 1.3;
    ctx.stroke();

    if (isMajor) {
      const labelR = size * 0.39;
      ctx.save();
      ctx.translate(cx + Math.cos(rad) * labelR, cy + Math.sin(rad) * labelR);
      ctx.rotate(rad + Math.PI / 2);
      ctx.fillStyle = theme.dialTickHex;
      ctx.globalAlpha = 0.72;
      ctx.font = '600 17px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${deg}°`, 0, 0);
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;

  // Crosshair axes at center
  ctx.strokeStyle = theme.dialTickHex;
  ctx.globalAlpha = 0.18;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.19, cy);
  ctx.lineTo(cx + size * 0.19, cy);
  ctx.moveTo(cx, cy - size * 0.19);
  ctx.lineTo(cx, cy + size * 0.19);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

/**
 * Soft radial contact shadow decal beneath the plinth and pillars.
 */
export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;

  const grad = ctx.createRadialGradient(c, c, size * 0.08, c, c, size * 0.48);
  grad.addColorStop(0, 'rgba(28, 20, 14, 0.78)');
  grad.addColorStop(0.55, 'rgba(28, 20, 14, 0.35)');
  grad.addColorStop(0.85, 'rgba(28, 20, 14, 0.08)');
  grad.addColorStop(1, 'rgba(28, 20, 14, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
