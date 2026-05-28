import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { getUserAccess } from "@/lib/access-control";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await getUserAccess(session.user.email, session.user.name);

  if (!access.isActive || !access.isAdmin) {
    redirect("/");
  }

  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
