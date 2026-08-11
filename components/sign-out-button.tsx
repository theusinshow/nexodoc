"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";
import { DropdownItem } from "@/components/ui/dropdown";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type SignOutButtonProps = {
  compact?: boolean;
};

/**
 * Sair COMO ITEM DE MENU — a forma que a conta usa no rodapé do Nexo.
 *
 * Existe para o `signOut` continuar num lugar só. Sair é a ação mais destrutiva
 * do rodapé e a menos frequente; ela pertence ao menu da conta, atrás de um
 * gesto, e não solta na coluna competindo por altura com o que se usa todo dia.
 */
export function SignOutMenuItem({ onDone }: { onDone?: () => void }) {
  return (
    <DropdownItem
      onClick={() => {
        onDone?.();
        void signOut({ redirectTo: "/login" });
      }}
    >
      <LogOut className="size-4 shrink-0" strokeWidth={1.5} aria-hidden />
      Sair
    </DropdownItem>
  );
}

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
