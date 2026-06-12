/** Wersja aplikacji z package.json (NEXT_PUBLIC_APP_VERSION wstrzykiwany w next.config). */
export const APP_VERSION =
  typeof process !== 'undefined'
    ? process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0'
    : '0.0.0';

/** Etykieta "Pano v: x.y.z" do wyświetlania w UI. */
export const PANO_VERSION_LABEL = `Pano v: ${APP_VERSION}`;

/** Etykieta "CONCEPTFAB Pano v: x.y.z". */
export const CONCEPTFAB_PANO_VERSION_LABEL = `CONCEPTFAB Pano v: ${APP_VERSION}`;
