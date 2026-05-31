import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

/**
 * This file is web-only and used to configure the root HTML for every
 * web page during static rendering.
 * The contents of this function only run in Node.js environments and
 * do not have access to the DOM or browser APIs.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* PWA - Progressive Web App */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#1565C0" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="BarCash PDV" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="application-name" content="BarCash PDV" />
        <meta name="description" content="Sistema de Gestão para Bares e Restaurantes" />

        {/* 
          This disables the annoying tap highlight on mobile web. 
          It has no effect on desktop or native apps.
        */}
        <ScrollViewStyleReset />

        {/* Leaflet CSS */}
        <link 
            rel="stylesheet" 
            href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
            integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
            crossOrigin=""
        />

      </head>
      <body>{children}</body>
    </html>
  );
}
