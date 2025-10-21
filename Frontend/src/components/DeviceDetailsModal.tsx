import React from 'react';
import { X, Monitor, Network, Activity } from 'lucide-react';
import type { Device } from '../types/Device';
import '../styles/Modal.css';

interface DeviceDetailsModalProps {
  device: Device;
  isOpen: boolean;
  onClose: () => void;
}

const DeviceDetailsModal: React.FC<DeviceDetailsModalProps> = ({ 
  device, 
  isOpen, 
  onClose 
}) => {
  if (!isOpen) return null;

  const isActive = device.status === 'online' || device.connection_status === 'online';

  const formatLastPing = (lastPing: string | null) => {
    if (!lastPing) return 'No disponible';
    try {
      const date = new Date(lastPing);
      return date.toLocaleString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={handleOverlayClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">Detalles del Dispositivo</h2>
          <button className="modal-close-button" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          <div className="device-detail-header">
            <div className="device-detail-icon">
              <Monitor size={20} />
            </div>
            <div className="device-detail-info">
              <h3>{device.name || device.device_name}</h3>
              <div className="device-detail-status">
                <span className={`status-dot ${isActive ? 'status-active' : 'status-inactive'}`} />
                {isActive ? 'Activo' : 'Inactivo'}
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4 className="detail-section-title">
              <Network size={16} />
              Información de Red
            </h4>
            <div className="detail-grid network-info-shadow">
              <div className="detail-item highlight">
                <span className="detail-label">IP Actual:</span>
                <span className="detail-value">{device.current_ip}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Red Actual:</span>
                <span className="detail-value">{device.current_wifi_network || 'No disponible'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">MAC Address:</span>
                <span className="detail-value">{device.mac_address || 'N/A'}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Tipo de Dispositivo:</span>
                <span className="detail-value">{device.device_type || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="detail-section">
            <h4 className="detail-section-title">
              <Activity size={16} />
              Actividad
            </h4>
            <div className="detail-grid">
              <div className="detail-item">
                <span className="detail-label">Último Ping:</span>
                <span className="detail-value">{formatLastPing(device.last_ping)}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Total de Pings:</span>
                <span className="detail-value">{device.ping_count || 0}</span>
              </div>
              <div className="detail-item">
                <span className="detail-label">Identificador:</span>
                <span className="detail-value">{device.id}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="modal-button" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceDetailsModal;