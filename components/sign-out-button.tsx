"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  if (compact) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Sair da conta"
            onClick={() => void signOut({ redirectTo: "/login" })}
          >
            <LogOut />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Sair da conta</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      className="mt-1 justify-start text-muted-foreground hover:text-foreground"
      onClick={() => void signOut({ redirectTo: "/login" })}
    >
      <LogOut />
      Sair
    </Button>
  );
}
