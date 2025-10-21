import React, { useMemo, useState } from 'react';
import {
  Users,
  Monitor,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import UserManagement from './UserManagement';
import DeviceManagement from './DeviceManagement';
import '../styles/AdminDashboard.css';

type AdminTab = 'users' | 'devices';

const AdminDashboard: React.FC = () => {
  const { hasPermission } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');

  const tabs = useMemo(
    () => [
      {
        id: 'users' as AdminTab,
        label: 'Usuarios',
        icon: Users,
        visible: hasPermission('users.read'),
      },
      {
        id: 'devices' as AdminTab,
        label: 'Dispositivos',
        icon: Monitor,
        visible: hasPermission('devices.read'),
      },
    ].filter((tab) => tab.visible),
    [hasPermission]
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UserManagement />;
      case 'devices':
        return <DeviceManagement />;
      default:
        return <UserManagement />;
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <div className="admin-title">
          <h1>Panel de Administración</h1>
        </div>
        <div className="admin-actions">
          <button className="admin-back-button" onClick={() => navigate('/dashboard')}>
            <ArrowLeft size={16} />
            Volver al dashboard
          </button>
        </div>
      </div>

      <div className="admin-content">
        <nav className="admin-nav">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon size={20} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>

        <main className="admin-main">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
