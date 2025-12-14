import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const backendResponse = await fetch(`${BACKEND_URL}/api/auth/logout`, {
      method: "POST",
    });

    const data = await backendResponse.json();

    // Create response
    const response = NextResponse.json(data, { status: backendResponse.status });

    // Forward Set-Cookie headers (which will delete the cookie)
    const setCookieHeader = backendResponse.headers.get("set-cookie");
    if (setCookieHeader) {
      response.headers.set("set-cookie", setCookieHeader);
    }

    return response;
  } catch (error) {
    console.error("Logout proxy error:", error);
    return NextResponse.json(
      { detail: "Logout failed" },
      { status: 500 }
    );
  }
}
