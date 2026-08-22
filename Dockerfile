# Usa una imagen base de Node.js
FROM node:22-slim

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /app

# Instala OpenSSL para Prisma
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Copia los archivos de tu proyecto necesarios para instalar dependencias
COPY package*.json ./
COPY tsconfig*.json ./
COPY prisma.config.ts prisma.config.second.ts prisma.config.third.ts ./
COPY prisma ./prisma/
COPY prisma_second ./prisma_second/
COPY prisma_third ./prisma_third/

# Limpia la caché de npm para evitar problemas anteriores
RUN npm cache clean --force

# Instala las dependencias
RUN npm install

# Genera los 3 clientes de Prisma (uno por schema/datasource independiente)
RUN npx prisma generate --config prisma.config.ts
RUN npx prisma generate --config prisma.config.second.ts
RUN npx prisma generate --config prisma.config.third.ts

# Copia el resto de los archivos del proyecto
COPY . .

# Compila el código TypeScript
RUN npm run build

# Expone el puerto que usará la aplicación
EXPOSE 3001

# Comando para sincronizar el esquema con la base de datos y ejecutar la aplicación
CMD ["sh", "-c", "npm run start:prod"]