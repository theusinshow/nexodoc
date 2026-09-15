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
  // Fora do Windows: `lsof` (vem no ubuntu-latest do GitHub Actions); em imagem
  // mínima sem ele, `ss` (iproute2), e por último `fuser` (psmisc).
  if (temComando("lsof")) {
    try {
      const saida = execSync(`lsof -nP -ti tcp:${porta} -sTCP:LISTEN || true`, { encoding: "utf8" }).trim();
      return saida ? [...new Set(saida.split(/\s+/))] : [];
    } catch {
      return null;
    }
  }
  if (temComando("ss")) {
    try {
      const saida = execSync("ss -Hltnp", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
      const pids = new Set();
      for (const linha of saida.split(/\r?\n/)) {
        // Estado, Recv-Q, Send-Q, endereço local, endereço remoto, processo.
        const colunas = linha.trim().split(/\s+/);
        if (colunas.length < 4 || !colunas[3].endsWith(`:${porta}`)) continue;
        // Ouvinte sem `pid=` é de outro usuário: o `ss` não mostra. Aí não dá
        // para dizer "livre" nem derrubar — é o "não sei".
        const achados = [...linha.matchAll(/pid=(\d+)/g)].map((m) => m[1]);
        if (achados.length === 0) return null;
        for (const pid of achados) pids.add(pid);
      }
      return [...pids];
    } catch {
      return null;
    }
  }
  if (temComando("fuser")) {
    try {
      // `fuser` escreve os PIDs no stdout e o resto no stderr; sai com 1 quando
      // ninguém usa a porta. Ele não separa quem escuta de quem só conecta,
      // mas na porta própria da bateria quem conecta é a própria bateria.
      const saida = execSync(`fuser -n tcp ${porta} 2>/dev/null || true`, { encoding: "utf8" }).trim();
      return saida ? [...new Set(saida.split(/\s+/).filter((p) => /^\d+$/.test(p)))] : [];
    } catch {
      return null;
    }
  }
  return null;
}

function temComando(nome) {
  try {
    execSync(`command -v ${nome}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
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
    const ferramenta = process.platform === "win32" ? "netstat" : "lsof/ss/fuser";
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
    // Fora do Windows, um GRUPO DE PROCESSOS próprio: é o que deixa derrubar a
    // árvore inteira (shell → npx → next → node) com um sinal só, pelo PID
    // negativo. `filho.kill()` matava só o shell e o `next dev` seguia vivo.
    detached: !WINDOWS,
    env: ambienteDoServidor(porta),
    stdio: ["ignore", log, log],
  });
  let saida = null;
  filho.on("exit", (codigo, sinal) => {
    saida = { codigo, sinal };
  });
  if (!WINDOWS) gruposVivos.add(filho.pid);

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
  async function matarFilho() {
    if (WINDOWS) {
      try {
        execSync(`taskkill /PID ${filho.pid} /T /F`, { stdio: "ignore" });
      } catch {
        // Já tinha saído sozinho: é o caminho feliz normal.
      }
      return;
    }
    await matarGrupo(filho.pid);
    // O grupo caiu, mas alguém que tenha saído dele (um `setsid` no caminho)
    // ainda estaria na porta: a porta é o critério final, como no Windows.
    matarPorta(porta);
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
    await matarFilho();
    fecharLog();
    throw err;
  }
  return {
    base,
    async derrubar() {
      matarPorta(porta);
      await matarFilho();
      fecharLog();
    },
  };
}

const WINDOWS = process.platform === "win32";

/** Os grupos de processo (fora do Windows) que a bateria abriu e ainda não derrubou. */
const gruposVivos = new Set();

function grupoVivo(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (err) {
    // EPERM: existe, mas não é nosso — para efeito de "caiu?", está vivo.
    return err?.code === "EPERM";
  }
}

/**
 * SIGTERM no grupo inteiro, uma folga para o `next dev` fechar o que abriu, e
 * SIGKILL em quem sobrou. O PID negativo é o grupo: `detached: true` fez o
 * shell líder dele, e o `next dev` e o worker herdaram.
 */
async function matarGrupo(pgid, { folgaMs = 5000 } = {}) {
  try {
    process.kill(-pgid, "SIGTERM");
  } catch {
    // Grupo já vazio: nada a fazer.
  }
  const fim = Date.now() + folgaMs;
  while (grupoVivo(pgid) && Date.now() < fim) {
    await new Promise((res) => setTimeout(res, 200));
  }
  if (grupoVivo(pgid)) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {
      // Caiu entre a checagem e o sinal.
    }
  }
  gruposVivos.delete(pgid);
}

/**
 * Derruba todo servidor que a bateria subiu e ainda está de pé — inclusive o
 * que ainda não respondeu `/api/saude` e por isso não tem `derrubar()`. É o
 * caminho do Ctrl+C / SIGTERM em `rodar.mjs`. No Linux ele é obrigatório: o
 * grupo próprio (`detached`) não recebe o SIGINT do terminal junto com a
 * bateria, então ninguém mais o derrubaria.
 */
export async function derrubarServidoresVivos() {
  await Promise.all([...gruposVivos].map((pgid) => matarGrupo(pgid)));
}

// Última rede: a bateria saindo por qualquer caminho (exceção não tratada,
// `process.exit` no meio) não deixa um `next dev` órfão escutando na porta.
process.on("exit", () => {
  for (const pgid of gruposVivos) {
    try {
      process.kill(-pgid, "SIGKILL");
    } catch {
      // já caiu
    }
  }
});
