const STACK_LABELS = [
  'Extrayendo hoja clínica...',
  'Clasificando páginas...',
  'Estructurando expediente...',
  'Dossier auditado y listo',
];

interface MediBotRunnerProps {
  activeStep: number;
}

const MediBotRunner = ({ activeStep }: MediBotRunnerProps) => (
  <div className="relative h-44 w-full overflow-hidden rounded-xl bg-slate-950 border border-slate-800/80 flex items-center justify-center select-none">
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(6,182,212,0.07)_0%,transparent_65%)] pointer-events-none" />
    <svg viewBox="0 0 420 120" className="w-full h-full max-w-lg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="scanRay" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0" />
        </linearGradient>
      </defs>

      <line x1="0" y1="104" x2="420" y2="104" stroke="#1e293b" strokeWidth="1.5" />
      <line x1="0" y1="104" x2="420" y2="104" stroke="#0891b2" strokeWidth="2" strokeDasharray="18 10" className="animate-track-left" />

      {/* No SVG transform on this group — CSS translateX uses view-box % coords */}
      <g className="animate-doc-incoming">
        <rect x="176" y="55" width="13" height="17" rx="1.5" fill="#0c1a2e" stroke="#22d3ee" strokeWidth="1" />
        <line x1="178.5" y1="59" x2="186.5" y2="59" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1="178.5" y1="62.5" x2="185" y2="62.5" stroke="#38bdf8" strokeWidth="0.8" />
        <line x1="178.5" y1="66" x2="183" y2="66" stroke="#22d3ee" strokeWidth="0.8" />
      </g>

      <g transform="translate(108, 5)">
        <g className="animate-leg-rear">
          <rect x="32" y="72" width="7" height="24" rx="3.5" fill="#0c4a6e" stroke="#0284c7" strokeWidth="1" />
          <rect x="29" y="94" width="13" height="5" rx="2.5" fill="#0369a1" />
        </g>
        <g className="animate-leg-front">
          <rect x="47" y="72" width="7" height="24" rx="3.5" fill="#0284c7" stroke="#38bdf8" strokeWidth="1" />
          <rect x="44" y="94" width="13" height="5" rx="2.5" fill="#38bdf8" />
        </g>

        <g className="animate-bot-bob">
          {/* Torso: left edge at x=28 */}
          <rect x="28" y="44" width="32" height="28" rx="5" fill="#0f172a" stroke="#0284c7" strokeWidth="1.5" />
          <path d="M 44 52 v 12 M 38 58 h 12" stroke="#22d3ee" strokeWidth="1.8" strokeLinecap="round" />
          {/* Arm extending forward right, hand at (72,56) → absolute (180,61) */}
          <path d="M 60 52 L 72 56" stroke="#0284c7" strokeWidth="4" strokeLinecap="round" />
          <circle cx="72" cy="56" r="3.5" fill="#38bdf8" />
          {/* Neck: left edge at x=36, aligns head to torso */}
          <rect x="36" y="40" width="12" height="6" rx="3" fill="#0f172a" stroke="#0284c7" strokeWidth="1" />
          {/* Head: left edge at x=30 ≈ torso left (28) → no hump on the back */}
          <rect x="30" y="22" width="26" height="18" rx="4" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.5" />
          <line x1="44" y1="22" x2="43" y2="14" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="43" cy="13" r="2.5" fill="#34d399" />
          {/* Visor on right (forward) side of head */}
          <rect x="50" y="26" width="10" height="8" rx="2" fill="#082f49" stroke="#38bdf8" strokeWidth="1" />
          <circle cx="55" cy="30" r="2" fill="#22d3ee" /><circle cx="55.7" cy="29.3" r="0.7" fill="#fff" />
          {/* Scan beam projected rightward toward incoming doc */}
          <polygon points="60,25 104,18 104,37 60,30" fill="url(#scanRay)" />
          <line x1="60" y1="27.5" x2="102" y2="27.5" stroke="#a5f3fc" strokeWidth="0.6" strokeDasharray="3 2" opacity="0.5" />
          {activeStep >= 0 && <rect x="62" y="50" width="14" height="18" rx="1.5" fill="#0f172a" stroke="#0284c7" strokeWidth="1" transform="rotate(-8 62 50)" />}
          {activeStep >= 1 && <rect x="64" y="47" width="14" height="18" rx="1.5" fill="#0f172a" stroke="#22d3ee" strokeWidth="1.2" transform="rotate(-3 64 47)" />}
          {activeStep >= 2 && <rect x="66" y="44" width="14" height="18" rx="1.5" fill="#0f172a" stroke="#34d399" strokeWidth="1.2" transform="rotate(3 66 44)" />}
          {activeStep >= 3 && (
            <g>
              <rect x="65" y="41" width="14" height="18" rx="1.5" fill="#052e16" stroke="#10b981" strokeWidth="1.5" transform="rotate(6 65 41)" />
              <circle cx="84" cy="60" r="5.5" fill="#10b981" />
              <path d="M 82 60 l 2 2 l 3 -4" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
            </g>
          )}
        </g>
      </g>
    </svg>
    <div className="absolute bottom-2.5 right-4 text-[10px] font-mono text-cyan-400 bg-slate-900/90 border border-cyan-500/30 px-2 py-0.5 rounded-md">
      {STACK_LABELS[activeStep]}
    </div>
  </div>
);

export default MediBotRunner;
