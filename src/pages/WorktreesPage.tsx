import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  GitBranchIcon,
  PlusIcon,
  TerminalIcon,
  CodeIcon,
  TrashIcon,
  RefreshIcon,
  FolderIcon,
  CheckIcon,
} from '../components/Icons';
import { Project, CodexAccount, WorktreeInfo } from '../types/electron';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const WorktreesPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { success, error } = useToast();

  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<CodexAccount[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [worktrees, setWorktrees] = useState<WorktreeInfo[]>([]);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [launchAccountId, setLaunchAccountId] = useState('');

  // Modal State for Generating Worktrees
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState<boolean>(false);
  const [selectedSlotNumbers, setSelectedSlotNumbers] = useState<Set<number>>(new Set([1, 2]));

  const loadInitialData = async () => {
    try {
      const [fetchedProjects, fetchedAccounts] = await Promise.all([
        window.electronAPI.projects.getAll(),
        window.electronAPI.codex.getAccounts(),
      ]);

      const gitProjects = fetchedProjects.filter((p) => p.has_git);
      setProjects(gitProjects);
      setAccounts(fetchedAccounts);
      setLaunchAccountId(fetchedAccounts[0]?.id || '');

      const urlProjectId = searchParams.get('project');
      if (urlProjectId && gitProjects.some((p) => p.id === urlProjectId)) {
        setSelectedProjectId(urlProjectId);
      } else if (gitProjects.length > 0) {
        setSelectedProjectId(gitProjects[0].id);
      }
    } catch (err) {
      console.error(err);
      error('Error al inicializar proyectos con Git');
    }
  };

  const loadWorktrees = async (projectId: string) => {
    if (!projectId) {
      setWorktrees([]);
      return;
    }
    try {
      setActionLoading(true);
      const wtList = await window.electronAPI.worktrees.getForProject(projectId);
      setWorktrees(wtList);
    } catch (err) {
      console.error(err);
      error('Error al consultar git worktrees del proyecto');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadWorktrees(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleToggleSlot = (slot: number) => {
    setSelectedSlotNumbers((prev) => {
      const next = new Set(prev);
      if (next.has(slot)) next.delete(slot);
      else next.add(slot);
      return next;
    });
  };

  const handleCreateWorktrees = async () => {
    if (selectedSlotNumbers.size === 0) {
      error('Seleccioná al menos un slot para generar worktree');
      return;
    }

    try {
      setActionLoading(true);
      const accountPayload = Array.from(selectedSlotNumbers).map((slot_number) => ({
        slot_number,
      }));

      const results = await window.electronAPI.worktrees.create(selectedProjectId, accountPayload);
      const createdCount = results.filter((r) => r.success).length;
      const failed = results.filter(r => !r.success);
      if (failed.length && createdCount) error(`${failed.length} worktrees fallaron: ${failed[0].error}`);

      if (createdCount > 0) {
        success(`¡Se crearon ${createdCount} worktrees y ramas asociadas exitosamente!`);
        setIsGenerateModalOpen(false);
        loadWorktrees(selectedProjectId);
      } else {
        error(results[0]?.error || 'No se pudieron crear los worktrees');
      }
    } catch (err) {
      console.error(err);
      error('Error al crear los worktrees');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveWorktree = async (path: string, branch?: string) => {
    if (!confirm(`¿Eliminar el worktree en "${path}"? (No afectará a las ramas remotas).`)) return;
    try {
      setActionLoading(true);
      const res = await window.electronAPI.worktrees.remove(path);
      if (res.success) {
        success(`Worktree ${branch || ''} removido`);
        loadWorktrees(selectedProjectId);
      } else {
        error('No se pudo remover el worktree. Comprobá si tiene cambios sin guardar.');
      }
    } catch (err) {
      console.error(err);
      error(err instanceof Error ? err.message : 'Error al remover el worktree');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenVSCode = async (path: string) => {
    try {
      await window.electronAPI.projects.openVSCode(path);
      success('Abriendo worktree en VS Code...');
    } catch (err) {
      console.error(err);
      error('Error al abrir VS Code');
    }
  };

  const handleOpenTerminal = async (path: string) => {
    try {
      await window.electronAPI.projects.openTerminal(path);
      success('Terminal abierta en el worktree');
    } catch (err) {
      console.error(err);
      error('Error al abrir terminal');
    }
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Git Worktrees Multi-Cuenta</h1>
          <p className="page-subtitle">
            Trabajá en paralelo en múltiples cuentas de Codex sobre el mismo repositorio sin conflictos de rama ni duplicar datos.
          </p>
        </div>

        {selectedProjectId && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setIsGenerateModalOpen(true)}
            disabled={actionLoading}
          >
            <PlusIcon size={14} /> Crear Worktrees por Cuenta
          </button>
        )}
      </div>

      {/* Project Selector Bar */}
      <div className="card" style={{ marginBottom: 24, padding: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            Repositorio Seleccionado:
          </label>
          <select
            className="select"
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            style={{ flex: 1 }}
          >
            {projects.length === 0 ? (
              <option value="">No hay proyectos con Git registrados</option>
            ) : (
              projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.path}
                </option>
              ))
            )}
          </select>
          <select className="select" aria-label="Cuenta para worktree" value={launchAccountId} onChange={e => setLaunchAccountId(e.target.value)} style={{ maxWidth: 200 }}>
            {accounts.map(a => <option value={a.id} key={a.id}>#{a.slot_number} · {a.label}</option>)}
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => loadWorktrees(selectedProjectId)}
            disabled={actionLoading || !selectedProjectId}
            title="Refrescar ramas y worktrees"
          >
            <RefreshIcon size={14} className={actionLoading ? 'spin' : ''} />
          </button>
        </div>
      </div>

      {/* Worktrees Content */}
      {!selectedProjectId ? (
        <div className="empty-state">
          <GitBranchIcon size={48} />
          <h3>No se ha seleccionado ningún repositorio con Git</h3>
          <p>Primero registrá una carpeta de código que tenga control de versiones Git en la sección de Proyectos.</p>
        </div>
      ) : worktrees.length === 0 ? (
        <div className="empty-state">
          <GitBranchIcon size={48} />
          <h3>No hay worktrees adicionales en {currentProject?.name}</h3>
          <p>
            Generá worktrees aislados para que cada ranura de Codex trabaje en su propia carpeta y rama.
          </p>
          <button className="btn btn-primary" onClick={() => setIsGenerateModalOpen(true)}>
            <PlusIcon size={14} /> Generar Worktrees Aislados
          </button>
        </div>
      ) : (
        <div className="worktree-list">
          {worktrees.map((wt) => {
            const isMainRepo = wt.isMain;

            return (
              <div key={wt.path} className="worktree-item">
                <div className="worktree-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="worktree-branch">
                      {wt.branch || '(HEAD desacoplado)'}
                    </span>
                    {isMainRepo && (
                      <span className="project-tag node" style={{ fontSize: 10 }}>
                        Repositorio Principal
                      </span>
                    )}
                    <span className={wt.dirty ? 'worktree-dirty' : 'worktree-clean'} style={{ fontSize: 11, fontWeight: 600 }}>
                      &bull; {wt.dirty ? `Modificado (${wt.modifiedFiles} archivos)` : 'Limpio'}
                    </span>
                  </div>

                  <div className="worktree-path">{wt.path}</div>

                  <div className="worktree-meta">
                    {wt.lastCommit && <span>Último commit: {wt.lastCommit}</span>}
                  </div>
                </div>

                <div className="btn-group">
                  <button className="btn btn-primary btn-sm" disabled={!launchAccountId || !!wt.error} onClick={async () => {
                    try { await window.electronAPI.worktrees.launch(selectedProjectId, wt.path, launchAccountId); success('Codex abierto en el worktree elegido.'); }
                    catch (err) { error(err instanceof Error ? err.message : 'No se pudo iniciar Codex.'); }
                  }}>Codex</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenVSCode(wt.path)}
                    title="Abrir en VS Code"
                  >
                    <CodeIcon size={13} /> VS Code
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenTerminal(wt.path)}
                    title="Abrir terminal"
                  >
                    <TerminalIcon size={13} /> Terminal
                  </button>

                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.electronAPI.projects.openFolder(wt.path).catch(err => error(err.message))}
                    title="Abrir carpeta"
                  >
                    <FolderIcon size={13} />
                  </button>

                  {!isMainRepo && (
                    <button
                      className="btn btn-ghost btn-sm btn-icon btn-danger"
                      onClick={() => handleRemoveWorktree(wt.path, wt.branch)}
                      title="Eliminar este worktree"
                    >
                      <TrashIcon size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Generate Worktrees Modal */}
      <Modal
        isOpen={isGenerateModalOpen}
        onClose={() => setIsGenerateModalOpen(false)}
        title={`Crear Worktrees Aislados para ${currentProject?.name}`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsGenerateModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleCreateWorktrees} disabled={actionLoading}>
              <CheckIcon size={14} /> Crear Worktrees ({selectedSlotNumbers.size})
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Seleccioná para cuáles ranuras de OpenAI Codex querés aprovisionar carpetas de trabajo aisladas.
          Se creará una rama <code>codex/slot-X</code> para cada una.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {accounts.map((acc) => {
            const isChecked = selectedSlotNumbers.has(acc.slot_number);
            return (
              <div
                key={acc.id}
                onClick={() => handleToggleSlot(acc.slot_number)}
                style={{
                  background: isChecked ? 'var(--accent-indigo-dim)' : 'var(--bg-tertiary)',
                  border: `1px solid ${isChecked ? 'var(--accent-indigo)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 14px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  transition: 'all var(--transition-fast)',
                }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {}} // handled by parent onClick
                  style={{ accentColor: 'var(--accent-indigo)', pointerEvents: 'none' }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    Slot #{acc.slot_number} — {acc.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    Rama: codex/slot-{acc.slot_number}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>
    </div>
  );
};

export default WorktreesPage;
