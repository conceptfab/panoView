// oxlint-disable react-doctor/async-await-in-loop
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import {
  getOTPEmailTemplate,
  getPendingRequestNotificationTemplate,
} from './templates';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = Number(process.env.SMTP_PORT || 587);
    if (!host || !user || !pass) {
      throw new Error('SMTP_HOST, SMTP_USER and SMTP_PASS must be set');
    }
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }
  return transporter;
}

function getEmailFrom(): string {
  const raw = (process.env.EMAIL_FROM ?? process.env.SMTP_USER ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[\r\n]+/g, '');
  if (!raw) {
    return 'ConceptFab Pano <cfabpano@conceptfab.com>';
  }
  return raw.includes('<') && raw.includes('>')
    ? raw
    : `ConceptFab Pano <${raw}>`;
}

async function sendHtmlMail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await getTransporter().sendMail({
      from: getEmailFrom(),
      to,
      subject,
      html,
    });
    return { success: true };
  } catch (error) {
    console.error('SMTP send error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function sendOTPEmail(
  email: string,
  code: string,
  options?: { isAdmin?: boolean }
): Promise<{ success: boolean; error?: string }> {
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION ?? '0.0.0';
  const subjectBase = `Kod logowania - CONCEPTFAB Pano v: ${appVersion}`;
  const subject = options?.isAdmin ? `[Admin] ${subjectBase}` : subjectBase;

  return sendHtmlMail(
    email,
    subject,
    getOTPEmailTemplate(code, appVersion, options?.isAdmin)
  );
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

  for (const to of adminEmails) {
    const result = await sendHtmlMail(to, subject, html);
    if (!result.success) {
      console.error('[Bug report]', to, result.error);
      return result;
    }
  }
  return { success: true };
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
    const result = await sendHtmlMail(to, subject, html);
    if (!result.success) {
      console.error('[Pending notification]', to, result.error);
    }
  }
}
