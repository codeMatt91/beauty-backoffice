export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen overflow-x-hidden flex items-center justify-center bg-gradient-to-br from-rose-50 via-white to-pink-50 dark:from-background dark:via-background dark:to-background">
      {children}
    </div>
  );
}
