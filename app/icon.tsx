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
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#08080A',
          border: '16px solid #C5A059',
          borderRadius: '96px',
          color: '#F7E7CE',
        }}
      >
        <div
          style={{
            width: '90px',
            height: '36px',
            border: '8px solid #C5A059',
            borderRadius: '8px',
            marginBottom: '-6px',
          }}
        />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '10px solid #F7E7CE',
            borderRadius: '44px',
            padding: '20px 54px',
            fontSize: 175,
            fontFamily: 'serif',
            fontWeight: 700,
            letterSpacing: '-6px',
          }}
        >
          LG
        </div>
      </div>
    ),
    { ...size }
  );
}
