import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CpuIcon,
  PlayIcon,
  MailIcon,
  FolderGitIcon,
  GlobeIcon,
  CodeIcon,
  RefreshIcon,
} from '../components/Icons';
import { DashboardStats, CodexAccount, Project } from '../types/electron';
import { useToast } from '../components/Toast';
import { TerminalDrawer } from '../components/TerminalDrawer';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [accounts, setAccounts] = useState<CodexAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Quick launcher state
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [terminalAccount, setTerminalAccount] = useState<CodexAccount | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedStats, fetchedAccounts, fetchedProjects] = await Promise.all([
        window.electronAPI.dashboard.getStats(),
        window.electronAPI.codex.getAccounts(),
        window.electronAPI.projects.getAll(),
      ]);
      setStats(fetchedStats);
      setAccounts(fetchedAccounts);
      setProjects(fetchedProjects);

      if (fetchedAccounts.length > 0 && !selectedAccount) {
        // Default to first available account or first account
        const available = fetchedAccounts.find((a) => a.status === 'available');
        setSelectedAccount(available ? available.id : fetchedAccounts[0].id);
      }
      if (fetchedProjects.length > 0 && !selectedProject) {
        setSelectedProject(fetchedProjects[0].id);
      }
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      error('Error al cargar datos del panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLaunchCodex = () => {
    if (!selectedAccount) {
      error('Seleccioná una cuenta de Codex');
      return;
    }
    const acc = accounts.find((a) => a.id === selectedAccount);
    if (acc) {
      setTerminalAccount(acc);
    }
  };

  const handleOpenChatGPT = async (accountId = selectedAccount) => {
    try { await window.electronAPI.chatgpt.open(accountId); success('ChatGPT abierto con el perfil elegido.'); }
    catch (err) { error(err instanceof Error ? err.message : 'No se pudo abrir ChatGPT.'); }
  };

  const handleOpenVSCode = async () => {
    if (!selectedProject) {
      error('Seleccioná un proyecto');
      return;
    }
    const proj = projects.find((p) => p.id === selectedProject);
    if (proj) {
      try {
        await window.electronAPI.projects.openVSCode(proj.path);
        success(`VS Code abierto en ${proj.name}`);
      } catch (err) {
        console.error(err);
        error('Error al abrir VS Code');
      }
    }
  };

  const handleLaunchNextFreeCodex = async () => {
    const freeAccount = accounts.find((a) => a.status === 'available');
    if (!freeAccount) {
      error('No hay cuentas de Codex con estado "Disponible"');
      return;
    }
    try {
      await window.electronAPI.codex.launch(freeAccount.id, selectedProject || undefined);
      await window.electronAPI.codex.updateAccount(freeAccount.id, { status: 'working' });
      success(`Codex Slot #${freeAccount.slot_number} (${freeAccount.label}) iniciado`);
      loadData();
    } catch (err) {
      console.error(err);
      error('Error al iniciar cuenta libre');
    }
  };

  const handleOpenFavoriteEmails = async () => {
    try {
      const emails = await window.electronAPI.emails.getAll();
      const favs = emails.filter((e) => e.favorite);
      if (favs.length === 0) {
        error('No tenés correos marcados como favoritos');
        return;
      }
      const settings = await window.electronAPI.settings.getAll();
      const result = await window.electronAPI.emails.openMultiple(
        favs.map((f) => f.id),
        settings.batchOpenInterval
      );
      if (result.failed) error(`${result.opened} abiertos; ${result.failed} fallaron.`);
      else success(`${result.opened} correos abiertos.`);
    } catch (err) {
      console.error(err);
      error('Error al abrir correos');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'working': return 'Trabajando';
      case 'limit': return 'Límite alcanzado';
      case 'resting': return 'En reposo';
      default: return 'Desconocido';
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Panel Principal</h1>
          <p className="page-subtitle">Control centralizado de cuentas de OpenAI Codex, navegación y repositorios locales.</p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading} title="Actualizar estadísticas">
          <RefreshIcon size={14} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
      </div>

      {/* Quick Launch Panel */}
      <div className="launcher-panel">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <PlayIcon size={16} /> Lanzador Rápido de Instancias
        </h3>
        <div className="launcher-row">
          <div className="launcher-field">
            <label>Cuenta / Slot de Codex</label>
            <select
              className="select"
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  Slot #{acc.slot_number} — {acc.label} {acc.alias ? `(${acc.alias})` : ''} [{getStatusLabel(acc.status)}]
                </option>
              ))}
            </select>
          </div>

          <div className="launcher-field">
            <label>Proyecto Destino (Opcional)</label>
            <select
              className="select"
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">(Ninguno — Terminal en carpeta por defecto)</option>
              {projects.map((proj) => (
                <option key={proj.id} value={proj.id}>
                  {proj.name} ({proj.path})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn btn-primary"
              onClick={handleLaunchCodex}
              disabled={!selectedAccount}
              style={{ height: 40 }}
            >
              <PlayIcon size={14} />
              Lanzar Codex
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleOpenChatGPT()}
              title="Abrir ChatGPT en perfil aislado de navegador"
              style={{ height: 40 }}
            >
              <GlobeIcon size={14} />
              ChatGPT Web
            </button>
            {selectedProject && (
              <button
                className="btn btn-secondary"
                onClick={handleOpenVSCode}
                title="Abrir proyecto en VS Code"
                style={{ height: 40 }}
              >
                <CodeIcon size={14} />
                VS Code
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/codex')}>
          <div className="stat-label">Codex Disponibles</div>
          <div className="stat-value">
            <span className="stat-highlight" style={{ color: 'var(--status-available)' }}>
              {stats?.codex.available ?? 0}
            </span>
            <span style={{ fontSize: 18, color: 'var(--text-muted)' }}> / {stats?.codex.total ?? 6}</span>
          </div>
          <div className="stat-detail">
            {stats?.codex.limit ?? 0} en límite &bull; {stats?.codex.working ?? 0} trabajando
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/emails')}>
          <div className="stat-label">Cuentas de Correo</div>
          <div className="stat-value">
            <span className="stat-highlight">
              {stats?.emails.total ?? 0}
            </span>
          </div>
          <div className="stat-detail">
            {stats?.emails.favorites ?? 0} marcadas como favoritas
          </div>
        </div>

        <div className="stat-card" style={{ cursor: 'pointer' }} onClick={() => navigate('/projects')}>
          <div className="stat-label">Proyectos Locales</div>
          <div className="stat-value">
            <span className="stat-highlight" style={{ color: 'var(--accent-cyan)' }}>
              {stats?.projects.total ?? 0}
            </span>
          </div>
          <div className="stat-detail">
            Listos para vincular a slots o worktrees
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Acciones Rápidas</h3>
      <div className="quick-actions">
        <div className="quick-action" onClick={handleLaunchNextFreeCodex}>
          <CpuIcon size={16} />
          <span>Siguiente Codex Libre</span>
        </div>
        <div className="quick-action" onClick={handleOpenFavoriteEmails}>
          <MailIcon size={16} />
          <span>Abrir Correos Favoritos</span>
        </div>
        <div className="quick-action" onClick={() => navigate('/projects')}>
          <FolderGitIcon size={16} />
          <span>Gestionar Proyectos</span>
        </div>
        <div className="quick-action" onClick={() => navigate('/worktrees')}>
          <CodeIcon size={16} />
          <span>Crear Worktrees Paralelos</span>
        </div>
      </div>

      {/* Codex Slots Snapshot Grid */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Estado de Ranuras Codex</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/codex')}>
          Ver todas &rarr;
        </button>
      </div>

      <div className="codex-grid" style={{ marginBottom: 32 }}>
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="codex-card"
            style={{ '--card-accent': acc.color } as React.CSSProperties}
          >
            <div className="codex-card-header">
              <div className="codex-slot">
                <div className="codex-slot-number">#{acc.slot_number}</div>
                <div className="codex-slot-info">
                  <h3>{acc.label}</h3>
                  <div className="codex-slot-email">{acc.alias || acc.email || 'Sin credenciales asociadas'}</div>
                </div>
              </div>
              <span className={`codex-status ${acc.status}`}>
                <span className="codex-status-dot" />
                {getStatusLabel(acc.status)}
              </span>
            </div>

            <div className="codex-card-actions">
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setTerminalAccount(acc);
                }}
              >
                <PlayIcon size={12} /> Lanzar
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  handleOpenChatGPT(acc.id);
                }}
                title="Abrir ChatGPT en una nueva pestaña"
              >
                <GlobeIcon size={12} /> Web
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Activity Feed */}
      {stats?.recentActivity && stats.recentActivity.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Registro de Actividad Reciente</h3>
          </div>
          <div className="activity-feed">
            {stats.recentActivity.map((item) => (
              <div key={item.id} className="activity-item">
                <div className="activity-dot" />
                <div>
                  <div className="activity-text">
                    <strong>{item.action}</strong> &bull; {item.details}
                  </div>
                  <div className="activity-time">{item.created_at}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live Interactive Terminal Drawer */}
      <TerminalDrawer
        isOpen={!!terminalAccount}
        onClose={() => {
          setTerminalAccount(null);
          loadData();
        }}
        account={terminalAccount}
        projectId={selectedProject}
        initialCommand="codex"
      />
    </div>
  );
};

export default Dashboard;
