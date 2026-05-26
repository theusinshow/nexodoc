import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isAdminEmail } from "@/lib/access-control";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/");
  }

  return children;
}
