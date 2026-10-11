import { ImageResponse } from 'next/server';

export const runtime = 'edge';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '512px',
          height: '512px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#08080A',
          overflow: 'hidden',
        }}
      >
        <img
          src="https://boutique-olfattiva.vercel.app/logo.jpg"
          width="938"
          height="512"
          style={{
            objectFit: 'cover',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
