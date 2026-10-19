import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import "@/app/ds.css";
import "@/components/aviso-de-responsabilidade.css";
import "@/components/moldura/moldura.css";
import { AvisoDeResponsabilidade } from "@/components/aviso-de-responsabilidade";
import { Moldura } from "@/components/moldura/moldura";
import { FONTES_DS } from "@/lib/ds/fontes";
import { VERSAO_DOS_TERMOS } from "@/lib/aviso-de-responsabilidade";
import { tentarMoldura } from "@/lib/moldura";

export const metadata = {
  title: "Termos de uso - Nexo",
  description: "Termo de uso e limitação de responsabilidade do NexoDoc",
};

/*
 * Página pública (fora do `matcher` do proxy): o link do aceite e do rodapé
 * precisa abrir também para quem ainda não entrou. Texto estático. Logado, vem
 * na moldura do app (Topo e busca); sem sessão, só a página, como a 404.
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

function Termos() {
  return (
    <div className="ar-pagina">
      <h1>Termos de uso e limitação de responsabilidade</h1>
      <p className="ar-versao">Versão {VERSAO_DOS_TERMOS}</p>

      <article className="ar-folha">
        <div role="note" data-revisao-juridica className="ar-nota">
          <TriangleAlert aria-hidden />
          <p>
            <b>Atenção:</b> este texto é um modelo e deve ser revisado por um advogado antes de produzir efeitos jurídicos.
          </p>
        </div>
        <div className="ar-texto">
          <section>
            <AvisoDeResponsabilidade />
          </section>
          {CLAUSULAS.map((c) => (
            <section key={c.titulo}>
              <h2>{c.titulo}</h2>
              <p>{c.texto}</p>
            </section>
          ))}
        </div>
      </article>

      <p className="ar-pe">
        <Link href="/" className="ar-link">
          Voltar ao NexoDoc
        </Link>
      </p>
    </div>
  );
}

export default async function TermosPage() {
  const dados = await tentarMoldura();
  if (!dados)
    return (
      <div className={`ds ${FONTES_DS} md-raiz`}>
        <main id="conteudo">
          <Termos />
        </main>
      </div>
    );
  return (
    <Moldura dados={dados} atual={null}>
      <Termos />
    </Moldura>
  );
}
