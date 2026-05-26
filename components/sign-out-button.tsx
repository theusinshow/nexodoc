"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

type SignOutButtonProps = {
  compact?: boolean;
};

export function SignOutButton({ compact = false }: SignOutButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size={compact ? "icon" : "default"}
      aria-label="Sair da conta"
      className={compact ? undefined : "mt-1 justify-start text-muted-foreground hover:text-foreground"}
      onClick={() => void signOut({ redirectTo: "/login" })}
    >
      <LogOut />
      {compact ? null : "Sair"}
    </Button>
  );
}
