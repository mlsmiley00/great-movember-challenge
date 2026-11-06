import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/server";
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
  if (code) {
    const db = await supabase();
    const { error } = await db.auth.exchangeCodeForSession(code);
    if (!error) {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (user?.email_confirmed_at && user.user_metadata.invitation_token) {
        const { error: acceptError } = await db.rpc("accept_invitation", {
          token: user.user_metadata.invitation_token,
          chosen_name: user.user_metadata.display_name || "Member",
        });
        if (!acceptError)
          await db.auth.updateUser({ data: { invitation_token: null } });
      }
      const next = request.nextUrl.searchParams.get("next");
      return NextResponse.redirect(
        new URL(next === "/join?recovery=1" ? next : "/", origin),
      );
    }
  }
  return NextResponse.redirect(
    new URL(
      "/login?error=" +
        encodeURIComponent(
          "This email link could not be opened. Older reset links must be opened in the browser that requested them. Request a new link if it expired or was already used. / No se pudo abrir el enlace. Los enlaces antiguos deben abrirse en el navegador que los solicitó. Solicita uno nuevo si caducó o ya se usó.",
        ),
      origin,
    ),
  );
}
