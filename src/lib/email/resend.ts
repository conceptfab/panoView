// oxlint-disable react-doctor/async-await-in-loop
import { Resend } from 'resend';
import {
  getOTPEmailTemplate,
  getPendingRequestNotificationTemplate,
} from './templates';

// Lazy init – konstruktor Resend rzuca przy braku klucza, co wywalałoby build
// (collecting page data) na środowiskach bez ustawionego RESEND_API_KEY.
let resendClient: Resend | null = null;
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
}

// Nadawca: "Name <email@domain.com>". Set EMAIL_FROM_USE_RESEND_TEST=true tylko do testów (wysyłka tylko na adres konta Resend).
function getEmailFrom(): string {
  if (process.env.EMAIL_FROM_USE_RESEND_TEST === 'true') {
    return 'ConceptFab Pano <onboarding@resend.dev>';
  }
  const raw = (process.env.EMAIL_FROM ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '');
  if (!raw || raw.toLowerCase().includes('localhost')) {
    return 'ConceptFab Pano <onboarding@resend.dev>';
  }
  return raw.includes('<') && raw.includes('>')
    ? raw
    : `ConceptFab Pano <${raw}>`;
}

const RESEND_TEST_RECIPIENT = (process.env.RESEND_TEST_RECIPIENT ?? '')
  .trim()
  .toLowerCase();

export async function sendOTPEmail(
  email: string,
  code: string,
  options?: { isAdmin?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const isTestSender = process.env.EMAIL_FROM_USE_RESEND_TEST === 'true';
  const toLower = email.trim().toLowerCase();

  if (
    isTestSender &&
    RESEND_TEST_RECIPIENT &&
    toLower !== RESEND_TEST_RECIPIENT
  ) {
    return {
      success: false,
      error: `W trybie testowym kod można wysłać tylko na adres ${RESEND_TEST_RECIPIENT}. Wpisz ten adres na stronie logowania lub zweryfikuj domenę w Resend (resend.com/domains) i wyłącz EMAIL_FROM_USE_RESEND_TEST w .env.local.`,
    };
  }

  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
  const subjectBase = `Kod logowania - CONCEPTFAB Pano v: ${appVersion}`;
  const subject = options?.isAdmin ? `[Admin] ${subjectBase}` : subjectBase;

  try {
    const { error } = await getResend().emails.send({
      from: getEmailFrom(),
      to: email,
      subject,
      html: getOTPEmailTemplate(code, appVersion, options?.isAdmin),
    });

    if (error) {
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Email send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Wysyła do adminów maila z raportem błędu (Bug hunter). Tytuł zawiera wersję. */
export async function sendBugReportToAdmins(
  adminEmails: string[],
  reporterEmail: string,
  message: string,
  appVersion: string
): Promise<{ success: boolean; error?: string }> {
  if (adminEmails.length === 0) {
    return { success: false, error: 'Brak adresów adminów' };
  }
  const subject = `[Bug hunter] CONCEPTFAB Pano v: ${appVersion}`;
  const html = `
<!DOCTYPE html>
<html lang="pl">
<head><meta charset="UTF-8"><title>${subject}</title></head>
<body style="margin:0;padding:16px;font-family:sans-serif;">
  <p><strong>Od:</strong> ${reporterEmail}</p>
  <p><strong>Wersja:</strong> ${appVersion}</p>
  <hr style="border:none;border-top:1px solid #ccc;margin:12px 0;">
  <pre style="white-space:pre-wrap;word-wrap:break-word;margin:0;">${message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
  try {
    for (const to of adminEmails) {
      const { error } = await getResend().emails.send({
        from: getEmailFrom(),
        to,
        subject,
        html,
      });
      if (error) {
        console.error('[Bug report]', to, error.message);
        return { success: false, error: error.message };
      }
    }
    return { success: true };
  } catch (error) {
    console.error('[Bug report]', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/** Wysyła do każdego admina maila, że ktoś (requesterEmail) czeka w poczekalni. */
export async function sendPendingRequestNotificationToAdmins(
  adminEmails: string[],
  requesterEmail: string
): Promise<void> {
  if (adminEmails.length === 0) return;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? '')
    .trim()
    .replace(/\/$/, '');
  const subject = `[CONCEPTFAB Pano] Nowa prośba o dostęp: ${requesterEmail}`;
  const html = getPendingRequestNotificationTemplate(requesterEmail, appUrl);
  for (const to of adminEmails) {
    try {
      const { error } = await getResend().emails.send({
        from: getEmailFrom(),
        to,
        subject,
        html,
      });
      if (error) console.error('[Pending notification]', to, error.message);
    } catch (e) {
      console.error('[Pending notification]', to, e);
    }
  }
}
