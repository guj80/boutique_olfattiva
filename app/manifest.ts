import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Atelier LG — Haute Parfumerie',
    short_name: 'Atelier LG',
    description: 'Haute Parfumerie Collection & Olfactive Radar',
    start_url: '/',
    display: 'standalone',
    background_color: '#050308',
    theme_color: '#050308',
    icons: [
      {
        src: '/LOGO_LG.jpg',
        sizes: '192x192',
        type: 'image/jpeg',
      },
      {
        src: '/LOGO_LG.jpg',
        sizes: '512x512',
        type: 'image/jpeg',
      },
    ],
  };
}
