# Usar Node.js LTS como imagen base
FROM node:20-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install --omit=dev

# Copiar el resto del código
COPY . .

# Exponer el puerto del servidor
EXPOSE 3000

# Variable de entorno para producción
ENV NODE_ENV=production

# Comando para iniciar el servidor
CMD ["node", "server.js"]
