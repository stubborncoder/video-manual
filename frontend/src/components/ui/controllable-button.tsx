"use client";

import * as React from "react";
import { Button, buttonVariants } from "./button";
import { registerButton } from "@/lib/guide-registry";
import type { VariantProps } from "class-variance-authority";

export interface ControllableButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  guideId: string;
  asChild?: boolean;
}

/**
 * A Button that registers itself with the guide registry for programmatic control.
 * Use this for buttons that need to be triggered by the guide agent.
 */
export function ControllableButton({
  guideId,
  onClick,
  children,
  ...props
}: ControllableButtonProps) {
  // Use ref to store the latest onClick to avoid re-registering on every render
  const onClickRef = React.useRef(onClick);
  onClickRef.current = onClick;

  // Register the click handler with the guide registry
  React.useEffect(() => {
    console.log("[ControllableButton] Registering:", guideId);
    const handler = () => {
      console.log("[ControllableButton] Handler called for:", guideId);
      onClickRef.current?.(undefined as unknown as React.MouseEvent<HTMLButtonElement>);
    };
    return registerButton(guideId, handler);
  }, [guideId]);

  return (
    <Button data-guide-id={guideId} onClick={onClick} {...props}>
      {children}
    </Button>
  );
}
