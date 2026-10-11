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
          background: '#08080A',
          border: '16px solid #C5A059',
          borderRadius: '96px',
          color: '#F7E7CE',
          fontSize: 220,
          fontFamily: 'serif',
          fontWeight: 700,
        }}
      >
        BL
      </div>
    ),
    { ...size }
  );
}
