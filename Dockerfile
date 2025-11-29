# Dockerfile
FROM node:20-slim

# Install required tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl tar gzip \
 && rm -rf /var/lib/apt/lists/*

# Download IPATool v2.2.0
RUN curl -L "https://github.com/majd/ipatool/releases/download/v2.2.0/ipatool-2.2.0-linux-amd64.tar.gz" \
    -o /tmp/ipatool.tar.gz \
 && tar -xzf /tmp/ipatool.tar.gz -C /tmp \
 && mv /tmp/ipatool /usr/local/bin/ipatool \
 && chmod +x /usr/local/bin/ipatool \
 && rm /tmp/ipatool.tar.gz

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

ENV PORT=10000
EXPOSE 10000

CMD ["npm", "start"]