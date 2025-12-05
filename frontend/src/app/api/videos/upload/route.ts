import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Increase max duration for large uploads
export const maxDuration = 300; // 5 minutes

export async function POST(request: NextRequest) {
  try {
    // Get session cookie to forward authentication
    const sessionCookie = request.cookies.get("session_user_id");

    if (!sessionCookie) {
      return NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401 }
      );
    }

    // Get content type and length from original request
    const contentType = request.headers.get("content-type");
    const contentLength = request.headers.get("content-length");

    // Stream the request body directly to the backend
    let backendResponse: Response;
    try {
      backendResponse = await fetch("http://localhost:8000/api/videos/upload", {
        method: "POST",
        headers: {
          Cookie: `session_user_id=${sessionCookie.value}`,
          ...(contentType && { "Content-Type": contentType }),
          ...(contentLength && { "Content-Length": contentLength }),
        },
        body: request.body,
        // @ts-expect-error duplex is required for streaming request bodies in Node.js
        duplex: "half",
      });
    } catch {
      return NextResponse.json(
        { detail: "Cannot connect to backend server" },
        { status: 503 }
      );
    }

    // Check if response is JSON before parsing
    const responseContentType = backendResponse.headers.get("content-type");
    if (!responseContentType?.includes("application/json")) {
      return NextResponse.json(
        { detail: `Backend error: ${backendResponse.status} ${backendResponse.statusText}` },
        { status: backendResponse.status || 500 }
      );
    }

    const data = await backendResponse.json();

    if (!backendResponse.ok) {
      return NextResponse.json(data, { status: backendResponse.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Upload proxy error:", error);
    return NextResponse.json(
      { detail: "Upload failed" },
      { status: 500 }
    );
  }
}
