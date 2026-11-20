import React, { useEffect, useRef, useState } from 'react';
import {
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  X,
  EyeOff,
  Moon,
  Pipette,
  Shuffle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  MatrixSettings,
  PALETTES,
  PRESET_PALETTE_ORDER,
  parseHexColor,
  resolvePalette,
} from '../types/matrix';
import { VerticalVolumeBar } from './VerticalVolumeBar';

interface ControlPanelProps {
  open: boolean;
  onClose: () => void;
  settings: MatrixSettings;
  onChange: (next: Partial<MatrixSettings>) => void;
  onReset: () => void;
  paused: boolean;
  onTogglePause: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onHideUi: () => void;
  onStartScreensaver: () => void;
}

export function ControlPanel({
  open,
  onClose,
  settings,
  onChange,
  onReset,
  paused,
  onTogglePause,
  isFullscreen,
  onToggleFullscreen,
  onHideUi,
  onStartScreensaver,
}: ControlPanelProps) {
  const palette = resolvePalette(settings);
  const [hexDraft, setHexDraft] = useState(palette.accentHex.toUpperCase());
  const [volumeBarOpen, setVolumeBarOpen] = useState(settings.audioEnabled);
  const audioSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setHexDraft(palette.accentHex.toUpperCase());
  }, [palette.accentHex]);

  useEffect(() => {
    setVolumeBarOpen(settings.audioEnabled);
  }, [settings.audioEnabled]);

  useEffect(() => {
    if (!open || !volumeBarOpen) return;

    const handleOutsideVolumeBar = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (
        audioSectionRef.current &&
        target &&
        audioSectionRef.current.contains(target)
      ) {
        return;
      }
      setVolumeBarOpen(false);
    };

    window.addEventListener('pointerdown', handleOutsideVolumeBar);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideVolumeBar);
    };
  }, [open, volumeBarOpen]);

  if (!open) return null;

  const sliderStyle = {
    '--slider-accent': palette.accentHex,
    '--slider-glow': palette.accentGlow,
  } as React.CSSProperties;

  const handleColorPickerChange = (hex: string) => {
    const normalized = hex.toUpperCase();
    setHexDraft(normalized);
    onChange({ palette: 'custom', customColor: normalized });
  };

  const handleHexInputChange = (raw: string) => {
    const formatted = raw.startsWith('#') ? raw : `#${raw}`;
    setHexDraft(formatted.toUpperCase());
    if (parseHexColor(formatted)) {
      onChange({ palette: 'custom', customColor: formatted.toUpperCase() });
    }
  };

  const handleHexInputBlur = () => {
    if (!parseHexColor(hexDraft)) {
      setHexDraft(palette.accentHex.toUpperCase());
    }
  };

  return (
    <aside
      data-matrix-ui="true"
      aria-label="Digital rain controls"
      style={sliderStyle}
      className="fixed bottom-5 right-5 z-30 w-[min(340px,calc(100vw-2rem))] max-h-[calc(100vh-2.5rem)] overflow-y-auto rounded-xl border border-white/12 bg-zinc-950/88 p-5 text-zinc-100 shadow-2xl backdrop-blur-xl transition-opacity duration-200"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/10">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">
            Digital Rain Settings
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Click anywhere on screen to trigger a ripple
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close controls"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/10 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Primary quick actions */}
      <div className="grid grid-cols-3 gap-2 py-4 border-b border-white/10">
        <button
          type="button"
          onClick={onTogglePause}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-white/12 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
        >
          {paused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
          <span>{paused ? 'Resume' : 'Pause'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleFullscreen}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-white/12 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
        >
          {isFullscreen ? (
            <Minimize2 className="h-3.5 w-3.5" />
          ) : (
            <Maximize2 className="h-3.5 w-3.5" />
          )}
          <span>{isFullscreen ? 'Exit Full' : 'Fullscreen'}</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-3 py-2 text-xs font-medium text-zinc-100 hover:bg-white/12 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span>Reset</span>
        </button>
      </div>

      {/* Ambient Audio (CRT Hum + Digital Clicks) */}
      <div
        ref={audioSectionRef}
        className="py-4 border-b border-white/10"
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              if (settings.audioEnabled) {
                setVolumeBarOpen((v) => !v);
              } else {
                onChange({ audioEnabled: true });
                setVolumeBarOpen(true);
              }
            }}
            className="flex items-center gap-2.5 min-w-0 text-left focus-visible:outline-2 focus-visible:outline-white rounded-md"
          >
            {settings.audioEnabled ? (
              <Volume2
                className="h-4 w-4 shrink-0 text-zinc-200 transition-colors"
                style={volumeBarOpen ? { color: palette.accentHex } : undefined}
              />
            ) : (
              <VolumeX className="h-4 w-4 shrink-0 text-zinc-500" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-medium text-zinc-200">
                Ambient Sound
              </div>
              <div className="text-[11px] text-zinc-400 truncate">
                {settings.audioEnabled
                  ? `Unmuted · ${Math.round(settings.audioVolume * 100)}%`
                  : 'Muted · CRT hum & clicks'}
              </div>
            </div>
          </button>

          {/* Mute / Unmute Switch Button */}
          <button
            type="button"
            role="switch"
            aria-checked={settings.audioEnabled}
            aria-label={
              settings.audioEnabled ? 'Mute ambient sound' : 'Unmute ambient sound'
            }
            onClick={() => {
              const next = !settings.audioEnabled;
              onChange({ audioEnabled: next });
              setVolumeBarOpen(next);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-white ${
              settings.audioEnabled
                ? 'border-white/25 bg-white/20'
                : 'border-white/10 bg-white/6'
            }`}
          >
            <span
              className="inline-block h-4 w-4 rounded-full transition-transform duration-150"
              style={{
                transform: settings.audioEnabled
                  ? 'translateX(22px)'
                  : 'translateX(3px)',
                backgroundColor: settings.audioEnabled
                  ? palette.accentHex
                  : '#71717a',
              }}
            />
          </button>
        </div>

        {/* Vertical sound volume bar displayed when unmuted and not dismissed */}
        {settings.audioEnabled && volumeBarOpen && (
          <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/45 px-4 py-2">
            <div className="space-y-1">
              <div className="text-xs font-medium text-zinc-200">
                Sound Volume
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Drag the vertical bar to adjust CRT hum and digital click level.
              </p>
            </div>
            <div className="shrink-0 rounded-lg border border-white/12 bg-zinc-900/80">
              <VerticalVolumeBar
                volume={settings.audioVolume}
                onChange={(nextVol) => onChange({ audioVolume: nextVol })}
                accentHex={palette.accentHex}
                accentGlow={palette.accentGlow}
                compact
              />
            </div>
          </div>
        )}
      </div>

      {/* Color Themes & Custom Picker */}
      <div className="py-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-medium text-zinc-300">Rain Color</span>
          <span className="font-matrix-mono text-[11px] text-zinc-400">
            {palette.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {PRESET_PALETTE_ORDER.map((id) => {
            const p = PALETTES[id];
            const active = settings.palette === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() =>
                  onChange({ palette: id, customColor: p.accentHex })
                }
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white ${
                  active
                    ? 'bg-white/14 text-white border border-white/30'
                    : 'bg-white/4 text-zinc-300 border border-white/8 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: p.accentHex }}
                />
                <span className="truncate">{p.label}</span>
              </button>
            );
          })}
        </div>

        {/* Random gradual color cycle toggle */}
        <button
          type="button"
          onClick={() => onChange({ palette: 'random' })}
          aria-pressed={settings.palette === 'random'}
          className={`mt-2.5 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-white ${
            settings.palette === 'random'
              ? 'border-white/30 bg-white/14 text-white'
              : 'border-white/8 bg-white/4 text-zinc-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2.5 w-2.5 rounded-sm shrink-0"
              style={{
                background:
                  'conic-gradient(#22EE5C, #30A8FF, #B068FF, #FF384C, #FFB020, #22EE5C)',
              }}
            />
            <span>Random Cycle</span>
          </span>
          <Shuffle className="h-3.5 w-3.5 text-zinc-400" />
        </button>

        {settings.palette === 'random' && (
          <div className="mt-2.5 px-0.5">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label
                htmlFor="matrix-random-pace"
                className="font-medium text-zinc-400"
              >
                Color Shift Pace
              </label>
              <span className="font-matrix-mono text-zinc-300">
                {settings.randomCycleSeconds}s
              </span>
            </div>
            <input
              id="matrix-random-pace"
              type="range"
              min={2}
              max={15}
              step={1}
              value={settings.randomCycleSeconds}
              onChange={(e) =>
                onChange({ randomCycleSeconds: parseInt(e.target.value, 10) })
              }
              className="matrix-slider"
            />
          </div>
        )}

        {/* Custom color picker + hex input */}
        <div
          className={`mt-2.5 flex items-center justify-between gap-2.5 rounded-lg border px-3 py-2 transition-colors ${
            settings.palette === 'custom'
              ? 'border-white/30 bg-white/12'
              : 'border-white/10 bg-white/4'
          }`}
        >
          <label
            htmlFor="matrix-custom-color"
            className="flex items-center gap-2 text-xs font-medium text-zinc-200 cursor-pointer shrink-0"
          >
            <Pipette className="h-3.5 w-3.5 text-zinc-400" />
            <span>Custom</span>
          </label>

          <div className="flex items-center gap-2">
            <input
              type="text"
              aria-label="Custom hex color code"
              value={hexDraft}
              onChange={(e) => handleHexInputChange(e.target.value)}
              onBlur={handleHexInputBlur}
              maxLength={7}
              spellCheck={false}
              className="w-[78px] rounded-md border border-white/12 bg-black/50 px-2 py-1 text-right font-matrix-mono text-xs text-zinc-100 focus:border-white/40 focus:outline-none"
            />
            <label className="relative flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-white/25 shadow-inner">
              <span
                aria-hidden="true"
                className="h-full w-full"
                style={{ backgroundColor: palette.accentHex }}
              />
              <input
                id="matrix-custom-color"
                type="color"
                aria-label="Pick custom digital rain color"
                value={palette.accentHex}
                onChange={(e) => handleColorPickerChange(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Sliders */}
      <div className="space-y-4 py-4 border-b border-white/10">
        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="matrix-speed" className="font-medium text-zinc-300">
              Fall Speed
            </label>
            <span className="font-matrix-mono text-zinc-200">
              {settings.speed.toFixed(2)}×
            </span>
          </div>
          <input
            id="matrix-speed"
            type="range"
            min={0.25}
            max={2.5}
            step={0.05}
            value={settings.speed}
            onChange={(e) => onChange({ speed: parseFloat(e.target.value) })}
            className="matrix-slider"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="matrix-density" className="font-medium text-zinc-300">
              Stream Density
            </label>
            <span className="font-matrix-mono text-zinc-200">
              {Math.round(settings.density * 100)}%
            </span>
          </div>
          <input
            id="matrix-density"
            type="range"
            min={0.35}
            max={1.0}
            step={0.01}
            value={settings.density}
            onChange={(e) => onChange({ density: parseFloat(e.target.value) })}
            className="matrix-slider"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="matrix-size" className="font-medium text-zinc-300">
              Glyph Size
            </label>
            <span className="font-matrix-mono text-zinc-200">
              {settings.fontSize}px
            </span>
          </div>
          <input
            id="matrix-size"
            type="range"
            min={12}
            max={28}
            step={1}
            value={settings.fontSize}
            onChange={(e) => onChange({ fontSize: parseInt(e.target.value, 10) })}
            className="matrix-slider"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="matrix-trail" className="font-medium text-zinc-300">
              Trail Length
            </label>
            <span className="font-matrix-mono text-zinc-200">
              {settings.trailLength} cells
            </span>
          </div>
          <input
            id="matrix-trail"
            type="range"
            min={10}
            max={44}
            step={1}
            value={settings.trailLength}
            onChange={(e) => onChange({ trailLength: parseInt(e.target.value, 10) })}
            className="matrix-slider"
          />
        </div>

        <div>
          <div className="flex items-center justify-between text-xs mb-1.5">
            <label htmlFor="matrix-glow" className="font-medium text-zinc-300">
              Phosphor Glow
            </label>
            <span className="font-matrix-mono text-zinc-200">
              {Math.round(settings.glow * 100)}%
            </span>
          </div>
          <input
            id="matrix-glow"
            type="range"
            min={0}
            max={1}
            step={0.02}
            value={settings.glow}
            onChange={(e) => onChange({ glow: parseFloat(e.target.value) })}
            className="matrix-slider"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-2.5 py-4 border-b border-white/10">
        {(
          [
            {
              key: 'mirrored',
              label: 'Mirrored Katakana',
              value: settings.mirrored,
            },
            {
              key: 'depthLayers',
              label: 'Background Depth Layer',
              value: settings.depthLayers,
            },
            {
              key: 'scanlines',
              label: 'CRT Scanlines',
              value: settings.scanlines,
            },
            {
              key: 'interactive',
              label: 'Pointer Ripple',
              value: settings.interactive,
            },
          ] as const
        ).map((item) => (
          <div
            key={item.key}
            className="flex items-center justify-between gap-3 py-0.5"
          >
            <span className="text-xs font-medium text-zinc-300">{item.label}</span>
            <button
              type="button"
              role="switch"
              aria-checked={item.value}
              aria-label={item.label}
              onClick={() => onChange({ [item.key]: !item.value })}
              className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                item.value
                  ? 'border-white/25 bg-white/20'
                  : 'border-white/10 bg-white/6'
              }`}
            >
              <span
                className="inline-block h-4 w-4 rounded-full transition-transform duration-150"
                style={{
                  transform: item.value ? 'translateX(20px)' : 'translateX(3px)',
                  backgroundColor: item.value ? palette.accentHex : '#71717a',
                }}
              />
            </button>
          </div>
        ))}

        {/* Auto Screensaver Mode */}
        <div className="pt-2.5 mt-2.5 border-t border-white/10">
          <div className="flex items-center justify-between gap-3 py-0.5">
            <div className="flex items-center gap-2 min-w-0">
              <Moon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">
                Auto Screensaver
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.screensaverEnabled}
              aria-label="Auto Screensaver"
              onClick={() =>
                onChange({ screensaverEnabled: !settings.screensaverEnabled })
              }
              className={`relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                settings.screensaverEnabled
                  ? 'border-white/25 bg-white/20'
                  : 'border-white/10 bg-white/6'
              }`}
            >
              <span
                className="inline-block h-4 w-4 rounded-full transition-transform duration-150"
                style={{
                  transform: settings.screensaverEnabled
                    ? 'translateX(20px)'
                    : 'translateX(3px)',
                  backgroundColor: settings.screensaverEnabled
                    ? palette.accentHex
                    : '#71717a',
                }}
              />
            </button>
          </div>

          {settings.screensaverEnabled && (
            <div className="mt-3 space-y-2.5">
              <div>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <label
                    htmlFor="matrix-screensaver-delay"
                    className="font-medium text-zinc-400"
                  >
                    Inactivity Delay
                  </label>
                  <span className="font-matrix-mono text-zinc-300">
                    {settings.screensaverDelaySeconds}s
                  </span>
                </div>
                <input
                  id="matrix-screensaver-delay"
                  type="range"
                  min={10}
                  max={120}
                  step={5}
                  value={settings.screensaverDelaySeconds}
                  onChange={(e) =>
                    onChange({
                      screensaverDelaySeconds: parseInt(e.target.value, 10),
                    })
                  }
                  className="matrix-slider"
                />
              </div>

              <button
                type="button"
                onClick={onStartScreensaver}
                className="w-full rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-white/12 hover:text-white transition-colors focus-visible:outline-2 focus-visible:outline-white"
              >
                Start Screensaver Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Pure wallpaper mode footer */}
      <div className="pt-3.5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onHideUi}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-400 hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
        >
          <EyeOff className="h-3.5 w-3.5" />
          <span>Hide Controls</span>
        </button>
        <span className="text-[11px] text-zinc-500 font-matrix-mono">
          Space Pause · M Audio · H Hide
        </span>
      </div>
    </aside>
  );
}
