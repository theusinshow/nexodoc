# O NEXO INTEIRO NUM CONTAINER — app Next.js + LibreOffice.
#
# Por que um só, e não Vercel + serviço de conversão:
#
# 1. **Duração.** Nenhuma rota declara `maxDuration`, e a auditoria profunda roda
#    24 blocos com 5 em paralelo; uma única chamada de conferência já levou 14s
#    nos logs. Função serverless morre antes. Aqui não há teto.
# 2. **Filesystem.** Os modelos ODT das prefeituras são lidos do disco em tempo
#    de execução, com o caminho montado por `process.cwd()`. Empacotador que não
#    rastreia esses arquivos produz um deploy que falha SÓ em produção — já
#    aconteceu com `/api/capas/templates`. Container tem disco de verdade.
# 3. **LibreOffice.** É o que converte ODT em PDF. No mesmo container, some a
#    latência de rede da conversão e some um serviço para manter.
#
# O `render-service/` continua existindo para quem preferir o arranjo separado.

# ---------------------------------------------------------------- dependências
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `npm ci` respeita o lock; o postinstall do Prisma gera o client.
RUN npm ci

# --------------------------------------------------------------------- build
FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A flag do Nexo é NEXT_PUBLIC_*: ela é EMBUTIDA na compilação, então precisa
# existir aqui, não só em tempo de execução. Sem isto o app sobe com o Nexo
# desligado e ninguém entende por quê.
ARG NEXT_PUBLIC_NEXO_ENABLED=true
ENV NEXT_PUBLIC_NEXO_ENABLED=$NEXT_PUBLIC_NEXO_ENABLED
# `npm run build` já faz `prisma generate && next build`.
RUN npm run build

# ----------------------------------------------------------------- produção
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# LibreOffice headless + as fontes. Sem as fontes, o PDF sai com substituição e
# o carimbo da capa muda de largura — o documento deixa de bater com o modelo.
RUN apt-get update && apt-get install -y --no-install-recommends \
      libreoffice-writer \
      fonts-dejavu \
      fonts-liberation \
      ca-certificates \
      curl \
    && rm -rf /var/lib/apt/lists/*

ENV LIBREOFFICE_PATH=/usr/bin/soffice

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
# `prisma.config.ts` NÃO é opcional aqui. O `schema.prisma` declara o datasource
# sem `url` — ela sai deste arquivo. Sem ele, `migrate deploy` morre com
# "The datasource.url property is required in your Prisma config file", e como o
# CMD encadeia com `&&`, o container inteiro sai com status 1 sem nunca subir.
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
# `next start` lê a configuração em tempo de execução. Sem ela some
# `serverExternalPackages` (pdfjs) e o domínio das fotos de perfil do Google.
COPY --from=build /app/next.config.ts ./next.config.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
# Os modelos ODT vão INTEIROS, não pelo rastreio do empacotador: as rotas os
# leem por `process.cwd()`, e é mais barato copiar a pasta que caçar a próxima
# rota que alguém esquecer de declarar.
COPY --from=build /app/templates ./templates

EXPOSE 3000
ENV PORT=3000

# A porta vem do ambiente: a Render injeta a dela, e um health check fixo em 3000
# reprovaria um container saudável.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT:-3000}/api/saude" || exit 1

# `migrate deploy` aplica as migrações pendentes e não gera nada — é o comando
# de produção. Falhou, o container não sobe: banco fora do esquema é pior que
# app fora do ar.
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
