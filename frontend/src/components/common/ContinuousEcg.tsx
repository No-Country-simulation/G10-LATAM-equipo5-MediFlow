const ecgSweepPath =
  'M 0 24 L 95 24 C 102 19, 110 19, 115 24 L 130 24 L 134 27 L 140 6 L 146 39 L 150 24 L 160 24 C 168 17, 177 17, 185 24 L 275 24 C 282 19, 290 19, 295 24 L 310 24 L 314 27 L 320 6 L 326 39 L 330 24 L 340 24 C 348 17, 357 17, 365 24 L 455 24 C 462 19, 470 19, 475 24 L 490 24 L 494 27 L 500 6 L 506 39 L 510 24 L 520 24 C 528 17, 537 17, 545 24 L 635 24 C 642 19, 650 19, 655 24 L 670 24 L 674 27 L 680 6 L 686 39 L 690 24 L 700 24 C 708 17, 717 17, 725 24 L 815 24 C 822 19, 830 19, 835 24 L 850 24 L 854 27 L 860 6 L 866 39 L 870 24 L 880 24 C 888 17, 897 17, 905 24 L 1000 24';

interface ContinuousEcgProps {
  className?: string;
}

const ContinuousEcg = ({ className = '' }: ContinuousEcgProps) => {
  return (
    <div
      className={`absolute inset-x-0 bottom-4 w-full h-12 pointer-events-none overflow-hidden select-none z-0 opacity-50 ${className}`.trim()}
    >
      <style>
        {`
          @keyframes phosphor-sweep {
            0% {
              -webkit-mask-position: 100% 0;
              mask-position: 100% 0;
            }
            100% {
              -webkit-mask-position: 0% 0;
              mask-position: 0% 0;
            }
          }
          @keyframes phosphor-head {
            0% {
              left: 0%;
              opacity: 0;
            }
            2% {
              opacity: 1;
            }
            98% {
              opacity: 1;
            }
            100% {
              left: 100%;
              opacity: 0;
            }
          }
          .phosphor-trace {
            -webkit-mask-image: linear-gradient(
              to right,
              transparent 0%,
              transparent 35%,
              rgba(0, 0, 0, 0.18) 38%,
              rgba(0, 0, 0, 0.6) 44%,
              rgba(0, 0, 0, 0.95) 48%,
              #000 50%,
              transparent 50.1%,
              transparent 100%
            );
            mask-image: linear-gradient(
              to right,
              transparent 0%,
              transparent 35%,
              rgba(0, 0, 0, 0.18) 38%,
              rgba(0, 0, 0, 0.6) 44%,
              rgba(0, 0, 0, 0.95) 48%,
              #000 50%,
              transparent 50.1%,
              transparent 100%
            );
            -webkit-mask-size: 200% 100%;
            mask-size: 200% 100%;
            animation: phosphor-sweep 4.15s linear infinite;
            will-change: mask-position, -webkit-mask-position;
          }
          .phosphor-sweep-dot {
            animation: phosphor-head 4.15s linear infinite;
            will-change: left, opacity;
          }
        `}
      </style>

      <div className="relative w-full h-full phosphor-trace">
        <svg
          viewBox="0 0 1000 48"
          className="w-full h-full"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d={ecgSweepPath}
            stroke="rgba(244,63,94,0.85)"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 phosphor-sweep-dot pointer-events-none z-10">
        <div className="w-1.5 h-1.5 rounded-full bg-rose-400 shadow-[0_0_10px_#f43f5e,0_0_18px_rgba(244,63,94,0.75)]" />
      </div>
    </div>
  );
};

export default ContinuousEcg;
