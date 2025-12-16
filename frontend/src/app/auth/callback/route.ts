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

  // Create redirect URL helper
  const redirectTo = request.nextUrl.clone();
  redirectTo.searchParams.delete("token_hash");
  redirectTo.searchParams.delete("type");
  redirectTo.searchParams.delete("next");

  if (token_hash && type) {
    const supabase = getSupabaseClient();

    // Verify the OTP token
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as "invite" | "signup" | "recovery" | "email" | "magiclink",
    });

    if (error) {
      console.error("Auth callback error:", error);
      redirectTo.pathname = "/";
      redirectTo.searchParams.set("error", "auth_error");
      redirectTo.searchParams.set("error_description", error.message);
      return NextResponse.redirect(redirectTo);
    }

    // Check if this is an invitation - invited users need to set a password
    if (type === "invite" && data.user) {
      // For invited users, redirect to password setup
      // The session is already established, but they need to set a password
      redirectTo.pathname = "/auth/setup-password";
      redirectTo.searchParams.set("next", next);
      return NextResponse.redirect(redirectTo);
    }

    // For password recovery, redirect to password reset page
    if (type === "recovery") {
      redirectTo.pathname = "/auth/reset-password";
      return NextResponse.redirect(redirectTo);
    }

    // For other types (signup confirmation, magic link), redirect to dashboard
    redirectTo.pathname = next;
    return NextResponse.redirect(redirectTo);
  }

  // Handle OAuth callback (code exchange)
  const code = searchParams.get("code");
  if (code) {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("OAuth callback error:", error);
      redirectTo.pathname = "/";
      redirectTo.searchParams.set("error", "auth_error");
      redirectTo.searchParams.set("error_description", error.message);
      return NextResponse.redirect(redirectTo);
    }

    redirectTo.pathname = next;
    return NextResponse.redirect(redirectTo);
  }

  // No valid auth parameters, redirect to home
  redirectTo.pathname = "/";
  return NextResponse.redirect(redirectTo);
}
