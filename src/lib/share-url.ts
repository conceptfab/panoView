function configuredAppOrigin(): string | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;

  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/+$/, '');
  }
}

export function buildShareUrl(requestOrigin: string, token: string): string {
  const origin = configuredAppOrigin() ?? requestOrigin.replace(/\/+$/, '');
  return `${origin}/p/${token}`;
}
