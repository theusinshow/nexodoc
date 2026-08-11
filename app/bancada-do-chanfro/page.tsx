/**
 * Bancada do chanfro — todo corte e toda camada numa tela só.
 *
 * Existe para `scripts/prova-chanfro.mjs` medir sem login e sem disparar IA.
 * Cada elemento carrega `data-prova` porque asserção por classe quebra quando a
 * classe muda de nome, e asserção por posição no DOM quebra quando alguém
 * insere uma linha acima.
 */
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const metadata = { title: "Bancada do chanfro" };

const CORTES = [4, 5, 6, 7, 8, 12] as const;
const CAMADAS = [5, 6, 7, 8] as const;

export default function BancadaDoChanfro() {
  return (
    <main className="flex min-h-screen flex-col gap-10 bg-background p-10">
      <section className="flex flex-wrap gap-4" data-prova="cortes">
        {CORTES.map((n) => (
          <div
            key={n}
            data-prova={`cut-${n}`}
            className={`nx-cut-${n} flex h-16 w-40 items-center justify-center bg-card font-mono text-xs text-muted-foreground`}
          >
            nx-cut-{n}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-4" data-prova="camadas">
        {CAMADAS.map((n) => (
          <div
            key={n}
            data-prova={`edge-${n}`}
            className={`nx-edge-${n} flex h-16 w-40 items-center justify-center font-mono text-xs text-muted-foreground`}
          >
            nx-edge-{n}
          </div>
        ))}
      </section>

      <section className="flex flex-wrap gap-4" data-prova="foco">
        {/* Trampolim: `:focus-visible` nao casa com foco programatico num
            <button>, entao a prova pousa aqui e chega no alvo com Tab. */}
        <button type="button" data-prova="foco-antes" className="h-10 px-4 font-mono text-xs text-muted-foreground">
          trampolim
        </button>
        <button
          type="button"
          data-prova="foco-alvo"
          className="nx-edge-7 h-10 border-0 px-4 font-mono text-xs text-foreground"
        >
          foco por dentro
        </button>
      </section>

      <section className="flex flex-wrap items-center gap-4" data-prova="botoes">
        <Button data-prova="btn-lg" size="lg">Confirmar e gerar</Button>
        <Button data-prova="btn-default">Corrigir</Button>
        <Button data-prova="btn-sm" size="sm">Denso</Button>
        <Button data-prova="btn-secondary" variant="secondary">Secundária</Button>
        <Button data-prova="btn-ghost" variant="ghost">Cancelar</Button>
        <Button data-prova="btn-loading" loading>Gerando</Button>
      </section>

      <section className="flex flex-wrap gap-4" data-prova="cartoes">
        <Card data-prova="card" className="w-56 p-4 text-sm text-muted-foreground">
          cartão com contorno
        </Card>
        <Card data-prova="card-flat" flat className="w-56 p-4 text-sm text-muted-foreground">
          cartão chapado
        </Card>
      </section>

      <section className="flex flex-col gap-4" data-prova="campos">
        <Input data-prova="input" placeholder="campo de texto" className="w-64" />
        <Textarea data-prova="textarea" placeholder="area de texto" className="w-64" />
      </section>

      <section className="flex flex-wrap items-center gap-4" data-prova="chips">
        <Chip data-prova="chip">chip padrão</Chip>
        <Chip data-prova="chip-suggest" variant="suggest">sugerido</Chip>
        <Badge data-prova="badge">badge</Badge>
        <Badge data-prova="badge-ok" variant="ok">ok</Badge>
      </section>
    </main>
  );
}
