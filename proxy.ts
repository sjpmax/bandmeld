import type { NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";

// Next.js 16+ convention (formerly middleware.ts). On Next 15 or earlier,
// rename this file to middleware.ts and the function to `middleware`.
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Skip static assets and images; run everywhere else so sessions stay fresh.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|pdf)$).*)",
  ],
};
