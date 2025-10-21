import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye, 
  UserPlus,
  Mail,
  Calendar,
  X,
  Shield
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { userService } from '../services/api';
import type { User, PaginatedResponse } from '../types/Device';

const UserManagement: React.FC = () => {
  const { hasPermission } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit' | 'view'>('view');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState('');

  const canCreate = hasPermission('users.create');
  const canEdit = hasPermission('users.update');
  const canDelete = hasPermission('users.delete');

  useEffect(() => {
    loadUsers();
  }, [currentPage, searchTerm, roleFilter]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response: PaginatedResponse<User> = await userService.getUsers({
        page: currentPage,
        limit: 10,
        q: searchTerm || undefined,
        role: roleFilter || undefined,
      });
      
      setUsers(response.items);
      setTotalPages(Math.ceil(response.total / 10));
    } catch (err) {
      setError('Error al cargar usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setModalMode('create');
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setModalMode('edit');
    setShowModal(true);
  };

  const handleViewUser = (user: User) => {
    setSelectedUser(user);
    setModalMode('view');
    setShowModal(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!canDelete) return;
    
    if (window.confirm('¿Está seguro de que desea eliminar este usuario?')) {
      try {
        await userService.deleteUser(userId);
        await loadUsers();
      } catch (err) {
        setError('Error al eliminar usuario');
      }
    }
  };

  const handleSaveUser = async (userData: any) => {
    try {
      if (modalMode === 'create') {
        await userService.createUser(userData);
      } else if (modalMode === 'edit' && selectedUser) {
        await userService.updateUser(selectedUser.id, userData);
      }
      
      setShowModal(false);
      await loadUsers();
    } catch (err: any) {
      const errorMessage = err.message || `Error al ${modalMode === 'create' ? 'crear' : 'actualizar'} usuario`;
      setError(errorMessage);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getRoleColor = (roleName: string) => {
    switch (roleName) {
      case 'admin': return 'role-admin';
      case 'manager': return 'role-manager';
      case 'user': return 'role-user';
      default: return 'role-default';
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="management-loading">
        <div className="loading-spinner" />
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div className="user-management">
      <div className="management-header">
        <div className="header-left">
          <h2>Gestión de Usuarios</h2>
          <p>Administrar usuarios del sistema</p>
        </div>
        <div className="header-right">
          {canCreate && (
            <button className="btn-primary" onClick={handleCreateUser}>
              <Plus size={16} />
              Crear Usuario
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
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">Todos los roles</option>
          <option value="admin">Administrador</option>
          <option value="manager">Manager</option>
          <option value="user">Usuario</option>
          <option value="viewer">Visualizador</option>
        </select>
      </div>

      <div className="management-table">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Fecha Creación</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>
                  <div className="user-info">
                    <div className="user-name">
                      {user.first_name && user.last_name 
                        ? `${user.first_name} ${user.last_name}`
                        : user.username
                      }
                    </div>
                    <div className="user-username">@{user.username}</div>
                  </div>
                </td>
                <td>
                  <div className="user-email">
                    <Mail size={14} />
                    {user.email}
                  </div>
                </td>
                <td>
                  <span className={`role-badge ${getRoleColor(typeof user.role === 'string' ? user.role : 'user')}`}>
                    <Shield size={12} />
                    {typeof user.role === 'string' 
                      ? (user.role === 'admin' ? 'Administrador' : 
                         user.role === 'manager' ? 'Manager' : 
                         user.role === 'user' ? 'Usuario' : user.role)
                      : 'Usuario'}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                    {user.is_active ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td>
                  <div className="date-info">
                    <Calendar size={14} />
                    {formatDate(user.created_at)}
                  </div>
                </td>
                <td>
                  <div className="actions">
                    <button
                      className="action-btn view"
                      onClick={() => handleViewUser(user)}
                      title="Ver detalles"
                    >
                      <Eye size={16} />
                    </button>
                    {canEdit && (
                      <button
                        className="action-btn edit"
                        onClick={() => handleEditUser(user)}
                        title="Editar usuario"
                      >
                        <Edit size={16} />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteUser(user.id)}
                        title="Eliminar usuario"
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

        {users.length === 0 && !loading && (
          <div className="empty-state">
            <UserPlus size={64} />
            <h3>No hay usuarios disponibles</h3>
            <p>No se encontraron usuarios con los criterios de búsqueda.</p>
            {canCreate && (
              <button className="btn-primary" onClick={handleCreateUser}>
                Crear Primer Usuario
              </button>
            )}
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
        <UserModal
          user={selectedUser}
          mode={modalMode}
          onSave={handleSaveUser}
          onCancel={() => setShowModal(false)}
        />
      )}
    </div>
  );
};

// Modal Component
interface UserModalProps {
  user: User | null;
  mode: 'create' | 'edit' | 'view';
  onSave: (userData: any) => Promise<void>;
  onCancel: () => void;
}

const UserModal: React.FC<UserModalProps> = ({ user, mode, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    password: '',
    role_id: user?.role_id || '',
    is_active: user?.is_active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.email || (mode === 'create' && !formData.password)) {
      alert('Por favor complete todos los campos requeridos');
      return;
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      alert('Por favor ingrese un email válido');
      return;
    }

    setSaving(true);
    try {
      // Limpiar y preparar datos para envío
      // Mapear UUID a nombre de rol
      const roleMapping: Record<string, string> = {
        '1b4f708f-1839-4690-9f38-c314a4b54905': 'admin',
        'f2872717-7783-45d9-af05-2959521a93e6': 'manager', 
        'a2748b39-637d-43e0-b1e9-6c532510eb7c': 'user',
        'c74b5d38-e673-4f0c-8841-b3c58a3ae06f': 'viewer'
      };

      const cleanData = {
        username: formData.username.trim(),
        email: formData.email.trim().toLowerCase(),
        first_name: formData.first_name?.trim() || undefined,
        last_name: formData.last_name?.trim() || undefined,
        role: roleMapping[formData.role_id] || formData.role_id || undefined, // Convertir UUID a nombre
        is_active: formData.is_active
      };

      // Solo incluir password si estamos creando
      if (mode === 'create' && formData.password) {
        (cleanData as any).password = formData.password;
      }
      await onSave(cleanData);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  const isReadOnly = mode === 'view';

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'create' ? 'Crear Usuario' : 
             mode === 'edit' ? 'Editar Usuario' : 'Detalles del Usuario'}
          </h2>
          <button className="modal-close-button" onClick={onCancel}>
            <X size={20} />
          </button>
        </div>

        <form id="user-form" className="modal-body" onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Nombre de usuario *</label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={isReadOnly}
                required
              />
            </div>

            <div className="form-group">
              <label>Email *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isReadOnly}
                required
              />
            </div>

            <div className="form-group">
              <label>Nombre</label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                disabled={isReadOnly}
              />
            </div>

            <div className="form-group">
              <label>Apellido</label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                disabled={isReadOnly}
              />
            </div>

            {mode === 'create' && (
              <div className="form-group">
                <label>Contraseña *</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="form-group">
              <label>Rol</label>
              <select
                name="role_id"
                value={formData.role_id}
                onChange={handleChange}
                disabled={isReadOnly}
              >
                <option value="">Seleccionar rol</option>
                <option value="1b4f708f-1839-4690-9f38-c314a4b54905">Administrador</option>
                <option value="f2872717-7783-45d9-af05-2959521a93e6">Manager</option>
                <option value="a2748b39-637d-43e0-b1e9-6c532510eb7c">Usuario</option>
                <option value="c74b5d38-e673-4f0c-8841-b3c58a3ae06f">Visualizador</option>
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
                Usuario activo
              </label>
            </div>
          </div>

        </form>
        
        {!isReadOnly && (
          <div className="modal-footer">
            <button type="button" className="modal-button" onClick={onCancel} disabled={saving}>
              Cancelar
            </button>
            <button type="submit" className="modal-button modal-button-primary" disabled={saving} form="user-form">
              {saving ? 'Guardando...' : mode === 'create' ? 'Crear' : 'Actualizar'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;
