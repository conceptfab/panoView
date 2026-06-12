/** Dane systemu/sprzętu z klienta (userAgent, ekran, viewport). */
export interface SystemInfo {
  userAgent: string;
  language: string;
  languages?: string[];
  platform: string;
  screenWidth: number;
  screenHeight: number;
  windowWidth: number;
  windowHeight: number;
  devicePixelRatio?: number;
  timezone?: string;
}

/** Zdarzenie logowania – zapisywane po udanym verify. */
export interface LoginEvent {
  type: 'login';
  at: string; // ISO
  system: SystemInfo;
}

/** Początek oglądania projektu. */
export interface ViewStartEvent {
  type: 'view_start';
  at: string;
  projectId: string;
  projectName?: string;
}

/** Koniec oglądania – z czasem spędzonym w sekundach. */
export interface ViewEndEvent {
  type: 'view_end';
  at: string;
  projectId: string;
  durationSeconds: number;
}

/** Zrzut ekranu w podglądzie. */
export interface ScreenshotEvent {
  type: 'screenshot';
  at: string;
  projectId: string;
  projectName?: string;
}

export type StatsEvent =
  | LoginEvent
  | ViewStartEvent
  | ViewEndEvent
  | ScreenshotEvent;

/** Jeden dzień statystyk użytkownika – zawartość pliku YYYY-MM-DD.json. */
export interface UserStatsDay {
  date: string; // YYYY-MM-DD
  userId: string;
  events: StatsEvent[];
}
