import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

import {
  DEV_AUTH_PROVIDER_ID,
  getDevAuthUser,
  isDevAuthEnabled,
} from "@/lib/dev-auth";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
    ...(isDevAuthEnabled()
      ? [
          Credentials({
            id: DEV_AUTH_PROVIDER_ID,
            name: "Acesso dev",
            // O e-mail é opcional: sem ele, vale o do ambiente, como sempre
            // valeu. Com ele, dá para encenar duas pessoas ao mesmo tempo — que
            // é o que uma prova de trabalho em conjunto precisa fazer.
            credentials: { email: { label: "E-mail", type: "text" } },
            authorize(credentials) {
              return getDevAuthUser(
                typeof credentials?.email === "string" ? credentials.email : undefined,
              );
            },
          }),
        ]
      : []),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth: session, request }) {
      const isLoginPage = request.nextUrl.pathname === "/login";
      const isAuthenticated = Boolean(session?.user);

      if (isLoginPage && isAuthenticated) {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      return isLoginPage || isAuthenticated;
    },
  },
});
