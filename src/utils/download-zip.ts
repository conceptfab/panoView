/**
 * Pobiera archiwum ZIP z endpointu POST (chroniony przed CSRF/prefetch).
 * Zwraca nazwę pliku z nagłówka Content-Disposition.
 */
export async function downloadZipFromApi(url: string): Promise<string> {
  const res = await fetch(url, { method: 'POST' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      typeof data.error === 'string' ? data.error : 'Pobieranie nie powiodło się'
    );
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  const filenameMatch = disposition?.match(/filename="([^"]+)"/);
  const filename = filenameMatch?.[1] ?? 'download.zip';

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(objectUrl);

  return filename;
}
