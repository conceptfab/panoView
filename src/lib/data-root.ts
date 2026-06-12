import path from 'path';

/**
 * Katalog główny danych aplikacji.
 * Na Railway: używa RAILWAY_VOLUME_MOUNT_PATH (ustawiane automatycznie przez Volume).
 * Można nadpisać przez PANO_DATA_DIR.
 * Lokalnie domyślnie: katalog roboczy (process.cwd()).
 */
export function getDataRoot(): string {
  const railway = process.env.RAILWAY_VOLUME_MOUNT_PATH?.trim();
  const pano = process.env.PANO_DATA_DIR?.trim();
  const root = pano || railway;
  return root ? path.resolve(root) : process.cwd();
}
