import { NextResponse } from "next/server";
import { verifyChallengeSignature } from "@/lib/auth/siwe";
import { createSessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

interface RequestBody {
  address?: string;
  message?: string;
  signature?: string;
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.address || !body.message || !body.signature) {
    return NextResponse.json({ ok: false, error: "address, message and signature are all required." }, { status: 400 });
  }

  const result = await verifyChallengeSignature({
    address: body.address,
    message: body.message,
    signature: body.signature as `0x${string}`,
  });

  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 401 });
  }

  let session;
  try {
    session = createSessionToken(body.address);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Failed to issue session." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true, address: body.address.toLowerCase(), expiresAt: session.expiresAt });
  response.cookies.set(SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(session.expiresAt),
  });
  return response;
}
