import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardIcon,
  CpuIcon,
  MailIcon,
  FolderGitIcon,
  GitBranchIcon,
  SettingsIcon,
} from './Icons';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

export const Sidebar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const mainNavItems: NavItem[] = [
    { path: '/', label: 'Panel Principal', icon: <DashboardIcon size={18} /> },
    { path: '/codex', label: 'Cuentas Codex', icon: <CpuIcon size={18} /> },
    { path: '/emails', label: 'Cuentas de Correo', icon: <MailIcon size={18} /> },
    { path: '/projects', label: 'Proyectos Locales', icon: <FolderGitIcon size={18} /> },
    { path: '/worktrees', label: 'Git Worktrees', icon: <GitBranchIcon size={18} /> },
  ];

  const configNavItems: NavItem[] = [
    { path: '/settings', label: 'Configuración', icon: <SettingsIcon size={18} /> },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-section">
        <div className="sidebar-label">Navegación</div>
        {mainNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-section" style={{ marginTop: 'auto' }}>
        <div className="sidebar-label">Sistema</div>
        {configNavItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="sidebar-version">
        Account Hub v0.2.0 &bull; Local
      </div>
    </aside>
  );
};
