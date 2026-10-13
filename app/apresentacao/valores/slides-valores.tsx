"use client";

import { Check, Layers, Scale, ScanText, X } from "lucide-react";
import type { ReactNode } from "react";

import { BarraEmbutida } from "@/components/ds/medidas";

import { Cronograma } from "../folhas/decisao";
import type { Slide } from "../palco";
import {
  Checklist,
  Diagrama,
  Entra,
  Fio,
  Linhas,
  MONO,
  No,
  Particula,
  Selo,
} from "../pecas";

/**
 * A PROPOSTA — seis folhas, abertas deliberadamente a partir da folha 17.
 * A sequência é: objeto da compra → custo operacional → entregas → preço →
 * evidência final → decisão. O custo histórico de construção não ancora mais o
 * preço: ele explica o esforço do vendedor, não o valor recebido pelo comprador.
 *
 * Mesma gramática do deck (02/10/2026): manchete com a conclusão e uma peça.
 */

const BLOCO = "A proposta";

/**
 * Uma linha de custo, como os "Itens de custo" do Dinheiro no admin: o item, a
 * base em cinza, o valor à direita — e, quando a linha tem `parte`, a BARRA
 * EMBUTIDA do app, no trilho cujo fim é o maior item da tabela.
 */
function LinhaDeCusto({
  item,
  base,
  valor,
  atraso,
  parte,
}: {
  item: string;
  base: string;
  valor: string;
  atraso: number;
  parte?: readonly [number, number];
}) {
  return (
    <Entra
      atraso={atraso}
      style={{
        display: "grid",
        gridTemplateColumns: "1fr auto",
        alignItems: "baseline",
        gap: "0 24px",
        padding: "12px 0",
        boxShadow: "inset 0 1px 0 var(--ds-line-subtle)",
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: 25 }}>{item}</p>
        <p style={{ margin: "2px 0 0", fontSize: 18, color: "var(--ds-text-tertiary)" }}>{base}</p>
      </div>
      <span style={{ fontSize: 32, letterSpacing: "-0.02em", fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </span>
      {parte ? (
        <div style={{ gridColumn: "1 / -1", marginTop: 8, zoom: 1.5 }}>
          <BarraEmbutida valor={parte[0]} maximo={parte[1]} />
        </div>
      ) : null}
    </Entra>
  );
}

const INCLUI = [
  "Conferência documental",
  "Montagem de LDs, capas e volumes",
  "Implantação acompanhada",
  "Correções durante o uso",
  "Evidência final",
  "Memorial-padrão corrigido",
];
const NAO_INCLUI = [
  "Módulo novo sob demanda",
  "Cobertura garantida de OCR para todo documento",
  "Auditoria técnica de prancha",
];

function Campo({ rotulo, atraso, children }: { rotulo: string; atraso: number; children: ReactNode }) {
  return (
    <Entra
      atraso={atraso}
      style={{ display: "grid", gridTemplateColumns: "200px 1fr", alignItems: "center", padding: "18px 0", boxShadow: "inset 0 1px 0 var(--ds-line-subtle)" }}
    >
      <span style={{ fontSize: 19, color: "var(--ds-text-tertiary)", alignSelf: "start", paddingTop: 6 }}>{rotulo}</span>
      <div>{children}</div>
    </Entra>
  );
}

const fichinha = (texto: string, fora = false) => (
  <span
    key={texto}
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      height: 40,
      padding: "0 16px",
      margin: "0 8px 8px 0",
      borderRadius: 10,
      fontSize: 19,
      background: fora ? "transparent" : "rgb(255 255 255 / 0.06)",
      boxShadow: fora ? "inset 0 0 0 1px var(--ds-line-default)" : undefined,
      color: fora ? "var(--ds-text-tertiary)" : "var(--ds-text-primary)",
    }}
  >
    {fora ? <X size={16} strokeWidth={2} /> : <Check size={16} strokeWidth={2} />}
    {texto}
  </span>
);

export const VALORES: readonly Slide[] = [
  {
    rotulo: "O piloto",
    numero: "A",
    bloco: BLOCO,
    titulo: "Um piloto, duas trilhas de evidência",
    manchete: [
      { texto: "As duas capacidades entram juntas.", fraca: true },
      "A prova de cada uma continua separada.",
    ],
    notas:
      "ANTES DO PREÇO, DEFINIR O OBJETO DA COMPRA. As duas capacidades entram juntas, mas não dividem uma métrica artificial — as duas trilhas só se encontram na mesa da diretoria.\n\nCONFERÊNCIA: quem projeta julga cada achado e a precisão aparece por disciplina.\n\nMONTAGEM: quem monta registra a linha de base, o tempo real, as falhas, o retrabalho e se os arquivos finais foram aceitos.\n\nA DIRETORIA recebe as duas medidas separadas. Isso impede que uma capacidade esconda a fraqueza da outra e transforma o piloto em produção de evidência, não período de acesso.",
    corpo: (
      <Diagrama
        largura={1680}
        altura={440}
        fios={
          <>
            <Fio d="M 260 100 L 340 100" atraso={500} seta={{ x: 340, y: 100, dir: "direita" }} />
            <Fio d="M 720 100 L 800 100" atraso={800} seta={{ x: 800, y: 100, dir: "direita" }} />
            <Fio d="M 260 340 L 340 340" atraso={1100} seta={{ x: 340, y: 340, dir: "direita" }} />
            <Fio d="M 720 340 L 800 340" atraso={1400} seta={{ x: 800, y: 340, dir: "direita" }} />
            <Fio d="M 1150 100 C 1240 100 1240 220 1330 220" atraso={1800} seta={{ x: 1330, y: 220, dir: "direita" }} />
            <Fio d="M 1150 340 C 1240 340 1240 220 1330 220" atraso={1900} seta={{ x: 1330, y: 220, dir: "direita" }} />
          </>
        }
      >
        <Particula d="M 130 100 L 1150 100 C 1240 100 1240 220 1330 220" atraso={2400} duracao={2000} />
        <Particula d="M 130 340 L 1150 340 C 1240 340 1240 220 1330 220" atraso={2600} duracao={2000} />
        <No x={0} y={55} largura={260} altura={90} atraso={300} icone={<ScanText size={22} strokeWidth={1.75} />} titulo="Conferência" />
        <No x={340} y={40} largura={380} altura={120} atraso={600} titulo="Quem projeta julga" texto="verdadeiro, duvidoso ou falso, sempre ligado à página e ao trecho" />
        <No x={800} y={40} largura={350} altura={120} atraso={900} titulo="Precisão por disciplina" texto="a medida da conferência" />
        <No x={0} y={295} largura={260} altura={90} atraso={900} icone={<Layers size={22} strokeWidth={1.75} />} titulo="Montagem" />
        <No x={340} y={280} largura={380} altura={120} atraso={1200} titulo="Quem monta registra" texto="linha de base, tempo, retrabalho e estabilidade do rascunho" />
        <No x={800} y={280} largura={350} altura={120} atraso={1500} titulo="Resultado operacional" texto="LDs, capas e volumes, e se foram aceitos" />
        <No x={1330} y={150} largura={350} altura={140} atraso={2100} variante="claro" icone={<Scale size={22} strokeWidth={1.75} />} titulo="A diretoria decide" texto="com as duas medidas, separadas" />
      </Diagrama>
    ),
  },

  {
    rotulo: "Quanto custa operar",
    numero: "B",
    bloco: BLOCO,
    titulo: "Quanto custa operar",
    manchete: ["O custo por execução é medido; o mensal, estimado."],
    notas:
      "O CUSTO POR EXECUÇÃO É MEDIDO; o mensal é estimativa. Atualizar a cotação antes de apresentar: a tela usa a PTAX de venda de 28/09/2026 (R$ 5,2132), e o total é US$ 57 × a cotação — 57 × 5,2132 ≈ R$ 297.\n\nA FAIXA POR MEMORIAL É MEDIDA em produção, leitura profunda, somando leitura, validação e transcrição das páginas sem texto: 129-24 (54 p.) US$ 0,54; 025-24 (155 p.) US$ 0,91; 117-25 (218 p.) US$ 1,06; 027-24 (190 p.) US$ 1,09; 118-25 (234 p.) US$ 1,10. SE PERGUNTAREM POR QUE A FOLHA 05 DIZ US$ 1,61: aquela foi uma corrida anterior do mesmo 117-25 (US$ 1,23 de leitura, US$ 0,37 de validação, US$ 0,01 de transcrição); as de produção saíram mais baratas. O mensal continua calculado pela mais cara — 16 × US$ 1,61 ≈ US$ 26 —, de propósito: estimativa de custo erra para cima.\n\nO TOTAL MENSAL usa dezesseis memoriais, montagem corrente, servidor e banco. Não apresentar esse número como preço nem como retorno: é custo operacional e precisa continuar separado dos R$ 8 mil do piloto.",
    corpo: (
      <div className="ap-grade" style={{ alignItems: "start" }}>
        <div style={{ gridColumn: "1 / span 5" }}>
          <Entra atraso={300}>
            <Selo tom="ok">Medido por execução</Selo>
          </Entra>
          <div style={{ marginTop: 18 }}>
            <LinhaDeCusto item="Conferência de um memorial" base="cinco memoriais em produção" valor="até US$ 1,10" atraso={400} />
            <LinhaDeCusto item="Leitura de um selo de prancha" base="frações de centavo por folha" valor="US$ 0,001" atraso={540} />
          </div>
        </div>
        <div style={{ gridColumn: "7 / span 6" }}>
          <Entra atraso={700}>
            <Selo tom="decide">Estimativa mensal no volume do escritório</Selo>
          </Entra>
          <div style={{ marginTop: 18 }}>
            <LinhaDeCusto item="Conferência de memoriais" base="cerca de 16 por mês, pela corrida mais cara" valor="US$ 26" parte={[26, 26]} atraso={800} />
            <LinhaDeCusto item="Montagem de listas e volumes" base="uso corrente" valor="menos de US$ 1" parte={[1, 26]} atraso={920} />
            <LinhaDeCusto item="Servidor" base="infraestrutura" valor="US$ 25" parte={[25, 26]} atraso={1040} />
            <LinhaDeCusto item="Banco de dados" base="infraestrutura" valor="US$ 5" parte={[5, 26]} atraso={1160} />
          </div>
          <Entra
            atraso={1300}
            style={{ marginTop: 18, padding: "16px 26px", borderRadius: 20, background: "var(--ds-surface-card)", boxShadow: "var(--ds-edge)", display: "flex", justifyContent: "space-between", alignItems: "center" }}
          >
            <span className="ap-rotulo">Ordem de grandeza</span>
            <span style={{ fontSize: 48, letterSpacing: "-0.035em", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
              ≈ R$ 297 / mês
            </span>
          </Entra>
          <Entra atraso={1420} style={{ marginTop: 12 }}>
            <p className="ap-fonte">
              Convertido a <span className="ap-premissa">R$ 5,21 por dólar</span> (PTAX
              de venda do Banco Central) — atualizar a cotação antes de apresentar.
            </p>
          </Entra>
        </div>
      </div>
    ),
  },

  {
    rotulo: "O que está sendo comprado",
    numero: "C",
    bloco: BLOCO,
    titulo: "O que o piloto compra",
    manchete: [
      { texto: "Não são três meses de acesso.", fraca: true },
      "É uma implantação com prova de saída.",
    ],
    notas:
      "ESTA FOLHA SUBSTITUI O CUSTO DE CONSTRUÇÃO COMO ÂNCORA. O comprador não paga as horas passadas; paga implantação, acompanhamento e uma decisão final sustentada por evidência. O cronograma mostra as três coisas no tempo, em meses relativos.\n\nIMPLANTAÇÃO inclui configurar o uso com projeto e pessoas reais. ACOMPANHAMENTO inclui observar, corrigir e documentar problemas recorrentes. EVIDÊNCIA inclui as duas medidas separadas e o memorial-padrão corrigido.\n\nPROPRIEDADE, EM UMA FRASE: o software continua sendo de Matheus Mendes; os pareceres e arquivos produzidos para a PROSUL ficam com a PROSUL. Custódia de código só entra numa negociação de longo prazo.",
    corpo: (
      <Cronograma
        atraso={300}
        linhas={[
          { rotulo: "Implantação", texto: "projeto, usuários, configuração e linha de base, nos dois caminhos", de: 0, ate: 1, forte: true },
          { rotulo: "Acompanhamento", texto: "problemas recorrentes recebem correção ou procedimento documentado", de: 0, ate: 3 },
          { rotulo: "Evidência", texto: "medidas separadas, registro das decisões e memorial-padrão corrigido", de: 2, ate: 3, forte: true },
        ]}
      />
    ),
  },

  {
    rotulo: "A proposta",
    numero: "D",
    bloco: BLOCO,
    titulo: "A proposta",
    manchete: [
      "Licença de uso com acompanhamento,",
      { texto: "por três meses.", fraca: true },
    ],
    notas:
      "LER O ESCOPO ANTES DO NÚMERO. A ficha monta de cima para baixo e o valor chega por último: ele compra a implantação descrita na folha anterior e a evidência da folha seguinte.\n\nSE PERGUNTAREM POR QUE TRÊS MESES: porque um projeto precisa atravessar o sistema por inteiro e produzir julgamento, não impressão.\n\nOCR pode funcionar em casos específicos, mas não é cobertura garantida do piloto. Dizer assim evita contradizer a demonstração das quatorze páginas sem texto da corrida real.\n\nÀ DIREITA, AS DUAS SAÍDAS: se não produzir evidência suficiente, encerra; se produzir, a renovação nasce dos dados do piloto.\n\nO PISO CONTINUA R$ 8 mil. Não conceder desconto por alívio de a reunião estar acabando.",
    corpo: (
      <div className="ap-grade" style={{ alignItems: "center" }}>
        <div className="ap-painel ap-entra" style={{ gridColumn: "1 / span 8", padding: "12px 36px 28px", animationDelay: "300ms" }}>
          <Campo rotulo="Modalidade" atraso={420}>
            <span style={{ fontSize: 25 }}>Licença de uso durante o piloto</span>
          </Campo>
          <Campo rotulo="Prazo" atraso={540}>
            <span style={{ fontSize: 25 }}>3 meses</span>
          </Campo>
          <Campo rotulo="Inclui" atraso={660}>
            {INCLUI.map((t) => fichinha(t))}
          </Campo>
          <Campo rotulo="Não inclui" atraso={820}>
            {NAO_INCLUI.map((t) => fichinha(t, true))}
          </Campo>
          <Campo rotulo="Valor" atraso={1100}>
            <span style={{ display: "block", fontSize: 72, letterSpacing: "-0.045em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
              <Linhas linhas={["R$ 8.000"]} atraso={1200} />
            </span>
          </Campo>
        </div>
        <div style={{ gridColumn: "10 / span 3", display: "grid", gap: 20 }}>
          <Entra atraso={1600} className="ap-assenta" style={{ padding: "24px 28px", borderRadius: 20, outline: "1.5px dashed var(--ds-line-strong)", outlineOffset: -1.5 }}>
            <p style={{ margin: 0, fontSize: 18, color: "var(--ds-text-tertiary)" }}>Sem evidência suficiente</p>
            <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 500 }}>Encerra.</p>
          </Entra>
          <Entra atraso={1800} className="ap-assenta" style={{ padding: "24px 28px", borderRadius: 20, background: "var(--ds-surface-card)", boxShadow: "var(--ds-edge-strong)" }}>
            <p style={{ margin: 0, fontSize: 18, color: "var(--ds-text-tertiary)" }}>Com evidência</p>
            <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 500 }}>A renovação nasce dos dados do piloto.</p>
          </Entra>
        </div>
      </div>
    ),
  },

  {
    rotulo: "O que fica ao final",
    numero: "E",
    bloco: BLOCO,
    titulo: "A prova que fica com a PROSUL",
    manchete: [
      { texto: "O valor não se sustenta no que custou construir.", fraca: true },
      "Sustenta-se no que fica para decidir.",
    ],
    notas:
      "ESTA É A JUSTIFICATIVA DO VALOR. Não comparar os R$ 8 mil com horas de desenvolvimento. Mostrar o pacote de decisão que a empresa recebe — a folha é o sumário dele.\n\nCONFERÊNCIA: matriz julgada por disciplina, taxa de achados verdadeiros, classes recorrentes de falso positivo e correções do memorial-padrão.\n\nMONTAGEM: linha de base contra tempo real, LDs e volumes gerados, arquivos aceitos, falhas, retrabalho e correções.\n\nO REGISTRO DE DECISÃO fecha: o que ficou provado, o que ainda falta e qual condição sustenta renovar. Mesmo sem renovação, essa evidência não some.",
    corpo: (
      <div style={{ display: "grid", gridTemplateColumns: "520px 1fr", gap: 64, alignItems: "center" }}>
        <div className="ap-papel ap-entra" style={{ height: 560, boxSizing: "border-box", padding: "44px 48px", animationDelay: "300ms" }}>
          <span style={{ fontFamily: MONO, fontSize: 14, color: "var(--ds-text-on-paper-muted)" }}>Entrega final do piloto</span>
          <p style={{ margin: "120px 0 0", fontSize: 40, fontWeight: 600, letterSpacing: "-0.03em", lineHeight: 1.05 }}>
            Relatório de decisão
          </p>
          <p style={{ margin: "14px 0 0", fontSize: 20, color: "var(--ds-text-on-paper-muted)" }}>
            Conferência e montagem, medidas em separado
          </p>
          <span style={{ position: "absolute", left: 48, right: 48, bottom: 44, display: "flex", justifyContent: "space-between", fontSize: 16, color: "var(--ds-text-on-paper-muted)" }}>
            <span>PROSUL</span>
            <span>Mês 3</span>
          </span>
        </div>
        <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
          {(
            [
              ["Conferência medida", "Julgamento por disciplina: verdadeiros, duvidosos e falsos, padrões recorrentes e correções do texto-base."],
              ["Montagem medida", "Tempo antes e depois, estabilidade, retrabalho, arquivos gerados e aceitação por quem entrega."],
              ["Decisão registrada", "O que ficou provado, o que permaneceu em aberto e a condição objetiva para encerrar ou renovar."],
            ] as const
          ).map(([t, x], i) => (
            <li key={t} className="ap-entra" style={{ display: "grid", gridTemplateColumns: "64px 1fr", padding: "26px 0", boxShadow: "inset 0 1px 0 var(--ds-line-subtle)", animationDelay: `${700 + i * 220}ms` }}>
              <span style={{ fontFamily: MONO, fontSize: 18, color: "var(--ds-text-tertiary)", paddingTop: 8 }}>{i + 1}</span>
              <span>
                <b style={{ display: "block", fontSize: 32, fontWeight: 500, letterSpacing: "-0.02em" }}>{t}</b>
                <span className="ap-texto" style={{ display: "block", marginTop: 6, fontSize: 22 }}>{x}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    ),
  },

  {
    rotulo: "A decisão",
    numero: "F",
    bloco: BLOCO,
    titulo: "Para começar",
    manchete: [
      "Aprovar o piloto de três meses por R$ 8 mil.",
      { texto: "Escolher o projeto. Nomear as pessoas.", fraca: true },
    ],
    lead: "Com a aprovação, a próxima reunião é de implantação.",
    notas:
      "ÚLTIMA FOLHA DO ANEXO: terminar em decisão, não em propriedade.\n\nPEDIR TRÊS COISAS: aprovar o piloto de três meses por R$ 8 mil; escolher o projeto inicial; nomear o responsável e os usuários. O checklist está vazio de propósito: quem marca é a sala.\n\nSE A RESPOSTA FOR SIM, a próxima conversa é de implantação. Se precisarem pensar, perguntar qual evidência ainda falta para decidir e registrar quem a traz.\n\nNÃO REPETIR o custo de construção, não oferecer desconto e não abrir roadmap. Parar depois do pedido.",
    corpo: (
      <div style={{ width: 1300 }}>
        <Checklist
          atraso={400}
          titulo="Para começar"
          itens={[
            { titulo: "Projeto", texto: "O primeiro trabalho real que atravessa o piloto.", campos: ["Qual projeto"] },
            { titulo: "Responsável", texto: "Quem recebe a evidência e responde pela decisão final.", campos: ["Quem"] },
            { titulo: "Usuários", texto: "Quem julga a conferência e quem mede a montagem.", campos: ["Quem"] },
          ]}
        />
      </div>
    ),
  },
];
