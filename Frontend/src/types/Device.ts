export interface Device {
  id: string;
  device_name: string;
  device_type: string;
  mac_address: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  current_ip: string | null;
  current_public_ip: string | null;
  current_local_ip: string | null;
  current_wifi_network: string | null;
  last_ping: string | null;
  last_online: string | null;
  ping_count: number | null;
  status: 'online' | 'offline' | 'maintenance' | string;
  uptime_percentage: string | null;
  connection_status: 'online' | 'offline' | null;
  serial_number?: string | null;
  model?: string | null;
  location?: string | null;
  notes?: string | null;
  device_status?: string | null;
  name?: string;
  ip?: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role_id: string;
  role?: Role | string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: string;
  name: string;
  display_name: string;
  permissions: Permission[];
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface Assignment {
  id: string;
  user_id: string;
  device_id: string;
  user?: User;
  device?: Device;
  is_active: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ApiHealth {
  status: string;
  timestamp: string;
  message?: string;
  version?: string;
  database?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: User;
}

export interface LoginCredentials {
  username_or_email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role_id?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

export interface DeviceStats {
  total: number;
  online: number;
  offline: number;
  maintenance: number;
  byType: Record<string, number>;
  byLocation: Record<string, number>;
  recentPings: number;
}

export interface AssignmentStats {
  total: number;
  active: number;
  inactive: number;
  byUser: Record<string, number>;
}
