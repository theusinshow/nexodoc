import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A moldura do Nexo: fundo, cor e a altura da janela. Nada mais.
 *
 * ELA TINHA UM CABEÇALHO — "NEXO / <modulo>" e um rótulo de versão. Ele saiu
 * junto com as props `moduleName` e `version` que só serviam a ele.
 *
 * Duas razões. A primeira é que ele não tinha mais o que dizer: em `/nexo` o
 * breadcrumb se escondia (o módulo É o Nexo) e sobrava a palavra "NEXO" sozinha
 * numa faixa de 48px, enquanto a barra lateral já mostra a marca, a navegação e
 * a conta — melhor e no lugar certo. A segunda é que ele não tinha COMO dizer:
 * os providers do Nexo vivem dentro do `children`, e deste componente, que é
 * irmão acima deles, nenhum hook da conversa é alcançável.
 *
 * O topo do Nexo agora é a `BarraDoNexo`, uma linha do `NexoShell` — de dentro
 * dos providers ela lê a conversa ativa e diz de qual obra é o trabalho.
 *
 * `/volumes` e as demais telas nunca passaram por aqui: cada uma traz o próprio
 * cabeçalho (ver `ProjectContextStrip`). Este componente tem um consumidor só,
 * `app/nexo/layout.tsx`, e é por isso que o cabeçalho condicional foi removido
 * em vez de mantido atrás de um sinal — um ramo que nada alcança é uma decisão
 * antiga esperando ser tomada de novo por engano.
 */
export function AppShell({ children, className }: AppShellProps) {
  return (
    <div className={cn("flex h-dvh flex-col bg-background text-foreground", className)}>
      <main className="min-h-0 flex-1 px-4 py-4">{children}</main>
    </div>
  );
}
