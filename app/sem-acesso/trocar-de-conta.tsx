"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { Button } from "@/components/ui/button";

/**
 * Trocar de conta é ENCERRAR a sessão, não navegar para `/login`.
 *
 * O link para `/login` prometia uma coisa e fazia outra: com a sessão de pé,
 * `/login` vê o usuário logado, redireciona, e o guarda de acesso devolve para
 * cá. O botão não trocava conta nenhuma — refazia o laço que esta tela existe
 * justamente para quebrar. Encerrar antes é o que faz o rótulo virar verdade.
 */
export function TrocarDeConta() {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void signOut({ redirectTo: "/login" })}
    >
      <LogOut strokeWidth={1.5} />
      Entrar com outra conta
    </Button>
  );
}
