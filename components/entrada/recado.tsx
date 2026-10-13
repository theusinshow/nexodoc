"use client";

import { AnimatePresence, motion } from "motion/react";
import { Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Botao, Girando, Tecla } from "@/components/ds/basicos";
import { LIMITE_DE_MENSAGEM } from "@/lib/contato-limites";

import { Aviso, type TomDoAviso } from "./aviso";

export type RespostaDoContato =
  | { ok: true; estado: "enviado" | "gravado" | "nao-configurado" }
  | { ok: false; motivo: string; erro?: string };

/*
 * O RECADO tem desfechos diferentes e a tela nunca diz que mandou quando não
 * mandou: gravado em disco (dev) e "não configurado" não são "enviado".
 */
const RECADO: Record<string, { tom: TomDoAviso; texto: string }> = {
  enviado: { tom: "ok", texto: "Recado enviado. O responsável responde no e-mail que você informou." },
  gravado: { tom: "atencao", texto: "Modo de desenvolvimento: o recado foi gravado no disco e nenhum e-mail saiu." },
  "nao-configurado": { tom: "atencao", texto: "O envio de e-mail não está configurado neste ambiente. Nada foi enviado: procure o responsável por outro canal." },
  "email-invalido": { tom: "erro", texto: "Confira o e-mail: o responsável precisa dele para responder." },
  "mensagem-vazia": { tom: "erro", texto: "Escreva o que aconteceu, nem que seja em uma linha." },
  excesso: { tom: "erro", texto: "Recados demais em pouco tempo. Tente de novo daqui a alguns minutos." },
  falhou: { tom: "erro", texto: "O envio falhou e nada saiu. Tente de novo em instantes." },
};

const SUAVE = [0.22, 1, 0.36, 1] as const;

/**
 * FALAR COM O RESPONSÁVEL: abre no lugar, embaixo do que deu errado (não é
 * modal). Fica sempre na porta, e não só no erro: quem mais precisa dele é a
 * conta que o escritório ainda não liberou, e esse caso não produz `?error=`.
 */
export function Recado({ enviarRecado }: { enviarRecado: (dados: FormData) => Promise<RespostaDoContato> }) {
  const [aberto, setAberto] = useState(false);
  // Os dois campos são controlados: o React 19 limpa o formulário ao fim da
  // ação, e quem recebe "confira o e-mail" perderia o que digitou.
  const [email, setEmail] = useState("");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [resposta, setResposta] = useState<RespostaDoContato | null>(null);
  const primeiro = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (aberto) primeiro.current?.focus();
  }, [aberto]);

  // Esc desiste de qualquer ponto da tela, e não só com o foco no formulário:
  // durante o envio o botão trava e o navegador tira o foco dele.
  useEffect(() => {
    if (!aberto) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      e.preventDefault();
      setAberto(false);
    };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [aberto]);

  const chave = resposta ? (resposta.ok ? resposta.estado : resposta.motivo) : null;
  const desfecho = chave ? (RECADO[chave] ?? { tom: "erro" as const, texto: "Não foi possível enviar." }) : null;

  return (
    <div className="en-contato">
      <AnimatePresence initial={false} mode="popLayout">
        {!aberto ? (
          <motion.div key="fechado" exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
            <Botao variante="quiet" tamanho="sm" onClick={() => setAberto(true)}>
              <Mail size={14} strokeWidth={1.75} aria-hidden />
              Falar com o responsável
            </Botao>
          </motion.div>
        ) : (
          <motion.form
            key="aberto"
            className="en-form"
            action={async (dados) => {
              setEnviando(true);
              setResposta(null);
              try {
                setResposta(await enviarRecado(dados));
              } finally {
                setEnviando(false);
              }
            }}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: SUAVE }}
          >
            <p className="en-form-titulo">Falar com o responsável</p>
            <label className="en-campo">
              <span>Seu e-mail, para a resposta</span>
              <input ref={primeiro} name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@escritorio.com.br" />
            </label>
            <label className="en-campo">
              <span>
                O que aconteceu
                <em className="ds-num">
                  {texto.length}/{LIMITE_DE_MENSAGEM}
                </em>
              </span>
              <textarea name="mensagem" rows={3} required maxLength={LIMITE_DE_MENSAGEM} value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Seu nome, o escritório e o que a tela mostrou" />
            </label>
            {desfecho && <Aviso tom={desfecho.tom}>{desfecho.texto}</Aviso>}
            <div className="en-form-acoes">
              <Botao variante="ghost" tamanho="sm" type="submit" disabled={enviando}>
                {enviando && <Girando tamanho={13} />}
                {enviando ? "Enviando" : "Enviar recado"}
              </Botao>
              <Botao variante="quiet" tamanho="sm" onClick={() => setAberto(false)}>
                Cancelar <Tecla>Esc</Tecla>
              </Botao>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
