import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.EMAIL_FROM ?? "Aleppo <noreply@resend.dev>";

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your Aleppo password",
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px; color: #1c1917;">
        <div style="margin-bottom: 24px;">
          <div style="display: inline-flex; align-items: center; justify-content: center; width: 48px; height: 48px; background: #f59e0b; border-radius: 12px;">
            <span style="font-size: 24px;">🍳</span>
          </div>
        </div>
        <h1 style="font-size: 22px; font-weight: 700; margin: 0 0 8px;">Reset your password</h1>
        <p style="color: #57534e; margin: 0 0 24px; line-height: 1.5;">
          Someone requested a password reset for your Aleppo account. If that was you, click the button below. The link expires in 1 hour.
        </p>
        <a
          href="${resetUrl}"
          style="display: inline-block; background: #f59e0b; color: #fff; font-weight: 600; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px;"
        >
          Reset password
        </a>
        <p style="color: #a8a29e; font-size: 12px; margin: 24px 0 0; line-height: 1.5;">
          If you didn't request this, you can safely ignore this email — your password won't change.
        </p>
      </div>
    `,
  });
}
