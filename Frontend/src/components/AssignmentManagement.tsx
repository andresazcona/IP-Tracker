import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  UserCheck,
  Users,
  Monitor,
  Calendar,
  FileText,
  Link,
  X
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { assignmentService, userService, deviceService } from '../services/api';
import type { Assignment, User, Device, PaginatedResponse } from '../types/Device';
import '../styles/Modal.css';

const AssignmentManagement: React.FC = () => {
  const { hasPermission } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [deviceFilter, setDeviceFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  const canCreate = hasPermission('assignments.create');
  const canEdit = hasPermission('assignments.update');
  const canDelete = hasPermission('assignments.delete');

  useEffect(() => {
    loadData();
  }, [currentPage, searchTerm, userFilter, deviceFilter, activeFilter]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Cargar asignaciones
      const assignmentsResponse: PaginatedResponse<Assignment> = await assignmentService.getAssignments({
        page: currentPage,
        limit: 10,
        user_id: userFilter || undefined,
        device_id: deviceFilter || undefined,
        active: activeFilter ? activeFilter === 'true' : undefined,
      });
      
      setAssignments(assignmentsResponse.items);
      setTotalPages(Math.ceil(assignmentsResponse.total / 10));

      // Cargar usuarios y dispositivos para los filtros (solo si están vacíos)
      if (users.length === 0 || devices.length === 0) {
        const [usersData, devicesData] = await Promise.all([
          userService.getUsers({ limit: 100 }).catch(() => ({ items: [] as User[] })),
          deviceService.getDevices({ limit: 100 }).catch(() => ({ items: [] }))
        ]);
        
        if (users.length === 0) setUsers(usersData.items || []);
        if (devices.length === 0) setDevices(devicesData.items || []);
      }
    } catch (err) {
      setError('Error al cargar asignaciones');
      setAssignments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAssignment = () => {
    setSelectedAssignment(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEditAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleViewAssignment = (assignment: Assignment) => {
    setSelectedAssignment(assignment);
    setModalMode('view');
    setShowModal(true);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    if (!canDelete) return;
    
    if (window.confirm('¿Está seguro de que desea eliminar esta asignación?')) {
      try {
        await assignmentService.deleteAssignment(assignmentId);
        await loadData();
      } catch (err) {
        setError('Error al eliminar asignación');
      }
    }
  };

  const handleSaveAssignment = async (assignmentData: any) => {
    try {
      if (modalMode === 'create') {
        await assignmentService.createAssignment(assignmentData);
      } else if (modalMode === 'edit' && selectedAssignment) {
        await assignmentService.updateAssignment(selectedAssignment.id, assignmentData);
      }
      
      setShowModal(false);
      await loadData();
    } catch (err) {
      setError(`Error al ${modalMode === 'create' ? 'crear' : 'actualizar'} asignación`);
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

  const getUserName = (assignment: Assignment) => {
    if (assignment.user) {
      return assignment.user.first_name && assignment.user.last_name
        ? `${assignment.user.first_name} ${assignment.user.last_name}`
        : assignment.user.username;
    }
    return 'Usuario no encontrado';
  };

  const getDeviceName = (assignment: Assignment) => {
    if (assignment.device) {
      return assignment.device.device_name || assignment.device.name || 'Dispositivo sin nombre';
    }
    return 'Dispositivo no encontrado';
  };

  if (loading && assignments.length === 0) {
    return (
      <div className="management-loading">
        <div className="loading-spinner" />
        <p>Cargando asignaciones...</p>
      </div>
    );
  }

  return (
    <div className="assignment-management">
      <div className="management-header">
        <div className="header-left">
          <h2>Gestión de Asignaciones</h2>
          <p>Administrar asignaciones de dispositivos a usuarios</p>
        </div>
        <div className="header-right">
          {canCreate && (
            <button className="btn-primary" onClick={handleCreateAssignment}>
              <Plus size={16} />
              Nueva Asignación
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
            placeholder="Buscar asignaciones..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los usuarios</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.first_name && user.last_name 
                ? `${user.first_name} ${user.last_name}` 
                : user.username}
            </option>
          ))}
        </select>

        <select
          value={deviceFilter}
          onChange={(e) => setDeviceFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los dispositivos</option>
          {devices.map((device) => (
            <option key={device.id} value={device.id}>
              {device.device_name || device.name || 'Sin nombre'}
            </option>
          ))}
        </select>

        <select
          value={activeFilter}
          onChange={(e) => setActiveFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los estados</option>
          <option value="true">Activas</option>
          <option value="false">Inactivas</option>
        </select>
      </div>

      <div className="management-table">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Dispositivo</th>
              <th>Estado</th>
              <th>Fecha Creación</th>
              <th>Última Actualización</th>
              <th>Notas</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((assignment) => (
              <tr key={assignment.id}>
                <td>
                  <div className="user-info">
                    <Users size={14} />
                    <div>
                      <div className="user-name">{getUserName(assignment)}</div>
                      <div className="user-username">
                        @{assignment.user?.username || 'N/A'}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="device-info">
                    <Monitor size={14} />
                    <div>
                      <div className="device-name">{getDeviceName(assignment)}</div>
                      <div className="device-type">
                        {assignment.device?.device_type || 'N/A'}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`status-badge ${assignment.is_active ? 'active' : 'inactive'}`}>
                    <Link size={12} />
                    {assignment.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                </td>
                <td>
                  <div className="date-info">
                    <Calendar size={14} />
                    {formatDate(assignment.created_at)}
                  </div>
                </td>
                <td>
                  <div className="date-info">
                    <Calendar size={14} />
                    {formatDate(assignment.updated_at)}
                  </div>
                </td>
                <td>
                  <div className="notes-preview">
                    <FileText size={14} />
                    {assignment.notes ? (
                      <span title={assignment.notes}>
                        {assignment.notes.length > 30 
                          ? `${assignment.notes.substring(0, 30)}...` 
                          : assignment.notes}
                      </span>
                    ) : (
                      <span className="no-notes">Sin notas</span>
                    )}
                  </div>
                </td>
                <td>
                  <div className="actions">
                    <button
                      className="action-btn view"
                      onClick={() => handleViewAssignment(assignment)}
                      title="Ver detalles de la asignación"
                    >
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <button
                        className="action-btn edit"
                        onClick={() => handleEditAssignment(assignment)}
                        title="Editar asignación"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteAssignment(assignment.id)}
                        title="Eliminar asignación"
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

        {assignments.length === 0 && !loading && (
          <div className="empty-state">
            <UserCheck size={48} />
            <h3>No hay asignaciones</h3>
            <p>No se encontraron asignaciones con los criterios de búsqueda.</p>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Anterior
          </button>
          
          <span>
            Página {currentPage} de {totalPages}
          </span>
          
          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Siguiente
          </button>
        </div>
      )}

      {showModal && (
        <AssignmentModal
          assignment={selectedAssignment}
          mode={modalMode}
          users={users}
          devices={devices}
          onSave={handleSaveAssignment}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// Modal Component
interface AssignmentModalProps {
  assignment: Assignment | null;
  mode: 'create' | 'edit' | 'view';
  users: User[];
  devices: Device[];
  onSave: (assignmentData: any) => Promise<void>;
  onCancel: () => void;
}

const AssignmentModal: React.FC<AssignmentModalProps> = ({ 
  assignment, 
  mode, 
  users, 
  devices, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    user_id: assignment?.user_id || '',
    device_id: assignment?.device_id || '',
    notes: assignment?.notes || '',
    is_active: assignment?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.user_id || !formData.device_id) {
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
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const isReadOnly = mode === 'view';

  const getUserName = (user: User) => {
    return user.first_name && user.last_name 
      ? `${user.first_name} ${user.last_name}` 
      : user.username;
  };

  const getDeviceName = (device: Device) => {
    return device.device_name || device.name || 'Sin nombre';
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'create' ? 'Nueva Asignación' : 
             mode === 'edit' ? 'Editar Asignación' : 'Detalles de la Asignación'}
          </h2>
          <button className="modal-close-button" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <form id="assignment-form" className="modal-body" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Usuario *</label>
              <select
                name="user_id"
                value={formData.user_id}
                onChange={handleChange}
                disabled={isReadOnly}
                required
              >
                <option value="">Seleccionar usuario</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {getUserName(user)} (@{user.username})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Dispositivo *</label>
              <select
                name="device_id"
                value={formData.device_id}
                onChange={handleChange}
                disabled={isReadOnly}
                required
              >
                <option value="">Seleccionar dispositivo</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id}>
                    {getDeviceName(device)} ({device.device_type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  name="is_active"
                  checked={formData.is_active}
                  onChange={handleChange}
                  disabled={isReadOnly}
                />
                Asignación activa
              </label>
            </div>

            <div className="form-group full-width">
              <label>Notas</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                disabled={isReadOnly}
                rows={3}
                placeholder="Notas adicionales sobre la asignación..."
              />
            </div>
          </div>

        </form>
        
        {!isReadOnly && (
          <div className="modal-footer">
            <button type="button" className="modal-button" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="modal-button modal-button-primary" disabled={saving} form="assignment-form">
              {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Actualizar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentManagement;
