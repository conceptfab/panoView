'use client';

// oxlint-disable react-doctor/no-fetch-in-effect

import { useEffect, useRef } from 'react';

const STATS_LOGIN_SENT = 'pano_stats_login_sent';

function getSystemInfo() {
  if (typeof window === 'undefined') return null;
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    languages: navigator.languages ? [...navigator.languages] : undefined,
    platform: navigator.platform,
    screenWidth: window.screen?.width ?? 0,
    screenHeight: window.screen?.height ?? 0,
    windowWidth: window.innerWidth,
    windowHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    timezone: Intl.DateTimeFormat?.().resolvedOptions?.().timeZone,
  };
}

/** Wysyła zdarzenie logowania raz na sesję (pierwszy load dashboardu po zalogowaniu). */
export function StatsReporter() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    if (
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem(STATS_LOGIN_SENT)
    ) {
      sent.current = true;
      return;
    }

    const system = getSystemInfo();
    if (!system) return;

    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data?.user) return;
        sent.current = true;
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(STATS_LOGIN_SENT, '1');
        }
        return fetch('/api/stats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'login',
            payload: { type: 'login', system },
          }),
        });
      })
      .catch(() => {});
  }, []);

  return null;
}
