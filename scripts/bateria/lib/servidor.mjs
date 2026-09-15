// O servidor da bateria: sobe numa porta própria e é derrubado pelo PID de quem
// ESCUTA na porta. Parar só o npm deixava o `node` filho vivo, respondendo com
// código velho (medido duas vezes em 14/09/2026).
import { execSync, spawn } from "node:child_process";
import fs from "node:fs";

import { ambienteDoServidor } from "./ambiente.mjs";

export function matarPorta(porta) {
  try {
    if (process.platform === "win32") {
      const saida = execSync("netstat -ano -p tcp", { encoding: "utf8" });
      const pids = new Set(
        saida
          .split(/\r?\n/)
          .filter((l) => l.includes(`:${porta} `) && /LISTEN/i.test(l))
          .map((l) => l.trim().split(/\s+/).at(-1))
          .filter((pid) => pid && pid !== "0"),
      );
      for (const pid of pids) execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      const pids = execSync(`lsof -ti tcp:${porta} -sTCP:LISTEN || true`, { encoding: "utf8" }).trim();
      if (pids) execSync(`kill -9 ${pids.split(/\s+/).join(" ")}`, { stdio: "ignore" });
    }
  } catch {
    // Nada escutando: é o caso normal.
  }
}

async function esperarSaude(base, ms) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
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
  const log = fs.openSync(arquivoDeLog, "a");
  let logFechado = false;
  function fecharLog() {
    // Guarda contra fechar duas vezes: o caminho de falha e o `derrubar()`
    // podiam se sobrepor, e `closeSync` num fd já fechado lança.
    if (logFechado) return;
    logFechado = true;
    fs.closeSync(log);
  }

  const filho = spawn(`npx next dev -p ${porta}`, {
    shell: true,
    env: ambienteDoServidor(porta),
    stdio: ["ignore", log, log],
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

  const base = `http://localhost:${porta}`;
  try {
    await esperarSaude(base, 240_000);
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
