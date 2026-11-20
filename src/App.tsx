import { useCallback, useEffect, useRef, useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { MatrixRainCanvas } from './components/MatrixRainCanvas';
import { ControlPanel } from './components/ControlPanel';
import { FloatingAudioSwitch } from './components/VerticalVolumeBar';
import { MatrixAudioEngine } from './audio/matrixAudio';
import {
  DEFAULT_SETTINGS,
  MatrixSettings,
  SCREENSAVER_CALM_SPEED,
  resolvePalette,
} from './types/matrix';

export default function App() {
  const [settings, setSettings] = useState<MatrixSettings>(() => {
    // Respect prefers-reduced-motion gently while preserving full-page rain
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return { ...DEFAULT_SETTINGS, speed: 0.4, glow: 0.45 };
    }
    return DEFAULT_SETTINGS;
  });

  const [paused, setPaused] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);
  const [uiHidden, setUiHidden] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buttonDimmed, setButtonDimmed] = useState(false);
  const [screensaverActive, setScreensaverActive] = useState(false);

  const audioEngineRef = useRef<MatrixAudioEngine | null>(null);
  // Brief grace period after manually starting screensaver so mouse-up doesn't wake immediately
  const screensaverGraceUntilRef = useRef<number>(0);

  const getAudioEngine = useCallback(() => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new MatrixAudioEngine();
    }
    return audioEngineRef.current;
  }, []);

  // Clean up audio context on unmount
  useEffect(() => {
    return () => {
      audioEngineRef.current?.dispose();
      audioEngineRef.current = null;
    };
  }, []);

  const effectiveSpeed = screensaverActive
    ? Math.min(settings.speed, SCREENSAVER_CALM_SPEED)
    : settings.speed;

  // Sync audio parameters dynamically with rain speed (including calm screensaver pace), density, volume, and pause state
  useEffect(() => {
    const engine = audioEngineRef.current;
    if (!engine) return;
    engine.updateParams({
      speed: effectiveSpeed,
      density: settings.density,
      volume: settings.audioVolume,
      paused,
    });
  }, [effectiveSpeed, settings.density, settings.audioVolume, paused]);

  const handleSettingsChange = useCallback(
    (next: Partial<MatrixSettings>) => {
      // Trigger Web Audio directly inside the user interaction event when toggling sound
      if (typeof next.audioEnabled === 'boolean') {
        const engine = getAudioEngine();
        engine.updateParams({
          speed: next.speed ?? effectiveSpeed,
          density: next.density ?? settings.density,
          volume: next.audioVolume ?? settings.audioVolume,
          paused,
        });
        engine.setEnabled(next.audioEnabled);
      }
      setSettings((prev) => ({ ...prev, ...next }));
    },
    [getAudioEngine, effectiveSpeed, settings.density, settings.audioVolume, paused]
  );

  const handleToggleAudio = useCallback(() => {
    const nextEnabled = !settings.audioEnabled;
    const engine = getAudioEngine();
    engine.updateParams({
      speed: effectiveSpeed,
      density: settings.density,
      volume: settings.audioVolume,
      paused,
    });
    engine.setEnabled(nextEnabled);
    setSettings((prev) => ({ ...prev, audioEnabled: nextEnabled }));
  }, [
    getAudioEngine,
    settings.audioEnabled,
    effectiveSpeed,
    settings.density,
    settings.audioVolume,
    paused,
  ]);

  const handleReset = useCallback(() => {
    audioEngineRef.current?.setEnabled(false);
    setSettings(DEFAULT_SETTINGS);
    setPaused(false);
    setScreensaverActive(false);
  }, []);

  const handleStartScreensaver = useCallback(() => {
    screensaverGraceUntilRef.current = performance.now() + 500;
    setControlsOpen(false);
    setScreensaverActive(true);
  }, []);

  const handleRipple = useCallback((normalizedX: number) => {
    audioEngineRef.current?.triggerRippleClick(normalizedX);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {
        // Ignore if blocked by iframe sandbox permissions
      });
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Inactivity tracking: dims buttons after 3.5s and triggers full Screensaver Mode after configured delay
  useEffect(() => {
    let dimTimer: number | null = null;
    let screensaverTimer: number | null = null;
    let lastX = -1;
    let lastY = -1;

    const clearTimers = () => {
      if (dimTimer !== null) window.clearTimeout(dimTimer);
      if (screensaverTimer !== null) window.clearTimeout(screensaverTimer);
    };

    const scheduleTimers = () => {
      clearTimers();

      dimTimer = window.setTimeout(() => {
        setButtonDimmed(true);
      }, 3500);

      if (settings.screensaverEnabled) {
        screensaverTimer = window.setTimeout(() => {
          setControlsOpen(false);
          setScreensaverActive(true);
        }, settings.screensaverDelaySeconds * 1000);
      }
    };

    const wakeFromActivity = () => {
      setButtonDimmed(false);
      setScreensaverActive(false);
      scheduleTimers();
    };

    const onPointerMove = (e: PointerEvent) => {
      if (performance.now() < screensaverGraceUntilRef.current) return;
      // Ignore tiny sub-pixel sensor jitter while in screensaver
      if (lastX >= 0 && Math.hypot(e.clientX - lastX, e.clientY - lastY) < 4) {
        return;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      wakeFromActivity();
    };

    const onDiscreteActivity = () => {
      if (performance.now() < screensaverGraceUntilRef.current) return;
      wakeFromActivity();
    };

    // If user disabled screensaver while active, exit it cleanly
    if (!settings.screensaverEnabled) {
      setScreensaverActive(false);
    }

    scheduleTimers();

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onDiscreteActivity, { passive: true });
    window.addEventListener('keydown', onDiscreteActivity);
    window.addEventListener('wheel', onDiscreteActivity, { passive: true });
    window.addEventListener('touchstart', onDiscreteActivity, { passive: true });

    return () => {
      clearTimers();
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerdown', onDiscreteActivity);
      window.removeEventListener('keydown', onDiscreteActivity);
      window.removeEventListener('wheel', onDiscreteActivity);
      window.removeEventListener('touchstart', onDiscreteActivity);
    };
  }, [settings.screensaverEnabled, settings.screensaverDelaySeconds]);

  // Keyboard shortcuts: Space (pause), M (mute/unmute), C (controls), H (hide UI), F (fullscreen), Esc (close/restore)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setPaused((p) => !p);
      } else if (e.key === 'm' || e.key === 'M') {
        handleToggleAudio();
      } else if (e.key === 'h' || e.key === 'H') {
        setUiHidden((hidden) => {
          const next = !hidden;
          if (next) setControlsOpen(false);
          return next;
        });
      } else if (e.key === 'c' || e.key === 'C') {
        setUiHidden(false);
        setControlsOpen((open) => !open);
      } else if (e.key === 'f' || e.key === 'F') {
        handleToggleFullscreen();
      } else if (e.key === 'Escape') {
        if (controlsOpen) setControlsOpen(false);
        else if (uiHidden) setUiHidden(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [controlsOpen, uiHidden, handleToggleFullscreen, handleToggleAudio]);

  // Close the settings panel when clicking or touching outside of it
  useEffect(() => {
    if (!controlsOpen) return;

    const handleOutsidePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && target.closest('[data-matrix-ui="true"]')) {
        return;
      }
      setControlsOpen(false);
    };

    window.addEventListener('pointerdown', handleOutsidePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handleOutsidePointerDown);
    };
  }, [controlsOpen]);

  const showFloatingButtons = !uiHidden && !controlsOpen && !screensaverActive;
  const showRestoreHotspot = uiHidden && !screensaverActive;
  const activePalette = resolvePalette(settings);

  return (
    <main
      className={`relative h-screen w-screen overflow-hidden bg-black ${
        screensaverActive ? 'cursor-none' : ''
      }`}
    >
      {/* Full-viewport Digital Rain Canvas */}
      <MatrixRainCanvas
        settings={settings}
        paused={paused}
        screensaverActive={screensaverActive}
        onRipple={handleRipple}
      />

      {/* Optional subtle CRT scanline and screen vignette overlay */}
      {settings.scanlines && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-10 crt-scanlines crt-vignette"
        />
      )}

      {/* Discreet floating corner actions so the page stays pure unobstructed rain */}
      {showFloatingButtons && (
        <div
          data-matrix-ui="true"
          className={`fixed bottom-5 right-5 z-20 flex items-end gap-2 transition-opacity duration-300 ${
            buttonDimmed ? 'opacity-25 hover:opacity-100' : 'opacity-85 hover:opacity-100'
          }`}
        >
          <FloatingAudioSwitch
            audioEnabled={settings.audioEnabled}
            volume={settings.audioVolume}
            onToggle={handleToggleAudio}
            onVolumeChange={(nextVol) =>
              handleSettingsChange({ audioVolume: nextVol })
            }
            accentHex={activePalette.accentHex}
            accentGlow={activePalette.accentGlow}
          />

          <button
            type="button"
            onClick={() => setControlsOpen(true)}
            aria-label="Open digital rain settings"
            title="Settings (C)"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/12 bg-black/55 text-zinc-200 backdrop-blur-md transition-colors hover:bg-black/80 hover:text-white focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Invisible bottom-right corner restore zone when UI is manually hidden */}
      {showRestoreHotspot && (
        <button
          type="button"
          data-matrix-ui="true"
          onClick={() => setUiHidden(false)}
          aria-label="Show controls"
          title="Show controls (H)"
          className="fixed bottom-4 right-4 z-20 flex h-11 items-center justify-center rounded-xl border border-white/10 bg-black/65 px-3 text-xs font-medium text-zinc-200 opacity-0 backdrop-blur-md transition-opacity duration-200 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white"
        >
          Show Controls
        </button>
      )}

      {/* Collapsible Controls Drawer */}
      <ControlPanel
        open={controlsOpen && !uiHidden && !screensaverActive}
        onClose={() => setControlsOpen(false)}
        settings={settings}
        onChange={handleSettingsChange}
        onReset={handleReset}
        paused={paused}
        onTogglePause={() => setPaused((p) => !p)}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
        onHideUi={() => {
          setControlsOpen(false);
          setUiHidden(true);
        }}
        onStartScreensaver={handleStartScreensaver}
      />
    </main>
  );
}
