import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Atelier LG',
    short_name: 'Atelier LG',
    description: 'Haute Parfumerie Collection',
    start_url: '/',
    display: 'standalone',
    background_color: '#050308',
    theme_color: '#050308',
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
