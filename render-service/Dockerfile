FROM ubuntu:22.04

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      libreoffice-headless \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json ./
RUN npm install --production

COPY index.js ./

EXPOSE 3000

CMD ["node", "index.js"]
