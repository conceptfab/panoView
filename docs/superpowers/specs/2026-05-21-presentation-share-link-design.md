# Link do prezentacji (publiczny link współdzielenia) — spec

- **Data:** 2026-05-21
- **Status:** zatwierdzony do implementacji
- **Autor:** michal@kleniewski.com (+ Claude)

## 1. Cel

Dodać możliwość wygenerowania **specjalnego linku**, którym dowolny posiadacz
może otworzyć prezentację panoramy **bez logowania**. Link musi dać się
**dezaktywować w dowolnym momencie**. Opcjonalnie chroniony PIN-em.

„Prezentacja" = istniejący widok panoramy projektu (to, co dziś renderuje
[`/pano/[projectId]`](../../../src/app/(dashboard)/pano/[projectId]/page.tsx)
przez komponent [`PanoViewer`](../../../src/components/viewer/PanoViewer.tsx)).

## 2. Decyzje (ustalone w brainstormingu)

| Pytanie | Decyzja |
|---|---|
| Kto otwiera link? | Każdy z linkiem, **bez logowania** (anonimowo) |
| Ile linków na projekt? | **Jeden** link na projekt |
| Cykl życia | Ręczny przełącznik **Włączony/Wyłączony** (natychmiastowa blokada) |
| PIN | **Opcjonalny** per projekt (puste = otwiera od razu) |
| Działa dla nieopublikowanych? | **Nie** — tylko gdy projekt `isPublished` |
| Statystyki anonimowe? | **Tak** — liczone w osobnym kubełku |
| Rotacja adresu | Brak (świadomy kompromis) — wyłącz/włącz przywraca ten sam adres |

## 3. Wybór architektury

**Token przechowywany po stronie serwera** (plik JSON), nie samodzielny JWT.

| Podejście | Natychmiastowa dezaktywacja | Złożoność | Wybór |
|---|---|---|---|
| A. Token w pliku JSON + flaga `isActive` | ✅ | niska, pasuje do JSON store | **TAK** |
| B. Podpisany JWT (stateless) | ❌ (nie da się odwołać bez denylisty) | średnia | nie |
| C. JWT + flaga serwerowa | ✅ | wyższa niż A, brak zysku | nie |

Wymaganie „dezaktywacja w dowolnym momencie" wyklucza B.

## 4. Model danych

Nowy plik **`data/share-links.json`** (osobny od `projects.json`, aby sekret nie
wyciekał przez `GET /api/projects/[id]`, które zwraca cały obiekt projektu).

```jsonc
{
  "links": [
    {
      "projectId": "Jutrzenki",
      "token": "<base64url z 24 losowych bajtów>",
      "isActive": true,
      "pinHash": null,            // "scrypt$<sólHex>$<hashHex>" albo null
      "createdAt": "2026-05-21T...Z",
      "updatedAt": "2026-05-21T...Z"
    }
  ]
}
```

Niezmienniki:
- Maks. **jeden** wpis na `projectId`.
- `token` generowany **raz** przy pierwszym włączeniu i pozostaje stały przy
  kolejnych włącz/wyłącz.
- Walidacja zod, zapis przez istniejący `writeJsonFile` (mutex z `json-store.ts`).

### Nowy moduł `src/lib/db/share-links.ts`

Wzorzec jak [`access-control.ts`](../../../src/lib/auth/access-control.ts).
Funkcje (nazwy orientacyjne):

- `getShareLinks(): Promise<ShareLink[]>`
- `getShareLinkByToken(token): Promise<ShareLink | null>`
- `getShareLinkByProject(projectId): Promise<ShareLink | null>`
- `setShareActive(projectId, isActive): Promise<ShareLink>` — pierwsze
  `isActive:true` generuje token, jeśli brak wpisu.
- `setSharePin(projectId, pin: string | null): Promise<ShareLink>` — `null`/''
  czyści PIN; inaczej hashuje (`scrypt`).
- (opcjonalnie) `deleteShareLink(projectId)` przy usuwaniu projektu —
  podpiąć w `deleteProject` lub zostawić jako sierotę (mała skala). **Decyzja:**
  podpiąć sprzątanie w `deleteProject`, żeby nie zostawiać martwych wpisów.

### Typy — `src/types/share.ts` (lub dopisać do istniejących typów)

```ts
export interface ShareLink {
  projectId: string;
  token: string;
  isActive: boolean;
  pinHash: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Hashowanie PIN — `src/lib/auth/share-pin.ts`

- `hashPin(pin: string): string` → `scrypt$<saltHex>$<hashHex>` (Node `crypto`,
  bez nowej zależności; `randomBytes(16)` na sól, `scryptSync`).
- `verifyPin(pin: string, stored: string): boolean` → `timingSafeEqual`.

### Generowanie tokenu

`crypto.randomBytes(24).toString('base64url')` (~32 znaki, 192 bity entropii).

## 5. Publiczna trasa `src/app/p/[token]/page.tsx`

Server component, renderowany w **root layout** (`src/app/layout.tsx`) — bez
nawigacji dashboardu. Bramki w kolejności, każda nieudana → `notFound()` (404,
aby nie zdradzać istnienia linku):

1. `getShareLinkByToken(token)` istnieje **i** `isActive === true`.
2. `getProjectById(link.projectId)` istnieje **i** `isPublished === true`.
3. Jeśli `pinHash !== null` i brak ważnego ciasteczka `pano-share-<token>` →
   renderuj **ekran PIN** (komponent kliencki) zamiast widoku.
4. Wczytaj `getProjectConfig(projectId)`; jeśli brak panoram → komunikat jak w
   obecnym `/pano`.
5. Renderuj `<PanoViewer config basePath publicMode shareToken={token} projectId={project.id} />`.

`basePath = /uploads/projects/${projectId}` — pliki serwowane przez
[`/uploads/[...path]`](../../../src/app/uploads/[...path]/route.ts), który **nie
wymaga auth**, więc obrazy ładują się anonimowo. Middleware nie chroni `/p`
(nie ma go w `protectedRoutes`) ani `/api` (wykluczone w matcherze).

### Ekran PIN

Komponent kliencki `src/components/viewer/SharePinGate.tsx` (lub inline na
stronie): pole na PIN + przycisk; `POST /api/p/[token]/unlock`. Po sukcesie
odświeżenie strony (cookie ustawione) → renderuje widok. Po błędzie komunikat
„Nieprawidłowy PIN".

## 6. Zmiany w `PanoViewer`

Dwa nowe opcjonalne propsy (domyślne zachowanie bez zmian):

- `publicMode?: boolean` — gdy `true`, **ukrywa** link „powrót do galerii"
  (obecnie twardo `href="/gallery"`).
- `shareToken?: string` — gdy ustawiony, zdarzenia statystyk lecą na
  `POST /api/p/[shareToken]/stats` zamiast `/api/stats`.

Logika statystyk: dziś wysyłka jest bramkowana `if (!projectId) return`. W trybie
publicznym `projectId` **jest** przekazywany (potrzebny w payloadzie), a wybór
URL zależy od obecności `shareToken`. Zdarzenia: `view_start`, `view_end`,
`screenshot` (te same typy). Generowanie miniatury pozostaje za `isAdmin` (w
trybie publicznym `isAdmin=false`).

## 7. Statystyki anonimowe — kubełek `share`

Reużycie istniejącego mechanizmu [`stats.ts`](../../../src/lib/db/stats.ts):
zdarzenia anonimowe zapisywane przez `appendEvent('share', date, event)` →
`data/stats/share/YYYY-MM-DD.json`. `safeUserId('share') === 'share'`.

### Nowy endpoint `POST /api/p/[token]/stats`

- **Walidacja przed zapisem:** token istnieje i `isActive`; projekt istnieje i
  `isPublished`; jeśli `pinHash` ustawiony → wymagane ważne ciasteczko
  `pano-share-<token>`; `payload.projectId` musi równać się `link.projectId`
  (zapobiega podszywaniu pod inny projekt).
- Body: ten sam kształt co `/api/stats` dla `view_start` / `view_end` /
  `screenshot` (bez `login`).
- Po walidacji: `appendEvent('share', getDateString(), toEvent(payload))`.
- Authenticated `/api/stats` **pozostaje nietknięty**.

### Panel admina

W [`GET /api/admin/stats`](../../../src/app/api/admin/stats/route.ts) (gałąź listy)
po zbudowaniu `result` z realnych użytkowników dołożyć **syntetyczny wiersz** dla
kubełka `share`, jeśli ma jakiekolwiek dni:

```ts
const shareDates = await getStatsDaysForUser('share');
if (shareDates.length) {
  // policz totalEvents jak dla użytkowników
  result.push({ userId: 'share', email: 'Linki publiczne (anonimowo)', days: shareDates, totalEvents });
}
```

[`StatsPanel`](../../../src/components/admin/StatsPanel.tsx) używa `u.email ?? u.userId`
do wyświetlenia i przekazuje `u.userId` do pobrania szczegółów — rozwijanie dni i
zdarzeń działa bez zmian. Czyszczenie starej historii
(`deleteStatsOlderThan` → `listUserIdsWithStats`) **już obejmuje** `share`.

## 8. API zarządzania linkiem (admin/editor)

Uprawnienia: `requireAdminOrEditor` + `editorCanEditProject` (edytor tylko dla
projektów w swoich grupach) — spójnie z
[`/api/projects/[id]`](../../../src/app/api/projects/[id]/route.ts).

### `GET /api/projects/[id]/share`
Zwraca stan dla UI:
```jsonc
{ "isActive": true, "hasPin": false, "url": "https://<host>/p/<token>" }
```
`url` budowany z `request` (origin) + token. Gdy brak wpisu →
`{ isActive:false, hasPin:false, url:null }`.

### `PUT /api/projects/[id]/share`
Body (zod): `{ isActive?: boolean, pin?: string | null }`.
- `isActive:true` po raz pierwszy → generuje token.
- `pin: "1234"` → ustawia PIN; `pin: null` lub `""` → czyści PIN.
- Zwraca ten sam kształt co `GET`.

### `POST /api/p/[token]/unlock`
Body: `{ pin: string }`. Waliduje token aktywny + projekt opublikowany +
`verifyPin`. Po sukcesie ustawia podpisane (jose) httpOnly ciasteczko
`pano-share-<token>` (TTL **12 h**, `secure` w produkcji, `sameSite:'lax'`,
`path:'/'`). Zwraca `{ ok: true }` lub 401.

Pomocniczo w [`jwt.ts`](../../../src/lib/auth/jwt.ts) (lub osobny plik): funkcje
`createShareUnlockToken(token)` / `verifyShareUnlockToken(value, token)` — payload
zawiera claim z `token` linku, żeby ciasteczko jednego linku nie odblokowywało
innego.

## 9. UI — sekcja w `ProjectEditForm`

Nowa karta/sekcja „Link do prezentacji" w
[`ProjectEditForm.tsx`](../../../src/components/admin/ProjectEditForm.tsx):

- Przełącznik **Włączony / Wyłączony** (`Switch`) → `PUT .../share { isActive }`.
- Pole **URL** (read-only `Input`) + przycisk **Kopiuj** (widoczne, gdy token
  istnieje). Gdy wyłączony — pokaż adres, ale z adnotacją „nieaktywny".
- Opcjonalne pole **PIN**: input + przyciski „Ustaw PIN" / „Usuń PIN" →
  `PUT .../share { pin }`. Pokazuj tylko `hasPin` (nigdy nie zwracaj PIN-u).
- Adnotacja: „Link działa tylko dla opublikowanego projektu."
- Stan pobierany przez `GET .../share` (np. w `useEffect` lub przekazany z
  server page jako prop — zgodnie z obecnym wzorcem formularza, który jest
  klientowy → fetch w `useEffect`).

Dane wejściowe sekcji wymagają, by strona edycji projektu znała stan linku —
formularz jest komponentem klienckim, więc najprościej pobrać `GET .../share`
po stronie klienta.

## 10. Bezpieczeństwo i przypadki brzegowe

- Token 192-bitowy, nieodgadywalny; trzymany poza `projects.json`.
- **404 zamiast 403** dla nieaktywnych/nieopublikowanych/nieistniejących.
- Wyłączenie linku = natychmiastowa blokada (token sprawdzany przy każdym
  żądaniu strony i endpointu statystyk).
- PIN: `scrypt` + sól + `timingSafeEqual`; PIN nigdy nie zwracany przez API.
- Endpoint statystyk waliduje token/publikację/PIN i zgodność `projectId` —
  brak zapisu „na ślepo" do kubełka `share`.
- Ciasteczko unlock związane z konkretnym tokenem (claim), httpOnly, krótki TTL.
- Usunięcie projektu sprząta wpis w `share-links.json`.

## 11. Poza zakresem (YAGNI — możliwe rozszerzenia)

- Data wygaśnięcia linku.
- Wiele nazwanych linków na projekt.
- Przycisk rotacji/unieważnienia adresu (nowy token).
- Dane systemowe (userAgent, ekran, strefa) dla wejść anonimowych.
- Limity prób PIN / rate limiting (mała skala, plikowy store).

## 12. Pliki (nowe / zmieniane)

**Nowe:**
- `data/share-links.json` (tworzony automatycznie przez `readJsonFileWithDefault`)
- `src/types/share.ts`
- `src/lib/db/share-links.ts`
- `src/lib/auth/share-pin.ts`
- `src/app/p/[token]/page.tsx`
- `src/components/viewer/SharePinGate.tsx`
- `src/app/api/projects/[id]/share/route.ts` (GET, PUT)
- `src/app/api/p/[token]/unlock/route.ts` (POST)
- `src/app/api/p/[token]/stats/route.ts` (POST)
- (walidacja zod — dopisać do `src/utils/validation.ts`)

**Zmieniane:**
- `src/components/viewer/PanoViewer.tsx` — propsy `publicMode`, `shareToken`
- `src/components/admin/ProjectEditForm.tsx` — sekcja „Link do prezentacji"
- `src/app/api/admin/stats/route.ts` — syntetyczny wiersz `share`
- `src/lib/db/projects.ts` — `deleteProject` sprząta wpis linku
- `src/lib/auth/jwt.ts` (lub nowy plik) — token unlock ciasteczka

## 13. Kryteria akceptacji

1. Admin/edytor może w edycji projektu **włączyć** link i skopiować URL.
2. Otwarcie URL w trybie incognito (bez logowania) **uruchamia prezentację**.
3. **Wyłączenie** linku → ten sam URL natychmiast zwraca 404.
4. Gdy projekt **nieopublikowany** → URL zwraca 404 (nawet przy aktywnym linku).
5. Po ustawieniu **PIN** otwarcie URL wymaga podania PIN; błędny PIN → odmowa.
6. Wejścia anonimowe pojawiają się w panelu statystyk pod „Linki publiczne
   (anonimowo)" jako `view_start`/`view_end`.
7. Edytor widzi sekcję linku tylko dla projektów w swoich grupach.
