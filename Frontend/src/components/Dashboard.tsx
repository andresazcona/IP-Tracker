import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, LogOut, Monitor, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { deviceService, healthService } from '../services/api';
import type { Device, ApiHealth } from '../types/Device';
import DeviceCard from './DeviceCard';
import DeviceDetailsModal from './DeviceDetailsModal';
import '../styles/Dashboard.css';

type FilterType = 'all' | 'active' | 'inactive';

const Dashboard: React.FC = () => {
  const { logout, isAdmin, isManager } = useAuth();
  const navigate = useNavigate();
  const [devices, setDevices] = useState<Device[]>([]);
  const [filteredDevices, setFilteredDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiHealth, setApiHealth] = useState<ApiHealth | null>(null);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [error, setError] = useState<string>('');
  const canAccessAdmin = isAdmin() || isManager();

  // Configuración desde variables de entorno
  const appName = import.meta.env.VITE_APP_NAME || 'IP Tracker';
  const appSubtitle = import.meta.env.VITE_APP_SUBTITLE || 'Sistema de Monitoreo de Dispositivos IP';
  const refreshInterval = parseInt(import.meta.env.VITE_REFRESH_INTERVAL || '30000');
  const fetchDevices = useCallback(async () => {
    try {
      setError('');
      const data = await deviceService.getDevices();
      // Validar que data tenga items
      if (data && Array.isArray(data.items)) {
        setDevices(data.items);
        applyFilter(data.items, activeFilter);
      } else {
        setDevices([]);
        applyFilter([], activeFilter);
        setError('Formato de respuesta inválido de la API');
      }
    } catch (err) {
      setError('Error al cargar los dispositivos');
      setDevices([]); // Asegurar que devices sea siempre un array
      applyFilter([], activeFilter);
    }
  }, [activeFilter]);

  const fetchApiHealth = useCallback(async () => {
    try {
      const health = await healthService.getHealth();
      setApiHealth(health);
    } catch (err) {
      setApiHealth({
        status: 'error',
        timestamp: new Date().toISOString(),
      });
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    if (refreshing) {
      return;
    }
    setRefreshing(true);
    
    try {
      await Promise.all([fetchDevices(), fetchApiHealth()]);
    } catch (error) {
    } finally {
      setRefreshing(false);
    }
  }, [refreshing, fetchDevices, fetchApiHealth]);

  const applyFilter = (deviceList: Device[], filter: FilterType) => {
    let filtered = deviceList;
    
    switch (filter) {
      case 'active':
        filtered = deviceList.filter(device => 
          device.status === 'online' || device.connection_status === 'online'
        );
        break;
      case 'inactive':
        filtered = deviceList.filter(device => 
          device.status === 'offline' || device.connection_status === 'offline'
        );
        break;
      default:
        filtered = deviceList;
    }
    
    setFilteredDevices(filtered);
  };

  const handleFilterChange = (filter: FilterType) => {
    setActiveFilter(filter);
    applyFilter(devices, filter);
  };

  const handleDeviceClick = (device: Device) => {
    setSelectedDevice(device);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedDevice(null);
  };

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      if (!isMounted) return;
      setLoading(true);
      
      try {
        await Promise.all([fetchDevices(), fetchApiHealth()]);
      } catch (error) {
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    // Auto-refresh usando intervalo de configuración
    const interval = setInterval(() => {
      if (isMounted) {
        handleRefresh();
      }
    }, refreshInterval);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshInterval, handleRefresh]);

  const stats = {
    total: Array.isArray(devices) ? devices.length : 0,
    active: Array.isArray(devices) ? devices.filter(d => d.status === 'online' || d.connection_status === 'online').length : 0,
    inactive: Array.isArray(devices) ? devices.filter(d => d.status === 'offline' || d.connection_status === 'offline').length : 0,
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner-large" />
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Header */}
      <header className="dashboard-header">
        <div className="header-left">
          <h1 className="header-title">{appName}</h1>
          <p className="header-subtitle">{appSubtitle}</p>
        </div>
        
        <div className="header-right">
          <div className="api-status">
            <div className={`status-indicator ${
              apiHealth?.status === 'healthy' || apiHealth?.status === 'ok' 
                ? 'status-healthy' 
                : 'status-error'
            }`} />
            API {apiHealth?.status === 'healthy' || apiHealth?.status === 'ok' ? 'Conectada' : 'Desconectada'}
          </div>
          
          <button
            className="header-button"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Actualizar
          </button>
          
          {canAccessAdmin && (
            <button
              className="header-button admin-button"
              onClick={() => navigate('/admin')}
            >
              <Shield size={16} />
              Administracion
            </button>
          )}
          
          <button
            className="header-button logout-button"
            onClick={logout}
          >
            <LogOut size={16} />
            Cerrar Sesión
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="dashboard-main">
        {error && (
          <div className="error-message" style={{ marginBottom: 'var(--spacing-lg)' }}>
            {error}
          </div>
        )}

        {/* Stats Section */}
        <section className="stats-section">
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-number">{stats.total}</div>
              <div className="stat-label">Total Dispositivos</div>
            </div>
            <div className="stat-card stat-active">
              <div className="stat-number">{stats.active}</div>
              <div className="stat-label">Activos</div>
            </div>
            <div className="stat-card stat-inactive">
              <div className="stat-number">{stats.inactive}</div>
              <div className="stat-label">Inactivos</div>
            </div>
          </div>
        </section>

        {/* Filters Section */}
        <section className="filters-section">
          <div className="filters-container">
            <button
              className={`filter-button ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleFilterChange('all')}
            >
              Todos ({stats.total})
            </button>
            <button
              className={`filter-button ${activeFilter === 'active' ? 'active' : ''}`}
              onClick={() => handleFilterChange('active')}
            >
              Activos ({stats.active})
            </button>
            <button
              className={`filter-button ${activeFilter === 'inactive' ? 'active' : ''}`}
              onClick={() => handleFilterChange('inactive')}
            >
              Inactivos ({stats.inactive})
            </button>
          </div>
        </section>

        {/* Devices Section */}
        <section className="devices-section">
          <h2>
            {activeFilter === 'all' && 'Todos los Dispositivos'}
            {activeFilter === 'active' && 'Dispositivos Activos'}
            {activeFilter === 'inactive' && 'Dispositivos Inactivos'}
          </h2>
          
          {filteredDevices.length === 0 ? (
            <div className="empty-state">
              <Monitor size={48} className="empty-state-icon" />
              <p>No se encontraron dispositivos</p>
            </div>
          ) : (
            <div className="devices-grid">
              {filteredDevices.map((device) => (
                <DeviceCard
                  key={device.id}
                  device={device}
                  onClick={handleDeviceClick}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {/* Device Details Modal */}
      {selectedDevice && (
        <DeviceDetailsModal
          device={selectedDevice}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

export default Dashboard;
