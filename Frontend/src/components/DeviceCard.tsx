import React from 'react';
import { Server, Copy } from 'lucide-react';
import type { Device } from '../types/Device';

interface DeviceCardProps {
  device: Device;
  onClick: (device: Device) => void;
}

const DeviceCard: React.FC<DeviceCardProps> = ({ device, onClick }) => {
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
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const copyIpToClipboard = async (e: React.MouseEvent, ip: string | null) => {
    e.stopPropagation(); // Prevenir que se abra el modal
    if (!ip) return;
    try {
      await navigator.clipboard.writeText(ip);
      
      // Crear toast de confirmación
      const toast = document.createElement('div');
      toast.textContent = 'IP copiada al portapapeles';
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--color-success);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        transition: all 0.3s ease;
      `;
      
      document.body.appendChild(toast);
      
      // Remover el toast después de 3 segundos
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';
        setTimeout(() => document.body.removeChild(toast), 300);
      }, 3000);
    } catch (err) {
      // Error al copiar IP
      
      // Toast de error
      const errorToast = document.createElement('div');
      errorToast.textContent = 'Error al copiar IP';
      errorToast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: var(--color-error);
        color: white;
        padding: 12px 16px;
        border-radius: 8px;
        font-size: 0.875rem;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      `;
      
      document.body.appendChild(errorToast);
      setTimeout(() => document.body.removeChild(errorToast), 3000);
    }
  };

  return (
    <div 
      className={`device-card ${isActive ? 'device-active' : 'device-inactive'}`}
      onClick={() => onClick(device)}
    >
      <div className={`device-status-bar ${isActive ? 'status-bar-active' : 'status-bar-inactive'}`} />
      
      <div className="device-header">
        <div className="device-icon">
          <Server size={20} />
        </div>
        <div className="device-status-badge">
          <span className={`status-dot ${isActive ? 'status-active' : 'status-inactive'}`} />
          {isActive ? 'Activo' : 'Inactivo'}
        </div>
      </div>

      <div className="device-content">
        <h3 className="device-name">
          {device.name || device.device_name}
        </h3>
        
        <div className="device-info">
          <div className="device-info-item clickable-ip" onClick={(e) => copyIpToClipboard(e, device.current_local_ip)}>
            <span className="info-label">IP Actual:</span>
            <span className="info-value ip-address">
              {device.current_local_ip}
              <Copy size={12} style={{ marginLeft: '4px', opacity: 0.7 }} />
            </span>
          </div>
          
          <div className="device-info-item">
            <span className="info-label">Red Actual:</span>
            <span className="info-value">{device.current_wifi_network || 'No disponible'}</span>
          </div>
          
          <div className="device-info-item">
            <span className="info-label">Último ping:</span>
            <span className="info-value">{formatLastPing(device.last_ping)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeviceCard;