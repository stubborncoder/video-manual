"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Home,
  ArrowLeft,
  ShieldAlert,
  KeyRound,
  UserX,
  Mail,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VDocsIcon } from "@/components/ui/VDocsIcon";

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
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient mesh */}
        <div
          className="absolute top-0 left-0 w-full h-full opacity-[0.04]"
          style={{
            backgroundImage: `
              radial-gradient(ellipse 80% 60% at 30% 30%, var(--primary) 0%, transparent 50%),
              radial-gradient(ellipse 60% 50% at 70% 70%, #F59E0B 0%, transparent 50%)
            `,
          }}
        />

        {/* Concentric circles pattern */}
        <div className="absolute inset-0 flex items-center justify-center">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute border border-border/30 rounded-full"
              style={{
                width: `${(i + 1) * 200}px`,
                height: `${(i + 1) * 200}px`,
                opacity: 0.5 - i * 0.1,
              }}
            />
          ))}
        </div>

        {/* Floating elements */}
        {mounted && (
          <>
            <div
              className="absolute w-48 h-48 bg-primary/5 rounded-full blur-3xl animate-float-1"
              style={{ top: '15%', right: '20%' }}
            />
            <div
              className="absolute w-64 h-64 bg-warning/5 rounded-full blur-3xl animate-float-2"
              style={{ bottom: '10%', left: '15%' }}
            />
          </>
        )}
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center px-6 w-full max-w-lg transition-all duration-700 ${
          mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        {/* Logo */}
        <Link
          href="/"
          className="group mb-10 flex items-center gap-3 transition-transform hover:scale-105"
        >
          <VDocsIcon branded className="w-10 h-10" />
          <span className="font-display text-2xl tracking-tight text-foreground">
            vDocs
          </span>
        </Link>

        {/* Error card */}
        <Card className="w-full bg-card/80 backdrop-blur-sm border-border shadow-lg">
          <CardHeader className="text-center pb-4">
            {/* Icon with animated background */}
            <div className="mx-auto mb-4 relative">
              <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
              <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 rounded-full p-5 border border-primary/20">
                <ErrorIcon className="w-10 h-10 text-primary" strokeWidth={1.5} />
              </div>
            </div>

            <CardTitle className="font-display text-2xl tracking-tight">
              {config.title}
            </CardTitle>

            {errorDescription && (
              <CardDescription className="mt-3 text-base leading-relaxed">
                {decodeURIComponent(errorDescription.replace(/\+/g, " "))}
              </CardDescription>
            )}
          </CardHeader>

          <CardContent className="pt-0">
            {/* Suggestion box */}
            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {config.suggestion}
              </p>
            </div>

            {/* Error code badge */}
            {errorCode !== "default" && (
              <div className="flex justify-center mb-6">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-xs font-mono text-muted-foreground">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  {errorCode}
                </span>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col gap-3">
              <Button asChild size="lg" className="w-full gap-2">
                <Link href="/">
                  <RefreshCw className="w-4 h-4" />
                  Try Again
                </Link>
              </Button>
              <div className="flex gap-3">
                <Button asChild variant="outline" size="lg" className="flex-1 gap-2">
                  <Link href="/">
                    <Home className="w-4 h-4" />
                    Home
                  </Link>
                </Button>
                <Button asChild variant="ghost" size="lg" className="flex-1 gap-2">
                  <Link href="/dashboard">
                    <ArrowLeft className="w-4 h-4" />
                    Dashboard
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Help text */}
        <p className="mt-8 text-sm text-muted-foreground/60 text-center">
          Having trouble?{" "}
          <Link
            href="mailto:support@vdocs.io"
            className="text-primary hover:underline underline-offset-4 transition-colors"
          >
            Contact support
          </Link>
        </p>
      </div>

      {/* Bottom accent line */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
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
