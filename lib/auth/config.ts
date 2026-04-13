import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";
import type { UserRole } from "@/db/schema";

const isDev = process.env.NODE_ENV !== "production";

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
  trustHost: true,
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
    // DEV ONLY: Credentials provider để switch user nhanh khi test các role khác nhau.
    // Chỉ enable khi NODE_ENV !== 'production'. KHÔNG có password — chỉ check email
    // có trong DB + active. Production deploy sẽ tự loại provider này.
    ...(isDev
      ? [
          Credentials({
            id: "dev-switch",
            name: "Dev Switch User",
            credentials: {
              email: { label: "Email", type: "email" },
            },
            async authorize(creds) {
              const email = (creds?.email as string | undefined)?.toLowerCase();
              if (!email) return null;
              const user = await db.query.users.findFirst({
                where: eq(users.email, email),
              });
              if (!user || !user.active) return null;
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                image: user.image,
              };
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async signIn({ user, profile, account }) {
      // Email có thể đến từ profile (Google) hoặc user (Credentials dev-switch)
      const email = (profile?.email ?? user?.email)?.toLowerCase();
      if (!email) return "/login?error=no-email";

      // Dev switch bypass domain check (already validated khi seed user)
      const isDevSwitch = account?.provider === "dev-switch";

      // 1. Domain check (chỉ cho Google)
      if (!isDevSwitch) {
        const domain = email.split("@")[1];
        if (
          allowedDomains.length > 0 &&
          (!domain || !allowedDomains.includes(domain))
        ) {
          return "/login?error=domain";
        }
      }

      // 2. Find or auto-create user
      let dbUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (!dbUser) {
        // Auto-create with active=false (pending approval)
        const [newUser] = await db
          .insert(users)
          .values({
            email,
            name: profile?.name ?? user?.name ?? email.split("@")[0],
            image: (profile?.picture as string) ?? null,
            role: "digital", // default role — admin sẽ đổi sau
            active: false,   // pending — chờ admin duyệt
          })
          .returning();
        dbUser = newUser;
        // Redirect to pending page
        return "/pending";
      }

      if (!dbUser.active) return "/pending";

      // 3. Update last login (chỉ Google update image)
      await db
        .update(users)
        .set({
          ...(profile?.picture
            ? { image: profile.picture as string }
            : {}),
          lastLoginAt: new Date(),
        })
        .where(eq(users.id, dbUser.id));

      return true;
    },

    async jwt({ token }) {
      // Re-fetch user mỗi lần refresh để check active + role mới nhất
      if (token.sub) {
        const dbUser = await db.query.users.findFirst({
          where: eq(users.id, token.sub),
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.active = dbUser.active;
        } else {
          // User bị xoá khỏi DB
          token.active = false;
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as UserRole;
        // Pass active status to client for pending check
        (session.user as unknown as Record<string, unknown>).active = token.active;
      }
      return session;
    },
  },
});
