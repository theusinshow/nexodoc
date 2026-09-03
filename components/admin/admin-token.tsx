"use client";

/**
 * O TOKEN É DO PAINEL, NÃO DA TELA.
 *
 * Sete telas mantinham cada uma o seu `const [token, setToken] = useState("")`,
 * o seu `useEffect` restaurando do `sessionStorage`, o seu `submit` e o seu
 * `AdminTokenForm` no cabeçalho. Sete cópias do mesmo campo de senha para uma
 * sessão só — e era a primeira coisa que se via ao abrir qualquer uma delas.
 *
 * A duplicação também travava a repaginação: dois conteúdos não podem dividir
 * um destino enquanto cada um insiste em ter o próprio formulário de token.
 *
 * O QUE ESTE MÓDULO NÃO FAZ: dizer que o token é válido. Quem sabe disso é a
 * tela, que recebe (ou não) os dados — e é por isso que existe
 * `registrarResposta`. Afirmar validade não apurada seria a mesma mentira que o
 * `AdminTokenForm` já evitava sozinho.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export const ADMIN_TOKEN_STORAGE_KEY = "nexodoc-admin-token";

interface EstadoDoToken {
  token: string;
  /**
   * Alguma tela conseguiu carregar com este token. É o que recolhe o campo —
   * e o que impede o recolhimento quando o acesso foi negado.
   */
  aceito: boolean;
  /** O token já foi procurado no `sessionStorage`? Antes disso, ninguém busca. */
  restaurado: boolean;
  /**
   * Sobe a cada pedido de recarga. As telas escutam este número para refazer o
   * pedido sem que o trilho precise conhecer nenhuma delas.
   */
  recarga: number;
  definirToken: (valor: string) => void;
  /** A tela diz se o pedido passou. `false` reabre o campo. */
  registrarResposta: (ok: boolean) => void;
  recarregar: () => void;
  sair: () => void;
}

const Contexto = createContext<EstadoDoToken | null>(null);

export function AdminTokenProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState("");
  const [aceito, setAceito] = useState(false);
  const [restaurado, setRestaurado] = useState(false);
  const [recarga, setRecarga] = useState(0);

  useEffect(() => {
    // `queueMicrotask` porque o React Compiler barra `setState` sincrono no
    // corpo de um efeito — o mesmo contorno que as telas do painel já usavam.
    queueMicrotask(() => {
      try {
        setToken(sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) ?? "");
      } catch {
        // `sessionStorage` pode estar bloqueado (modo restrito do navegador).
        // Sem ele o painel continua funcionando — só pede o token a cada aba.
      }
      /*
       * MARCA COMO RESTAURADO MESMO SEM TOKEN, e é o ponto: as telas só buscam
       * depois desta linha. Sem ela, o primeiro render (token vazio) dispararia
       * um "informe o token admin" antes de o `sessionStorage` ter sido lido, e
       * o erro apareceria e sumiria a cada carregamento de página.
       */
      setRestaurado(true);
    });
  }, []);

  const definirToken = useCallback((valor: string) => {
    setToken(valor);
    /*
     * Token novo é token não apurado. Sem isto, trocar um token que funcionava
     * por um errado manteria o campo recolhido afirmando "sessão admin".
     */
    setAceito(false);
  }, []);

  const registrarResposta = useCallback((ok: boolean) => {
    setAceito(ok);

    if (!ok) return;

    try {
      /*
       * SÓ GRAVA O QUE FUNCIONOU. Gravar no `onChange` encheria o
       * `sessionStorage` de tokens digitados pela metade, e o próximo
       * carregamento restauraria um deles.
       */
      setToken((atual) => {
        sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, atual.trim());
        return atual;
      });
    } catch {
      // Ver acima: sem `sessionStorage` o painel só fica menos conveniente.
    }
  }, []);

  const recarregar = useCallback(() => setRecarga((n) => n + 1), []);

  const sair = useCallback(() => {
    setToken("");
    setAceito(false);
    try {
      sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
    } catch {
      // O token já saiu do estado, que é o que importa nesta aba.
    }
  }, []);

  const valor = useMemo(
    () => ({
      token,
      aceito,
      restaurado,
      recarga,
      definirToken,
      registrarResposta,
      recarregar,
      sair,
    }),
    [token, aceito, restaurado, recarga, definirToken, registrarResposta, recarregar, sair],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useAdminToken() {
  const contexto = useContext(Contexto);

  if (!contexto) {
    throw new Error("useAdminToken precisa do AdminTokenProvider (app/admin/layout.tsx).");
  }

  return contexto;
}
