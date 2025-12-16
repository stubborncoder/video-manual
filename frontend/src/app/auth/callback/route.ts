import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

// Create a Supabase client for server-side operations
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase environment variables not configured");
  }

  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Get the public origin for redirects.
 * In production behind a proxy, request.nextUrl might show internal addresses.
 */
function getPublicOrigin(request: NextRequest): string {
  // Check for forwarded host (from reverse proxy)
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  // Check the host header
  const host = request.headers.get("host");
  if (host && !host.includes("0.0.0.0") && !host.includes("localhost")) {
    return `https://${host}`;
  }

  // Fallback to environment variable or request origin
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
}

/**
 * Auth callback route handler for Supabase authentication.
 * Handles email confirmations, magic links, password resets, and invitations.
 *
 * For invitations: redirects users to password setup page instead of auto-login.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Get token parameters from URL
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = searchParams.get("next") ?? "/dashboard";

  // Get the public origin for proper redirects behind proxy
  const origin = getPublicOrigin(request);

  if (token_hash && type) {
    const supabase = getSupabaseClient();

    // Verify the OTP token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "signup" | "recovery" | "email" | "magiclink",
    });

    if (error) {
      console.error("Auth callback error:", error);
      const errorUrl = new URL("/", origin);
      errorUrl.searchParams.set("error", "auth_error");
      errorUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(errorUrl);
    }

    // Check if this is an invitation - invited users need to set a password
    if (type === "invite" && data.user) {
      // For invited users, redirect to password setup
      // The session is already established, but they need to set a password
      const setupUrl = new URL("/auth/setup-password", origin);
      setupUrl.searchParams.set("next", next);
      return NextResponse.redirect(setupUrl);
    }

    // For password recovery, redirect to password reset page
    if (type === "recovery") {
      return NextResponse.redirect(new URL("/auth/reset-password", origin));
    }

    // For other types (signup confirmation, magic link), redirect to dashboard
    return NextResponse.redirect(new URL(next, origin));
  }

  // Handle OAuth callback (code exchange)
  const code = searchParams.get("code");
  if (code) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth callback error:", error);
      const errorUrl = new URL("/", origin);
      errorUrl.searchParams.set("error", "auth_error");
      errorUrl.searchParams.set("error_description", error.message);
      return NextResponse.redirect(errorUrl);
    }

    return NextResponse.redirect(new URL(next, origin));
  }

  // No valid auth parameters, redirect to home
  return NextResponse.redirect(new URL("/", origin));
}
