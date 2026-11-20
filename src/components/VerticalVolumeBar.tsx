import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

interface VerticalVolumeBarProps {
  volume: number; // 0.05 to 1
  onChange: (nextVolume: number) => void;
  accentHex: string;
  accentGlow: string;
  compact?: boolean;
}

export function VerticalVolumeBar({
  volume,
  onChange,
  accentHex,
  accentGlow,
  compact = false,
}: VerticalVolumeBarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      if (rect.height <= 0) return;
      // Top of track = 1.0 (100%), bottom of track = 0.05 (5%)
      const ratio = 1 - (clientY - rect.top) / rect.height;
      const clamped = Math.max(0.05, Math.min(1, Math.round(ratio * 100) / 100));
      onChange(clamped);
    },
    [onChange]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientY(e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    e.stopPropagation();
    updateFromClientY(e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault();
      onChange(Math.min(1, Math.round((volume + 0.05) * 100) / 100));
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault();
      onChange(Math.max(0.05, Math.round((volume - 0.05) * 100) / 100));
    }
  };

  const pct = Math.round(volume * 100);

  return (
    <div
      data-matrix-ui="true"
      className={`flex flex-col items-center select-none ${
        compact ? 'gap-2 py-2.5 px-2' : 'gap-2.5 py-3 px-2.5'
      }`}
    >
      {/* Numeric percentage readout at top */}
      <span className="font-matrix-mono text-[10px] font-semibold tracking-tight text-zinc-200">
        {pct}%
      </span>

      {/* Interactive vertical slider track */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Ambient sound volume"
        aria-orientation="vertical"
        aria-valuemin={5}
        aria-valuemax={100}
        aria-valuenow={pct}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onKeyDown={handleKeyDown}
        className={`relative flex w-6 cursor-pointer items-end justify-center touch-none focus-visible:outline-2 focus-visible:outline-white rounded-md ${
          compact ? 'h-24' : 'h-28'
        }`}
      >
        {/* Inner rail */}
        <div className="relative h-full w-1.5 overflow-hidden rounded-full bg-white/14">
          {/* Active phosphor fill bar from bottom */}
          <div
            className="absolute bottom-0 left-0 right-0 rounded-full transition-[height] duration-75"
            style={{
              height: `${pct}%`,
              backgroundColor: accentHex,
              boxShadow: `0 0 10px ${accentGlow}`,
            }}
          />
        </div>

        {/* Glowing thumb handle */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 h-3.5 w-3.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-zinc-950 transition-[bottom] duration-75"
          style={{
            bottom: `${pct}%`,
            backgroundColor: accentHex,
            boxShadow: `0 0 10px ${accentGlow}`,
          }}
        />
      </div>
    </div>
  );
}

interface FloatingAudioSwitchProps {
  audioEnabled: boolean;
  volume: number;
  onToggle: () => void;
  onVolumeChange: (nextVolume: number) => void;
  accentHex: string;
  accentGlow: string;
}

/**
 * Floating bottom-right audio switch button:
 * - Clicking the button toggles between Muted and Unmuted.
 * - When Unmuted, hovering over the audio icon (or the volume bar above it)
 *   displays the vertical sound volume bar, and moving the pointer away hides it
 *   and returns the icon to its default color.
 */
export function FloatingAudioSwitch({
  audioEnabled,
  volume,
  onToggle,
  onVolumeChange,
  accentHex,
  accentGlow,
}: FloatingAudioSwitchProps) {
  const [isHovered, setIsHovered] = useState(false);
  const showBar = audioEnabled && isHovered;

  return (
    <div
      data-matrix-ui="true"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      className="relative flex flex-col items-center"
    >
      {/* Vertical volume bar displayed above the switch only while hovered and unmuted */}
      {showBar && (
        <div className="pb-2">
          <div className="w-11 rounded-xl border border-white/14 bg-black/75 backdrop-blur-md shadow-xl">
            <VerticalVolumeBar
              volume={volume}
              onChange={onVolumeChange}
              accentHex={accentHex}
              accentGlow={accentGlow}
              compact
            />
          </div>
        </div>
      )}

      {/* Audio mute/unmute switch button */}
      <button
        type="button"
        role="switch"
        aria-checked={audioEnabled}
        aria-label={audioEnabled ? 'Mute ambient sound' : 'Unmute ambient sound'}
        title={audioEnabled ? 'Mute audio (M)' : 'Unmute audio (M)'}
        onClick={onToggle}
        className={`flex h-11 w-11 items-center justify-center rounded-xl border backdrop-blur-md transition-colors focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white ${
          showBar
            ? 'border-white/25 bg-black/80 text-white'
            : 'border-white/12 bg-black/55 text-zinc-200 hover:bg-black/80 hover:text-white'
        }`}
        style={
          showBar
            ? {
                borderColor: accentHex,
                boxShadow: `0 0 12px ${accentGlow}`,
              }
            : undefined
        }
      >
        {audioEnabled ? (
          <Volume2
            className="h-4 w-4 transition-colors"
            style={showBar ? { color: accentHex } : undefined}
          />
        ) : (
          <VolumeX className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
