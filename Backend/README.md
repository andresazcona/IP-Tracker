# IP Tracker Backend

## Instalación

### Desarrollo Local

1. Clona el repositorio o copia los archivos
2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura la base de datos PostgreSQL:

   **Opción A: Neon Database (Recomendado)**
   ```bash
   # Tu base de datos Neon ya está configurada
   # Solo necesitas ejecutar el schema:
   
   # Usando la conexión directa a Neon:
   psql 'postgresql://neondb_owner:REDACTED@ep-silent-firefly-adpjc98a-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require' -f schema.sql
   ```

   **Opción B: PostgreSQL Local**
   ```bash
   # Conecta a PostgreSQL como superusuario
   psql -U postgres

   # Crea la base de datos
   CREATE DATABASE ip_tracker;

   # Ejecuta el schema
   \i schema.sql
   ```

4. Configura las variables de entorno:
   ```bash
   cp .env.example .env
   # Edita .env con tus configuraciones
   ```

5. Inicia el servidor:
   ```bash
   npm start
   # o para desarrollo
   npm run dev
   ```

### Despliegue en Vercel

1. Asegúrate de tener el CLI de Vercel instalado:
   ```bash
   npm i -g vercel
   ```

2. Configura las variables de entorno en Vercel:
   ```bash
   vercel env add DATABASE_URL
   # Pega tu connection string de Neon cuando se te pida
   
   vercel env add BACKEND_URL
   # Usa la URL que Vercel te asignará (ej: https://your-app.vercel.app)
   ```

3. Despliega:
   ```bash
   vercel --prod
   ```

4. La aplicación estará disponible en tu dominio de Vercel

## Configuración

### Variables de Entorno

**Para Neon Database:**
- `DATABASE_URL`: URL completa de conexión a Neon (recomendado)

**Para PostgreSQL local:**
- `PORT`: Puerto del servidor (default: 3000)
- `DB_HOST`: Host de PostgreSQL (default: localhost)
- `DB_PORT`: Puerto de PostgreSQL (default: 5432)
- `DB_NAME`: Nombre de la base de datos (default: ip_tracker)
- `DB_USER`: Usuario de PostgreSQL
- `DB_PASSWORD`: Contraseña de PostgreSQL
- `DB_SSL`: Usar SSL (true para Neon, false para local)

**Otras variables:**
- `BACKEND_URL`: URL pública del backend (importante para Raspberry Pi)

### Base de Datos

El archivo `schema.sql` contiene:
- Tablas para dispositivos, logs de IP y estado
- Índices para mejor rendimiento
- Triggers automáticos para actualizar estado
- Vistas para consultas optimizadas
- Funciones para limpieza automática

## API Endpoints

### Registrar dispositivo
```
POST /api/devices/register
Content-Type: application/json

{
  "device_name": "raspberrypi-01",
  "device_type": "raspberry_pi",
  "mac_address": "00:11:22:33:44:55",
  "description": "Dispositivo principal"
}
```

### Ping de IP (usado por Raspberry Pi)
```
POST /api/devices/ping
Content-Type: application/json

{
  "device_id": "uuid-del-dispositivo",
  "local_ip": "192.168.1.100",
  "public_ip": "203.0.113.1",
  "port": 22
}
```

### Obtener todos los dispositivos
```
GET /api/devices/
```

### Obtener dispositivo específico
```
GET /api/devices/{device_id}
```

### Health check
```
GET /health
```

## Estructura del Proyecto

```
Backend/
├── server.js              # Servidor principal
├── package.json           # Dependencias
├── schema.sql             # Schema de PostgreSQL
├── .env.example           # Ejemplo de configuración
├── config/
│   └── database.js        # Configuración de BD
└── routes/
    └── devices.js         # Rutas de dispositivos
```

## Seguridad

- Rate limiting configurado
- Helmet para headers de seguridad
- CORS habilitado
- Validación de entrada
- Manejo de errores

## Monitoreo

- Logs de todas las queries
- Timestamps en todos los registros
- Estado de conexión de dispositivos
- Métricas de uptime

## Para Raspberry Pi

Usar los scripts incluidos:
- `ip-ping.sh`: Script para enviar ping cada 5 minutos
- `install-service.sh`: Instalar como servicio systemd

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Eres libre de usar, modificar y distribuir este software.

**Copyright (c) 2025 Andres Azcona**

---

<div align="center">

**Hecho con ❤️ por [Andres Azcona](https://github.com/andresazcona)**

⭐️ Si este proyecto te fue útil, considera darle una estrella en GitHub

</div>