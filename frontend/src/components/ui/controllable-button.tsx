"use client";

import * as React from "react";
import { Button, ButtonProps } from "./button";
import { registerButton } from "@/lib/guide-registry";

export interface ControllableButtonProps extends ButtonProps {
  guideId: string;
  onClick?: () => void;
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
      onClickRef.current?.();
    };
    return registerButton(guideId, handler);
  }, [guideId]);

  return (
    <Button data-guide-id={guideId} onClick={onClick} {...props}>
      {children}
    </Button>
  );
}
