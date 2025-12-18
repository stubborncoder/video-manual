"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Home,
  RefreshCw,
  ShieldAlert,
  KeyRound,
  UserX,
  Mail,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VDocsIcon } from "@/components/ui/VDocsIcon";
import { VDocsText } from "@/components/ui/vdocs-text";

// Error type definitions with icons and friendly messages
const errorConfig: Record<
  string,
  { icon: React.ElementType; title: string; suggestion: string }
> = {
  access_denied: {
    icon: UserX,
    title: "Access Denied",
    suggestion: "You may not have permission to access this resource. Try signing in with a different account.",
  },
  invalid_request: {
    icon: AlertCircle,
    title: "Invalid Request",
    suggestion: "The authentication request was malformed. Please try signing in again.",
  },
  unauthorized_client: {
    icon: ShieldAlert,
    title: "Unauthorized Client",
    suggestion: "The application is not authorized to make this request. Please contact support.",
  },
  invalid_token: {
    icon: KeyRound,
    title: "Invalid or Expired Token",
    suggestion: "Your session may have expired. Please sign in again to continue.",
  },
  email_not_confirmed: {
    icon: Mail,
    title: "Email Not Confirmed",
    suggestion: "Please check your inbox and confirm your email address before signing in.",
  },
  user_not_found: {
    icon: UserX,
    title: "User Not Found",
    suggestion: "No account was found with these credentials. Would you like to create a new account?",
  },
  invalid_credentials: {
    icon: KeyRound,
    title: "Invalid Credentials",
    suggestion: "The email or password you entered is incorrect. Please try again.",
  },
  default: {
    icon: ShieldAlert,
    title: "Authentication Error",
    suggestion: "Something went wrong during authentication. Please try signing in again.",
  },
};

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  const errorCode = searchParams.get("error") || "default";
  const errorDescription = searchParams.get("error_description");

  // Get error configuration
  const config = errorConfig[errorCode] || errorConfig.default;
  const ErrorIcon = config.icon;

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center relative overflow-hidden">
      {/* Background geometric pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient mesh background */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.03]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 50% at 20% 40%, var(--primary) 0%, transparent 50%),
              radial-gradient(ellipse 60% 40% at 80% 60%, var(--primary) 0%, transparent 50%)
            `,
          }}
        />

        {/* Grid lines */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `
              linear-gradient(var(--foreground) 1px, transparent 1px),
              linear-gradient(90deg, var(--foreground) 1px, transparent 1px)
            `,
            backgroundSize: '60px 60px',
          }}
        />

        {/* Floating geometric elements */}
        {mounted && (
          <>
            <div
              className="absolute w-96 h-96 border border-primary/10 rounded-full animate-float-1"
              style={{ top: '10%', right: '5%' }}
            />
            <div
              className="absolute w-64 h-64 border border-primary/5 rounded-full animate-float-2"
              style={{ bottom: '15%', left: '10%' }}
            />
            <div
              className="absolute w-32 h-32 bg-primary/5 rounded-lg rotate-45 animate-float-3"
              style={{ top: '60%', right: '15%' }}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center text-center px-6 max-w-xl transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="group mb-12 flex items-center gap-3 transition-transform hover:scale-105"
        >
          <VDocsIcon branded className="w-10 h-10" />
          <VDocsText className="font-display text-2xl tracking-tight text-foreground" />
        </Link>

        {/* Error code with decorative treatment */}
        <div className="relative mb-8">
          <span
            className="block font-display text-[10rem] md:text-[14rem] leading-none tracking-tighter text-primary/10 select-none"
            style={{ fontWeight: 400 }}
          >
            401
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-background/80 backdrop-blur-sm px-6 py-3 rounded-lg border border-border">
              <ErrorIcon className="w-12 h-12 text-primary mx-auto mb-2" />
              <span className="label-md text-muted-foreground">{config.title}</span>
            </div>
          </div>
        </div>

        {/* Message */}
        <h1 className="font-display text-3xl md:text-4xl text-foreground mb-4 tracking-tight">
          {config.title}
        </h1>
        <p className="body-lg text-muted-foreground mb-6 max-w-md leading-relaxed">
          {config.suggestion}
        </p>

        {/* Error details */}
        {errorDescription && (
          <div className="bg-muted/50 rounded-lg p-4 mb-6 max-w-md">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {decodeURIComponent(errorDescription.replace(/\+/g, " "))}
            </p>
          </div>
        )}

        {/* Error code badge */}
        {errorCode !== "default" && (
          <div className="flex justify-center mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-mono text-muted-foreground">
              <span className="w-1.5 h-1.5 rounded-full bg-warning" />
              {errorCode}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <Button asChild size="lg" className="gap-2 min-w-[160px]">
            <Link href="/">
              <RefreshCw className="w-4 h-4" />
              Try Again
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 min-w-[160px]">
            <Link href="/">
              <Home className="w-4 h-4" />
              Go Home
            </Link>
          </Button>
        </div>

        {/* Help text */}
        <p className="mt-12 text-sm text-muted-foreground/60">
          Need help?{" "}
          <Link
            href="mailto:support@vdocs.io"
            className="text-primary hover:underline underline-offset-4 transition-colors"
          >
            Contact support
          </Link>
        </p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
    </div>
  );
}

// Loading fallback
function AuthErrorLoading() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center">
      <div className="flex items-center gap-3 mb-8">
        <VDocsIcon branded className="w-10 h-10" />
        <span className="font-display text-2xl tracking-tight text-foreground">
          vDocs
        </span>
      </div>
      <div className="animate-pulse">
        <div className="w-12 h-12 rounded-full bg-muted" />
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<AuthErrorLoading />}>
      <AuthErrorContent />
    </Suspense>
  );
}
