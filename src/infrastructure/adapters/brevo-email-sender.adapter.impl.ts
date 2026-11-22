import { envs } from "../../config/envs.js";
import {
  EmailSenderAdapter,
  VerificationEmail,
} from "../../domain/adapters/email-sender.adapter.js";
import { CustomError } from "../../domain/error/custom-error.js";
import { fetchWithTimeout } from "../http/fetch-with-timeout.js";

const SERVICE_NAME = "Email provider";
const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function verificationHtml({ name, code, expiresInMinutes }: VerificationEmail): string {
  return `<!doctype html>
<html lang="es">
  <body style="font-family: Arial, sans-serif; color: #1f2937;">
    <p>Hola ${escapeHtml(name)},</p>
    <p>Usa este código para verificar tu correo en MathE:</p>
    <p style="font-size: 28px; font-weight: bold; letter-spacing: 6px;">${code}</p>
    <p>El código vence en ${expiresInMinutes} minutos.</p>
    <p>Si no creaste una cuenta en MathE, ignora este mensaje.</p>
  </body>
</html>`;
}

/** Sends emails through the Brevo transactional API over HTTPS (no SMTP ports). */
export class BrevoEmailSenderAdapterImpl implements EmailSenderAdapter {
  async sendVerificationCode(email: VerificationEmail): Promise<void> {
    const response = await fetchWithTimeout(BREVO_SEND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "api-key": envs.BREVO_API_KEY,
      },
      body: JSON.stringify({
        sender: { email: envs.EMAIL_FROM_ADDRESS, name: envs.EMAIL_FROM_NAME },
        to: [{ email: email.to, name: email.name }],
        subject: `Tu código de verificación de MathE: ${email.code}`,
        htmlContent: verificationHtml(email),
      }),
      timeoutMs: envs.EMAIL_TIMEOUT_MS,
      serviceName: SERVICE_NAME,
    });

    if (!response.ok) {
      // Log the provider's reason (never the API key) to diagnose sender/key issues.
      const detail = await response.text().catch(() => "");
      console.error(`Brevo rejected the email (${response.status}): ${detail.slice(0, 300)}`);
      throw CustomError.badGateway(`${SERVICE_NAME} returned status ${response.status}`);
    }
  }
}
