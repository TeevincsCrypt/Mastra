import { NextResponse } from "next/server";
import { getAuthenticatedAddress } from "@/lib/auth/requireSession";

export const dynamic = "force-dynamic";

export async function GET() {
  const address = await getAuthenticatedAddress();
  return NextResponse.json({ ok: true, authenticated: Boolean(address), address });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete("mastra_session");
  return response;
}
