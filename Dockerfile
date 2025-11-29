# Sử dụng Node 20 slim để image nhẹ
FROM node:20-slim

# Cài các công cụ cần thiết: cert, curl, tar, gzip
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl tar gzip \
 && rm -rf /var/lib/apt/lists/*

# Tải & cài ipatool v2.2.0 (Linux amd64)
RUN curl -L "https://github.com/majd/ipatool/releases/download/v2.2.0/ipatool-2.2.0-linux-amd64.tar.gz" \
    -o /tmp/ipatool.tar.gz \
 && mkdir -p /tmp/ipatool-extract \
 && tar -xzf /tmp/ipatool.tar.gz -C /tmp/ipatool-extract \
 && mv /tmp/ipatool-extract/ipatool /usr/local/bin/ipatool \
 && chmod +x /usr/local/bin/ipatool \
 && rm -rf /tmp/ipatool.tar.gz /tmp/ipatool-extract

# Thư mục làm việc của app
WORKDIR /app

# Copy file package để cài dependencies
COPY package*.json ./

# Cài dependencies production (express, cors, v.v.)
RUN npm install --only=production

# Copy toàn bộ source code vào container
COPY . .

# PORT server lắng nghe (trùng với server.js)
ENV PORT=10000
EXPOSE 10000

# Lệnh chạy app (start script trong package.json)
CMD ["npm", "start"]