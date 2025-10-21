import axios from 'axios';
import type {
  Device,
  ApiHealth,
  AuthResponse,
  LoginCredentials,
  User,
  RegisterData,
  Assignment,
  PaginatedResponse,
  DeviceStats,
  AssignmentStats
} from '../types/Device';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
export const AUTH_TOKEN_KEY = import.meta.env.VITE_AUTH_TOKEN_KEY || 'ip_tracker_auth_token';
export const REFRESH_TOKEN_KEY = import.meta.env.VITE_REFRESH_TOKEN_KEY || 'ip_tracker_refresh_token';

const INVALID_TOKEN_VALUES = new Set(['', 'undefined', 'null', 'none', 'false', '0', 'nan', '[object object]']);

const sanitizeStoredToken = (rawValue: string | null, storageKey: string): string | undefined => {
  if (typeof rawValue !== 'string') {
    return undefined;
  }

  const normalized = rawValue.trim();

  if (!normalized || INVALID_TOKEN_VALUES.has(normalized.toLowerCase())) {
    localStorage.removeItem(storageKey);
    return undefined;
  }

  return normalized;
};

export const getStoredAccessToken = (): string | undefined =>
  sanitizeStoredToken(localStorage.getItem(AUTH_TOKEN_KEY), AUTH_TOKEN_KEY);

export const getStoredRefreshToken = (): string | undefined =>
  sanitizeStoredToken(localStorage.getItem(REFRESH_TOKEN_KEY), REFRESH_TOKEN_KEY);



const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as (typeof error.config & { _retry?: boolean }) | undefined;



    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = getStoredRefreshToken();
        if (refreshToken) {
          const response = await axios.post(`${API_BASE_URL}/api/auth/refresh`, { refreshToken });

          const { accessToken, refreshToken: newRefreshToken } = response.data;
          if (accessToken) {
            localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
          }
          if (newRefreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, newRefreshToken);
          }

          if (!originalRequest.headers) {
            originalRequest.headers = {};
          }
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Token refresh failed
      }

      if (originalRequest?.url && (originalRequest.url.includes('/stats') || originalRequest.url.includes('/admin'))) {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
      }
    }

    return Promise.reject(error);
  }
);

const resolveString = (...values: Array<unknown>): string | undefined => {
  for (const value of values) {
    if (typeof value !== 'string') {
      continue;
    }
    const normalized = value.trim();
    if (!normalized || INVALID_TOKEN_VALUES.has(normalized.toLowerCase())) {
      continue;
    }
    return normalized;
  }
  return undefined;
};

const resolveNumber = (...values: Array<unknown>): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
};

const extractAuthResponse = (payload: any): Partial<AuthResponse> & { user?: User } => {
  const responseData = payload ?? {};
  

  
  // La respuesta real del backend es:
  // { "message": "Login successful", "user": {...}, "tokens": { "accessToken": "...", "refreshToken": "..." } }
  
  const tokensObject = responseData.tokens || {};
  
  const accessToken = resolveString(
    responseData.accessToken,
    responseData.access_token,
    tokensObject.accessToken,
    tokensObject.access_token
  );

  const refreshToken = resolveString(
    responseData.refreshToken,
    responseData.refresh_token,
    tokensObject.refreshToken,
    tokensObject.refresh_token
  );

  const expiresIn = resolveNumber(
    responseData.expiresIn,
    responseData.expires_in,
    tokensObject.expiresIn,
    tokensObject.expires_in,
    3600 // Default fallback
  );

  const user = responseData.user;
  
  return { accessToken, refreshToken, expiresIn, user };
};

export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await api.post('/api/auth/login', credentials);

      const { accessToken, refreshToken, expiresIn, user } = extractAuthResponse(response.data);

      if (accessToken) {
        localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        } else {
          localStorage.removeItem(REFRESH_TOKEN_KEY);
        }

        const resolvedUser = (user as User) ?? response.data.user;
        if (!resolvedUser) {
          throw new Error('No user payload received from API');
        }

        return {
          accessToken,
          refreshToken: refreshToken ?? '',
          expiresIn: expiresIn ?? 0,
          user: resolvedUser as User,
        };
      }

      throw new Error('No access token received from API');
    } catch (error: any) {
      if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
        return this.loginLocal(credentials);
      }
      throw new Error(error.response?.data?.message || 'Error al iniciar sesion');
    }
  },

  async verifyToken(): Promise<{ valid: boolean; user?: User }> {
    try {
      const response = await api.get('/api/auth/profile');
      return { valid: true, user: response.data };
    } catch (error) {
      return { valid: false };
    }
  },

  async loginLocal(credentials: LoginCredentials): Promise<AuthResponse> {
    const defaultUsername = import.meta.env.VITE_DEFAULT_USERNAME || 'admin';
    const defaultPassword = import.meta.env.VITE_DEFAULT_PASSWORD || 'admin123';

    const isValid = (
      credentials.username_or_email === defaultUsername &&
      credentials.password === defaultPassword
    );

    if (!isValid) {
      throw new Error('Usuario o contrasena incorrectos');
    }

    const token = `local-token-${Date.now()}`;
    const refreshToken = `local-refresh-${Date.now()}`;
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    const user: User = {
      id: '1',
      username: defaultUsername,
      email: 'admin@localhost',
      first_name: 'Admin',
      last_name: 'User',
      role_id: 'admin-role',
      role: {
        id: 'admin-role',
        name: 'admin',
        display_name: 'Administrador',
        permissions: [
          { id: '1', name: 'users.read', resource: 'users', action: 'read' },
          { id: '2', name: 'users.create', resource: 'users', action: 'create' },
          { id: '3', name: 'users.update', resource: 'users', action: 'update' },
          { id: '4', name: 'users.delete', resource: 'users', action: 'delete' },
          { id: '5', name: 'devices.read', resource: 'devices', action: 'read' },
          { id: '6', name: 'devices.create', resource: 'devices', action: 'create' },
          { id: '7', name: 'devices.update', resource: 'devices', action: 'update' },
          { id: '8', name: 'devices.delete', resource: 'devices', action: 'delete' },
          { id: '9', name: 'assignments.read', resource: 'assignments', action: 'read' },
          { id: '10', name: 'assignments.create', resource: 'assignments', action: 'create' },
          { id: '11', name: 'assignments.update', resource: 'assignments', action: 'update' },
          { id: '12', name: 'assignments.delete', resource: 'assignments', action: 'delete' },
        ],
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    return {
      accessToken: token,
      refreshToken,
      expiresIn: 3600,
      user,
    };
  },

  async register(data: RegisterData): Promise<AuthResponse> {
    const response = await api.post('/api/auth/register', data);
    const { accessToken, refreshToken, expiresIn, user } = extractAuthResponse(response.data);

    if (accessToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, accessToken);
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }

    return {
      accessToken: accessToken ?? '',
      refreshToken: refreshToken ?? '',
      expiresIn: expiresIn ?? 0,
      user: (user as User) ?? response.data.user,
    };
  },

  async logout(): Promise<void> {
    const refreshToken = getStoredRefreshToken();
    try {
      if (refreshToken) {
        await api.post('/api/auth/logout', { refreshToken });
      }
    } catch (error) {
      // Ignore logout errors
    } finally {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
    }
  },

  async getProfile(): Promise<User> {
    try {
      const response = await api.get('/api/auth/profile');
      return response.data.user;
    } catch (error) {
      const token = getStoredAccessToken();
      if (token && token.startsWith('local-token-')) {
        return {
          id: '1',
          username: 'admin',
          email: 'admin@localhost',
          first_name: 'Admin',
          last_name: 'User',
          role_id: 'admin-role',
          role: 'admin',
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      throw error;
    }
  },

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await api.put('/api/auth/profile', data);
    return response.data.user;
  },

  async changePassword(data: { current_password: string; new_password: string }): Promise<void> {
    await api.put('/api/auth/change-password', data);
  },

  isAuthenticated(): boolean {
    return !!getStoredAccessToken();
  },
};

const normalisePaginatedResponse = <T>(
  data: any,
  fallbackItems: T[],
  params?: { page?: number; limit?: number }
): PaginatedResponse<T> => {
  if (data && Array.isArray(data.items)) {
    return {
      items: data.items,
      total: data.total ?? data.items.length,
      page: data.page ?? params?.page ?? 1,
      limit: data.limit ?? params?.limit ?? data.items.length,
      totalPages: data.totalPages,
    };
  }

  if (data && Array.isArray(data.data)) {
    return {
      items: data.data,
      total: data.total ?? data.data.length,
      page: data.page ?? params?.page ?? 1,
      limit: data.limit ?? params?.limit ?? data.data.length,
    };
  }

  if (data && Array.isArray(data.users)) {
    return {
      items: data.users,
      total: data.total ?? data.users.length,
      page: data.page ?? params?.page ?? 1,
      limit: data.limit ?? params?.limit ?? data.users.length,
    };
  }

  return {
    items: fallbackItems,
    total: data?.total ?? fallbackItems.length,
    page: params?.page ?? 1,
    limit: params?.limit ?? fallbackItems.length,
  };
};

export const userService = {
  async getUsers(params?: {
    page?: number;
    limit?: number;
    q?: string;
    role?: string;
  }): Promise<PaginatedResponse<User>> {
    const response = await api.get('/api/users', { params });
    const payload = response.data;

    if (Array.isArray(payload)) {
      return normalisePaginatedResponse<User>(response.data, payload, params);
    }

    if (Array.isArray(payload.items)) {
      return normalisePaginatedResponse<User>(payload, payload.items, params);
    }

    if (Array.isArray(payload.users)) {
      return normalisePaginatedResponse<User>(payload, payload.users, params);
    }

    return normalisePaginatedResponse<User>(payload, [], params);
  },

  async createUser(data: RegisterData): Promise<User> {
    try {
      const response = await api.post('/api/users', data);
      return response.data;
    } catch (error: any) {
      // Manejar errores de validación específicos
      if (error.response?.status === 400 && error.response?.data?.details) {
        const validationDetails = error.response.data.details;
        // Extraer mensajes de validación específicos
        const validationMessages = validationDetails.map((detail: any) => {
          if (detail.path && detail.msg) {
            return `${detail.path}: ${detail.msg}`;
          }
          if (detail.path && detail.message) {
            return `${detail.path}: ${detail.message}`;
          }
          if (detail.field && detail.message) {
            return `${detail.field}: ${detail.message}`;
          }
          if (detail.msg) {
            return detail.msg;
          }
          if (detail.message) {
            return detail.message;
          }
          if (typeof detail === 'string') {
            return detail;
          }
          return JSON.stringify(detail);
        }).join(', ');
        
        throw new Error(`Errores de validación: ${validationMessages}`);
      }
      
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'Error desconocido al crear usuario';
      throw new Error(`Error al crear usuario: ${errorMessage}`);
    }
  },

  async getUser(id: string): Promise<User> {
    try {
      const response = await api.get(`/api/users/${id}`);
      return response.data;
    } catch (error) {
      throw new Error('Error al obtener usuario');
    }
  },

  async updateUser(id: string, data: Partial<User>): Promise<User> {
    try {
      const response = await api.put(`/api/users/${id}`, data);
      return response.data;
    } catch (error) {
      throw new Error('Error al actualizar usuario');
    }
  },

  async deleteUser(id: string): Promise<void> {
    try {
      await api.delete(`/api/users/${id}`);
    } catch (error) {
      throw new Error('Error al eliminar usuario');
    }
  },

  async getUserDevices(id: string): Promise<Device[]> {
    try {
      const response = await api.get(`/api/users/${id}/devices`);
      return response.data || [];
    } catch (error) {
      throw new Error('Error al obtener dispositivos del usuario');
    }
  },
};

export const roleService = {
  async getRoles(): Promise<Array<{id: string; name: string; display_name: string}>> {
    try {
      // Intentar obtener roles del backend
      const response = await api.get('/api/roles');
      return response.data.items || response.data || [];
    } catch (error) {
      // Roles reales del backend con UUIDs correctos
      return [
        { id: '1b4f708f-1839-4690-9f38-c314a4b54905', name: 'admin', display_name: 'Administrador' },
        { id: 'f2872717-7783-45d9-af05-2959521a93e6', name: 'manager', display_name: 'Manager' },
        { id: 'a2748b39-637d-43e0-b1e9-6c532510eb7c', name: 'user', display_name: 'Usuario' },
        { id: 'c74b5d38-e673-4f0c-8841-b3c58a3ae06f', name: 'viewer', display_name: 'Visualizador' }
      ];
    }
  }
};



export const deviceService = {
  async getDevices(params?: {
    q?: string;
    status?: string;
    type?: string;
    location?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Device>> {
    try {
      const response = await api.get('/api/devices', { params });
      // Manejar diferentes formatos de respuesta
      let items: Device[] = [];
      let total = 0;
      let page = 1;
      let limit = 20;
      
      if (Array.isArray(response.data)) {
        items = response.data;
        total = response.data.length;
        limit = response.data.length;
      } else if (response.data.items && Array.isArray(response.data.items)) {
        items = response.data.items;
        total = response.data.total || response.data.items.length;
        page = response.data.page || 1;
        limit = response.data.limit || 20;
      } else if (response.data.devices && Array.isArray(response.data.devices)) {
        items = response.data.devices;
        total = response.data.total || response.data.devices.length;
        page = response.data.page || 1;
        limit = response.data.limit || 20;
      } else if (response.data.data && Array.isArray(response.data.data)) {
        items = response.data.data;
        total = response.data.total || response.data.data.length;
        page = response.data.page || 1;
        limit = response.data.limit || 20;
      } else {
        // Buscar cualquier array en la respuesta
        const possibleArrays = Object.values(response.data).filter(Array.isArray);
        if (possibleArrays.length > 0) {
          items = possibleArrays[0] as Device[];
          total = items.length;
        }
      }
      
      const result = { items, total, page, limit };
      return result;
    } catch (error: any) {
      throw new Error('Error al obtener dispositivos');
    }
  },

  async getDevice(id: string): Promise<Device> {
    try {
      const response = await api.get(`/api/devices/${id}`);
      return response.data;
    } catch (error) {
      throw new Error('Error al obtener dispositivo');
    }
  },

  async createDevice(data: Partial<Device>): Promise<Device> {
    try {
      const response = await api.post('/api/devices', data);
      return response.data;
    } catch (error) {
      throw new Error('Error al crear dispositivo');
    }
  },

  async updateDevice(id: string, data: Partial<Device>): Promise<Device> {
    try {
      const response = await api.put(`/api/devices/${id}`, data);
      return response.data;
    } catch (error) {
      throw new Error('Error al actualizar dispositivo');
    }
  },

  async deleteDevice(id: string): Promise<void> {
    try {
      await api.delete(`/api/devices/${id}`);
    } catch (error) {
      throw new Error('Error al eliminar dispositivo');
    }
  },

  async getDevicesSummary(): Promise<any> {
    try {
      const response = await api.get('/api/devices/stats/overview');
      return response.data;
    } catch (error) {
      throw new Error('Error al obtener resumen de dispositivos');
    }
  },

  async getDevicesStats(): Promise<DeviceStats> {
    try {
      const response = await api.get('/api/devices/stats/overview');
      return response.data;
    } catch (error) {
      // Retornar estadísticas vacías en caso de error del backend
      return {
        total: 0,
        online: 0,
        offline: 0,
        maintenance: 0,
        byType: {},
        byLocation: {},
        recentPings: 0,
      } as DeviceStats;
    }
  },

  async getPotentiallyOfflineDevices(): Promise<Device[]> {
    try {
      const response = await api.get('/api/devices/status/potentially-offline');
      return response.data.devices ?? response.data ?? [];
    } catch (error) {
      const response = await api.get('/devices/status/potentially-offline');
      return response.data.devices ?? response.data ?? [];
    }
  },

  async registerDevice(deviceData: any): Promise<any> {
    try {
      const response = await api.post('/api/devices/register', deviceData);
      return response.data;
    } catch (error) {
      const response = await api.post('/devices/register', deviceData);
      return response.data;
    }
  },

  async pingDevice(deviceData: any): Promise<any> {
    try {
      const response = await api.post('/api/devices/ping', deviceData);
      return response.data;
    } catch (error) {
      const response = await api.post('/devices/ping', deviceData);
      return response.data;
    }
  },

  async checkOfflineDevices(): Promise<any> {
    try {
      const response = await api.post('/api/devices/check-offline');
      return response.data;
    } catch (error) {
      const response = await api.post('/devices/check-offline');
      return response.data;
    }
  },

  async checkDeviceOffline(id: string): Promise<any> {
    try {
      const response = await api.post(`/api/devices/${id}/check-offline`);
      return response.data;
    } catch (error) {
      const response = await api.post(`/devices/${id}/check-offline`);
      return response.data;
    }
  },
};

export const assignmentService = {
  async getAssignments(params?: {
    user_id?: string;
    device_id?: string;
    active?: boolean;
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Assignment>> {
    const response = await api.get('/api/assignments', { params });
    const payload = response.data;

    if (Array.isArray(payload)) {
      return normalisePaginatedResponse<Assignment>(payload, payload, params);
    }

    if (Array.isArray(payload.assignments)) {
      return normalisePaginatedResponse<Assignment>(payload, payload.assignments, params);
    }

    return normalisePaginatedResponse<Assignment>(payload, payload.items ?? [], params);
  },

  async createAssignment(data: {
    user_id: string;
    device_id: string;
    notes?: string;
  }): Promise<Assignment> {
    try {
      const response = await api.post('/api/assignments', data);
      return response.data;
    } catch (error) {
      throw new Error('Error al crear asignación');
    }
  },

  async createBulkAssignments(data: {
    assignments: Array<{
      user_id: string;
      device_id: string;
      notes?: string;
    }>;
  }): Promise<any> {
    try {
      const response = await api.post('/api/assignments/bulk', data);
      return response.data;
    } catch (error) {
      throw new Error('Error al crear asignaciones');
    }
  },

  async getAssignment(id: string): Promise<Assignment> {
    try {
      const response = await api.get(`/api/assignments/${id}`);
      return response.data;
    } catch (error) {
      throw new Error('Error al obtener asignación');
    }
  },

  async updateAssignment(id: string, data: {
    is_active?: boolean;
    notes?: string;
  }): Promise<Assignment> {
    try {
      const response = await api.put(`/api/assignments/${id}`, data);
      return response.data;
    } catch (error) {
      throw new Error('Error al actualizar asignación');
    }
  },

  async deleteAssignment(id: string): Promise<void> {
    try {
      await api.delete(`/api/assignments/${id}`);
    } catch (error) {
      throw new Error('Error al eliminar asignación');
    }
  },

  async getAssignmentsStats(): Promise<AssignmentStats> {
    try {
      const response = await api.get('/api/assignments/stats/overview');
      return response.data;
    } catch (error) {
      // Retornar estadísticas vacías en caso de error del backend
      return {
        total: 0,
        active: 0,
        inactive: 0,
        byUser: {},
        byDevice: {},
        recentAssignments: 0,
      } as AssignmentStats;
    }
  },
};

export const healthService = {
  async getHealth(): Promise<ApiHealth> {
    try {
      await api.get('/api/devices', { params: { limit: 1 } });
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
      };
    }
  },

  async corsTest(): Promise<any> {
    const response = await axios.get('https://backend-ipservice.vercel.app/cors-test');
    return response.data;
  },

  async corsInfo(): Promise<any> {
    const response = await axios.get('https://backend-ipservice.vercel.app/cors-info');
    return response.data;
  },
};

export default api;




