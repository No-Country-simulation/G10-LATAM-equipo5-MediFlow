import { useEffect, useState } from 'react';

export interface HospitalDoorsTransitionProps {
  isOpen: boolean;
  onAnimationComplete: () => void;
}

interface DoorLeafProps {
  side: 'left' | 'right';
  isSliding: boolean;
}

const DoorLeaf = ({ side, isSliding }: DoorLeafProps) => {
  const isLeft = side === 'left';
  const slideClass = isSliding
    ? isLeft
      ? '-translate-x-[105%]'
      : 'translate-x-[105%]'
    : 'translate-x-0';

  const borderClass = isLeft
    ? 'border-r-2 border-slate-950 shadow-[1px_0_12px_rgba(6,182,212,0.35)]'
    : 'border-l-2 border-slate-950 shadow-[-1px_0_12px_rgba(6,182,212,0.35)]';

  return (
    <div
      className={`relative w-1/2 h-full bg-gradient-to-b from-slate-900 via-slate-800 to-slate-950 transition-transform duration-[850ms] ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col justify-between p-6 overflow-hidden ${slideClass} ${borderClass}`}
    >
      <div className="w-full flex items-center justify-between opacity-40">
        <span className="text-[9px] font-mono text-cyan-400 tracking-widest uppercase">
          {isLeft ? 'AIRLOCK // SEC-01' : 'PRESSURIZED // ISO-4'}
        </span>
        <div className="w-2 h-2 rounded-full border border-cyan-400/60" />
      </div>

      <div className="w-full space-y-8 opacity-25">
        <div className="h-px bg-slate-700" />
        <div className="h-px bg-slate-700" />
      </div>

      {isLeft ? (
        <div className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/90 border border-rose-500/40 rounded shadow-[0_0_12px_rgba(244,63,94,0.3)]">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse shadow-[0_0_6px_#f43f5e]" />
          <span className="text-[10px] font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-rose-500 to-rose-400">
            Medi Flow
          </span>
        </div>
      ) : (
        <div className="absolute top-1/2 -translate-y-1/2 left-4 flex items-center px-2 py-1 bg-slate-950/90 border border-slate-700 rounded shadow-inner">
          <div className="w-3 h-1.5 bg-slate-600 rounded-sm" />
        </div>
      )}

      <div className="w-full flex justify-between items-center opacity-30 text-[8px] font-mono text-slate-400">
        <span>BIO-HAZARD LVL 0</span>
        <span>SYS-OK</span>
      </div>
    </div>
  );
};

export const HospitalDoorsTransition = ({
  isOpen,
  onAnimationComplete,
}: HospitalDoorsTransitionProps) => {
  const [isSliding, setIsSliding] = useState(false);
  const [isPowered, setIsPowered] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    let slideTimer: number;
    let fadeTimer: number;
    let doneTimer: number;

    const rafId = window.requestAnimationFrame(() => {
      setIsPowered(true);

      slideTimer = window.setTimeout(() => {
        setIsSliding(true);
      }, 450);

      fadeTimer = window.setTimeout(() => {
        setIsFadingOut(true);
      }, 1250);

      doneTimer = window.setTimeout(() => {
        onAnimationComplete();
      }, 1650);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(slideTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(doneTimer);
    };
  }, [isOpen, onAnimationComplete]);

  if (!isOpen) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-50 overflow-hidden bg-slate-950 flex items-center justify-center select-none transition-all duration-500 ease-out pointer-events-auto ${
        isFadingOut ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
      }`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/40 via-slate-950/90 to-slate-950 pointer-events-none" />
      <div className="absolute bottom-0 w-[550px] sm:w-[700px] h-36 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />

      <div
        className={`relative w-[420px] sm:w-[500px] h-[85vh] max-h-[820px] p-3 sm:p-4 bg-gradient-to-b from-slate-900 via-zinc-900 to-slate-950 border border-slate-700/70 rounded-t-full rounded-b-3xl shadow-[0_0_60px_rgba(0,0,0,0.95)] flex flex-col items-center transition-transform duration-500 ease-out ${
          isFadingOut ? 'scale-110' : 'scale-100'
        }`}
      >
        <div className="absolute top-4 left-6 w-2 h-2 rounded-full bg-slate-800 border border-slate-600 shadow-inner" />
        <div className="absolute top-4 right-6 w-2 h-2 rounded-full bg-slate-800 border border-slate-600 shadow-inner" />
        <div className="absolute bottom-4 left-6 w-2 h-2 rounded-full bg-slate-800 border border-slate-600 shadow-inner" />
        <div className="absolute bottom-4 right-6 w-2 h-2 rounded-full bg-slate-800 border border-slate-600 shadow-inner" />

        <div
          className={`relative w-full h-full rounded-t-full rounded-b-2xl p-1 bg-slate-950 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-500 overflow-hidden ${
            isPowered
              ? 'drop-shadow-[0_0_12px_#22d3ee] drop-shadow-[0_0_35px_rgba(6,182,212,0.65)]'
              : 'opacity-70'
          }`}
        >
          <div className="absolute inset-0 rounded-t-full rounded-b-2xl border-2 border-white/90 pointer-events-none z-30 shadow-[inset_0_0_12px_#22d3ee,0_0_12px_#22d3ee]" />

          <div className="relative w-full h-full rounded-t-full rounded-b-2xl overflow-hidden flex bg-gradient-to-b from-cyan-950/30 via-slate-950 to-slate-900">
            <div
              className={`absolute inset-0 bg-cyan-400/20 blur-2xl transition-all duration-700 pointer-events-none ${
                isSliding ? 'opacity-100 scale-110' : 'opacity-0 scale-95'
              }`}
            />

            <DoorLeaf side="left" isSliding={isSliding} />
            <DoorLeaf side="right" isSliding={isSliding} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default HospitalDoorsTransition;
