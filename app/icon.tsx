import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#050308',
          backgroundImage:
            'radial-gradient(circle at 50% 45%, rgba(16,245,156,0.22) 0%, rgba(236,72,153,0.14) 55%, #050308 80%)',
        }}
      >
        <svg
          width="430"
          height="430"
          viewBox="20 15 195 210"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="mainG" x1="20" y1="20" x2="210" y2="220" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#2AF598" />
              <stop offset="65%" stopColor="#10B981" />
              <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="rimG" x1="40" y1="20" x2="220" y2="210" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#EC4899" />
              <stop offset="50%" stopColor="#A855F7" />
              <stop offset="100%" stopColor="#6366F1" />
            </linearGradient>
          </defs>
          <g transform="translate(3.5, 2)" opacity="0.85">
            <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" fill="url(#rimG)" />
            <polygon points="94,72 132,72 94,82" fill="url(#rimG)" />
            <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" fill="url(#rimG)" />
            <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" fill="url(#rimG)" />
            <path d="M70 86 H86 V202 H130 L146 218 H70 Z" fill="url(#rimG)" />
            <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" fill="url(#rimG)" />
          </g>
          <g fill="url(#mainG)">
            <path d="M66 42 L168 24 L142 62 L148 40 L84 44 L102 58 L124 62 L82 62 Z" />
            <polygon points="94,72 132,72 94,82" />
            <path d="M62 88 L30 112 L68 202 L52 120 L62 112 Z" />
            <path d="M172 90 L200 112 L172 200 L184 120 L172 112 Z" />
            <path d="M70 86 H86 V202 H130 L146 218 H70 Z" />
            <path d="M94 86 H164 L148 102 H110 V146 L164 200 V156 H148 L128 136 H164 V218 L94 148 Z" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
