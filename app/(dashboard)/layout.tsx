import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";
import SharedHeader from "@/components/layout/SharedHeader";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={user.role} userName={`${user.firstName} ${user.lastName}`} />

      <div className="flex-1 flex flex-col min-w-0">
        <SharedHeader
          firstName={user.firstName}
          lastName={user.lastName}
          email={user.email}
          role={user.role as Role}
        />
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileNav role={user.role} />
    </div>
  );
}
