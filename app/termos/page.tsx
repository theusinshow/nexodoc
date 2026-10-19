import Link from "next/link";

import { AvisoDeResponsabilidade } from "@/components/aviso-de-responsabilidade";
import { VERSAO_DOS_TERMOS } from "@/lib/aviso-de-responsabilidade";

export const metadata = {
  title: "Termos de uso - Nexo",
  description: "Termo de uso e limitação de responsabilidade do NexoDoc",
};

/*
 * Página pública (fora do `matcher` do proxy): o link do aceite e do rodapé
 * precisa abrir também para quem ainda não entrou. Texto estático.
 */
const CLAUSULAS: { titulo: string; texto: string }[] = [
  {
    titulo: "1. Ferramenta de apoio à revisão",
    texto:
      "O NexoDoc é uma ferramenta de apoio à revisão de documentos de projetos de engenharia. Os apontamentos, pareceres e sugestões que ele produz são auxiliares e não constituem laudo, parecer técnico oficial, aprovação ou certificação de qualquer espécie.",
  },
  {
    titulo: "2. Sem garantia de detecção completa",
    texto:
      "A análise é automatizada e pode não identificar todas as inconsistências, erros ou omissões de um documento, assim como pode apontar itens que, após análise, se mostrem corretos. A ausência de um apontamento não significa que o documento esteja correto, e o NexoDoc não garante a conformidade do projeto com normas, legislação ou exigências de órgãos e clientes.",
  },
  {
    titulo: "3. Responsabilidade do usuário",
    texto:
      "Cabe ao usuário revisar cada apontamento, decidir o que procede, realizar as correções e fazer a verificação final antes de emitir ou protocolar qualquer documento. A responsabilidade técnica, inclusive a ART/RRT, é de quem elabora e assina o projeto e não é transferida ao NexoDoc nem aos seus responsáveis.",
  },
  {
    titulo: "4. Apontamentos não corrigidos",
    texto:
      "O NexoDoc e seus responsáveis não respondem por apontamentos que o usuário deixe de corrigir, por correções feitas de forma inadequada, nem por consequências de documentos emitidos sem a devida revisão humana.",
  },
  {
    titulo: "5. Uso por conta e risco",
    texto:
      "O uso do NexoDoc é por conta e risco do usuário. A ferramenta é fornecida no estado em que se encontra, sem garantias, expressas ou implícitas, de precisão, adequação a uma finalidade específica ou disponibilidade ininterrupta. Na extensão permitida pela lei, o NexoDoc não responde por danos diretos ou indiretos decorrentes do uso ou da impossibilidade de uso da ferramenta.",
  },
  {
    titulo: "6. Aceite e versão",
    texto:
      "O aceite deste termo é pedido antes da primeira auditoria e fica registrado com data, hora e versão do texto. Quando o texto mudar, o aceite poderá ser solicitado novamente.",
  },
];

export default function TermosPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-foreground">
      <p className="font-mono text-xs uppercase tracking-[0.05em] text-muted-foreground">NexoDoc</p>
      <h1 className="mt-2 text-2xl font-medium tracking-tight">Termos de uso e limitação de responsabilidade</h1>
      <p className="mt-1 text-xs text-muted-foreground">Versão {VERSAO_DOS_TERMOS}</p>

      <div
        role="note"
        data-revisao-juridica
        className="nx-cut-6 mt-6 bg-[var(--status-warning-bg)] px-4 py-3 text-sm text-[var(--status-warning)]"
      >
        <strong className="font-semibold">Atenção:</strong> este texto é um modelo e deve ser revisado por um advogado antes de produzir
        efeitos jurídicos.
      </div>

      <section className="mt-8 border-y border-border py-4">
        <AvisoDeResponsabilidade className="text-sm" />
      </section>

      {CLAUSULAS.map((c) => (
        <section key={c.titulo} className="mt-8">
          <h2 className="text-base font-medium">{c.titulo}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.texto}</p>
        </section>
      ))}

      <p className="mt-12 text-sm">
        <Link href="/" className="text-primary underline underline-offset-2">
          Voltar ao NexoDoc
        </Link>
      </p>
    </main>
  );
}
