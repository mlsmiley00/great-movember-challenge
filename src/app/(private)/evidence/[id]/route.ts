import { NextRequest, NextResponse } from "next/server";
import { member, COMPETITION } from "@/lib/auth";
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { db } = await member();
  const { id } = await params;
  const { data, error } = await db
    .from("evidence")
    .select("path")
    .eq("entry_id", id)
    .eq("competition_id", COMPETITION)
    .single();
  if (error || !data)
    return new NextResponse("Not found", {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  const result = await db.storage
    .from("progress-evidence")
    .createSignedUrl(data.path, 60);
  if (result.error || !result.data)
    return new NextResponse("Unavailable", { status: 404 });
  // Proxy the file so capability-bearing signed URLs never leave the server.
  const file = await fetch(result.data.signedUrl, { cache: "no-store" });
  if (!file.ok) return new NextResponse("Unavailable", { status: 404 });
  return new NextResponse(file.body, {
    headers: {
      "Content-Type":
        file.headers.get("content-type") || "application/octet-stream",
      "Cache-Control": "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
