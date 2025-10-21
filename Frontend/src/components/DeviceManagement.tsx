import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  Monitor,
  Calendar,
  MapPin,
  Activity,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { deviceService } from '../services/api';
import '../styles/Modal.css';
import type { Device } from '../types/Device';

const DeviceManagement: React.FC = () => {
  const { hasPermission } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [error, setError] = useState('');

  const canCreate = hasPermission('devices.create');
  const canEdit = hasPermission('devices.update');
  const canDelete = hasPermission('devices.delete');

  useEffect(() => {
    loadDevices();
  }, [searchTerm, statusFilter, typeFilter]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setError('');
      const devicesData = await deviceService.getDevices({
        q: searchTerm || undefined,
        status: statusFilter || undefined,
        type: typeFilter || undefined,
      });
      
      setDevices(devicesData.items);
    } catch (err) {
      setError('Error al cargar dispositivos');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDevice = () => {
    setSelectedDevice(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEditDevice = (device: Device) => {
    setSelectedDevice(device);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleViewDevice = (device: Device) => {
    setSelectedDevice(device);
    setModalMode('view');
    setShowModal(true);
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!canDelete) return;
    
    if (window.confirm('¿Está seguro de que desea eliminar este dispositivo?')) {
      try {
        await deviceService.deleteDevice(deviceId);
        await loadDevices();
      } catch (err) {
        setError('Error al eliminar dispositivo');
      }
    }
  };

  const handleSaveDevice = async (deviceData: any) => {
    try {
      if (modalMode === 'create') {
        await deviceService.createDevice(deviceData);
      } else if (modalMode === 'edit' && selectedDevice) {
        await deviceService.updateDevice(selectedDevice.id, deviceData);
      }
      
      setShowModal(false);
      await loadDevices();
    } catch (err) {
      setError(`Error al ${modalMode === 'create' ? 'crear' : 'actualizar'} dispositivo`);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online': return 'status-online';
      case 'offline': return 'status-offline';
      case 'maintenance': return 'status-maintenance';
      default: return 'status-unknown';
    }
  };



  if (loading && devices.length === 0) {
    return (
      <div className="management-loading">
        <div className="loading-spinner" />
        <p>Cargando dispositivos...</p>
      </div>
    );
  }

  return (
    <div className="device-management">
      <div className="management-header">
        <div className="header-left">
          <h2>Gestión de Dispositivos</h2>
          <p>Administrar dispositivos del sistema</p>
        </div>
        <div className="header-right">
          {canCreate && (
            <button className="btn-primary" onClick={handleCreateDevice}>
              <Plus size={16} />
              Crear Dispositivo
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="management-filters">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Buscar dispositivos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="online">En línea</option>
          <option value="offline">Desconectado</option>
          <option value="maintenance">Mantenimiento</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los tipos</option>
          <option value="raspberry">Raspberry Pi</option>
          <option value="arduino">Arduino</option>
          <option value="sensor">Sensor</option>
          <option value="computer">Computadora</option>
          <option value="router">Router</option>
          <option value="other">Otro</option>
        </select>
      </div>

      <div className="management-table">
        <table>
          <thead>
            <tr>
              <th>Dispositivo</th>
              <th>Tipo</th>
              <th>Estado</th>
              <th>Conexión</th>
              <th>Ubicación</th>
              <th>Último Ping</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((device) => (
              <tr key={device.id}>
                <td>
                  <div className="device-info">
                    <div className="device-name">{device.device_name || device.name}</div>
                    <div className="device-mac">{device.mac_address}</div>
                  </div>
                </td>
                <td>
                  <div className="device-type">
                    {device.device_type}
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${getStatusColor(device.status)}`}>
                    <Activity size={12} />
                    {device.status === 'online' ? 'En línea' : 
                     device.status === 'offline' ? 'Desconectado' : 
                     device.status === 'maintenance' ? 'Mantenimiento' : 'Desconocido'}
                  </span>
                </td>
                <td>
                  <div className="connection-info">
                    <div className="ip-info">
                      {device.current_local_ip || device.ip || 'N/A'}
                    </div>
                    <div className="network-info">
                      {device.current_wifi_network || 'N/A'}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="location-info">
                    <MapPin size={14} />
                    {device.location || 'No especificada'}
                  </div>
                </td>
                <td>
                  <div className="date-info">
                    <Calendar size={14} />
                    {device.last_ping ? formatDate(device.last_ping) : 'Nunca'}
                  </div>
                </td>

                <td>
                  <div className="actions">
                    <button
                      className="action-btn view"
                      onClick={() => handleViewDevice(device)}
                      title="Ver detalles del dispositivo"
                    >
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <button
                        className="action-btn edit"
                        onClick={() => handleEditDevice(device)}
                        title="Editar dispositivo"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteDevice(device.id)}
                        title="Eliminar dispositivo"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {devices.length === 0 && !loading && (
          <div className="empty-state">
            <Monitor size={48} />
            <h3>No hay dispositivos</h3>
            <p>No se encontraron dispositivos con los criterios de búsqueda.</p>
          </div>
        )}
      </div>

      {showModal && (
        <DeviceModal
          device={selectedDevice}
          mode={modalMode}
          onSave={handleSaveDevice}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// Modal Component
interface DeviceModalProps {
  device: Device | null;
  mode: 'create' | 'edit' | 'view';
  onSave: (deviceData: any) => Promise<void>;
  onCancel: () => void;
}

const DeviceModal: React.FC<DeviceModalProps> = ({ device, mode, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    device_name: device?.device_name || device?.name || '',
    device_type: device?.device_type || '',
    mac_address: device?.mac_address || '',
    serial_number: device?.serial_number || '',
    model: device?.model || '',
    location: device?.location || '',
    notes: device?.notes || device?.description || '',
    status: device?.status || 'offline',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.device_name || !formData.device_type) {
      return;
    }

    setSaving(true);
    try {
      await onSave(formData);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const isReadOnly = mode === 'view';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'create' ? 'Crear Dispositivo' : 
             mode === 'edit' ? 'Editar Dispositivo' : 'Detalles del Dispositivo'}
          </h2>
          <button className="modal-close-button" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <form id="device-form" className="modal-body" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre del dispositivo *</label>
              <input
                type="text"
                name="device_name"
                value={formData.device_name}
                onChange={handleChange}
                disabled={isReadOnly}
                required
              />
            </div>

            <div className="form-group">
              <label>Tipo de dispositivo *</label>
              <select
                name="device_type"
                value={formData.device_type}
                onChange={handleChange}
                disabled={isReadOnly}
                required
              >
                <option value="">Seleccionar tipo</option>
                <option value="raspberry">Raspberry Pi</option>
                <option value="arduino">Arduino</option>
                <option value="sensor">Sensor</option>
                <option value="computer">Computadora</option>
                <option value="router">Router</option>
                <option value="other">Otro</option>
              </select>
            </div>

            <div className="form-group">
              <label>Dirección MAC</label>
              <input
                type="text"
                name="mac_address"
                value={formData.mac_address}
                onChange={handleChange}
                disabled={isReadOnly}
                placeholder="aa:bb:cc:dd:ee:ff"
              />
            </div>

            <div className="form-group">
              <label>Número de serie</label>
              <input
                type="text"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                disabled={isReadOnly}
              />
            </div>

            <div className="form-group">
              <label>Modelo</label>
              <input
                type="text"
                name="model"
                value={formData.model}
                onChange={handleChange}
                disabled={isReadOnly}
              />
            </div>

            <div className="form-group">
              <label>Ubicación</label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                disabled={isReadOnly}
              />
            </div>

            <div className="form-group">
              <label>Estado</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                disabled={isReadOnly}
              >
                <option value="online">En línea</option>
                <option value="offline">Desconectado</option>
                <option value="maintenance">Mantenimiento</option>
              </select>
            </div>

            <div className="form-group full-width">
              <label>Notas</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                disabled={isReadOnly}
                rows={3}
                placeholder="Notas adicionales sobre el dispositivo..."
              />
            </div>
          </div>

        </form>
        
        {!isReadOnly && (
          <div className="modal-footer">
            <button type="button" className="modal-button" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="modal-button modal-button-primary" disabled={saving} form="device-form">
              {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Actualizar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceManagement;
