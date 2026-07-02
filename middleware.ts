import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_ROUTES = ["/login"];
const ADMIN_ONLY_ROUTES = ["/finance", "/employees", "/settings"];

export default auth((req: NextRequest & { auth: any }) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Rotta pubblica – lascia passare
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session) {
      return NextResponse.redirect(new URL("/calendar", req.url));
    }
    return NextResponse.next();
  }

  // Utente non autenticato
  if (!session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Rotte riservate agli Admin
  if (ADMIN_ONLY_ROUTES.some((r) => pathname.startsWith(r))) {
    if (session.user?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/calendar", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)",
  ],
};
