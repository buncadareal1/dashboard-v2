import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import type { UserRole } from "@/db/schema";

/**
 * Auth.js v5 với Google Workspace OAuth.
 *
 * 2 lớp bảo vệ trong signIn callback:
 * 1. Email phải thuộc domain công ty (ALLOWED_EMAIL_DOMAIN — comma-separated)
 * 2. User phải được admin pre-provision trong bảng users (active=true)
 *
 * Không tự tạo user mới từ OAuth callback → chống leak.
 */

const allowedDomains = (process.env.ALLOWED_EMAIL_DOMAIN ?? "")
  .split(",")
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: { strategy: "jwt" },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Cho phép link OAuth account với email user đã pre-provision trong DB.
      // An toàn vì admin tự tạo user → tin tưởng email Google trong domain whitelist.
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return "/login?error=no-email";

      // 1. Domain check
      const domain = email.split("@")[1];
      if (
        allowedDomains.length > 0 &&
        (!domain || !allowedDomains.includes(domain))
      ) {
        return "/login?error=domain";
      }

      // 2. Provisioned user check
      const dbUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });
      if (!dbUser) return "/login?error=not-provisioned";
      if (!dbUser.active) return "/login?error=deactivated";

      // 3. Update last login + ảnh từ Google
      await db
        .update(users)
        .set({
          image: profile?.picture as string | null,
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, dbUser.id));

      return true;
    },

    async jwt({ token, user }) {
      // Lần đầu sign in: attach role + id từ DB
      if (user?.email) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });
        if (dbUser) {
          token.sub = dbUser.id;
          token.role = dbUser.role;
          token.active = dbUser.active;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
});
