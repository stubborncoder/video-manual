"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerLink, setNavigateFunction } from "@/lib/guide-registry";

interface ControllableLinkProps
  extends React.ComponentProps<typeof Link> {
  guideId: string;
}

/**
 * A Link component that registers itself with the guide registry
 * so it can be triggered programmatically by the guide agent.
 */
export function ControllableLink({
  guideId,
  href,
  children,
  ...props
}: ControllableLinkProps) {
  const router = useRouter();

  // Register the navigate function once
  React.useEffect(() => {
    setNavigateFunction((url: string) => router.push(url));
  }, [router]);

  // Register this link
  React.useEffect(() => {
    const hrefString = typeof href === "string" ? href : href.pathname || "";
    return registerLink(guideId, hrefString);
  }, [guideId, href]);

  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  );
}
