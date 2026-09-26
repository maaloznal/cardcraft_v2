import type { MetadataRoute } from 'next';

const APP_BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Required by Next.js static export for metadata route handlers.
export const dynamic = 'force-static';

export default function manifest(): MetadataRoute.Manifest {
  const appRoot = `${APP_BASE_PATH}/`;

  return {
    id: appRoot,
    name: 'Cardcraft — конструктор карточек',
    short_name: 'Cardcraft',
    description: 'Создание, оформление и экспорт текстовых карточек для социальных сетей.',
    start_url: appRoot,
    scope: appRoot,
    display: 'standalone',
    background_color: '#f7f7f8',
    theme_color: '#ffffff',
    orientation: 'any',
    lang: 'ru',
    categories: ['design', 'productivity', 'utilities'],
    icons: [
      {
        src: `${APP_BASE_PATH}/pwa-icon-192.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${APP_BASE_PATH}/pwa-icon-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: `${APP_BASE_PATH}/pwa-icon-maskable-512.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
