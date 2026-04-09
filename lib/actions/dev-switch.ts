"use server";

import { signIn } from "@/lib/auth/config";

/**
 * DEV ONLY: switch sang user khác (không cần password) để test role.
 * Hard-blocked nếu NODE_ENV === 'production'.
 */
export async function devSwitchUser(email: string): Promise<void> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev switch user disabled in production");
  }
  await signIn("dev-switch", {
    email,
    redirectTo: "/",
  });
}
