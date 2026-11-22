import { ImageResponse } from 'next/server';

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
          background: '#050308',
        }}
      >
        <svg
          width="330"
          height="395"
          viewBox="220 205 1216 1455"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient
              id="plat"
              gradientUnits="userSpaceOnUse"
              x1="300"
              y1="200"
              x2="1300"
              y2="1650"
            >
              <stop offset="0" stopColor="#F7F9FA" />
              <stop offset="0.45" stopColor="#B7C2CB" />
              <stop offset="0.7" stopColor="#EEF2F4" />
              <stop offset="1" stopColor="#7F8D98" />
            </linearGradient>
          </defs>
          <g fill="url(#plat)">
            <polygon points="477,343 1184,220 1003,519 1030,343" />
            <polygon points="477,343 625,452 877,518 587,519" />
            <polygon points="680,552 926,553 680,620" />
            <polygon points="459,675 238,823 459,1520 459,1175 372,865 459,805" />
            <polygon points="1197,675 1418,823 1197,1520 1197,1175 1284,865 1197,805" />
            <polygon points="517,667 623,667 623,1531 940,1531 1060,1640 517,1640" />
            <polygon points="680,667 1143,667 1048,747 786,747 786,1183 1033,1400 1033,1163 890,1163 987,1056 1143,1056 1143,1638 680,1230" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  );
}
