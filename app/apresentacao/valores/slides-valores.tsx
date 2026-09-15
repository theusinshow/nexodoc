"use client";

import type { Slide } from "../palco";
import {
  Entra,
  EscalaHorizontal,
  EscalaVertical,
  Leitura,
  Linhas,
  MONO,
} from "../pecas";

/**
 * A PROPOSTA — seis folhas, abertas deliberadamente a partir da folha 17.
 * A sequência é: objeto da compra → custo operacional → entregas → preço →
 * evidência final → decisão. O custo histórico de construção não ancora mais o
 * preço: ele explica o esforço do vendedor, não o valor recebido pelo comprador.
 */

function LinhaDeCusto({
  item,
  base,
  valor,
  atraso,
}: {
  item: string;
  base: string;
  valor: string;
  atraso: number;
}) {
  return (
    <Entra
      atraso={atraso}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "baseline",
        gap: "0 24px",
        padding: "16px 0",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 26, color: "var(--foreground)" }}>
          {item}
        </p>
        <p
          style={{
            margin: "4px 0 0",
            fontFamily: MONO,
            fontSize: 20,
            color: "var(--muted-foreground)",
          }}
        >
          {base}
        </p>
      </div>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 32,
          color: "var(--foreground)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </Entra>
  );
}

function Total({
  rotuloDo,
  valor,
  atraso,
}: {
  rotuloDo: string;
  valor: string;
  atraso: number;
}) {
  return (
    <Entra
      atraso={atraso}
      style={{
        marginTop: "auto",
        paddingTop: 20,
        borderTop: "1px solid var(--nexodoc-accent)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 20,
      }}
    >
      <span className="ap-mono-rotulo">{rotuloDo}</span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 44,
          fontWeight: 500,
          letterSpacing: "-0.02em",
          color: "var(--nexodoc-accent)",
          whiteSpace: "nowrap",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {valor}
      </span>
    </Entra>
  );
}

export const VALORES: readonly Slide[] = [
  {
    rotulo: "O piloto",
    numero: "A",
    bloco: "A proposta",
    titulo: "Um piloto, duas trilhas de evidência",
    notas:
      "ANTES DO PREÇO, DEFINIR O OBJETO DA COMPRA. As duas capacidades entram juntas, mas não dividem uma métrica artificial.\n\nCONFERÊNCIA: quem projeta julga cada achado e a precisão aparece por disciplina.\n\nMONTAGEM: quem monta registra a linha de base, o tempo real, as falhas, o retrabalho e se os arquivos finais foram aceitos.\n\nA DIRETORIA recebe as duas medidas separadas. Isso impede que uma capacidade esconda a fraqueza da outra e transforma o piloto em produção de evidência, não período de acesso.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={180}
          style={{ marginTop: 48 }}
          fatos={[
            {
              titulo: ["Conferência", "documental"],
              cor: "var(--nexodoc-accent)",
              texto:
                "Achados julgados como verdadeiros, duvidosos ou falsos, separados por disciplina e sempre ligados à página e ao trecho.",
            },
            {
              titulo: ["Montagem", "de entregáveis"],
              cor: "var(--status-warning)",
              texto:
                "LDs, capas e volumes reais medidos por tempo, retrabalho, estabilidade do rascunho e aceitação dos arquivos finais.",
            },
          ]}
        />
        <Leitura
          atraso={1040}
          linhas={[
            { texto: "As duas capacidades entram juntas." },
            { texto: "A prova de cada uma continua separada.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "Quanto custa operar",
    numero: "B",
    bloco: "A proposta",
    titulo: "Quanto custa operar",
    notas:
      "O CUSTO POR EXECUÇÃO É MEDIDO; o mensal é estimativa. Atualizar a cotação antes de apresentar.\n\nOS US$ 1,61 são a mesma corrida da folha 05: US$ 1,23 de leitura, US$ 0,37 de validação e US$ 0,01 das quatorze páginas sem texto transcritas.\n\nO TOTAL MENSAL usa dezesseis memoriais, montagem corrente, servidor e banco. Não apresentar esse número como preço nem como retorno: é custo operacional e precisa continuar separado dos R$ 10 mil do piloto.",
    corpo: (
      <>
        <Entra atraso={100}>
          <p className="ap-texto" style={{ fontSize: 28, maxWidth: "80ch" }}>
            O custo por execução é medido no sistema. O total mensal é uma{" "}
            <span className="ap-premissa">estimativa</span> — varia com o uso.
          </p>
        </Entra>
        <div className="ap-grade" style={{ flex: 1, marginTop: 40 }}>
          <div
            style={{
              gridColumn: "1 / span 5",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={200}>
              <span className="ap-mono-rotulo">Medido por execução</span>
            </Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto
                item="Conferência de um memorial"
                base="218 páginas, leitura profunda"
                valor="US$ 1,61"
                atraso={300}
              />
              <LinhaDeCusto
                item="Leitura de um selo de prancha"
                base="frações de centavo por folha"
                valor="US$ 0,001"
                atraso={460}
              />
            </div>
          </div>
          <div
            style={{
              gridColumn: "7 / span 6",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <Entra atraso={620}>
              <span className="ap-mono-rotulo">
                Estimativa mensal no volume do escritório
              </span>
            </Entra>
            <div style={{ marginTop: 12 }}>
              <LinhaDeCusto
                item="Conferência de memoriais"
                base="cerca de 16 por mês"
                valor="US$ 26"
                atraso={720}
              />
              <LinhaDeCusto
                item="Montagem de listas e volumes"
                base="uso corrente"
                valor="menos de US$ 1"
                atraso={840}
              />
              <LinhaDeCusto
                item="Servidor"
                base="infraestrutura"
                valor="US$ 25"
                atraso={960}
              />
              <LinhaDeCusto
                item="Banco de dados"
                base="infraestrutura"
                valor="US$ 5"
                atraso={1080}
              />
            </div>
            <Total
              rotuloDo="Ordem de grandeza"
              valor="≈ R$ 295 / mês"
              atraso={1180}
            />
            <Entra atraso={1300}>
              <p className="ap-fonte">
                Convertido a{" "}
                <span className="ap-premissa">R$ 5,18 por dólar</span> —
                atualizar a cotação antes de apresentar.
              </p>
            </Entra>
          </div>
        </div>
      </>
    ),
  },

  {
    rotulo: "O que está sendo comprado",
    numero: "C",
    bloco: "A proposta",
    titulo: "O que o piloto compra",
    notas:
      "ESTA FOLHA SUBSTITUI O CUSTO DE CONSTRUÇÃO COMO ÂNCORA. O comprador não paga as horas passadas; paga implantação, acompanhamento e uma decisão final sustentada por evidência.\n\nIMPLANTAÇÃO inclui configurar o uso com projeto e pessoas reais. ACOMPANHAMENTO inclui observar, corrigir e documentar problemas recorrentes. EVIDÊNCIA inclui as duas medidas separadas e o memorial-padrão corrigido.\n\nPROPRIEDADE, EM UMA FRASE: o software continua sendo de Matheus Mendes; os pareceres e arquivos produzidos para a PROSUL ficam com a PROSUL. Custódia de código só entra numa negociação de longo prazo.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={180}
          style={{ marginTop: 48 }}
          fatos={[
            {
              titulo: ["Implantação", "acompanhada"],
              texto:
                "Projeto inicial, usuários, configuração, linha de base e entrada assistida nos dois caminhos.",
            },
            {
              titulo: ["Correção durante", "o uso"],
              texto:
                "Problemas recorrentes recebem correção ou procedimento documentado enquanto o piloto acontece.",
            },
            {
              titulo: ["Evidência para", "a diretoria"],
              texto:
                "Medidas separadas, registro das decisões e memorial-padrão corrigido para permanecer na empresa.",
            },
          ]}
        />
        <Leitura
          atraso={1160}
          linhas={[
            { texto: "Não são seis meses de acesso." },
            { texto: "É uma implantação com prova de saída.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "A proposta",
    numero: "D",
    bloco: "A proposta",
    titulo: "A proposta",
    notas:
      "LER O ESCOPO ANTES DO NÚMERO. O valor compra a implantação descrita na folha anterior e a evidência da folha seguinte.\n\nSE PERGUNTAREM POR QUE SEIS MESES: porque um projeto precisa atravessar o sistema por inteiro e produzir julgamento, não impressão.\n\nOCR pode funcionar em casos específicos, mas não é cobertura garantida do piloto. Dizer assim evita contradizer a demonstração das quatorze páginas sem texto da corrida real.\n\nO PISO CONTINUA R$ 10 mil. Não conceder desconto por alívio de a reunião estar acabando.",
    corpo: (
      <>
        <EscalaVertical
          atraso={120}
          numerada={false}
          style={{ flex: "none", height: 560 }}
          itens={[
            { titulo: "Modalidade", texto: "Licença de uso durante o piloto" },
            { titulo: "Prazo", texto: "6 meses" },
            {
              titulo: "Valor",
              texto: "R$ 10.000",
              cor: "var(--nexodoc-accent)",
            },
            {
              titulo: "Inclui",
              texto:
                "Conferência documental; montagem de LDs, capas e volumes; implantação acompanhada; correções; evidência final; memorial-padrão corrigido.",
            },
            {
              titulo: "Não inclui",
              texto:
                "Módulo novo sob demanda, cobertura garantida de OCR para todo documento e auditoria técnica de prancha.",
            },
          ]}
        />
        <Leitura
          atraso={920}
          linhas={[
            { texto: "Se não produzir evidência suficiente, encerra." },
            {
              texto: "Se produzir, a renovação nasce dos dados do piloto.",
              chave: true,
            },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "O que fica ao final",
    numero: "E",
    bloco: "A proposta",
    titulo: "A prova que fica com a PROSUL",
    notas:
      "ESTA É A JUSTIFICATIVA DO VALOR. Não comparar os R$ 10 mil com horas de desenvolvimento. Mostrar o pacote de decisão que a empresa recebe.\n\nCONFERÊNCIA: matriz julgada por disciplina, taxa de achados verdadeiros, classes recorrentes de falso positivo e correções do memorial-padrão.\n\nMONTAGEM: linha de base contra tempo real, LDs e volumes gerados, arquivos aceitos, falhas, retrabalho e correções.\n\nO REGISTRO DE DECISÃO fecha: o que ficou provado, o que ainda falta e qual condição sustenta renovar. Mesmo sem renovação, essa evidência não some.",
    corpo: (
      <>
        <EscalaHorizontal
          atraso={180}
          style={{ marginTop: 44 }}
          fatos={[
            {
              titulo: ["Conferência", "medida"],
              cor: "var(--nexodoc-accent)",
              texto:
                "Julgamento por disciplina, verdadeiros, duvidosos, falsos, padrões recorrentes e correções do texto-base.",
            },
            {
              titulo: ["Montagem", "medida"],
              cor: "var(--status-warning)",
              texto:
                "Tempo antes e depois, estabilidade, retrabalho, arquivos gerados e aceitação por quem entrega.",
            },
            {
              titulo: ["Decisão", "registrada"],
              texto:
                "O que ficou provado, o que permaneceu em aberto e a condição objetiva para encerrar ou renovar.",
            },
          ]}
        />
        <Leitura
          atraso={1160}
          linhas={[
            { texto: "O valor não se sustenta no que custou construir." },
            { texto: "Sustenta-se no que fica para decidir.", chave: true },
          ]}
        />
      </>
    ),
  },

  {
    rotulo: "A decisão",
    numero: "F",
    bloco: "A proposta",
    titulo: "Para começar",
    notas:
      "ÚLTIMA FOLHA DO ANEXO: terminar em decisão, não em propriedade.\n\nPEDIR TRÊS COISAS: aprovar o piloto de seis meses por R$ 10 mil; escolher o projeto inicial; nomear o responsável e os usuários.\n\nSE A RESPOSTA FOR SIM, a próxima conversa é de implantação. Se precisarem pensar, perguntar qual evidência ainda falta para decidir e registrar quem a traz.\n\nNÃO REPETIR o custo de construção, não oferecer desconto e não abrir roadmap. Parar depois do pedido.",
    corpo: (
      <>
        <p className="ap-titulo-de-fato" style={{ marginTop: 20 }}>
          <Linhas
            linhas={[
              "Aprovar o piloto de seis meses por R$ 10 mil.",
              "Escolher o projeto. Nomear as pessoas.",
            ]}
            atraso={180}
          />
        </p>
        <EscalaHorizontal
          atraso={520}
          compacta
          style={{ marginTop: 72 }}
          fatos={[
            {
              titulo: ["01 · Projeto"],
              texto: "O primeiro trabalho real que atravessa o piloto.",
            },
            {
              titulo: ["02 · Responsável"],
              texto: "Quem recebe a evidência e responde pela decisão final.",
            },
            {
              titulo: ["03 · Usuários"],
              texto: "Quem julga a conferência e quem mede a montagem.",
            },
          ]}
        />
        <Leitura
          atraso={1240}
          rotuloDo="Próximo passo"
          linhas={[
            { texto: "Com a aprovação," },
            { texto: "a próxima reunião é de implantação.", chave: true },
          ]}
        />
      </>
    ),
  },
];
