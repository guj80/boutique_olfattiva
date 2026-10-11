import { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Private Olfactory',
    short_name: 'Olfactory',
    description: 'Private Olfactory Archive',
    start_url: '/',
    display: 'standalone',
    background_color: '#08080A',
    theme_color: '#08080A',
    icons: [
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
