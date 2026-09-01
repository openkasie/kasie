import { eq } from "drizzle-orm";
import NextAuth, { type DefaultSession } from "next-auth";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db/client";
import {
  kasieAccounts,
  kasieSessions,
  kasieUsers,
  kasieVerificationTokens,
} from "@/lib/db/schema";
import { env, hasGithubAuth, hasGoogleAuth } from "@/lib/env";
import { usesSecureSessionCookies } from "@/lib/auth/session-cookie";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperadmin: boolean;
      selectedProjectId: string | null;
    } & DefaultSession["user"];
  }
  interface User {
    isSuperadmin?: boolean;
    selectedProjectId?: string | null;
  }
}

declare module "next-auth/adapters" {
  interface AdapterUser {
    isSuperadmin: boolean;
    selectedProjectId: string | null;
  }
}

const SESSION_MAX_AGE_S = 30 * 24 * 60 * 60;

const adapter = DrizzleAdapter(db, {
  usersTable: kasieUsers,
  accountsTable: kasieAccounts,
  sessionsTable: kasieSessions,
  verificationTokensTable: kasieVerificationTokens,
});

async function findUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(kasieUsers)
    .where(eq(kasieUsers.email, email.toLowerCase()))
    .limit(1);
  return user ?? null;
}

function buildProviders() {
  const providers = [];

  if (hasGoogleAuth()) {
    providers.push(
      Google({
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Invite-only: users are pre-provisioned by email, so linking a
        // verified OAuth email to the existing row is the intended flow.
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  if (hasGithubAuth()) {
    providers.push(
      GitHub({
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    );
  }

  return providers;
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter,
  secret: env.AUTH_SECRET,
  session: { strategy: "database", maxAge: SESSION_MAX_AGE_S },
  useSecureCookies: usesSecureSessionCookies(),
  pages: { signIn: "/sign-in", error: "/sign-in" },
  providers: buildProviders(),
  callbacks: {
    async signIn({ user }) {
      // Invite-only: OAuth sign-in succeeds only for pre-provisioned emails.
      if (!user.email) return false;
      return Boolean(await findUserByEmail(user.email));
    },
    async session({ session, user }) {
      session.user.id = user.id;
      session.user.isSuperadmin = user.isSuperadmin;
      session.user.selectedProjectId = user.selectedProjectId ?? null;
      return session;
    },
  },
});
