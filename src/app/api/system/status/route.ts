import { NextResponse } from "next/server";
import { getSystemState } from "@/lib/store/systemState";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ...(await getSystemState()) });
}
