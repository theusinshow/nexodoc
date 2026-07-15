// Lê um PDF do disco e envia para o endpoint local /api/audit/classify.
// Não copia o arquivo; só faz POST para localhost (a própria app).
import { readFile } from "node:fs/promises";

const path = process.argv[2];
const url = process.argv[3] ?? "http://localhost:3000/api/audit/classify";
if (!path) {
  console.error('Uso: node scripts/classify-post.ts "<arquivo.pdf>" [url]');
  process.exit(1);
}

const buf = await readFile(path);
const name = path.split(/[\\/]/).pop() ?? "arquivo.pdf";
const form = new FormData();
form.append("files", new Blob([buf], { type: "application/pdf" }), name);

const res = await fetch(url, { method: "POST", body: form });
const text = await res.text();
console.log(`[HTTP ${res.status}]`);
try {
  console.log(JSON.stringify(JSON.parse(text), null, 2));
} catch {
  console.log(text.slice(0, 800));
}
