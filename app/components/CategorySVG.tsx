'use client';

import React from 'react';

interface CategorySVGProps {
  category: string;
  className?: string;
  index?: number;
}

export default function CategorySVG({ category, className = '', index = 0 }: CategorySVGProps) {
  // Color palettes similar to thewellness education page
  const colorPalettes = [
    '#C4B5A0', '#A89A91', '#C8B8D8', '#A8C1A8', '#D4A5A5',
    '#9AB5D1', '#E6C9A8', '#B5C9C3', '#D1B3C4', '#A8B8A8',
  ];

  const backgroundColor = colorPalettes[index % colorPalettes.length];

  // Generate complementary colors based on the main color
  const getComplementaryColors = (baseColor: string) => {
    const colors = {
      primary: baseColor,
      secondary: adjustColorBrightness(baseColor, -20),
      accent: adjustColorBrightness(baseColor, 40),
      light: adjustColorBrightness(baseColor, 60),
    };
    return colors;
  };

  // Helper function to adjust color brightness
  function adjustColorBrightness(hex: string, percent: number) {
    const num = parseInt(hex.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return "#" + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  const colors = getComplementaryColors(backgroundColor);

  const getSVGByCategory = () => {
    const baseProps = {
      width: "100%",
      height: "100%",
      viewBox: "0 0 400 240",
      preserveAspectRatio: "xMidYMid slice"
    };

    const gradientId = `grad-${index}`;
    const filterId = `glow-${index}`;

    switch (category.toLowerCase()) {
      case 'publication':
      case 'research':
        return (
          <svg {...baseProps}>
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.light} />
                <stop offset="50%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.secondary} />
              </linearGradient>
              <filter id={filterId}>
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Background */}
            <rect width="100%" height="100%" fill={`url(#${gradientId})`} />

            {/* Research Data Visualization */}
            <g transform="translate(40, 60)">
              {/* Chart bars */}
              {[0, 1, 2, 3, 4, 5].map(i => (
                <rect
                  key={i}
                  x={i * 50}
                  y={120 - (20 + Math.sin(i * 0.8) * 40)}
                  width="30"
                  height={20 + Math.sin(i * 0.8) * 40}
                  fill={colors.accent}
                  opacity="0.8"
                  filter={`url(#${filterId})`}
                >
                  <animate
                    attributeName="height"
                    values={`${20 + Math.sin(i * 0.8) * 40};${30 + Math.sin(i * 0.8) * 50};${20 + Math.sin(i * 0.8) * 40}`}
                    dur={`${3 + i * 0.2}s`}
                    repeatCount="indefinite"
                  />
                </rect>
              ))}

              {/* Connecting line */}
              <path
                d={`M15,${120 - (20 + Math.sin(0) * 40)} ${[1,2,3,4,5].map(i =>
                  `L${15 + i * 50},${120 - (20 + Math.sin(i * 0.8) * 40)}`
                ).join(' ')}`}
                stroke={colors.secondary}
                strokeWidth="3"
                fill="none"
                opacity="0.7"
              />
            </g>

            {/* Molecular structure */}
            <g transform="translate(280, 40)">
              <circle cx="0" cy="0" r="8" fill={colors.accent} opacity="0.9"/>
              <circle cx="30" cy="20" r="6" fill={colors.secondary} opacity="0.9"/>
              <circle cx="60" cy="0" r="8" fill={colors.accent} opacity="0.9"/>
              <circle cx="30" cy="-20" r="6" fill={colors.secondary} opacity="0.9"/>

              <line x1="0" y1="0" x2="30" y2="20" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
              <line x1="30" y1="20" x2="60" y2="0" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
              <line x1="0" y1="0" x2="30" y2="-20" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
              <line x1="30" y1="-20" x2="60" y2="0" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
            </g>

            {/* Floating particles */}
            <g>
              {[0, 1, 2, 3].map(i => (
                <circle
                  key={i}
                  cx={100 + i * 80}
                  cy={200}
                  r="3"
                  fill={colors.light}
                  opacity="0.6"
                >
                  <animate
                    attributeName="cy"
                    values="200;180;200"
                    dur={`${2 + i * 0.5}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </g>
          </svg>
        );

      case 'healthcare':
      case 'medical':
        return (
          <svg {...baseProps}>
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.light} />
                <stop offset="50%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.secondary} />
              </linearGradient>
              <filter id={filterId}>
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Background */}
            <rect width="100%" height="100%" fill={`url(#${gradientId})`} />

            {/* Medical Cross */}
            <g transform="translate(320, 120)">
              <rect x="-25" y="-8" width="50" height="16" fill={colors.accent} opacity="0.9" rx="4"/>
              <rect x="-8" y="-25" width="16" height="50" fill={colors.accent} opacity="0.9" rx="4"/>
              <circle cx="0" cy="0" r="40" stroke={colors.secondary} strokeWidth="3" fill="none" opacity="0.5">
                <animate attributeName="r" values="40;45;40" dur="3s" repeatCount="indefinite"/>
              </circle>
            </g>

            {/* DNA Helix */}
            <g transform="translate(60, 60)">
              <path
                d="M0,60 Q20,20 40,60 T80,60 T120,60"
                stroke={colors.accent}
                strokeWidth="4"
                fill="none"
                opacity="0.8"
              />
              <path
                d="M0,60 Q20,100 40,60 T80,60 T120,60"
                stroke={colors.secondary}
                strokeWidth="4"
                fill="none"
                opacity="0.8"
              />

              {/* DNA base pairs */}
              {[0, 1, 2, 3, 4].map(i => (
                <line
                  key={i}
                  x1={i * 30}
                  y1={60 + Math.sin(i * 0.5) * 20}
                  x2={i * 30}
                  y2={60 - Math.sin(i * 0.5) * 20}
                  stroke={colors.light}
                  strokeWidth="2"
                  opacity="0.6"
                />
              ))}
            </g>

            {/* Heartbeat line */}
            <g transform="translate(0, 180)">
              <path
                d="M0,0 L60,0 L80,-40 L100,60 L120,-80 L140,40 L160,-20 L180,0 L400,0"
                stroke={colors.accent}
                strokeWidth="3"
                fill="none"
                opacity="0.7"
                filter={`url(#${filterId})`}
              >
                <animate
                  attributeName="stroke-dasharray"
                  values="0,1000;1000,0"
                  dur="4s"
                  repeatCount="indefinite"
                />
              </path>
            </g>
          </svg>
        );

      case 'technology':
      case 'ai':
        return (
          <svg {...baseProps}>
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.light} />
                <stop offset="50%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.secondary} />
              </linearGradient>
              <filter id={filterId}>
                <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                <feMerge>
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>

            {/* Background */}
            <rect width="100%" height="100%" fill={`url(#${gradientId})`} />

            {/* Circuit board pattern */}
            <g transform="translate(40, 40)">
              {/* Horizontal lines */}
              <line x1="0" y1="40" x2="200" y2="40" stroke={colors.accent} strokeWidth="3" opacity="0.7"/>
              <line x1="0" y1="80" x2="200" y2="80" stroke={colors.accent} strokeWidth="3" opacity="0.7"/>
              <line x1="0" y1="120" x2="200" y2="120" stroke={colors.accent} strokeWidth="3" opacity="0.7"/>

              {/* Vertical lines */}
              <line x1="60" y1="0" x2="60" y2="160" stroke={colors.secondary} strokeWidth="3" opacity="0.7"/>
              <line x1="120" y1="0" x2="120" y2="160" stroke={colors.secondary} strokeWidth="3" opacity="0.7"/>
              <line x1="180" y1="40" x2="180" y2="120" stroke={colors.secondary} strokeWidth="3" opacity="0.7"/>

              {/* Circuit nodes */}
              <circle cx="60" cy="40" r="6" fill={colors.light} filter={`url(#${filterId})`}/>
              <circle cx="60" cy="80" r="6" fill={colors.light} filter={`url(#${filterId})`}/>
              <circle cx="60" cy="120" r="6" fill={colors.light} filter={`url(#${filterId})`}/>
              <circle cx="120" cy="40" r="6" fill={colors.light} filter={`url(#${filterId})`}/>
              <circle cx="120" cy="80" r="6" fill={colors.light} filter={`url(#${filterId})`}/>
              <circle cx="120" cy="120" r="6" fill={colors.light} filter={`url(#${filterId})`}/>
              <circle cx="180" cy="80" r="8" fill={colors.accent} filter={`url(#${filterId})`}>
                <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite"/>
              </circle>
            </g>

            {/* Neural network */}
            <g transform="translate(280, 100)">
              {/* Nodes */}
              <circle cx="0" cy="0" r="8" fill={colors.accent} opacity="0.9"/>
              <circle cx="60" cy="-30" r="6" fill={colors.secondary} opacity="0.9"/>
              <circle cx="60" cy="30" r="6" fill={colors.secondary} opacity="0.9"/>
              <circle cx="100" cy="0" r="8" fill={colors.light} opacity="0.9"/>

              {/* Connections */}
              <line x1="0" y1="0" x2="60" y2="-30" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
              <line x1="0" y1="0" x2="60" y2="30" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
              <line x1="60" y1="-30" x2="100" y2="0" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
              <line x1="60" y1="30" x2="100" y2="0" stroke={colors.primary} strokeWidth="2" opacity="0.6"/>
            </g>

            {/* Data flow particles */}
            <g>
              {[0, 1, 2].map(i => (
                <circle
                  key={i}
                  cx="0"
                  cy={60 + i * 40}
                  r="4"
                  fill={colors.light}
                  opacity="0.8"
                >
                  <animate
                    attributeName="cx"
                    values="0;400;0"
                    dur={`${4 + i}s`}
                    repeatCount="indefinite"
                  />
                </circle>
              ))}
            </g>
          </svg>
        );

      default:
        return (
          <svg {...baseProps}>
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={colors.light} />
                <stop offset="50%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.secondary} />
              </linearGradient>
            </defs>

            {/* Background */}
            <rect width="100%" height="100%" fill={`url(#${gradientId})`} />

            {/* Abstract geometric pattern */}
            <g transform="translate(100, 60)">
              <polygon
                points="0,80 40,0 80,80 40,160"
                fill={colors.accent}
                opacity="0.7"
              />
              <polygon
                points="80,80 120,0 160,80 120,160"
                fill={colors.secondary}
                opacity="0.7"
              />
              <polygon
                points="160,80 200,0 240,80 200,160"
                fill={colors.light}
                opacity="0.7"
              />
            </g>

            {/* Floating elements */}
            <g>
              <circle cx="320" cy="80" r="12" fill={colors.accent} opacity="0.6">
                <animate
                  attributeName="cy"
                  values="80;60;80"
                  dur="3s"
                  repeatCount="indefinite"
                />
              </circle>
              <circle cx="340" cy="140" r="8" fill={colors.secondary} opacity="0.6">
                <animate
                  attributeName="cy"
                  values="140;120;140"
                  dur="2.5s"
                  repeatCount="indefinite"
                />
              </circle>
            </g>
          </svg>
        );
    }
  };

  return (
    <div className={`category-svg ${className}`} style={{ backgroundColor }}>
      {getSVGByCategory()}
    </div>
  );
}