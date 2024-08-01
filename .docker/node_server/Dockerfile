FROM node:20.15-alpine as dependency-base

# Create destination directory
ENV WORKDIR=/home/api_server
WORKDIR $WORKDIR

# Install system dependencies
RUN apk add --no-cache mysql-client bash vim git wget curl nodejs npm && \
    rm -rf /var/cache/apk/* && \
    rm -rf /var/lib/apt/lists/* /tmp/*

# Install NestJS CLI
RUN npm install -g @nestjs/cli

FROM dependency-base as server_development

# Set NODE_ENV environment variable to development
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}

# Copy over package.json and package-lock.json files
COPY package*.json .

# Cài đặt các phụ thuộc Node.js
RUN npm install

# Sao chép mã nguồn vào container
COPY . .

# Điều chỉnh quyền
RUN chmod -R 755 $WORKDIR

# Mở cổng 3001
EXPOSE 3001

# Lệnh chạy ứng dụng
CMD ["npm", "run", "start:dev"]
