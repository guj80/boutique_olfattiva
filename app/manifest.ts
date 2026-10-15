import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Boutique Olfattiva',
    short_name: 'Boutique Olfattiva',
    description: 'La tua collezione olfattiva personale e consulente IA di alta profumeria',
    start_url: '/',
    display: 'standalone',
    background_color: '#0c0a09',
    theme_color: '#d4af37',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
