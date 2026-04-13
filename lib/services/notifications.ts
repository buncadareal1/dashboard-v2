import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, notifications } from "@/db/schema";
import type { NotificationType } from "@/db/schema";
import {
  sendEmail,
  getAdminEmail,
  newUserPendingEmailHtml,
  csvUploadDoneEmailHtml,
} from "./email";

/**
 * Tạo in-app notification cho 1 user + optional gửi email.
 */
async function createNotification(params: {
  recipientId: string;
  type: NotificationType;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  emailSubject?: string;
  emailHtml?: string;
}) {
  const [notif] = await db
    .insert(notifications)
    .values({
      recipientId: params.recipientId,
      type: params.type,
      title: params.title,
      message: params.message,
      metadata: params.metadata,
    })
    .returning();

  // Send email if provided
  if (params.emailSubject && params.emailHtml) {
    const recipient = await db.query.users.findFirst({
      where: eq(users.id, params.recipientId),
      columns: { email: true },
    });
    if (recipient) {
      const sent = await sendEmail({
        to: recipient.email,
        subject: params.emailSubject,
        html: params.emailHtml,
      });
      if (sent) {
        await db
          .update(notifications)
          .set({ emailSent: true })
          .where(eq(notifications.id, notif.id));
      }
    }
  }

  return notif;
}

/**
 * Lấy tất cả admin users.
 */
async function getAdminUsers() {
  return db.query.users.findMany({
    where: eq(users.role, "admin"),
    columns: { id: true, email: true, name: true },
  });
}

/**
 * Thông báo tất cả admin khi có user mới đăng ký (pending).
 */
export async function notifyNewUserPending(newUserName: string, newUserEmail: string) {
  const admins = await getAdminUsers();
  const adminEmail = getAdminEmail();

  const title = "Tài khoản mới chờ duyệt";
  const message = `${newUserName} (${newUserEmail}) vừa đăng nhập lần đầu và đang chờ được kích hoạt.`;

  const promises = admins.map((admin) =>
    createNotification({
      recipientId: admin.id,
      type: "new_user_pending",
      title,
      message,
      metadata: { newUserEmail, newUserName },
      // Chỉ gửi email cho admin chính (tránh spam nhiều admin)
      ...(admin.email === adminEmail
        ? {
            emailSubject: `[Smartland] Tài khoản mới: ${newUserName}`,
            emailHtml: newUserPendingEmailHtml(newUserName, newUserEmail),
          }
        : {}),
    }),
  );

  await Promise.all(promises);
}

/**
 * Thông báo tất cả admin khi có người upload file CSV.
 */
export async function notifyCsvUpload(params: {
  uploaderName: string;
  uploaderEmail: string;
  filename: string;
  projectName: string;
  projectId: string;
  uploadId: string;
  rowCount: number;
  status: "done" | "failed";
}) {
  const admins = await getAdminUsers();
  const adminEmail = getAdminEmail();

  const isDone = params.status === "done";
  const title = isDone
    ? "File CSV đã upload thành công"
    : "File CSV upload thất bại";
  const message = `${params.uploaderName} đã upload "${params.filename}" vào dự án ${params.projectName}${isDone ? ` (${params.rowCount} dòng)` : " — lỗi xử lý"}.`;

  const promises = admins.map((admin) =>
    createNotification({
      recipientId: admin.id,
      type: isDone ? "csv_upload_done" : "csv_upload_failed",
      title,
      message,
      metadata: {
        uploadId: params.uploadId,
        projectId: params.projectId,
        filename: params.filename,
        uploaderEmail: params.uploaderEmail,
        rowCount: params.rowCount,
      },
      ...(admin.email === adminEmail && isDone
        ? {
            emailSubject: `[Smartland] Upload CSV: ${params.filename}`,
            emailHtml: csvUploadDoneEmailHtml(
              params.uploaderName,
              params.filename,
              params.projectName,
              params.rowCount,
            ),
          }
        : {}),
    }),
  );

  await Promise.all(promises);
}
