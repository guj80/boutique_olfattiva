import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Atelier LG — Boutique Olfattiva',
    short_name: 'Atelier LG',
    description: 'Collezione di Alta Profumeria & Radar Olfattivo',
    start_url: '/',
    display: 'standalone',
    background_color: '#050308',
    theme_color: '#050308',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
    ],
  };
}
