import { createClient, Session } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Supabase environment variables not set. Auth features will be disabled."
  );
}

// Create Supabase client (or null if not configured)
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      })
    : null;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => !!supabase;

// Cached session to avoid calling getSession() for every API request
// This prevents hangs when Supabase has network issues or session refresh problems
let cachedSession: Session | null = null;
let sessionInitialized = false;

// Initialize session cache from auth state listener
if (supabase) {
  supabase.auth.onAuthStateChange((event, session) => {
    cachedSession = session;
    sessionInitialized = true;
  });

  // Also get initial session (but don't block on it)
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (!sessionInitialized) {
      cachedSession = session;
      sessionInitialized = true;
    }
  }).catch(() => {
    // If initial getSession fails, just mark as initialized with null
    sessionInitialized = true;
  });
}

// Get current access token for API calls (uses cached session)
export const getAccessToken = async (): Promise<string | null> => {
  if (!supabase) return null;

  // If session is cached, use it immediately
  if (sessionInitialized) {
    return cachedSession?.access_token ?? null;
  }

  // Fallback: try to get session with a timeout to prevent hanging
  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 3000);
    });

    const sessionPromise = supabase.auth.getSession().then(
      ({ data: { session } }) => {
        cachedSession = session;
        sessionInitialized = true;
        return session?.access_token ?? null;
      }
    );

    return await Promise.race([sessionPromise, timeoutPromise]);
  } catch {
    return null;
  }
};
