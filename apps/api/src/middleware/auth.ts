import { createMiddleware } from "hono/factory";
import { verify } from "hono/jwt";
import type { UserRole } from "@dashboard/db/schema";

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
};

type AuthEnv = {
  Variables: {
    user: AuthUser;
  };
};

/**
 * JWT auth middleware — verify token từ Next.js frontend.
 * Token chứa: sub (userId), email, name, role.
 */
export const authMiddleware = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = header.slice(7);
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return c.json({ error: "Server misconfigured" }, 500);
  }

  try {
    const payload = await verify(token, secret, "HS256");
    c.set("user", {
      id: payload.sub as string,
      email: payload.email as string,
      name: (payload.name as string) ?? null,
      role: payload.role as UserRole,
    });
    await next();
  } catch {
    return c.json({ error: "Invalid token" }, 401);
  }
});
