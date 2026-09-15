// O servidor da bateria: sobe numa porta própria e é derrubado pelo PID de quem
// ESCUTA na porta. Parar só o npm deixava o `node` filho vivo, respondendo com
// código velho (medido duas vezes em 14/09/2026).
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";

import { ambienteDoServidor, HOST_DA_BATERIA } from "./ambiente.mjs";

/**
 * Os PIDs que ESCUTAM na porta agora (vazio = porta livre). `null` quando não
 * deu para perguntar ao sistema: "não sei" não pode virar "livre".
 */
export function pidsEscutando(porta) {
  if (process.platform === "win32") {
    let saida = "";
    try {
      // Sem `-p tcp`: ele lista só IPv4. Um ouvinte SÓ em IPv6 (`[::]:3100`)
      // sumia, e a guarda dizia "porta livre" com alguém escutando nela (medido
      // em 15/09/2026). O ouvinte dual-stack, que é o padrão do `next dev`, já
      // aparecia também na linha `0.0.0.0`.
      saida = execSync("netstat -ano", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      return null;
    }
    return [
      ...new Set(
        saida
          .split(/\r?\n/)
          .map((l) => l.trim().split(/\s+/))
          // Proto, endereço local, endereço remoto, estado, PID. Olhar só o
          // endereço LOCAL: `:3100 ` em qualquer lugar da linha pegaria também
          // uma conexão de saída para a 3100 de outra máquina. As linhas de UDP
          // não têm estado e ficam de fora pelo protocolo.
          .filter(
            (c) => c.length >= 5 && /^TCP/i.test(c[0]) && c[1].endsWith(`:${porta}`) && /LISTEN/i.test(c[3]),
          )
          .map((c) => c[4])
          .filter((pid) => pid && pid !== "0"),
      ),
    ];
  }
  try {
    execSync("command -v lsof", { stdio: "ignore" });
    const saida = execSync(`lsof -ti tcp:${porta} -sTCP:LISTEN || true`, { encoding: "utf8" }).trim();
    return saida ? [...new Set(saida.split(/\s+/))] : [];
  } catch {
    return null;
  }
}

export function matarPorta(porta) {
  for (const pid of pidsEscutando(porta) ?? []) {
    try {
      if (process.platform === "win32") execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
      else execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    } catch {
      // Quem sobreviveu é pego por `garantirPortaLivre`, com o PID no erro.
    }
  }
}

/*
 * A PORTA TEM DE ESTAR LIVRE DE VERDADE antes de subir o servidor — 14/09/2026.
 *
 * `matarPorta` engolia toda falha do `taskkill`. Se quem escuta na 3100
 * sobrevivesse (um `next dev` aberto como administrador, por exemplo), o
 * servidor novo morria com EADDRINUSE e `/api/saude` respondia 200 pelo VELHO:
 * código antigo, sem a IA simulada, e a bateria verde contra o servidor errado.
 * O `taskkill` devolve antes de o Windows soltar a porta, então a checagem
 * espera um pouco antes de acusar.
 */
export async function garantirPortaLivre(porta, { esperaMs = 5000 } = {}) {
  const fim = Date.now() + esperaMs;
  let pids = pidsEscutando(porta);
  while (pids !== null && pids.length > 0 && Date.now() < fim) {
    await new Promise((res) => setTimeout(res, 250));
    pids = pidsEscutando(porta);
  }
  if (pids === null) {
    const ferramenta = process.platform === "win32" ? "netstat" : "lsof";
    throw new Error(
      `não consegui ver quem escuta na porta ${porta} (${ferramenta} falhou); sem isso a bateria poderia testar um servidor velho`,
    );
  }
  if (pids.length > 0) {
    throw new Error(
      `a porta ${porta} continua ocupada pelo PID ${pids.join(", ")}; derrube-o antes de rodar a bateria`,
    );
  }
}

/** As últimas linhas do log do servidor, para o erro dizer por que ele caiu. */
function caudaDoLog(arquivoDeLog, linhas = 25) {
  try {
    return fs.readFileSync(arquivoDeLog, "utf8").split(/\r?\n/).filter(Boolean).slice(-linhas).join("\n");
  } catch {
    return "(log ilegível)";
  }
}

export async function esperarSaude(base, ms, { saiu = () => null } = {}) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    // O processo morreu antes de responder: esperar os 240s não traz ele de
    // volta — só esconde o motivo por quatro minutos.
    const motivo = saiu();
    if (motivo) throw new Error(motivo);
    try {
      const r = await fetch(`${base}/api/saude`);
      if (r.ok) return;
    } catch {
      // ainda subindo
    }
    await new Promise((res) => setTimeout(res, 2000));
  }
  throw new Error(`o servidor da bateria não respondeu /api/saude em ${ms / 1000}s`);
}

export async function subirServidor({ porta, arquivoDeLog }) {
  matarPorta(porta);
  await garantirPortaLivre(porta);
  const log = fs.openSync(arquivoDeLog, "a");
  let logFechado = false;
  function fecharLog() {
    // Guarda contra fechar duas vezes: o caminho de falha e o `derrubar()`
    // podiam se sobrepor, e `closeSync` num fd já fechado lança.
    if (logFechado) return;
    logFechado = true;
    fs.closeSync(log);
  }

  // Só no loopback: a bateria loga como dev sem senha, e isso não pode ficar
  // aberto para a rede local enquanto ela roda.
  const filho = spawn(`npx next dev -H ${HOST_DA_BATERIA} -p ${porta}`, {
    shell: true,
    env: ambienteDoServidor(porta),
    stdio: ["ignore", log, log],
  });
  let saida = null;
  filho.on("exit", (codigo, sinal) => {
    saida = { codigo, sinal };
  });

  /*
   * `shell: true` faz `filho` ser o PROCESSO DO SHELL, não o `next dev` — que
   * é neto dele. Se `/api/saude` nunca respondeu porque a porta ainda não
   * tinha sido aberta, `matarPorta` não encontra ninguém ESCUTANDO e essa
   * árvore (shell → npx → next → node) ficava viva, livre para abrir a porta
   * DEPOIS de `subirServidor` já ter desistido e devolvido o erro (achado na
   * revisão da Tarefa 4, 14/09/2026). Matar pelo PID do próprio `filho`, com
   * a árvore inteira, fecha essa brecha — independente do que já esteja
   * escutando.
   */
  function matarFilho() {
    if (process.platform === "win32") {
      try {
        execSync(`taskkill /PID ${filho.pid} /T /F`, { stdio: "ignore" });
      } catch {
        // Já tinha saído sozinho: é o caminho feliz normal.
      }
    } else {
      filho.kill();
    }
  }

  const base = `http://${HOST_DA_BATERIA}:${porta}`;
  try {
    await esperarSaude(base, 240_000, {
      saiu: () =>
        saida
          ? `o servidor da bateria saiu antes de responder /api/saude (código ${saida.codigo ?? saida.sinal}). Fim do log:\n${caudaDoLog(arquivoDeLog)}`
          : null,
    });
  } catch (err) {
    matarPorta(porta);
    matarFilho();
    fecharLog();
    throw err;
  }
  return {
    base,
    async derrubar() {
      matarPorta(porta);
      matarFilho();
      fecharLog();
    },
  };
}
