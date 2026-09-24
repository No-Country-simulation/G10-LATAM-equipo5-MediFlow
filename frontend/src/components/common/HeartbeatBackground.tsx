import type React from 'react';

export interface HeartbeatBackgroundProps {
  mode?: 'full' | 'compact';
}

export const HeartbeatBackground: React.FC<HeartbeatBackgroundProps> = ({ mode = 'full' }) => {
  const heightClass = mode === 'full' ? 'h-[32vh] md:h-[40vh]' : 'h-[14vh] md:h-[18vh]';

  const ecgPath =
    'M 0 130 L 120 130 C 130 130 135 120 145 120 C 155 120 160 130 170 130 L 210 130 L 220 142 L 235 30 L 250 175 L 260 130 L 290 130 C 305 130 315 105 330 105 C 345 105 355 130 370 130 L 490 130 C 500 130 505 120 515 120 C 525 120 530 130 540 130 L 580 130 L 590 142 L 605 25 L 620 180 L 630 130 L 660 130 C 675 130 685 105 700 105 C 715 105 725 130 740 130 L 860 130 C 870 130 875 120 885 120 C 895 120 900 130 910 130 L 950 130 L 960 142 L 975 35 L 990 175 L 1000 130 L 1030 130 C 1045 130 1055 108 1070 108 C 1085 108 1095 130 1110 130 L 1200 130';

  return (
    <div className={`absolute bottom-0 left-0 w-full z-0 pointer-events-none overflow-hidden ${heightClass}`}>
      <style>
        {`
          @keyframes ecg-flow {
            0% {
              stroke-dashoffset: 2400;
            }
            100% {
              stroke-dashoffset: 0;
            }
          }
          @keyframes pulse-glow {
            0%, 100% {
              filter: drop-shadow(0 0 3px #ff1744) drop-shadow(0 0 8px rgba(255, 23, 68, 0.4));
              opacity: 0.85;
            }
            50% {
              filter: drop-shadow(0 0 6px #ff1744) drop-shadow(0 0 16px rgba(255, 23, 68, 0.75));
              opacity: 1;
            }
          }
          .ecg-runner {
            stroke-dasharray: 450 1950;
            animation: ecg-flow 3.8s linear infinite;
          }
          .ecg-glow-container {
            animation: pulse-glow 2s ease-in-out infinite;
          }
        `}
      </style>
      <svg
        className="w-full h-full"
        viewBox="0 0 1200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
      >
        <path
          d={ecgPath}
          stroke="#f43f5e"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="opacity-15"
        />

        <g className="ecg-glow-container">
          <path
            d={ecgPath}
            stroke="#ff1744"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="ecg-runner"
          />
        </g>
      </svg>
    </div>
  );
};

export default HeartbeatBackground;
