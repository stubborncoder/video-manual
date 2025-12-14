import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  try {
    // Forward auth headers to backend
    const authHeader = request.headers.get("authorization");
    const sessionCookie = request.cookies.get("session_user_id");

    const headers: Record<string, string> = {};
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }
    if (sessionCookie) {
      headers["Cookie"] = `session_user_id=${sessionCookie.value}`;
    }

    const backendResponse = await fetch(`${BACKEND_URL}/api/auth/me`, {
      method: "GET",
      headers,
    });

    const data = await backendResponse.json();

    // Create response
    const response = NextResponse.json(data, { status: backendResponse.status });

    // Forward Set-Cookie headers from backend
    const setCookieHeader = backendResponse.headers.get("set-cookie");
    if (setCookieHeader) {
      // Parse and forward the cookie
      response.headers.set("set-cookie", setCookieHeader);
    }

    return response;
  } catch (error) {
    console.error("Auth proxy error:", error);
    return NextResponse.json(
      { authenticated: false },
      { status: 500 }
    );
  }
}
