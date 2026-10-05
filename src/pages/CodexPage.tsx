import React, { useState, useEffect } from 'react';
import {
  PlayIcon,
  GlobeIcon,
  SettingsIcon,
  EditIcon,
  FolderGitIcon,
  RefreshIcon,
  CheckIcon,
} from '../components/Icons';
import { CodexAccount, CodexStatus, Project } from '../types/electron';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { TerminalDrawer } from '../components/TerminalDrawer';
import { downloadFile } from '../services/web-adapter';

export const CodexPage: React.FC = () => {
  const { success, error } = useToast();
  const [accounts, setAccounts] = useState<CodexAccount[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [authStatus, setAuthStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [adding, setAdding] = useState(false);

  // Edit Account Modal State
  const [editingAccount, setEditingAccount] = useState<CodexAccount | null>(null);
  const [editForm, setEditForm] = useState<Partial<CodexAccount>>({});

  // Active Terminal Drawer State (OpenDots / OpenManus style)
  const [terminalAccount, setTerminalAccount] = useState<CodexAccount | null>(null);
  const [terminalInitialCmd, setTerminalInitialCmd] = useState<string>('');
  const [terminalProjectId, setTerminalProjectId] = useState<string>('');

  // Launch with Project Modal State
  const [launchAccount, setLaunchAccount] = useState<CodexAccount | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [accs, projs] = await Promise.all([
        window.electronAPI.codex.getAccounts(),
        window.electronAPI.projects.getAll(),
      ]);
      setAccounts(accs);
      setProjects(projs);

      // Check auth status for each account (whether auth.json exists in its profile)
      const authMap: Record<string, boolean> = {};
      await Promise.all(
        accs.map(async (a) => {
          try {
            authMap[a.id] = await window.electronAPI.codex.isAuthenticated(a.id);
          } catch {
            authMap[a.id] = false;
          }
        })
      );
      setAuthStatus(authMap);
    } catch (err) {
      console.error(err);
      error('Error al cargar cuentas de Codex');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (account: CodexAccount, newStatus: CodexStatus) => {
    try {
      await window.electronAPI.codex.updateAccount(account.id, { status: newStatus });
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, status: newStatus } : a))
      );
      success(`Estado de Slot #${account.slot_number} cambiado a ${newStatus}`);
    } catch (err) {
      console.error(err);
      error('No se pudo actualizar el estado');
    }
  };

  const isWeb = !!(window.electronAPI && window.electronAPI.isWeb);

  const handleOpenTerminalLive = (account: CodexAccount, cmd: string = '') => {
    setTerminalAccount(account);
    setTerminalInitialCmd(cmd);
    setTerminalProjectId(account.current_project_id || '');
  };

  const handleConfigure = (account: CodexAccount) => {
    handleOpenTerminalLive(account, 'codex login --device-auth');
  };

  const handleAssociatedEmail = async (account: CodexAccount) => {
    try {
      const emails = await window.electronAPI.emails.getAll();
      const linked = emails.find(e => e.email.toLowerCase() === account.email.toLowerCase());
      if (!linked) throw new Error('Registrá el correo asociado en Cuentas de Correo para abrir su perfil.');
      await window.electronAPI.emails.open(linked.id);
      success('Correo asociado abierto.');
    } catch (err) { error(err instanceof Error ? err.message : 'No se pudo abrir el correo.'); }
  };

  const handleOpenChatGPT = async (account: CodexAccount) => {
    try {
      await window.electronAPI.chatgpt.open(account.id);
      success(`Abriendo navegador con perfil aislado para Slot #${account.slot_number} (${account.label}).`);
    } catch (err) {
      error(err instanceof Error ? err.message : 'No se pudo abrir el perfil de ChatGPT.');
    }
  };

  const handleDownloadBat = async (account: CodexAccount) => {
    try {
      const data = await window.electronAPI.codex.generateLauncher(account.id, account.current_project_id || undefined);
      if (data.content) {
        downloadFile(data.filename, data.content, 'application/x-bat');
        success(`Lanzador ${data.filename} descargado.`);
      }
    } catch {
      error('No se pudo generar el archivo .bat');
    }
  };

  const handleImportExisting = async (account: CodexAccount) => {
    try {
      await window.electronAPI.codex.importExisting(account.id);
      success(`¡Credenciales de ~/.codex vinculadas con éxito a Slot #${account.slot_number}!`);
      loadData();
    } catch (err: any) {
      console.error(err);
      error(err.message || 'No se pudieron importar las credenciales de ~/.codex');
    }
  };

  const handleLaunchSubmit = async () => {
    if (!launchAccount) return;
    handleOpenTerminalLive(
      launchAccount,
      'codex'
    );
    setTerminalProjectId(selectedProjectId);
    setLaunchAccount(null);
  };

  const handleSaveEdit = async () => {
    if (!editingAccount) return;
    try {
      await window.electronAPI.codex.updateAccount(editingAccount.id, editForm);
      success('Cuenta actualizada correctamente');
      setEditingAccount(null);
      loadData();
    } catch (err) {
      console.error(err);
      error('Error al guardar cambios de la cuenta');
    }
  };

  const getStatusLabel = (status: CodexStatus) => {
    switch (status) {
      case 'available': return 'Disponible';
      case 'working': return 'Trabajando';
      case 'limit': return 'Límite alcanzado';
      case 'resting': return 'En reposo';
      case 'unknown': return 'Desconocido';
    }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Ranuras de Cuentas OpenAI Codex</h1>
          <p className="page-subtitle">
            Cada cuenta tiene su propia sesión. Los estados y límites se marcan manualmente.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-secondary btn-sm" onClick={() => window.electronAPI.launchers.openFolder().catch(err => error(err.message))}>Accesos PowerShell</button>
        <button className="btn btn-primary btn-sm" disabled={adding} onClick={async () => {
          setAdding(true);
          try { await window.electronAPI.codex.addAccount(); await loadData(); }
          catch (err) { error(err instanceof Error ? err.message : 'No se pudo crear la cuenta.'); }
          finally { setAdding(false); }
        }}>Agregar cuenta</button>
        <button className="btn btn-secondary btn-sm" onClick={loadData} disabled={loading}>
          <RefreshIcon size={14} className={loading ? 'spin' : ''} />
          Actualizar
        </button>
        </div>
      </div>

      {isWeb && (
        <div style={{
          background: 'linear-gradient(90deg, rgba(99, 102, 241, 0.12), rgba(139, 92, 246, 0.12))',
          border: '1px solid rgba(99, 102, 241, 0.3)',
          borderRadius: 'var(--radius-md)',
          padding: '12px 16px',
          marginBottom: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            <strong>Interfaz local:</strong> Las terminales y los perfiles se ejecutan en esta computadora. ChatGPT y los correos se abren en ventanas de navegador independientes por cuenta.
          </div>
        </div>
      )}

      <div className="codex-grid">
        {accounts.map((acc) => {
          const linkedProject = projects.find((p) => p.id === acc.current_project_id);
          const isAuthed = !!authStatus[acc.id];

          return (
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
                    <div className="codex-slot-email">
                      {acc.alias || acc.email || 'Sin identificador'}
                    </div>
                  </div>
                </div>

                <div className="dropdown-status">
                  <span className={`codex-status ${acc.status}`}>
                    <span className="codex-status-dot" />
                    {getStatusLabel(acc.status)}
                  </span>
                </div>
              </div>

              {/* Authentication Status Badge */}
              <div style={{ marginBottom: 12, padding: '6px 10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {isAuthed ? (
                  <span style={{ fontSize: 11, color: 'var(--status-available)', display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                    <CheckIcon size={13} /> Credenciales locales guardadas
                  </span>
                ) : (
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    ⚪ Sin autenticar (hacé clic en Login CLI)
                  </span>
                )}

                {!isAuthed && acc.slot_number === 1 && (
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: 10, padding: '2px 8px' }}
                    onClick={() => handleImportExisting(acc)}
                    title="Vincular tu cuenta actual de ~/.codex a este slot"
                  >
                    Vincular cuenta actual
                  </button>
                )}
              </div>

              {/* Status Switcher Pills */}
              <div style={{ marginTop: 8, marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Estado manual
                </div>
                <div className="status-select">
                  {(['available', 'working', 'limit', 'resting', 'unknown'] as CodexStatus[]).map((st) => (
                    <button
                      key={st}
                      className={`status-option ${st} ${acc.status === st ? 'active' : ''}`}
                      onClick={() => handleStatusChange(acc, st)}
                      title={`Marcar como ${getStatusLabel(st)}`}
                    >
                      {getStatusLabel(st)}
                    </button>
                  ))}
                </div>
              </div>

              {acc.notes && (
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', padding: '6px 10px', borderRadius: 'var(--radius-sm)', marginBottom: 12 }}>
                  {acc.notes}
                </div>
              )}

              {linkedProject && (
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <FolderGitIcon size={13} /> Proyecto actual: <button className="btn btn-ghost btn-sm" onClick={() => window.electronAPI.projects.openFolder(linkedProject.path).catch(err => error(err.message))}>{linkedProject.name}</button>
                </div>
              )}
              {acc.restore_at && <div style={{ fontSize: 12, marginBottom: 12, color: 'var(--text-secondary)' }}>Recordatorio: {new Date(acc.restore_at).toLocaleString()}</div>}

              <div className="codex-card-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => { setSelectedProjectId(acc.current_project_id || ''); setLaunchAccount(acc); }}
                  title="Abrir terminal interactiva integrada con OpenAI Codex"
                >
                  <PlayIcon size={12} /> Lanzar Codex
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenChatGPT(acc)}
                  title="Abrir ChatGPT en una nueva pestaña"
                >
                  <GlobeIcon size={12} /> ChatGPT Web
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleConfigure(acc)}
                  title="Iniciar sesión con codex login en la terminal"
                >
                  <SettingsIcon size={12} /> Login CLI
                </button>
                {acc.email && <button className="btn btn-secondary btn-sm" onClick={() => handleAssociatedEmail(acc)}>Correo</button>}

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownloadBat(acc)}
                  title="Descargar script .bat para abrir esta consola nativamente en Windows"
                >
                  ⚡ .bat
                </button>

                <button
                  className="btn btn-ghost btn-sm btn-icon"
                  onClick={() => {
                    setEditingAccount(acc);
                    setEditForm({
                      label: acc.label,
                      alias: acc.alias,
                      email: acc.email,
                      color: acc.color,
                      notes: acc.notes,
                      status: acc.status,
                      restore_at: acc.restore_at,
                    });
                  }}
                  title="Editar ranura"
                >
                  <EditIcon size={14} />
                </button>
              </div>

              <div className="codex-card-meta">
                <span>Perfil: .../{acc.profile_path.split(/\\|\//).pop()}</span>
                {acc.last_used && (
                  <span>Último uso: {new Date(acc.last_used).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Launch with Project Modal */}
      <Modal
        isOpen={!!launchAccount}
        onClose={() => setLaunchAccount(null)}
        title={`Lanzar Codex (Slot #${launchAccount?.slot_number} — ${launchAccount?.label})`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setLaunchAccount(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleLaunchSubmit}>
              <PlayIcon size={14} /> Iniciar Terminal
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Codex se abrirá en la terminal integrada, con la cuenta y el proyecto que elijas.
        </p>

        <div className="input-group">
          <label className="input-label">Directorio / Proyecto de trabajo</label>
          <select
            className="select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
          >
            <option value="">(Ninguno — Iniciar en la carpeta base)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.path})
              </option>
            ))}
          </select>
        </div>
      </Modal>

      {/* Edit Account Modal */}
      <Modal
        isOpen={!!editingAccount}
        onClose={() => setEditingAccount(null)}
        title={`Editar Ranura #${editingAccount?.slot_number}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setEditingAccount(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveEdit}>
              <CheckIcon size={14} /> Guardar Cambios
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Nombre / Etiqueta del Slot</label>
          <input
            type="text"
            className="input"
            value={editForm.label || ''}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
            placeholder="Ej. Principal, Backend, Frontend"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Alias / Identificador</label>
            <input
              type="text"
              className="input"
              value={editForm.alias || ''}
              onChange={(e) => setEditForm({ ...editForm, alias: e.target.value })}
              placeholder="Ej. dev-openai-01"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Correo Asociado</label>
            <input
              type="email"
              className="input"
              value={editForm.email || ''}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              placeholder="cuenta@ejemplo.com"
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Color de Distinción</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={editForm.color || '#6366f1'}
              onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
              style={{ width: 44, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
            <input
              type="text"
              className="input"
              value={editForm.color || ''}
              onChange={(e) => setEditForm({ ...editForm, color: e.target.value })}
              placeholder="#6366f1"
              style={{ width: 120 }}
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Notas Adicionales</label>
          <textarea
            className="textarea"
            value={editForm.notes || ''}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
            placeholder="Notas sobre límites de tokens, vencimiento de plan, etc."
          />
        </div>
        <div className="input-group">
          <label className="input-label" htmlFor="restore-at">Recordatorio de recuperación (opcional)</label>
          <input id="restore-at" type="datetime-local" className="input" value={editForm.restore_at ? new Date(new Date(editForm.restore_at).getTime() - new Date(editForm.restore_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onChange={e => setEditForm({ ...editForm, restore_at: e.target.value ? new Date(e.target.value).toISOString() : null })} />
          <span className="page-subtitle">Es una referencia manual; no cambia el estado ni consulta la cuota.</span>
        </div>
      </Modal>

      {/* Interactive Live Terminal Drawer (OpenDots / OpenManus style) */}
      <TerminalDrawer
        isOpen={!!terminalAccount}
        onClose={() => {
          setTerminalAccount(null);
          loadData();
        }}
        account={terminalAccount}
        allAccounts={accounts}
        onSelectAccount={(acc) => {
          setTerminalAccount(acc);
          setTerminalInitialCmd('');
          setTerminalProjectId(acc.current_project_id || '');
        }}
        projectId={terminalProjectId}
        initialCommand={terminalInitialCmd}
      />
    </div>
  );
};

export default CodexPage;
