# Implementation Plan: Supabase Authentication for vDocs

## Executive Summary

This plan outlines the migration from the current simple cookie-based authentication (`session_user_id`) to a full Supabase authentication system with proper user management, session handling, and Row Level Security (RLS).

---

## 1. Supabase Project Setup and Configuration

### 1.1 Create Supabase Project
1. Create a new Supabase project at https://supabase.com/dashboard
2. Note the following credentials:
   - **Project URL**: `https://<project-ref>.supabase.co`
   - **Anon Key**: Public key for client-side auth
   - **Service Role Key**: Server-side key (never expose to client)
   - **JWT Secret**: For backend token verification

### 1.2 Database Schema Migration

The current SQLite schema in `/src/db/database.py` needs to be replicated in Supabase PostgreSQL with RLS policies.

**Create Tables in Supabase:**

```sql
-- Users table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    display_name TEXT,
    email TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

-- Jobs table (migrate from SQLite)
CREATE TABLE public.jobs (
    id TEXT PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    video_name TEXT NOT NULL,
    manual_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    current_node TEXT,
    node_index INTEGER,
    total_nodes INTEGER,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    seen BOOLEAN DEFAULT FALSE
);

-- LLM requests table
CREATE TABLE public.llm_requests (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    operation TEXT NOT NULL,
    model TEXT NOT NULL,
    input_tokens INTEGER,
    output_tokens INTEGER,
    total_tokens INTEGER,
    cached_tokens INTEGER DEFAULT 0,
    cache_creation_tokens INTEGER DEFAULT 0,
    cache_read_tokens INTEGER DEFAULT 0,
    cost_usd REAL,
    manual_id TEXT,
    job_id TEXT
);

-- Daily usage aggregates
CREATE TABLE public.usage_daily (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL,
    operation TEXT NOT NULL,
    model TEXT NOT NULL,
    request_count INTEGER DEFAULT 0,
    total_input_tokens INTEGER DEFAULT 0,
    total_output_tokens INTEGER DEFAULT 0,
    total_cached_tokens INTEGER DEFAULT 0,
    total_cache_read_tokens INTEGER DEFAULT 0,
    total_cost_usd REAL DEFAULT 0,
    UNIQUE(user_id, date, operation, model)
);

-- Indexes
CREATE INDEX idx_jobs_user_status ON public.jobs(user_id, status);
CREATE INDEX idx_jobs_completed_at ON public.jobs(completed_at);
CREATE INDEX idx_jobs_user_seen ON public.jobs(user_id, seen, started_at);
CREATE INDEX idx_llm_requests_user_date ON public.llm_requests(user_id, timestamp);
CREATE INDEX idx_usage_daily_user_date ON public.usage_daily(user_id, date);
```

### 1.3 Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.llm_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_daily ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own profile
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- Jobs: users can only access their own jobs
CREATE POLICY "Users can manage own jobs" ON public.jobs
    FOR ALL USING (auth.uid() = user_id);

-- LLM requests: users can only view their own usage
CREATE POLICY "Users can view own llm_requests" ON public.llm_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (for admin users)
CREATE POLICY "Admins can view all profiles" ON public.profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );
```

### 1.4 Supabase Auth Trigger (Auto-create Profile)

```sql
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## 2. Backend Integration (Python/FastAPI)

### 2.1 Add Dependencies

Add to `pyproject.toml`:

```toml
dependencies = [
    # ... existing deps ...
    "supabase>=2.0.0",
    "python-jose[cryptography]>=3.3.0",  # For JWT verification
]
```

### 2.2 Create Supabase Client Module

**New file: `src/auth/supabase_client.py`**

```python
"""Supabase client for authentication and database access."""

import os
from functools import lru_cache
from supabase import create_client, Client

@lru_cache()
def get_supabase_client() -> Client:
    """Get singleton Supabase client."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_ANON_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set")

    return create_client(url, key)

@lru_cache()
def get_supabase_admin_client() -> Client:
    """Get Supabase client with service role key (for server-side operations)."""
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")

    if not url or not key:
        raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set")

    return create_client(url, key)
```

### 2.3 Update Authentication Dependency

**Modify: `src/api/dependencies.py`**

Replace the current cookie-based auth with JWT verification:

```python
"""FastAPI dependencies for authentication and storage access."""

from typing import Annotated
from fastapi import Depends, HTTPException, status, Header, Cookie
from jose import jwt, JWTError
import os

from ..storage.user_storage import UserStorage
from ..storage.project_storage import ProjectStorage
from ..storage.trash_storage import TrashStorage
from ..auth.supabase_client import get_supabase_client


async def get_current_user(
    authorization: Annotated[str | None, Header()] = None,
    session_access_token: Annotated[str | None, Cookie()] = None,
) -> dict:
    """Verify Supabase JWT and return user info.

    Supports both:
    - Authorization header: Bearer <token>
    - Cookie: session_access_token=<token>
    """
    token = None

    # Try Authorization header first
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    # Fallback to cookie
    elif session_access_token:
        token = session_access_token

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Verify JWT with Supabase JWT secret
        jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
        payload = jwt.decode(
            token,
            jwt_secret,
            algorithms=["HS256"],
            audience="authenticated"
        )

        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload"
            )

        return {
            "id": user_id,
            "email": payload.get("email"),
            "role": payload.get("role", "user"),
        }

    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


CurrentUser = Annotated[dict, Depends(get_current_user)]

# Helper to get just the user_id string for compatibility
async def get_current_user_id(user: CurrentUser) -> str:
    """Get current user ID string."""
    return user["id"]

CurrentUserId = Annotated[str, Depends(get_current_user_id)]


def get_user_storage(user_id: CurrentUserId) -> UserStorage:
    """Get UserStorage for current user."""
    storage = UserStorage(user_id)
    storage.ensure_user_folders()
    return storage


def get_project_storage(user_id: CurrentUserId) -> ProjectStorage:
    """Get ProjectStorage for current user."""
    storage = ProjectStorage(user_id)
    storage.ensure_default_project()
    return storage


def get_trash_storage(user_id: CurrentUserId) -> TrashStorage:
    """Get TrashStorage for current user."""
    storage = TrashStorage(user_id)
    storage.ensure_trash_dirs()
    return storage


UserStorageDep = Annotated[UserStorage, Depends(get_user_storage)]
ProjectStorageDep = Annotated[ProjectStorage, Depends(get_project_storage)]
TrashStorageDep = Annotated[TrashStorage, Depends(get_trash_storage)]
```

### 2.4 Update Auth Routes

**Modify: `src/api/routes/auth.py`**

```python
"""Authentication routes using Supabase."""

from fastapi import APIRouter, HTTPException, Response
from pydantic import BaseModel, EmailStr

from ..dependencies import get_current_user, CurrentUser
from ...auth.supabase_client import get_supabase_client


router = APIRouter(prefix="/auth", tags=["auth"])


class SignUpRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str | None = None


class SignInRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    user_id: str
    email: str
    access_token: str
    refresh_token: str


@router.post("/signup")
async def signup(request: SignUpRequest, response: Response) -> AuthResponse:
    """Sign up a new user with email/password."""
    supabase = get_supabase_client()

    try:
        result = supabase.auth.sign_up({
            "email": request.email,
            "password": request.password,
            "options": {
                "data": {"display_name": request.display_name}
            }
        })

        if not result.user:
            raise HTTPException(status_code=400, detail="Signup failed")

        # Set tokens in httpOnly cookies
        if result.session:
            response.set_cookie(
                key="session_access_token",
                value=result.session.access_token,
                httponly=True,
                samesite="lax",
                max_age=60 * 60 * 24 * 7,  # 7 days
            )
            response.set_cookie(
                key="session_refresh_token",
                value=result.session.refresh_token,
                httponly=True,
                samesite="lax",
                max_age=60 * 60 * 24 * 30,  # 30 days
            )

        return AuthResponse(
            user_id=result.user.id,
            email=result.user.email,
            access_token=result.session.access_token if result.session else "",
            refresh_token=result.session.refresh_token if result.session else "",
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/signin")
async def signin(request: SignInRequest, response: Response) -> AuthResponse:
    """Sign in with email/password."""
    supabase = get_supabase_client()

    try:
        result = supabase.auth.sign_in_with_password({
            "email": request.email,
            "password": request.password,
        })

        if not result.user or not result.session:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Set tokens in httpOnly cookies
        response.set_cookie(
            key="session_access_token",
            value=result.session.access_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )
        response.set_cookie(
            key="session_refresh_token",
            value=result.session.refresh_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 30,
        )

        return AuthResponse(
            user_id=result.user.id,
            email=result.user.email,
            access_token=result.session.access_token,
            refresh_token=result.session.refresh_token,
        )

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/signout")
async def signout(response: Response) -> dict:
    """Sign out current user."""
    response.delete_cookie("session_access_token")
    response.delete_cookie("session_refresh_token")
    return {"status": "signed_out"}


@router.post("/refresh")
async def refresh_token(
    response: Response,
    refresh_token: str | None = None,
) -> AuthResponse:
    """Refresh access token."""
    supabase = get_supabase_client()

    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token required")

    try:
        result = supabase.auth.refresh_session(refresh_token)

        if not result.session:
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        response.set_cookie(
            key="session_access_token",
            value=result.session.access_token,
            httponly=True,
            samesite="lax",
            max_age=60 * 60 * 24 * 7,
        )

        return AuthResponse(
            user_id=result.user.id,
            email=result.user.email,
            access_token=result.session.access_token,
            refresh_token=result.session.refresh_token,
        )

    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.get("/me")
async def get_me(user: CurrentUser) -> dict:
    """Get current user info."""
    return {
        "authenticated": True,
        "user_id": user["id"],
        "email": user.get("email"),
        "role": user.get("role", "user"),
    }
```

### 2.5 Update WebSocket Authentication

**Modify: `src/api/websockets/process_video.py`**

Update WebSocket endpoint to verify Supabase JWT:

```python
from jose import jwt, JWTError
import os

@router.websocket("/ws/process")
async def websocket_process_video(
    websocket: WebSocket,
    token: str | None = None,  # Query param for token
):
    """WebSocket endpoint with Supabase JWT auth."""
    await websocket.accept()

    if not token:
        await websocket.send_json({
            "event_type": "error",
            "timestamp": 0,
            "data": {"error_message": "Authentication required", "recoverable": False}
        })
        await websocket.close(code=4001)
        return

    try:
        jwt_secret = os.environ.get("SUPABASE_JWT_SECRET")
        payload = jwt.decode(token, jwt_secret, algorithms=["HS256"], audience="authenticated")
        auth_user_id = payload.get("sub")
    except JWTError:
        await websocket.send_json({
            "event_type": "error",
            "timestamp": 0,
            "data": {"error_message": "Invalid token", "recoverable": False}
        })
        await websocket.close(code=4001)
        return

    # ... rest of the handler
```

---

## 3. Frontend Integration (Next.js)

### 3.1 Add Dependencies

```bash
cd frontend
npm install @supabase/supabase-js @supabase/auth-helpers-nextjs
```

### 3.2 Create Supabase Client

**New file: `frontend/src/lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**New file: `frontend/src/lib/supabase/server.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from Server Component
          }
        },
      },
    }
  )
}
```

### 3.3 Create Auth Provider

**New file: `frontend/src/components/providers/AuthProvider.tsx`**

```typescript
"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    router.push("/dashboard");
  };

  const signUp = async (email: string, password: string, displayName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

### 3.4 Update Root Layout

**Modify: `frontend/src/app/layout.tsx`**

```typescript
import { AuthProvider } from "@/components/providers/AuthProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={...}>
        <I18nProvider>
          <AuthProvider>
            <ThemeProvider>
              {children}
              <Toaster richColors position="top-right" />
            </ThemeProvider>
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
```

### 3.5 Update API Client

**Modify: `frontend/src/lib/api.ts`**

Add token to requests:

```typescript
import { createClient } from "@/lib/supabase/client";

export async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (session?.access_token) {
    headers["Authorization"] = `Bearer ${session.access_token}`;
  }

  // ... rest of request function
}
```

---

## 4. Database Migration Considerations

### 4.1 User Storage Migration Strategy

The current system stores user data in file-based storage under `/data/users/{user_id}/`. With Supabase, the user_id will be a UUID.

**Migration Options:**

**Option A: Hybrid Approach (Recommended)**
- Keep file-based storage for manuals and videos
- Use Supabase only for auth and metadata (users, jobs, usage tracking)
- Map Supabase UUID to folder names

**Option B: Full Supabase Migration**
- Move all user data to Supabase Storage buckets
- More complex but enables RLS on files

**Implementation (Option A):**

The `UserStorage` class in `src/storage/user_storage.py` already uses `user_id` as a folder name. The Supabase UUID will work as-is.

### 4.2 Data Migration Script

Create a one-time migration script to move existing users:

```python
# scripts/migrate_to_supabase.py
"""Migrate existing users to Supabase."""

import os
from pathlib import Path
from src.auth.supabase_client import get_supabase_admin_client
from src.db.database import get_connection

def migrate_users():
    """Migrate existing SQLite users to Supabase."""
    supabase = get_supabase_admin_client()

    with get_connection() as conn:
        cursor = conn.execute("SELECT id, display_name, email, role FROM users")
        for row in cursor.fetchall():
            # Create user in Supabase (admin API)
            # Note: passwords need to be reset
            result = supabase.auth.admin.create_user({
                "email": row["email"] or f"{row['id']}@migrated.local",
                "email_confirm": True,
                "user_metadata": {
                    "display_name": row["display_name"],
                    "legacy_id": row["id"],
                }
            })

            # Update profile with role
            if result.user:
                supabase.table("profiles").update({
                    "role": row["role"]
                }).eq("id", result.user.id).execute()

            print(f"Migrated user: {row['id']} -> {result.user.id}")

if __name__ == "__main__":
    migrate_users()
```

---

## 5. Protected Routes and Middleware

### 5.1 Next.js Middleware for Route Protection

**New file: `frontend/src/middleware.ts`**

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Protected routes
  const protectedPaths = ['/dashboard', '/admin']
  const isProtected = protectedPaths.some(path =>
    request.nextUrl.pathname.startsWith(path)
  )

  if (isProtected && !user) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Admin routes require admin role
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user?.id)
      .single()

    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### 5.2 Backend Admin Middleware Update

**Modify: `src/api/middleware/admin.py`**

```python
"""Admin authorization middleware using Supabase."""

from fastapi import HTTPException, status, Depends
from ..dependencies import CurrentUser


async def require_admin(user: CurrentUser) -> dict:
    """Dependency to require admin role.

    Args:
        user: Current authenticated user from JWT

    Returns:
        user dict if user is admin

    Raises:
        HTTPException: If user is not admin
    """
    if user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user
```

---

## 6. Environment Variables and Secrets Management

### 6.1 Backend Environment Variables

**Update: `.env`**

```bash
# Existing variables
GOOGLE_API_KEY="..."
ANTHROPIC_API_KEY="..."
OPENAI_API_KEY="..."

# Add Supabase variables
SUPABASE_URL="https://<project-ref>.supabase.co"
SUPABASE_ANON_KEY="eyJ..."  # Public anon key
SUPABASE_SERVICE_KEY="eyJ..."  # Service role key (NEVER expose to client)
SUPABASE_JWT_SECRET="your-jwt-secret"  # From Supabase dashboard -> Settings -> API
```

### 6.2 Frontend Environment Variables

**Create: `frontend/.env.local`**

```bash
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."  # Public key only
NEXT_PUBLIC_API_URL="http://localhost:8000"  # For direct backend calls
```

### 6.3 Add .env.local to .gitignore

Ensure sensitive frontend env vars are not committed:

```gitignore
# Frontend env
frontend/.env.local
frontend/.env.production.local
```

---

## 7. Implementation Sequence

### Phase 1: Supabase Setup
1. Create Supabase project
2. Set up database tables with RLS
3. Configure auth settings (email provider, JWT settings)
4. Get all credentials

### Phase 2: Backend Integration
1. Add Supabase Python dependency
2. Create `src/auth/supabase_client.py`
3. Update `src/api/dependencies.py` with JWT verification
4. Update `src/api/routes/auth.py` with new endpoints
5. Update WebSocket auth in all WS handlers
6. Update admin middleware

### Phase 3: Frontend Integration
1. Add `@supabase/supabase-js` dependency
2. Create Supabase client files
3. Create `AuthProvider` context
4. Update root layout with provider
5. Update landing page with login/signup forms
6. Update `api.ts` to include auth headers
7. Add Next.js middleware for route protection

### Phase 4: Migration
1. Run database migration script
2. Test existing users can authenticate
3. Update user storage folder mappings if needed

### Phase 5: Testing and Cleanup
1. Test all auth flows (signup, signin, signout, refresh)
2. Test protected routes
3. Test WebSocket authentication
4. Remove old auth code
5. Update documentation

---

## 8. Potential Challenges and Mitigations

### Challenge 1: File Storage Migration
**Risk:** Existing user folders use simple user_id strings, Supabase uses UUIDs
**Mitigation:** Keep file storage using UUID as folder name - no migration needed

### Challenge 2: WebSocket Authentication
**Risk:** WebSockets don't support cookies in the same way
**Mitigation:** Pass token as query parameter on WebSocket connection

### Challenge 3: Session Refresh
**Risk:** Access tokens expire, need transparent refresh
**Mitigation:** Supabase client handles refresh automatically; add backend refresh endpoint

### Challenge 4: Legacy User Data
**Risk:** Existing users may lose access to their data
**Mitigation:** Create migration script that maps legacy user IDs to new Supabase users

---

## Critical Files for Implementation

- `src/api/dependencies.py` - Core auth dependency that ALL routes use; must be updated first with JWT verification
- `src/api/routes/auth.py` - Current simple auth; replace with Supabase signup/signin/signout endpoints
- `frontend/src/lib/api.ts` - Frontend API client; add Authorization header with Supabase token
- `frontend/src/app/page.tsx` - Landing page with login UI; convert from user_id to email/password form
- `src/api/websockets/process_video.py` - WebSocket auth pattern; use as template for updating all WS handlers with JWT verification
