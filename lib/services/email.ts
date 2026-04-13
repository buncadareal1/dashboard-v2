import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL ?? "onboarding@resend.dev";
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL ?? "webdev@smartland.vn";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<boolean> {
  if (!resend) {
    console.warn("[email] RESEND_API_KEY not set — skipping email to", to);
    return false;
  }

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
    });
    return true;
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[email] Failed to send:", msg);
    return false;
  }
}

export function getAdminEmail(): string {
  return ADMIN_EMAIL;
}

// --- Email templates ---

export function newUserPendingEmailHtml(userName: string, userEmail: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Smartland Dashboard — Tài khoản mới chờ duyệt</h2>
      <p>Có người mới đăng nhập vào dashboard:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Tên</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(userName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Email</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(userEmail)}</td>
        </tr>
      </table>
      <p>Vào <a href="https://dashboard-v2-one-vert.vercel.app/settings">Settings → Team</a> để kích hoạt tài khoản và gán role.</p>
      <p style="color: #666; font-size: 12px;">— Smartland Dashboard</p>
    </div>
  `;
}

export function csvUploadDoneEmailHtml(
  uploaderName: string,
  filename: string,
  projectName: string,
  rowCount: number,
): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Smartland Dashboard — File CSV đã upload</h2>
      <p><strong>${escapeHtml(uploaderName)}</strong> vừa upload file lên dashboard:</p>
      <table style="border-collapse: collapse; width: 100%; margin: 16px 0;">
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">File</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(filename)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Dự án</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${escapeHtml(projectName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Số dòng</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${rowCount}</td>
        </tr>
      </table>
      <p>Xem chi tiết tại <a href="https://dashboard-v2-one-vert.vercel.app">Dashboard</a>.</p>
      <p style="color: #666; font-size: 12px;">— Smartland Dashboard</p>
    </div>
  `;
}

export function accountActivatedEmailHtml(userName: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">Chào ${escapeHtml(userName)},</h2>
      <p>Tài khoản của bạn trên <strong>Smartland Dashboard</strong> đã được kích hoạt!</p>
      <p>Bạn có thể đăng nhập ngay tại:</p>
      <p style="margin: 20px 0;">
        <a href="https://dashboard-v2-one-vert.vercel.app/login"
           style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Đăng nhập Dashboard
        </a>
      </p>
      <p style="color: #666; font-size: 12px;">— Smartland Dashboard</p>
    </div>
  `;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
