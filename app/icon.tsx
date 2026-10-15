import { ImageResponse } from 'next/og';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  let logoBase64 = '';
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
    const fileBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/jpeg;base64,${fileBuffer.toString('base64')}`;
  } catch {
    // Fallback se il file non viene letto
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0c0a09',
          backgroundImage: 'radial-gradient(circle at center, #1c1917 0%, #090807 100%)',
          padding: '68px', // Safe-zone anti-taglio per icone Android e iOS (13.5% per lato)
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '88px',
            border: '4px solid rgba(212, 175, 55, 0.65)',
            boxShadow: '0 12px 35px rgba(0, 0, 0, 0.85)',
            overflow: 'hidden',
            backgroundColor: '#110f0e',
          }}
        >
          {logoBase64 ? (
            <img
              src={logoBase64}
              width="376"
              height="376"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center',
              }}
            />
          ) : (
            <div
              style={{
                color: '#d4af37',
                fontSize: 160,
                fontWeight: 700,
                fontFamily: 'serif',
              }}
            >
              BO
            </div>
          )}
        </div>
      </div>
    ),
    { ...size }
  );
}
