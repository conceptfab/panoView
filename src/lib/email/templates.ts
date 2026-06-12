export function getOTPEmailTemplate(
  code: string,
  version: string = '0.0.0',
  isAdmin?: boolean
): string {
  const titleBase = `Kod logowania - CONCEPTFAB Pano v: ${version}`;
  const emailTitle = isAdmin ? `[Admin] ${titleBase}` : titleBase;
  const headerOneLine = `CONCEPTFAB Pano <span style="font-size: 0.85em; font-weight: 400; vertical-align: baseline;">v: ${version}</span>`;
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailTitle}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 600; color: #18181b; text-align: center; line-height: 1.3; white-space: nowrap;">
                ${headerOneLine}
              </h1>

              <p style="margin: 0 0 24px 0; font-size: 16px; line-height: 24px; color: #52525b; text-align: center;">
                Twój kod logowania:
              </p>

              <div style="text-align: center; padding: 24px 0;">
                <span style="display: inline-block; padding: 16px 32px; background-color: #f4f4f5; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #18181b; border-radius: 8px; font-family: 'Courier New', monospace;">
                  ${code}
                </span>
              </div>

              <p style="margin: 24px 0 0 0; font-size: 14px; line-height: 20px; color: #71717a; text-align: center;">
                Kod jest ważny przez <strong>10 minut</strong>.<br>
                Jeśli nie prosiłeś o ten kod, zignoruj tę wiadomość.
              </p>

              <hr style="margin: 32px 0; border: none; border-top: 1px solid #e4e4e7;">

              <p style="margin: 0; font-size: 12px; line-height: 18px; color: #a1a1aa; text-align: center;">
                Ze względów bezpieczeństwa nigdy nie udostępniaj tego kodu innym osobom.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin: 24px 0 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
          &copy; ${new Date().getFullYear()} <span style="font-size: 70%;">CONCEPTFAB</span>. Wszelkie prawa zastrzeżone.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

/** Szablon maila do admina: ktoś czeka w poczekalni. */
export function getPendingRequestNotificationTemplate(
  requesterEmail: string,
  appUrl: string = ''
): string {
  return `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Nowa prośba o dostęp - CONCEPTFAB Pano</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
          <tr>
            <td style="padding: 40px 32px;">
              <h1 style="margin: 0 0 24px 0; font-size: 20px; font-weight: 600; color: #18181b;">
                Nowa prośba o dostęp
              </h1>
              <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 24px; color: #52525b;">
                Użytkownik <strong>${requesterEmail}</strong> próbował się zalogować i trafił do <strong>poczekalni</strong>. Czeka na Twoje zatwierdzenie.
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 22px; color: #71717a;">
                Zaloguj się do panelu administratora, wejdź w <strong>Użytkownicy</strong> → zakładka <strong>Poczekalnia</strong>, a następnie zatwierdź lub odrzuć zgłoszenie.
              </p>
              ${
                appUrl
                  ? `<p style="margin: 0;"><a href="${appUrl}/admin/users" style="display: inline-block; background-color: #18181b; color: #fff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 500;">Otwórz poczekalnię</a></p>`
                  : ''
              }
            </td>
          </tr>
        </table>
        <p style="margin: 24px 0 0 0; font-size: 12px; color: #a1a1aa; text-align: center;">
          CONCEPTFAB Pano – powiadomienie dla administratora
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}
