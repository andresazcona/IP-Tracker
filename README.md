# 🌐 IP Tracker - Sistema de Monitoreo de Dispositivos IP

[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Sistema completo para el monitoreo y gestión de dispositivos IP, especialmente diseñado para Raspberry Pi y dispositivos IoT. Incluye autenticación JWT, gestión de usuarios, asignación de dispositivos y registro de actividad en tiempo real.

## 📋 Características

### 🔐 Autenticación y Seguridad
- Sistema de autenticación JWT con tokens de acceso y refresh
- Gestión completa de usuarios con roles (Admin, Manager, User, Viewer)
- Control de permisos granular basado en recursos y acciones
- Registro de auditoría de todas las acciones del sistema

### 📱 Gestión de Dispositivos
- Registro automático de dispositivos mediante pings periódicos
- Seguimiento de IP pública, local y red WiFi
- Monitoreo del estado (online/offline) en tiempo real
- Historial completo de cambios de IP
- Soporte para múltiples tipos de dispositivos

### 👥 Gestión de Usuarios
- CRUD completo de usuarios
- Sistema de roles y permisos configurables
- Asignación de dispositivos a usuarios
- Panel de administración intuitivo

### 📊 Monitoreo y Reportes
- Dashboard con información en tiempo real
- Estadísticas de conectividad y uptime
- Logs de actividad y cambios de IP
- Detección automática de dispositivos offline

### 🐳 Contenerización
- Arquitectura completamente dockerizada
- Despliegue con un solo comando
- Base de datos PostgreSQL persistente
- Frontend servido con Nginx optimizado

## 🚀 Inicio Rápido

### Prerrequisitos

- [Docker](https://www.docker.com/get-started) (versión 20.10 o superior)
- [Docker Compose](https://docs.docker.com/compose/install/) (versión 2.0 o superior)

### Instalación y Despliegue

1. **Clonar el repositorio**
```bash
git clone https://github.com/tu-usuario/IP-Tracker.git
cd IP-Tracker
```

2. **Configurar variables de entorno**
```bash
cp .env.example .env
```

Edita el archivo `.env` con tus valores:
```env
DB_NAME=ip_tracker
DB_USER=postgres
DB_PASSWORD=tu_contraseña_segura
JWT_SECRET=tu_secreto_jwt_minimo_32_caracteres
JWT_EXPIRES_IN=24h
```

3. **Levantar los contenedores**
```bash
docker-compose up -d --build
```

4. **Acceder a la aplicación**
- **Frontend**: http://localhost
- **Backend API**: http://localhost:3000
- **Credenciales por defecto**: `admin` / `admin`

¡Eso es todo! La aplicación estará corriendo con la base de datos inicializada y lista para usar.

## 📦 Arquitectura del Proyecto

```
IP-Tracker/
├── Backend/              # API REST con Node.js + Express
│   ├── config/          # Configuración de CORS, DB, inicialización
│   ├── middleware/      # Autenticación JWT, validaciones
│   ├── routes/          # Endpoints (auth, users, devices, assignments)
│   ├── sql/             # Schemas y migraciones de PostgreSQL
│   └── Dockerfile       # Imagen Docker del backend
│
├── Frontend/            # SPA con React + TypeScript + Vite
│   ├── src/
│   │   ├── components/  # Componentes React (Dashboard, Login, etc.)
│   │   ├── contexts/    # Context API (AuthContext)
│   │   ├── services/    # API client con Axios
│   │   ├── styles/      # CSS modules
│   │   └── types/       # TypeScript definitions
│   ├── Dockerfile       # Build multi-stage con Nginx
│   └── nginx.conf       # Configuración Nginx para SPA
│
└── docker-compose.yml   # Orquestación de servicios
```

## 🔧 Tecnologías Utilizadas

### Backend
- **Node.js 20** - Runtime de JavaScript
- **Express** - Framework web
- **PostgreSQL 15** - Base de datos relacional
- **JWT** - Autenticación segura
- **bcrypt** - Hash de contraseñas
- **Helmet** - Seguridad HTTP
- **CORS** - Control de acceso cross-origin

### Frontend
- **React 19** - Biblioteca UI
- **TypeScript** - Tipado estático
- **Vite** - Build tool rápido
- **Axios** - Cliente HTTP
- **React Router** - Navegación SPA
- **Lucide React** - Iconos modernos

### DevOps
- **Docker** - Contenerización
- **Docker Compose** - Orquestación multi-contenedor
- **Nginx** - Servidor web para frontend
- **Alpine Linux** - Imágenes base ligeras

## 📚 Documentación de la API

### Endpoints Principales

#### 🔐 Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `POST /api/auth/refresh` - Renovar token
- `GET /api/auth/me` - Obtener usuario actual

#### 👥 Usuarios
- `GET /api/users` - Listar usuarios (paginado)
- `POST /api/users` - Crear usuario
- `GET /api/users/:id` - Obtener usuario
- `PUT /api/users/:id` - Actualizar usuario
- `DELETE /api/users/:id` - Eliminar usuario

#### 📱 Dispositivos
- `GET /api/devices` - Listar dispositivos
- `POST /api/devices` - Registrar dispositivo
- `GET /api/devices/:id` - Obtener dispositivo
- `PUT /api/devices/:id` - Actualizar dispositivo
- `DELETE /api/devices/:id` - Eliminar dispositivo
- `POST /api/devices/:id/ping` - Registrar ping (actualizar IP)

#### 🔗 Asignaciones
- `GET /api/assignments` - Listar asignaciones
- `POST /api/assignments` - Asignar dispositivo a usuario
- `DELETE /api/assignments/:id` - Desasignar dispositivo

Para documentación completa de la API, consulta [Backend/README.md](Backend/README.md)

## 🐳 Comandos Docker Útiles

### Ver logs
```bash
# Todos los servicios
docker-compose logs -f

# Servicio específico
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres
```

### Gestión de contenedores
```bash
# Ver estado
docker-compose ps

# Reiniciar servicio
docker-compose restart backend

# Detener todo
docker-compose down

# Detener y eliminar volúmenes (⚠️ BORRA LA BD)
docker-compose down -v

# Reconstruir
docker-compose up -d --build
```

### Acceso a la base de datos
```bash
docker-compose exec postgres psql -U postgres -d ip_tracker
```

### Backup de la base de datos
```bash
docker-compose exec postgres pg_dump -U postgres ip_tracker > backup.sql
```

## 🔒 Seguridad

### Consideraciones Importantes

1. **Cambiar contraseñas por defecto** antes de producción
2. **Usar secretos JWT fuertes** (mínimo 32 caracteres)
3. **Configurar HTTPS** con certificados SSL válidos
4. **No exponer PostgreSQL** públicamente (comentar puertos en docker-compose.yml)
5. **Actualizar dependencias** regularmente
6. **Revisar logs de auditoría** periódicamente

### Variables de Entorno Sensibles

Nunca subas al repositorio:
- ❌ `.env`
- ❌ Claves privadas
- ❌ Contraseñas en texto plano
- ❌ Tokens de acceso

## 🧪 Desarrollo

### Ejecutar en modo desarrollo (sin Docker)

#### Backend
```bash
cd Backend
npm install
npm run dev
```

#### Frontend
```bash
cd Frontend
npm install
npm run dev
```

### Estructura de la Base de Datos

El schema incluye:
- ✅ Usuarios con roles y permisos
- ✅ Dispositivos con tracking de IP
- ✅ Historial de logs (ip_logs)
- ✅ Estado de dispositivos (device_status)
- ✅ Asignaciones usuario-dispositivo
- ✅ Tokens de refresh
- ✅ Logs de auditoría
- ✅ Triggers automáticos para actualización de estado
- ✅ Funciones PL/pgSQL para limpieza y mantenimiento

## 📊 Modelo de Datos

```
┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│    roles    │───┐   │    users     │───┐   │   devices   │
└─────────────┘   │   └──────────────┘   │   └─────────────┘
                  │           │           │           │
                  │           │           │           │
                  │           ▼           │           ▼
                  │   ┌──────────────┐   │   ┌─────────────┐
                  └──▶│ refresh_     │   └──▶│  ip_logs    │
                      │   tokens     │       └─────────────┘
                      └──────────────┘               │
                                                     ▼
              ┌─────────────────┐          ┌─────────────┐
              │ user_device_    │          │   device_   │
              │  assignments    │          │   status    │
              └─────────────────┘          └─────────────┘
```

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Roadmap

- [ ] Notificaciones por email cuando un dispositivo cae
- [ ] API webhooks para integración con otros sistemas
- [ ] Soporte para múltiples organizaciones
- [ ] Dashboard con gráficos de analytics
- [ ] Exportación de reportes en PDF/Excel
- [ ] App móvil para monitoreo remoto
- [ ] Integración con sistemas de alertas (Slack, Discord)
- [ ] Autenticación con OAuth2 (Google, GitHub)

## 🐛 Reportar Problemas

Si encuentras un bug o tienes una sugerencia, por favor abre un [issue](https://github.com/tu-usuario/IP-Tracker/issues) en GitHub.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para más detalles.

## 👏 Agradecimientos

- Inspirado en la necesidad de monitoreo de dispositivos IoT
- Construido con tecnologías open source
- Comunidad de desarrolladores

## 📞 Contacto

- **GitHub**: [@tu-usuario](https://github.com/tu-usuario)
- **Issues**: [GitHub Issues](https://github.com/tu-usuario/IP-Tracker/issues)

---

<div align="center">

**Desarrollado con ❤️ para la comunidad**

⭐️ Si este proyecto te fue útil, considera darle una estrella en GitHub

</div>
