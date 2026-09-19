import { useId } from 'react';

import { cn } from '../../design/cn';

interface ZekoWordmarkProps {
  readonly className?: string | undefined;
}

/*
 * Logotipo dibujado a mano en SVG y no con una fuente: la app corre solo en loopback,
 * asi que no puede depender de una webfont remota, y un path escala y se anima sin
 * incrustar binarios. Trazo tipo throw-up, relleno de spray y una gota en la "o".
 */
export function ZekoWordmark({ className }: ZekoWordmarkProps) {
  const id = useId();
  const gradient = `${id}-spray`;
  const glyphs = `${id}-glyphs`;
  const shine = `${id}-shine`;

  return (
    <svg
      viewBox="0 0 238 78"
      role="presentation"
      aria-hidden="true"
      className={cn('block h-8 w-auto overflow-visible', className)}
    >
      <defs>
        <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-spray-lime)" />
          <stop offset="48%" stopColor="var(--color-spray-cyan)" />
          <stop offset="100%" stopColor="var(--color-spray-magenta)" />
        </linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>

        <g id={glyphs} fillRule="evenodd">
          {/* Z */}
          <path d="M8,8 L64,8 L64,22 L34,46 L64,46 L64,60 L6,60 L6,46 L36,22 L8,22 Z" />
          {/* e */}
          <path d="M97,22 C83,22 74,31 74,41 C74,51 83,60 97,60 L116,60 L116,49 L97,49 C92,49 88,47 86,44 L118,44 L118,39 C118,29 109,22 97,22 Z M86,35 C88,32 92,30 97,30 C102,30 106,32 108,35 Z" />
          {/* k */}
          <path d="M126,4 L140,4 L140,34 L154,20 L172,20 L152,40 L174,60 L155,60 L140,45 L140,60 L126,60 Z" />
          {/* o */}
          <path d="M202,22 C188,22 180,31 180,41 C180,51 188,60 202,60 C216,60 224,51 224,41 C224,31 216,22 202,22 Z M202,32 C207,32 211,36 211,41 C211,46 207,50 202,50 C197,50 193,46 193,41 C193,36 197,32 202,32 Z" />
          {/* gota de la o */}
          <path d="M196,57 L208,57 L208,66 C208,72 205,75 202,75 C199,75 196,72 196,66 Z" />
        </g>
      </defs>

      <g transform="translate(4,1) skewX(-7)">
        {/* Contorno grueso: el mismo trazado engordado por stroke. */}
        <use
          href={`#${glyphs}`}
          fill="#05060a"
          stroke="#05060a"
          strokeWidth="11"
          strokeLinejoin="round"
        />
        <use href={`#${glyphs}`} fill={`url(#${gradient})`} />
        {/* Brillo sobre la barra superior de la Z. */}
        <path d="M13,11 L59,11 L59,17 L13,17 Z" fill={`url(#${shine})`} />
      </g>
    </svg>
  );
}
