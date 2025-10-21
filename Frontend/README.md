# IP Tracker - Frontend# IP Tracker - Frontend



Sistema de Monitoreo de Dispositivos IP construido con React + TypeScript + Vite.Sistema de Monitoreo de Dispositivos IP construido con React + TypeScript + Vite.



## Características## Características



- **Dashboard en tiempo real** con monitoreo de dispositivos IP

- **Interfaz moderna** con diseño limpio y profesional

- **Responsive design** adaptable a dispositivos móviles- **Dashboard en tiempo real** con monitoreo de dispositivos IP- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh

- **Auto-refresh** cada 30 segundos

- **Filtros dinámicos** (todos/activos/inactivos)- **Interfaz moderna** inspirada en el diseño de Vercel- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

- **Modal de detalles** para información completa de dispositivos

- **Autenticación JWT** con roles y permisos- **Responsive design** adaptable a dispositivos móviles

- **Gestión de usuarios** y dispositivos

- **Auto-refresh** cada 30 segundos## Expanding the ESLint configuration

## Tecnologías

- **Filtros dinámicos** (todos/activos/inactivos)

- **React 19** + TypeScript

- **Vite** como bundler y dev server- **Modal de detalles** para información completa de dispositivosIf you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

- **CSS Vanilla** con variables CSS

- **Lucide React** para iconos

- **Axios** para llamadas API

- **React Router** para navegación## Tecnologías```js



## Instalaciónexport default defineConfig([



```bash- **React 18** + TypeScript  globalIgnores(['dist']),

# Instalar dependencias

npm install- **Vite** como bundler  {



# Desarrollo- **CSS Vanilla** con variables CSS    files: ['**/*.{ts,tsx}'],

npm run dev

- **Lucide React** para iconos    extends: [

# Build para producción

npm run build- **Axios** para llamadas API      // Other configs...



# Preview del build

npm run preview

```## Instalación      // Remove tseslint.configs.recommended and replace with this



## Configuración      tseslint.configs.recommendedTypeChecked,



### Variables de Entorno```bash      // Alternatively, use this for stricter rules



Crea un archivo `.env` en la raíz del proyecto:# Clonar el repositorio      tseslint.configs.strictTypeChecked,



```envgit clone <repository-url>      // Optionally, add this for stylistic rules

# URL de la API

VITE_API_BASE_URL=http://localhost:3000cd Frontend      tseslint.configs.stylisticTypeChecked,



# Credenciales por defecto

VITE_DEFAULT_USERNAME=admin

VITE_DEFAULT_PASSWORD=admin# Instalar dependencias      // Other configs...



# Configuración de autenticaciónnpm install    ],

VITE_AUTH_TOKEN_KEY=ip_tracker_auth_token

VITE_REFRESH_TOKEN_KEY=ip_tracker_refresh_token    languageOptions: {



# Timeouts y refresh# Configurar variables de entorno      parserOptions: {

VITE_SESSION_TIMEOUT=20

VITE_REFRESH_INTERVAL=30000cp .env.example .env        project: ['./tsconfig.node.json', './tsconfig.app.json'],



# Branding# Editar .env con tu configuración        tsconfigRootDir: import.meta.dirname,

VITE_APP_NAME=IP Tracker

VITE_APP_SUBTITLE=Sistema de Monitoreo de Dispositivos IP      },

```

# Ejecutar en desarrollo      // other options...

### Tabla de Variables

npm run dev    },

| Variable | Descripción | Valor por defecto |

|----------|-------------|-------------------|```  },

| `VITE_API_BASE_URL` | URL base de la API | `http://localhost:3000` |

| `VITE_DEFAULT_USERNAME` | Usuario por defecto | `admin` |])

| `VITE_DEFAULT_PASSWORD` | Contraseña por defecto | `admin` |

| `VITE_AUTH_TOKEN_KEY` | Key para token de auth | `ip_tracker_auth_token` |## Despliegue en Vercel```

| `VITE_SESSION_TIMEOUT` | Timeout de sesión (min) | `20` |

| `VITE_REFRESH_INTERVAL` | Intervalo de refresh (ms) | `30000` |

| `VITE_APP_NAME` | Nombre de la aplicación | `IP Tracker` |

| `VITE_APP_SUBTITLE` | Subtítulo de la app | `Sistema de Monitoreo de Dispositivos IP` |### Método 1: Desde GitHubYou can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:



## Estructura del Proyecto1. Conecta tu repositorio a Vercel



```2. Configura las variables de entorno en el dashboard de Vercel:```js

src/

├── components/          # Componentes React   - `VITE_API_BASE_URL`: URL de tu API backend// eslint.config.js

│   ├── Dashboard.tsx           # Dashboard principal

│   ├── LoginForm.tsx           # Formulario de login   - `VITE_DEFAULT_USERNAME`: Usuario por defectoimport reactX from 'eslint-plugin-react-x'

│   ├── DeviceCard.tsx          # Card de dispositivo

│   ├── DeviceDetailsModal.tsx  # Modal de detalles   - `VITE_DEFAULT_PASSWORD`: Contraseña por defectoimport reactDom from 'eslint-plugin-react-dom'

│   ├── UserManagement.tsx      # Gestión de usuarios

│   ├── DeviceManagement.tsx    # Gestión de dispositivos

│   └── AdminDashboard.tsx      # Panel de administración

│### Método 2: CLI de Vercelexport default defineConfig([

├── contexts/            # React Context

│   └── AuthContext.tsx         # Contexto de autenticación```bash  globalIgnores(['dist']),

│

├── services/            # Servicios API# Instalar CLI de Vercel  {

│   └── api.ts                  # Cliente Axios configurado

│npm i -g vercel    files: ['**/*.{ts,tsx}'],

├── types/               # TypeScript types

│   └── Device.ts               # Interfaces y tipos    extends: [

│

├── styles/              # CSS# Hacer login      // Other configs...

│   ├── index.css               # Estilos globales

│   ├── Dashboard.css           # Estilos del dashboardvercel login      // Enable lint rules for React

│   ├── Login.css               # Estilos del login

│   └── Modal.css               # Estilos de modales      reactX.configs['recommended-typescript'],

│

├── App.tsx              # Componente principal# Desplegar      // Enable lint rules for React DOM

└── main.tsx             # Entry point

```vercel --prod      reactDom.configs.recommended,

```    ],

## Características Principales    languageOptions: {



### Autenticación## Variables de Entorno      parserOptions: {

- Login con JWT

- Refresh token automático| Variable | Descripción | Valor por Defecto |        tsconfigRootDir: import.meta.dirname,

- Manejo de sesiones

- Roles y permisos```    ],



### Dashboard    languageOptions: {

- Vista de todos los dispositivos

- Estado en tiempo real (online/offline)## Variables de Entorno      parserOptions: {

- Filtros por estado

- Auto-refresh configurable        project: ['./tsconfig.node.json', './tsconfig.app.json'],



### Gestión de Dispositivos| Variable | Descripción | Valor por Defecto |        tsconfigRootDir: import.meta.dirname,

- Crear, editar y eliminar dispositivos

- Ver detalles completos|----------|-------------|-------------------|      },

- Historial de IPs

- Asignar a usuarios| `VITE_API_BASE_URL` | URL base de la API | `https://srausiplogger.vercel.app` |      // other options...



### Gestión de Usuarios| `VITE_DEFAULT_USERNAME` | Usuario por defecto | `SRAUS` |    },

- CRUD completo de usuarios

- Asignación de roles| `VITE_DEFAULT_PASSWORD` | Contraseña por defecto | `semillero2025` |  },

- Permisos granulares

| `VITE_AUTH_TOKEN_KEY` | Key para token de auth | `ip_tracker_auth_token` |

## Docker| `VITE_SESSION_TIMEOUT` | Timeout de sesión (min) | `20` |

| `VITE_REFRESH_INTERVAL` | Intervalo de refresh (ms) | `30000` |

El frontend se construye con un Dockerfile multi-stage:| `VITE_APP_NAME` | Nombre de la aplicación | `IP Tracker` |

| `VITE_APP_SUBTITLE` | Subtítulo de la app | `Sistema de Monitoreo de Dispositivos IP` |

1. **Stage 1 (Builder)**: Instala dependencias y ejecuta el build

2. **Stage 2 (Production)**: Sirve los archivos con Nginx## Credenciales de Acceso



```dockerfile**Usuario:** `admin`  

FROM node:20-alpine AS builder**Contraseña:** `admin`

WORKDIR /app

COPY package*.json ./## 📄 Licencia

RUN npm install

COPY . .Este proyecto está bajo la Licencia MIT. Eres libre de usar, modificar y distribuir este software.

RUN npm run build

**Copyright (c) 2025 Andres Azcona**

FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html---

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80<div align="center">

CMD ["nginx", "-g", "daemon off;"]

```**Hecho con ❤️ por [Andres Azcona](https://github.com/andresazcona)**



## Credenciales de Acceso⭐️ Si este proyecto te fue útil, considera darle una estrella en GitHub



**Usuario:** `admin`  </div>
**Contraseña:** `admin`

> ⚠️ **Importante**: Cambia estas credenciales en producción.

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Eres libre de usar, modificar y distribuir este software.

**Copyright (c) 2025 Andres Azcona**

---

<div align="center">

**Hecho con ❤️ por [Andres Azcona](https://github.com/andresazcona)**

⭐️ Si este proyecto te fue útil, considera darle una estrella en GitHub

</div>
