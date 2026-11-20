import { useEffect, useRef } from 'react';
import {
  MatrixSettings,
  PaletteConfig,
  SCREENSAVER_CALM_SPEED,
  createPaletteFromRgb,
  hslToRgb,
  resolvePalette,
} from '../types/matrix';

/**
 * Authentic Matrix glyph set: half-width katakana, numerals, and subtle operators
 * inspired by Simon Whiteley's 1999 digital rain typography.
 */
const MATRIX_GLYPHS =
  'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ012345789:・."=*+-<>¦｜Z';

function randomGlyph(): string {
  return MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)];
}

interface RainCell {
  char: string;
  energy: number; // 0 (off) to 1 (peak)
  isHead: boolean;
  headFlash: number; // 0 to 1 extra white-hot bloom at head
  mutateCooldown: number;
  flickerPhase: number;
  decayRate: number;
}

interface RainStream {
  col: number;
  rowFloat: number;
  lastRow: number;
  speed: number; // cells per second
  trailLength: number;
  active: boolean;
  respawnDelay: number;
  brightnessBias: number; // subtle per-stream intensity variance
}

interface RainLayer {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  fontSize: number;
  cells: RainCell[];
  streams: RainStream[];
  isBackground: boolean;
}

interface MatrixRainCanvasProps {
  settings: MatrixSettings;
  paused: boolean;
  screensaverActive: boolean;
  onRipple?: (normalizedX: number) => void;
}

function createLayer(
  width: number,
  height: number,
  fontSize: number,
  density: number,
  trailLength: number,
  isBackground: boolean,
  prewarm: boolean
): RainLayer {
  const effectiveFont = isBackground ? Math.max(10, Math.round(fontSize * 0.64)) : fontSize;
  const cellW = Math.max(8, Math.round(effectiveFont * 0.86));
  const cellH = Math.max(10, Math.round(effectiveFont * 1.06));
  const cols = Math.ceil(width / cellW) + 1;
  const rows = Math.ceil(height / cellH) + 2;

  const totalCells = cols * rows;
  const cells: RainCell[] = new Array(totalCells);
  for (let i = 0; i < totalCells; i++) {
    cells[i] = {
      char: randomGlyph(),
      energy: 0,
      isHead: false,
      headFlash: 0,
      mutateCooldown: 0.08 + Math.random() * 0.65,
      flickerPhase: Math.random() * Math.PI * 2,
      decayRate: 0.6,
    };
  }

  const streams: RainStream[] = [];
  const streamsPerCol = isBackground ? 1 : 2;

  for (let col = 0; col < cols; col++) {
    for (let s = 0; s < streamsPerCol; s++) {
      // Secondary stream only spawns on a fraction of columns based on density
      const spawnChance = s === 0 ? Math.min(1, density + 0.1) : Math.max(0, (density - 0.35) * 0.85);
      const isActive = Math.random() < spawnChance;
      const baseSpeed = isBackground
        ? 4.2 + Math.random() * 5.8
        : 8.5 + Math.random() * 14.5;
      const streamTrail = Math.max(
        6,
        Math.round(trailLength * (0.55 + Math.random() * 0.9) * (isBackground ? 0.85 : 1))
      );

      const startRow = prewarm
        ? Math.random() * (rows + streamTrail) - streamTrail * 0.5
        : -Math.random() * rows * 0.9 - 1;

      streams.push({
        col,
        rowFloat: startRow,
        lastRow: Math.floor(startRow),
        speed: baseSpeed,
        trailLength: streamTrail,
        active: isActive,
        respawnDelay: isActive ? 0 : 0.3 + Math.random() * 4.5,
        brightnessBias: isBackground
          ? 0.28 + Math.random() * 0.24
          : 0.72 + Math.random() * 0.28,
      });
    }
  }

  const layer: RainLayer = {
    cols,
    rows,
    cellW,
    cellH,
    fontSize: effectiveFont,
    cells,
    streams,
    isBackground,
  };

  // Pre-populate trails so the screen immediately opens rich and alive on frame 1
  if (prewarm) {
    for (const stream of layer.streams) {
      if (!stream.active) continue;
      const headRow = Math.floor(stream.rowFloat);
      for (let offset = 0; offset < stream.trailLength; offset++) {
        const r = headRow - offset;
        if (r < 0 || r >= rows) continue;
        const idx = r * cols + stream.col;
        const t = 1 - offset / stream.trailLength;
        const energy = Math.pow(t, 1.35) * stream.brightnessBias;
        if (energy > cells[idx].energy) {
          cells[idx].energy = energy;
          cells[idx].char = randomGlyph();
          cells[idx].isHead = offset === 0;
          cells[idx].headFlash = offset === 0 ? 1 : offset === 1 ? 0.35 : 0;
          cells[idx].decayRate = stream.speed / Math.max(5, stream.trailLength);
        }
      }
    }
  }

  return layer;
}

export function MatrixRainCanvas({
  settings,
  paused,
  screensaverActive,
  onRipple,
}: MatrixRainCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const settingsRef = useRef<MatrixSettings>(settings);
  const pausedRef = useRef<boolean>(paused);
  const screensaverRef = useRef<boolean>(screensaverActive);
  const onRippleRef = useRef(onRipple);

  // Keep refs updated without resetting the animation loop
  settingsRef.current = settings;
  pausedRef.current = paused;
  screensaverRef.current = screensaverActive;
  onRippleRef.current = onRipple;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    let bgLayer: RainLayer | null = null;
    let fgLayer: RainLayer | null = null;
    let lastFontSize = settingsRef.current.fontSize;
    let lastDensity = settingsRef.current.density;
    let lastTrail = settingsRef.current.trailLength;

    const pointer = {
      x: -9999,
      y: -9999,
      active: false,
      lastMoveTime: 0,
    };

    const rebuildLayers = (prewarm: boolean) => {
      const s = settingsRef.current;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      fgLayer = createLayer(width, height, s.fontSize, s.density, s.trailLength, false, prewarm);
      bgLayer = createLayer(width, height, s.fontSize, s.density * 0.72, s.trailLength, true, prewarm);

      lastFontSize = s.fontSize;
      lastDensity = s.density;
      lastTrail = s.trailLength;
    };

    rebuildLayers(true);

    let resizeTimer: number | null = null;
    const handleResize = () => {
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        rebuildLayers(true);
      }, 90);
    };

    const disturbAtPoint = (clientX: number, clientY: number, radiusPx: number, burstStream: boolean) => {
      if (!settingsRef.current.interactive || !fgLayer) return;
      const layer = fgLayer;
      const centerCol = Math.floor(clientX / layer.cellW);
      const centerRow = Math.floor(clientY / layer.cellH);
      const colRadius = Math.ceil(radiusPx / layer.cellW);
      const rowRadius = Math.ceil(radiusPx / layer.cellH);

      for (let r = centerRow - rowRadius; r <= centerRow + rowRadius; r++) {
        if (r < 0 || r >= layer.rows) continue;
        for (let c = centerCol - colRadius; c <= centerCol + colRadius; c++) {
          if (c < 0 || c >= layer.cols) continue;
          const dx = (c + 0.5) * layer.cellW - clientX;
          const dy = (r + 0.5) * layer.cellH - clientY;
          const dist = Math.hypot(dx, dy);
          if (dist <= radiusPx) {
            const falloff = 1 - dist / radiusPx;
            const idx = r * layer.cols + c;
            const cell = layer.cells[idx];
            const boost = falloff * (burstStream ? 0.95 : 0.52);
            if (boost > cell.energy) {
              cell.energy = Math.min(1, boost);
              cell.decayRate = 0.85;
            }
            if (Math.random() < falloff * 0.45) {
              cell.char = randomGlyph();
            }
            if (burstStream && falloff > 0.65) {
              cell.headFlash = Math.max(cell.headFlash, falloff * 0.9);
            }
          }
        }
      }

      // Clicking/tapping launches fresh energized streams at the clicked column cluster
      if (burstStream) {
        for (let offset = -1; offset <= 1; offset++) {
          const targetCol = centerCol + offset;
          if (targetCol < 0 || targetCol >= layer.cols) continue;
          const colStreams = layer.streams.filter((st) => st.col === targetCol);
          const candidate = colStreams[0];
          if (candidate) {
            candidate.active = true;
            candidate.respawnDelay = 0;
            candidate.rowFloat = Math.max(0, centerRow - (offset === 0 ? 0 : 1));
            candidate.lastRow = Math.floor(candidate.rowFloat) - 1;
            candidate.speed = 13 + Math.random() * 10;
            candidate.brightnessBias = 1;
          }
        }
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
      pointer.lastMoveTime = performance.now();
      disturbAtPoint(e.clientX, e.clientY, 64, false);
    };

    const handlePointerDown = (e: PointerEvent) => {
      // Ignore clicks on floating UI controls
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-matrix-ui="true"]')) return;
      disturbAtPoint(e.clientX, e.clientY, 110, true);
      if (settingsRef.current.interactive && onRippleRef.current && width > 0) {
        onRippleRef.current(e.clientX / width);
      }
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointerleave', handlePointerLeave);

    const stepLayer = (
      layer: RainLayer,
      dt: number,
      s: MatrixSettings,
      speedMult: number
    ) => {
      const densityTarget = layer.isBackground ? s.density * 0.72 : s.density;
      const { cols, rows, cells, streams } = layer;

      // 1. Decay existing cell phosphor energy & mutate glyphs dynamically
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (cell.energy <= 0.002) {
          cell.energy = 0;
          cell.isHead = false;
          cell.headFlash = 0;
          continue;
        }

        // Smooth exponential-like tail fade to pure black
        cell.energy -= cell.decayRate * speedMult * dt;
        if (cell.energy < 0) cell.energy = 0;

        if (cell.headFlash > 0) {
          cell.headFlash = Math.max(0, cell.headFlash - dt * 4.8 * Math.max(0.6, speedMult));
          if (cell.headFlash < 0.25) cell.isHead = false;
        }

        // Live character mutation in illuminated wake (iconic Matrix shimmer)
        cell.mutateCooldown -= dt * (0.7 + speedMult * 0.45);
        if (cell.mutateCooldown <= 0) {
          if (Math.random() < (cell.isHead ? 0.65 : 0.24)) {
            cell.char = randomGlyph();
          }
          cell.mutateCooldown = 0.09 + Math.random() * 0.65;
        }
      }

      // 2. Advance falling streams
      for (let i = 0; i < streams.length; i++) {
        const stream = streams[i];
        if (!stream.active) {
          stream.respawnDelay -= dt * Math.max(0.4, speedMult);
          if (stream.respawnDelay <= 0) {
            const shouldSpawn = Math.random() < densityTarget;
            if (shouldSpawn) {
              stream.active = true;
              stream.rowFloat = -Math.random() * 3;
              stream.lastRow = Math.floor(stream.rowFloat);
              stream.speed = layer.isBackground
                ? 4.2 + Math.random() * 5.8
                : 8.5 + Math.random() * 14.5;
              stream.trailLength = Math.max(
                6,
                Math.round(
                  s.trailLength *
                    (0.55 + Math.random() * 0.9) *
                    (layer.isBackground ? 0.85 : 1)
                )
              );
              stream.brightnessBias = layer.isBackground
                ? 0.26 + Math.random() * 0.24
                : 0.72 + Math.random() * 0.28;
            } else {
              stream.respawnDelay = 0.6 + Math.random() * 2.4;
            }
          }
          continue;
        }

        const prevRow = stream.lastRow;
        stream.rowFloat += stream.speed * speedMult * dt;
        const currRow = Math.floor(stream.rowFloat);

        if (currRow > prevRow) {
          // Fill every stepped row so high speed never skips cells
          const stepStart = Math.max(0, prevRow + 1);
          const stepEnd = Math.min(rows - 1, currRow);
          const decayRate = stream.speed / Math.max(5, stream.trailLength);

          for (let r = stepStart; r <= stepEnd; r++) {
            const idx = r * cols + stream.col;
            const cell = cells[idx];
            cell.char = randomGlyph();
            cell.energy = Math.max(cell.energy, stream.brightnessBias);
            cell.decayRate = decayRate;
            const isNewest = r === currRow;
            cell.isHead = isNewest;
            cell.headFlash = isNewest ? 1.0 : 0.45;
          }

          // Clear previous head flag cleanly
          if (prevRow >= 0 && prevRow < rows) {
            cells[prevRow * cols + stream.col].isHead = false;
          }

          stream.lastRow = currRow;
        }

        // Stream finishes after passing bottom of screen
        if (currRow > rows + 2) {
          stream.active = false;
          const sparsity = 1.15 - densityTarget;
          stream.respawnDelay = 0.15 + Math.random() * (0.9 + sparsity * 3.8);
        }
      }
    };

    const drawLayer = (
      layer: RainLayer,
      s: MatrixSettings,
      palette: PaletteConfig,
      timeSec: number
    ) => {
      const [pr, pg, pb] = palette.primaryRgb;
      const [dr, dg, db] = palette.deepRgb;
      const { cols, rows, cellW, cellH, fontSize, cells, isBackground } = layer;

      ctx.font = `${isBackground ? 400 : 600} ${fontSize}px "JetBrains Mono", "Hiragino Kaku Gothic ProN", "Yu Gothic", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const mirrorSign = s.mirrored ? -1 : 1;
      const glowStrength = s.glow;

      // Batch regular glyphs first (shadowBlur = 0 for buttery 60fps)
      ctx.shadowBlur = 0;

      const brightHeads: Array<{ x: number; y: number; char: string; flash: number }> = [];

      for (let r = 0; r < rows; r++) {
        const y = r * cellH + cellH * 0.5;
        const rowOffset = r * cols;

        for (let c = 0; c < cols; c++) {
          const cell = cells[rowOffset + c];
          const e = cell.energy;
          if (e <= 0.015) continue;

          const x = c * cellW + cellW * 0.5;

          // Subtle organic CRT flicker
          const shimmer =
            0.91 + 0.09 * Math.sin(timeSec * 5.2 + cell.flickerPhase);
          const lum = Math.min(1, e * shimmer);

          if (!isBackground && cell.headFlash > 0.35) {
            brightHeads.push({ x, y, char: cell.char, flash: cell.headFlash });
            continue;
          }

          // Smooth color ramp from deep forest tail -> vibrant Matrix phosphor green
          const mix = Math.pow(lum, 0.85);
          const rr = Math.round(dr + (pr - dr) * mix);
          const gg = Math.round(dg + (pg - dg) * mix);
          const bb = Math.round(db + (pb - db) * mix);
          const alpha = isBackground
            ? Math.min(0.45, Math.pow(lum, 1.15) * 0.65)
            : Math.min(1, Math.pow(lum, 0.92));

          ctx.fillStyle = `rgba(${rr}, ${gg}, ${bb}, ${alpha.toFixed(3)})`;

          if (mirrorSign === -1) {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(-1, 1);
            ctx.fillText(cell.char, 0, 0);
            ctx.restore();
          } else {
            ctx.fillText(cell.char, x, y);
          }
        }
      }

      // Draw leading white-hot head glyphs with crisp phosphor bloom
      if (brightHeads.length > 0) {
        const blurPx = glowStrength > 0.01 ? Math.round(fontSize * 0.72 * glowStrength) : 0;
        ctx.shadowColor = palette.headGlow;
        ctx.shadowBlur = blurPx;

        for (let i = 0; i < brightHeads.length; i++) {
          const h = brightHeads[i];
          ctx.fillStyle = h.flash > 0.72 ? palette.head : `rgba(${Math.min(255, pr + 95)}, ${Math.min(255, pg + 55)}, ${Math.min(255, pb + 95)}, 0.98)`;
          if (mirrorSign === -1) {
            ctx.save();
            ctx.translate(h.x, h.y);
            ctx.scale(-1, 1);
            ctx.fillText(h.char, 0, 0);
            ctx.restore();
          } else {
            ctx.fillText(h.char, h.x, h.y);
          }
        }
        ctx.shadowBlur = 0;
      }
    };

    const pickRandomTarget = (prevHue: number) => {
      // Jump by 60°–300° so each new random target feels distinctly different
      const nextHue = (prevHue + 60 + Math.random() * 240) % 360;
      const sat = 0.82 + Math.random() * 0.16;
      const light = 0.53 + Math.random() * 0.08;
      return { hue: nextHue, rgb: hslToRgb(nextHue, sat, light) };
    };

    const initialRgb = resolvePalette(settingsRef.current).primaryRgb;
    const firstTarget = pickRandomTarget(135);
    const randomColorState = {
      wasRandom: settingsRef.current.palette === 'random',
      fromRgb: [...initialRgb] as [number, number, number],
      toRgb: firstTarget.rgb,
      currentRgb: [...initialRgb] as [number, number, number],
      targetHue: firstTarget.hue,
      progress: 0,
    };

    let smoothedSpeed = screensaverRef.current
      ? SCREENSAVER_CALM_SPEED
      : settingsRef.current.speed;
    let rafId = 0;
    let lastTimestamp = performance.now();

    const frame = (now: number) => {
      rafId = window.requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0.001, (now - lastTimestamp) / 1000));
      lastTimestamp = now;

      const s = settingsRef.current;

      // Smoothly glide rain speed into a calm, hypnotic pace when screensaver engages
      const targetSpeed = screensaverRef.current
        ? Math.min(s.speed, SCREENSAVER_CALM_SPEED)
        : s.speed;
      smoothedSpeed += (targetSpeed - smoothedSpeed) * Math.min(1, dt * 1.8);

      // Rebuild grid cleanly if font size changed
      if (s.fontSize !== lastFontSize) {
        rebuildLayers(true);
      } else if (Math.abs(s.density - lastDensity) > 0.01 || s.trailLength !== lastTrail) {
        lastDensity = s.density;
        lastTrail = s.trailLength;
      }

      if (!pausedRef.current) {
        if (s.depthLayers && bgLayer) {
          stepLayer(bgLayer, dt, s, smoothedSpeed);
        }
        if (fgLayer) {
          stepLayer(fgLayer, dt, s, smoothedSpeed);
        }
      }

      // Resolve active palette (with smooth gradual random cross-fading in Random Cycle mode)
      let activePalette: PaletteConfig;
      if (s.palette === 'random') {
        if (!randomColorState.wasRandom) {
          // Seamlessly transition starting from whatever color was just on screen
          randomColorState.wasRandom = true;
          randomColorState.fromRgb = [...randomColorState.currentRgb];
          const next = pickRandomTarget(randomColorState.targetHue);
          randomColorState.targetHue = next.hue;
          randomColorState.toRgb = next.rgb;
          randomColorState.progress = 0;
        }

        if (!pausedRef.current) {
          const duration = Math.max(1.5, s.randomCycleSeconds);
          randomColorState.progress += dt / duration;
          if (randomColorState.progress >= 1) {
            randomColorState.fromRgb = [...randomColorState.toRgb];
            const next = pickRandomTarget(randomColorState.targetHue);
            randomColorState.targetHue = next.hue;
            randomColorState.toRgb = next.rgb;
            randomColorState.progress %= 1;
          }
        }

        const p = randomColorState.progress;
        // Smoothstep ease-in-out curve for organic, gradual color blending
        const ease = p * p * (3 - 2 * p);
        const r = Math.round(
          randomColorState.fromRgb[0] +
            (randomColorState.toRgb[0] - randomColorState.fromRgb[0]) * ease
        );
        const g = Math.round(
          randomColorState.fromRgb[1] +
            (randomColorState.toRgb[1] - randomColorState.fromRgb[1]) * ease
        );
        const b = Math.round(
          randomColorState.fromRgb[2] +
            (randomColorState.toRgb[2] - randomColorState.fromRgb[2]) * ease
        );
        randomColorState.currentRgb = [r, g, b];
        activePalette = createPaletteFromRgb(
          randomColorState.currentRgb,
          'random',
          'Random Cycle'
        );
      } else {
        activePalette = resolvePalette(s);
        randomColorState.wasRandom = false;
        randomColorState.currentRgb = [...activePalette.primaryRgb];
      }

      // Render pure black background + parallax layers
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      const timeSec = now * 0.001;
      if (s.depthLayers && bgLayer) {
        drawLayer(bgLayer, s, activePalette, timeSec);
      }
      if (fgLayer) {
        drawLayer(fgLayer, s, activePalette, timeSec);
      }
    };

    rafId = window.requestAnimationFrame(frame);

    return () => {
      window.cancelAnimationFrame(rafId);
      if (resizeTimer !== null) window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-label="Full-screen Matrix digital rain animation"
      className="fixed inset-0 block w-full h-full bg-black"
    />
  );
}
