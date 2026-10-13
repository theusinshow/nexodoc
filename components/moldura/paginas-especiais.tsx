"use client";

import { RotateCw, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { Botao, Tecla } from "@/components/ds/basicos";
import { abrirSuporte } from "@/lib/suporte/cliente";
import { formatarProtocolo } from "@/lib/suporte/comum";

import { useMoldura } from "./contexto";
import "./sobreposicoes.css";

/** O último pedaço do endereço, se parece um código de obra ("117-26"): é o que vale buscar. */
function termoDo(caminho: string) {
  let ultimo: string;
  try {
    ultimo = decodeURIComponent(caminho.split("/").filter(Boolean).pop() ?? "");
  } catch {
    // "%" solto (robô varrendo, link cortado): `decodeURIComponent` estoura e derrubava o próprio 404.
    return "";
  }
  return /\d/.test(ultimo) && ultimo.length <= 24 ? ultimo : "";
}

/**
 * A PÁGINA QUE NÃO EXISTE. Diz o endereço que foi pedido, por que pode ter
 * sumido, e as duas saídas: buscar o que parece um código (abre o Ctrl K já
 * escrito) ou ir para Projetos. Sem sessão, a saída é entrar.
 */
export function PaginaQueNaoExiste({ logado }: { logado: boolean }) {
  const caminho = usePathname() ?? "";
  const router = useRouter();
  const { abrirBusca } = useMoldura();
  const termo = termoDo(caminho);
  return (
    <div className="pc-palco-proprio pc-404">
      <p className="pc-404-codigo mp-mono">{caminho}</p>
      <h1>Esta página não existe.</h1>
      <p className="pc-404-texto">O endereço pode ter sido digitado errado, ou o que estava aqui foi excluído. Excluído, continua guardado no histórico, mas some das listas.</p>
      <div className="pc-404-acoes">
        {logado ? (
          <>
            <Botao variante="primary" onClick={() => abrirBusca(termo)}>
              <Search size={15} /> {termo ? `Buscar “${termo}”` : "Buscar"} <Tecla>Ctrl K</Tecla>
            </Botao>
            <Botao variante="ghost" onClick={() => router.push("/projetos")}>
              Ir para Projetos
            </Botao>
          </>
        ) : (
          <Botao variante="primary" onClick={() => router.push("/login")}>
            Entrar no Nexo
          </Botao>
        )}
      </div>
    </div>
  );
}

/**
 * A PÁGINA QUE NÃO CARREGOU (o erro de uma rota). A frase é a de
 * `lib/estado-da-carga`: o que aconteceu e que nada foi alterado. "Tentar de
 * novo" refaz a renderização da rota; o painel é a saída se insistir.
 */
export function PaginaQueNaoCarregou({
  onTentar,
  codigo,
  chamado,
}: {
  onTentar: () => void;
  codigo?: string;
  /** O chamado que o erro já abriu sozinho ([[lib/suporte/cliente.ts]]); o relato da pessoa entra nele. */
  chamado?: { id: string; protocolo: number } | null;
}) {
  const caminho = usePathname() ?? "";
  const router = useRouter();
  return (
    <div className="pc-palco-proprio pc-404">
      <p className="pc-404-codigo mp-mono">
        {caminho} · {codigo ? `o servidor falhou (${codigo})` : "o servidor não respondeu"}
      </p>
      <h1>Esta página não carregou.</h1>
      <p className="pc-404-texto">
        O servidor não conseguiu montar esta tela. Nada foi alterado — tente de novo.
        {chamado && <> Já fomos avisados ({formatarProtocolo(chamado.protocolo)}).</>}
      </p>
      <div className="pc-404-acoes">
        <Botao variante="primary" onClick={onTentar}>
          <RotateCw size={15} /> Tentar de novo
        </Botao>
        <Botao variante="ghost" onClick={() => router.push("/")}>
          Ir para o painel
        </Botao>
        <Botao
          variante="quiet"
          onClick={() => abrirSuporte(chamado ? { chamadoId: chamado.id, protocolo: chamado.protocolo, categoria: "ERRO" } : { categoria: "ERRO" })}
        >
          Contar o que aconteceu
        </Botao>
      </div>
    </div>
  );
}
