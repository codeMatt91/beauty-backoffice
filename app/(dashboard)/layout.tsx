import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import MobileNav from "@/components/layout/MobileNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const user = session.user as any;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar role={user.role} userName={user.name ?? user.email} />

      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      <MobileNav role={user.role} />
    </div>
  );
}
