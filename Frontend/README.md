# SRAUS IP Logger - Frontend# React + TypeScript + Vite



Sistema de Monitoreo de Dispositivos IP desarrollado para SRAUS (Semillero de Robótica).This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.



## 🚀 CaracterísticasCurrently, two official plugins are available:



- **Dashboard en tiempo real** con monitoreo de dispositivos IP- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh

- **Interfaz moderna** inspirada en el diseño de Vercel- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

- **Responsive design** adaptable a dispositivos móviles

- **Auto-refresh** cada 30 segundos## Expanding the ESLint configuration

- **Filtros dinámicos** (todos/activos/inactivos)

- **Modal de detalles** para información completa de dispositivosIf you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:



## 🛠️ Tecnologías```js

export default defineConfig([

- **React 18** + TypeScript  globalIgnores(['dist']),

- **Vite** como bundler  {

- **CSS Vanilla** con variables CSS    files: ['**/*.{ts,tsx}'],

- **Lucide React** para iconos    extends: [

- **Axios** para llamadas API      // Other configs...



## 📦 Instalación      // Remove tseslint.configs.recommended and replace with this

      tseslint.configs.recommendedTypeChecked,

```bash      // Alternatively, use this for stricter rules

# Clonar el repositorio      tseslint.configs.strictTypeChecked,

git clone <repository-url>      // Optionally, add this for stylistic rules

cd Frontend      tseslint.configs.stylisticTypeChecked,



# Instalar dependencias      // Other configs...

npm install    ],

    languageOptions: {

# Configurar variables de entorno      parserOptions: {

cp .env.example .env        project: ['./tsconfig.node.json', './tsconfig.app.json'],

# Editar .env con tu configuración        tsconfigRootDir: import.meta.dirname,

      },

# Ejecutar en desarrollo      // other options...

npm run dev    },

```  },

])

## 🌐 Despliegue en Vercel```



### Método 1: Desde GitHubYou can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

1. Conecta tu repositorio a Vercel

2. Configura las variables de entorno en el dashboard de Vercel:```js

   - `VITE_API_BASE_URL`: URL de tu API backend// eslint.config.js

   - `VITE_DEFAULT_USERNAME`: Usuario por defectoimport reactX from 'eslint-plugin-react-x'

   - `VITE_DEFAULT_PASSWORD`: Contraseña por defectoimport reactDom from 'eslint-plugin-react-dom'



### Método 2: CLI de Vercelexport default defineConfig([

```bash  globalIgnores(['dist']),

# Instalar CLI de Vercel  {

npm i -g vercel    files: ['**/*.{ts,tsx}'],

    extends: [

# Hacer login      // Other configs...

vercel login      // Enable lint rules for React

      reactX.configs['recommended-typescript'],

# Desplegar      // Enable lint rules for React DOM

vercel --prod      reactDom.configs.recommended,

```    ],

    languageOptions: {

## ⚙️ Variables de Entorno      parserOptions: {

        project: ['./tsconfig.node.json', './tsconfig.app.json'],

| Variable | Descripción | Valor por Defecto |        tsconfigRootDir: import.meta.dirname,

|----------|-------------|-------------------|      },

| `VITE_API_BASE_URL` | URL base de la API | `https://srausiplogger.vercel.app` |      // other options...

| `VITE_DEFAULT_USERNAME` | Usuario por defecto | `SRAUS` |    },

| `VITE_DEFAULT_PASSWORD` | Contraseña por defecto | `semillero2025` |  },

| `VITE_AUTH_TOKEN_KEY` | Key para token de auth | `sraus_auth_token` |])

| `VITE_SESSION_TIMEOUT` | Timeout de sesión (min) | `20` |```

| `VITE_REFRESH_INTERVAL` | Intervalo de refresh (ms) | `30000` |
| `VITE_APP_NAME` | Nombre de la aplicación | `SRAUS IP Logger` |
| `VITE_APP_SUBTITLE` | Subtítulo de la app | `Sistema de Monitoreo de Dispositivos IP` |

## 🔐 Credenciales de Acceso

**Usuario:** `SRAUS`  
**Contraseña:** `semillero2025`

## 📄 Licencia

Este proyecto está desarrollado para SRAUS (Semillero de Robótica) - Uso interno.

---

Desarrollado con ❤️ por el equipo de SRAUS