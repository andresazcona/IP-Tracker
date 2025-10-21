import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import '../styles/Login.css';

const LoginForm: React.FC = () => {
  const [credentials, setCredentials] = useState({
    username_or_email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromLocation = (location.state as { from?: { pathname?: string } })?.from;
  const redirectPath = fromLocation?.pathname ?? '/dashboard';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.username_or_email || !credentials.password) {
      setError('Por favor ingresa usuario y contrasena');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await login(credentials);
      navigate(redirectPath, { replace: true });
    } catch {
      setError('Por favor ingresa usuario y contrasena');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setCredentials((prev) => ({
      ...prev,
      [name]: value,
    }));
    if (error) {
      setError('');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">IP Tracker</h1>
          <p className="login-subtitle">Sistema de Monitoreo de Dispositivos IP</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username_or_email" className="form-label">
              Usuario o Email
            </label>
            <input
              type="text"
              id="username_or_email"
              name="username_or_email"
              value={credentials.username_or_email}
              onChange={handleChange}
              className="form-input"
              placeholder="Ingresa tu usuario o email"
              disabled={isLoading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Contrasena
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={credentials.password}
              onChange={handleChange}
              className="form-input"
              placeholder="Ingresa tu contrasena"
              disabled={isLoading}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            className={`login-button ${isLoading ? 'loading' : ''}`}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <div className="loading-spinner" />
                Iniciando sesion...
              </>
            ) : (
              <>
                <LogIn size={16} />
                Iniciar sesion
              </>
            )}
          </button>

          {error && (
            <div className="error-message" role="alert">
              {error}
            </div>
          )}
        </form>

        <div className="login-footer">
          <p className="made-with-love">
            IP Tracker - Sistema de Monitoreo de Dispositivos
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginForm;
