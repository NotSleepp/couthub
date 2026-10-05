import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FolderGitIcon,
  PlusIcon,
  SearchIcon,
  CodeIcon,
  TerminalIcon,
  FolderIcon,
  GithubIcon,
  GitBranchIcon,
  PlayIcon,
  TrashIcon,
  EditIcon,
  CheckIcon,
  RefreshIcon,
} from '../components/Icons';
import { Project, CodexAccount } from '../types/electron';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();
  const isWeb = Boolean(window.electronAPI.isWeb);

  const [projects, setProjects] = useState<Project[]>([]);
  const [accounts, setAccounts] = useState<CodexAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const loadSequence = useRef(0);

  // Add / Edit Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [detecting, setDetecting] = useState<boolean>(false);
  const [projectForm, setProjectForm] = useState<Partial<Project>>({
    name: '',
    path: '',
    notes: '',
    has_git: 0,
    project_type: '',
    remote_url: '',
  });

  // Launch Codex in Project Modal
  const [launchProject, setLaunchProject] = useState<Project | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  const loadData = async () => {
    const sequence = ++loadSequence.current;
    try {
      setLoading(true);
      const [fetchedProjects, fetchedAccounts] = await Promise.all([
        window.electronAPI.projects.getAll(),
        window.electronAPI.codex.getAccounts(),
      ]);
      if (sequence !== loadSequence.current) return;
      setProjects(fetchedProjects);
      setAccounts(fetchedAccounts);
      if (fetchedAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(fetchedAccounts[0].id);
      }
    } catch (err) {
      console.error(err);
      error('Error al cargar proyectos');
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectDirectory = async () => {
    try {
      const selectedPath = await window.electronAPI.projects.selectDirectory();
      if (!selectedPath) return;

      setDetecting(true);
      const detection = await window.electronAPI.projects.detect(selectedPath);
      setProjectForm({
        name: detection.name,
        path: detection.path,
        has_git: detection.has_git ? 1 : 0,
        project_type: detection.project_type,
        remote_url: detection.remote_url,
        notes: '',
      });
      success(`Carpeta detectada: ${detection.name} (${detection.project_type || 'Proyecto genérico'})`);
    } catch (err) {
      console.error(err);
      error('Error al inspeccionar la carpeta seleccionada');
    } finally {
      setDetecting(false);
    }
  };

  const handleSaveProject = async () => {
    if (!projectForm.name || !projectForm.path) {
      error('El nombre y la ruta de la carpeta son obligatorios');
      return;
    }

    try {
      if (editingProject) {
        await window.electronAPI.projects.update(editingProject.id, projectForm);
        success('Proyecto actualizado');
      } else {
        await window.electronAPI.projects.add(projectForm);
        success('Proyecto registrado en el catálogo local');
      }
      setIsAddModalOpen(false);
      setEditingProject(null);
      await loadData();
    } catch (err) {
      console.error(err);
      error('Error al guardar proyecto');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`¿Remover "${name}" de Account Hub? (No se borrará ningún archivo de tu disco).`)) return;
    try {
      await window.electronAPI.projects.delete(id);
      success('Proyecto desvinculado');
      loadData();
    } catch (err) {
      console.error(err);
      error('Error al eliminar proyecto');
    }
  };

  const handleOpenVSCode = async (proj: Project) => {
    try {
      await window.electronAPI.projects.openVSCode(proj.path);
      success(`VS Code abierto en ${proj.name}`);
    } catch (err) {
      console.error(err);
      error('Error al abrir VS Code');
    }
  };

  const handleOpenTerminal = async (proj: Project) => {
    try {
      await window.electronAPI.projects.openTerminal(proj.path);
      success(`Terminal iniciada en ${proj.name}`);
    } catch (err) {
      console.error(err);
      error('Error al abrir terminal');
    }
  };

  const handleOpenFolder = async (proj: Project) => {
    try {
      await window.electronAPI.projects.openFolder(proj.path);
    } catch (err) {
      console.error(err);
      error('Error al abrir Explorador de archivos');
    }
  };

  const handleOpenGitHub = async (proj: Project) => {
    try {
      const res = await window.electronAPI.projects.openGitHub(proj.path);
      if (res.success) {
        success(`Abriendo repositorio en GitHub: ${res.url}`);
      } else {
        error('Este repositorio no tiene un remote origin en GitHub configurado');
      }
    } catch (err) {
      console.error(err);
      error('Error al abrir GitHub');
    }
  };

  const handleLaunchCodexInProject = async () => {
    if (!launchProject || !selectedAccountId) return;
    try {
      const acc = accounts.find((a) => a.id === selectedAccountId);
      await window.electronAPI.codex.launch(selectedAccountId, launchProject.id);
      await window.electronAPI.codex.updateAccount(selectedAccountId, {
        status: 'working',
        current_project_id: launchProject.id,
      });
      success(`Codex Slot #${acc?.slot_number || ''} iniciado en ${launchProject.name}`);
      setLaunchProject(null);
    } catch (err) {
      console.error(err);
      error('Error al lanzar instancia de Codex');
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.project_type.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Proyectos y Repositorios Locales</h1>
          <p className="page-subtitle">
            Vinculá carpetas de desarrollo para lanzar Codex en contexto, abrir terminales y crear worktrees paralelos.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
            title="Actualizar proyectos"
          >
            <RefreshIcon size={14} className={loading ? 'spin' : ''} />
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingProject(null);
              setProjectForm({
                name: '',
                path: '',
                notes: '',
                has_git: 0,
                project_type: '',
                remote_url: '',
              });
              setIsAddModalOpen(true);
            }}
            disabled={loading}
          >
            <PlusIcon size={14} /> Registrar Proyecto
          </button>
        </div>
      </div>

      <div className="search-bar">
        <SearchIcon size={16} />
        <input
          type="text"
          className="input"
          placeholder="Buscar proyectos por nombre, ruta o tecnología..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredProjects.length === 0 ? (
        <div className="empty-state">
          <FolderGitIcon size={48} />
          <h3>No hay proyectos registrados</h3>
          <p>Registrá tus repositorios de código para abrirlos al instante con cualquier cuenta de Codex.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingProject(null);
              setIsAddModalOpen(true);
            }}
            disabled={loading}
          >
            <PlusIcon size={14} /> Registrar Primer Proyecto
          </button>
        </div>
      ) : (
        <div className="project-grid">
          {filteredProjects.map((proj) => (
            <div key={proj.id} className="project-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 className="project-name">{proj.name}</h3>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => {
                      setEditingProject(proj);
                      setProjectForm({ ...proj });
                      setIsAddModalOpen(true);
                    }}
                    title="Editar"
                  >
                    <EditIcon size={14} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm btn-icon btn-danger"
                    onClick={() => handleDelete(proj.id, proj.name)}
                    title="Eliminar registro"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>

              <div className="project-path" title={proj.path}>
                {proj.path}
              </div>

              <div className="project-tags">
                {proj.has_git ? (
                  <span className="project-tag git">Git Repo</span>
                ) : (
                  <span className="project-tag" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    Sin Git
                  </span>
                )}
                {proj.project_type && (
                  <span className={`project-tag ${proj.project_type.toLowerCase()}`}>
                    {proj.project_type.toUpperCase()}
                  </span>
                )}
              </div>

              {proj.notes && (
                <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 16 }}>
                  {proj.notes}
                </p>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setLaunchProject(proj);
                  }}
                  title="Ejecutar OpenAI Codex en este repositorio"
                >
                  <PlayIcon size={12} /> Codex
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenVSCode(proj)}
                  title="Abrir en VS Code"
                >
                  <CodeIcon size={12} /> VS Code
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenTerminal(proj)}
                  title="Abrir terminal en esta carpeta"
                >
                  <TerminalIcon size={12} /> Terminal
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleOpenFolder(proj)}
                  title="Ver en Explorador de Windows"
                >
                  <FolderIcon size={12} /> Carpeta
                </button>

                {proj.has_git ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => navigate(`/worktrees?project=${proj.id}`)}
                    title="Crear o ver worktrees aislados"
                  >
                    <GitBranchIcon size={12} /> Worktrees
                  </button>
                ) : null}

                {proj.remote_url ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenGitHub(proj)}
                    title="Abrir en GitHub"
                  >
                    <GithubIcon size={12} /> GitHub
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProject(null);
        }}
        title={editingProject ? 'Editar Proyecto' : 'Registrar Nuevo Proyecto Local'}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingProject(null);
              }}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveProject} disabled={detecting}>
              <CheckIcon size={14} /> {editingProject ? 'Guardar Cambios' : 'Registrar'}
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Carpeta en Disco *</label>
          {isWeb && <p className="page-subtitle">En el navegador, ingresá la ruta completa de una carpeta de esta misma PC.</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              className="input"
              value={projectForm.path || ''}
              onChange={(e) => setProjectForm({ ...projectForm, path: e.target.value })}
              placeholder="C:\Users\...\proyecto"
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={handleSelectDirectory} disabled={detecting}>
              <FolderIcon size={14} />
              {detecting ? 'Detectando...' : isWeb ? 'Ingresar ruta...' : 'Examinar...'}
            </button>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Nombre del Proyecto *</label>
          <input
            type="text"
            className="input"
            value={projectForm.name || ''}
            onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
            placeholder="Mi Proyecto Web"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Tipo / Tecnología Detectada</label>
            <input
              type="text"
              className="input"
              value={projectForm.project_type || ''}
              onChange={(e) => setProjectForm({ ...projectForm, project_type: e.target.value })}
              placeholder="node, rust, python, etc."
            />
          </div>

          <div className="input-group">
            <label className="input-label">URL Remota (GitHub)</label>
            <input
              type="text"
              className="input"
              value={projectForm.remote_url || ''}
              onChange={(e) => setProjectForm({ ...projectForm, remote_url: e.target.value })}
              placeholder="https://github.com/usuario/repo"
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Notas Adicionales</label>
          <textarea
            className="textarea"
            value={projectForm.notes || ''}
            onChange={(e) => setProjectForm({ ...projectForm, notes: e.target.value })}
            placeholder="Comentarios sobre el entorno, scripts de inicio, etc."
          />
        </div>
      </Modal>

      {/* Launch Codex Modal */}
      <Modal
        isOpen={!!launchProject}
        onClose={() => setLaunchProject(null)}
        title={`Lanzar Codex en "${launchProject?.name}"`}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setLaunchProject(null)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleLaunchCodexInProject}>
              <PlayIcon size={14} /> Iniciar Codex
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          Seleccioná la cuenta de Codex con la que querés trabajar en <strong>{launchProject?.path}</strong>:
        </p>

        <div className="input-group">
          <label className="input-label">Cuenta / Slot</label>
          <select
            className="select"
            value={selectedAccountId}
            onChange={(e) => setSelectedAccountId(e.target.value)}
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                Slot #{acc.slot_number} — {acc.label} {acc.alias ? `(${acc.alias})` : ''} [{acc.status.toUpperCase()}]
              </option>
            ))}
          </select>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectsPage;
