import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { auth, handlers, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          prompt: "select_account",
        },
      },
    }),
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
