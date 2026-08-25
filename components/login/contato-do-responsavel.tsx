"use client";

/**
 * FALAR COM O RESPONSÁVEL — a saída de quem bateu na porta trancada.
 *
 * Ele só aparece quando o login falhou, e é de propósito: numa tela que deu
 * certo, um canal de suporte é ruído. A guarda inteira (destino fixo, teto por
 * origem, limites de tamanho) mora em [[lib/contato-do-responsavel]] — nada
 * daqui é confiável, este é o lado do navegador.
 *
 * NÃO É MODAL. O formulário abre no lugar, embaixo do aviso de erro: quem está
 * ali precisa continuar vendo o que deu errado enquanto escreve sobre isso, e
 * um diálogo por cima esconderia exatamente o contexto que a mensagem descreve.
 *
 * E ELE NUNCA DIZ QUE MANDOU QUANDO NÃO MANDOU. O correio devolve três estados
 * diferentes (saiu / foi gravado num arquivo de dev / não está configurado) e a
 * tela repete os três com nomes distintos. É a mesma regra que governou o aviso
 * de achados, e ela vale mais aqui: quem usa este formulário está bloqueado, e
 * um "enviado" falso o deixa esperando resposta que ninguém vai escrever.
 */

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { LIMITE_DE_MENSAGEM } from "@/lib/contato-limites";

export type RespostaDoContato =
  | { ok: true; estado: "enviado" | "gravado" | "nao-configurado" }
  | { ok: false; motivo: string; erro?: string };

const RECADO: Record<string, string> = {
  enviado: "Recado enviado. O responsável responde no e-mail que você informou.",
  gravado:
    "Modo de desenvolvimento: o recado foi gravado no disco e NENHUM e-mail saiu.",
  "nao-configurado":
    "O envio de e-mail ainda não está configurado neste ambiente. Nada foi enviado — procure o responsável por outro canal.",
  "email-invalido": "Confira o e-mail: o responsável precisa dele para responder.",
  "mensagem-vazia": "Escreva o que aconteceu, nem que seja em uma linha.",
  excesso: "Recados demais em pouco tempo. Tente de novo daqui a alguns minutos.",
  falhou: "O envio falhou e nada saiu. Tente de novo em instantes.",
};

export function ContatoDoResponsavel({
  enviarRecado,
}: {
  enviarRecado: (dados: FormData) => Promise<RespostaDoContato>;
}) {
  const [aberto, setAberto] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<RespostaDoContato | null>(null);

  if (!aberto) {
    return (
      <Button
        type="button"
        variant="outline"
        className="login-contato-gatilho"
        onClick={() => setAberto(true)}
      >
        Falar com o responsável
      </Button>
    );
  }

  const chave = resposta ? (resposta.ok ? resposta.estado : resposta.motivo) : null;

  return (
    <form
      className="login-contato"
      action={async (dados) => {
        setEnviando(true);
        setResposta(null);
        try {
          setResposta(await enviarRecado(dados));
        } finally {
          setEnviando(false);
        }
      }}
    >
      <label className="login-contato-rotulo" htmlFor="contato-email">
        Seu e-mail
      </label>
      <input
        id="contato-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="para o responsável poder responder"
        className="login-dev-email-input"
      />

      <label className="login-contato-rotulo" htmlFor="contato-mensagem">
        O que aconteceu
      </label>
      <textarea
        id="contato-mensagem"
        name="mensagem"
        required
        rows={4}
        maxLength={LIMITE_DE_MENSAGEM}
        placeholder="quem é você, de que escritório, e o que a tela disse"
        className="login-dev-email-input login-contato-mensagem"
      />

      {chave ? (
        <p
          role="status"
          className={
            resposta?.ok && resposta.estado === "enviado"
              ? "login-contato-aviso login-contato-aviso--ok"
              : "login-contato-aviso"
          }
        >
          {RECADO[chave] ?? "Não foi possível enviar."}
        </p>
      ) : null}

      <div className="login-contato-acoes">
        <Button type="submit" loading={enviando}>
          {enviando ? "Enviando" : "Enviar recado"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
