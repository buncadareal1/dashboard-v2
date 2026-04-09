import { auth } from "./config";
import type { UserRole } from "@/db/schema";

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
};

/**
 * Lấy user từ session — null nếu chưa login.
 * Dùng trong Server Components, Server Actions, Route Handlers.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.email) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name ?? null,
    image: session.user.image ?? null,
    role: session.user.role,
  };
}

/**
 * Bắt buộc login — throw nếu chưa.
 * Throw để Next.js error boundary xử lý hoặc redirect.
 */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }
  return user;
}
