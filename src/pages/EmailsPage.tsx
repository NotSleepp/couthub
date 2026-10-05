import React, { useState, useEffect } from 'react';
import {
  MailIcon,
  SearchIcon,
  PlusIcon,
  StarIcon,
  GlobeIcon,
  EditIcon,
  TrashIcon,
  UploadIcon,
  RefreshIcon,
  CheckIcon,
} from '../components/Icons';
import { EmailAccount, Group, OpenProgress, EmailProvider } from '../types/electron';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { parseEmailImport } from '../services/email-import';

export const EmailsPage: React.FC = () => {
  const { success, error } = useToast();

  const [emails, setEmails] = useState<EmailAccount[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTab, setSelectedTab] = useState<string>('all'); // 'all' | 'favorites' | group_name

  // Multi-select for batch opening
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProgress, setBatchProgress] = useState<OpenProgress | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newGroup, setNewGroup] = useState('');

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingEmail, setEditingEmail] = useState<EmailAccount | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importJsonText, setImportJsonText] = useState<string>('');

  // Form State
  const [emailForm, setEmailForm] = useState<Partial<EmailAccount>>({
    email: '',
    name: '',
    alias: '',
    provider: 'gmail',
    group_name: 'Personales',
    color: '#6366f1',
    notes: '',
    favorite: 0,
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedEmails, fetchedGroups] = await Promise.all([
        window.electronAPI.emails.getAll(),
        window.electronAPI.groups.getAll(),
      ]);
      setEmails(fetchedEmails);
      setSelectedIds(prev => new Set([...prev].filter(id => fetchedEmails.some(e => e.id === id))));
      setGroups(fetchedGroups);
    } catch (err) {
      console.error(err);
      error('Error al cargar correos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for batch open progress events
    return window.electronAPI.emails.onOpenProgress((progress) => {
      setBatchProgress(progress);
    });
  }, []);

  const handleToggleFavorite = async (account: EmailAccount) => {
    const newFav = account.favorite ? 0 : 1;
    try {
      await window.electronAPI.emails.update(account.id, { favorite: newFav });
      setEmails((prev) =>
        prev.map((e) => (e.id === account.id ? { ...e, favorite: newFav } : e))
      );
      success(newFav ? 'Marcado como favorito' : 'Eliminado de favoritos');
    } catch (err) {
      console.error(err);
      error('Error al actualizar favorito');
    }
  };

  const handleOpenSingle = async (account: EmailAccount) => {
    try {
      await window.electronAPI.emails.open(account.id);
      success(`Correo abierto: ${account.email}`);
    } catch (err) {
      console.error(err);
      error('Error al abrir navegador');
    }
  };

  const handleOpenBatch = async (ids: string[]) => {
    if (ids.length === 0 || batchBusy) return;
    setBatchBusy(true);
    try {
      const settings = await window.electronAPI.settings.getAll();
      const result = await window.electronAPI.emails.openMultiple(ids, settings.batchOpenInterval);
      setBatchProgress(result);
      if (result.failed) error(`${result.failed} correos no se abrieron: ${result.errors[0]?.error}`);
      else success(`${result.opened} correos abiertos${result.cancelled ? ' (lote cancelado)' : ''}.`);
    } catch (err) {
      console.error(err);
      error('Error en apertura por lotes');
    } finally { setBatchBusy(false); }
  };

  const handleDelete = async (id: string, email: string) => {
    if (!confirm(`¿Eliminar la cuenta ${email}? No se borrarán los datos de tu disco.`)) return;
    try {
      await window.electronAPI.emails.delete(id);
      success('Cuenta eliminada');
      loadData();
    } catch (err) {
      console.error(err);
      error('Error al eliminar');
    }
  };

  const handleSaveEmail = async () => {
    if (saving) return;
    if (!emailForm.email) {
      error('Ingresá una dirección de correo');
      return;
    }

    setSaving(true);
    try {
      if (editingEmail) {
        await window.electronAPI.emails.update(editingEmail.id, emailForm);
        success('Cuenta actualizada correctamente');
      } else {
        await window.electronAPI.emails.add(emailForm);
        success('Nueva cuenta agregada');
      }
      setIsAddModalOpen(false);
      setEditingEmail(null);
      loadData();
    } catch (err) {
      console.error(err);
      error(err instanceof Error ? err.message : 'Error al guardar la cuenta');
    } finally { setSaving(false); }
  };

  const handleImportSubmit = async () => {
    try {
      const items = parseEmailImport(importJsonText);
      const res = await window.electronAPI.emails.import(items);
      success(`¡Se importaron ${res.count} cuentas exitosamente!`);
      setIsImportModalOpen(false);
      setImportJsonText('');
      loadData();
    } catch (err) {
      console.error(err);
      error(err instanceof Error ? err.message : 'La importación no pudo completarse.');
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredEmails = emails.filter((e) => {
    const matchesSearch =
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.alias.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.group_name.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (selectedTab === 'favorites') return e.favorite === 1;
    if (selectedTab !== 'all') return e.group_name === selectedTab;
    return true;
  });

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Cuentas de Correo y Navegación</h1>
          <p className="page-subtitle">
            Cada correo abre su propio navegador aislado con sesión persistente (Gmail, Outlook, otros).
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadData}
            disabled={loading}
            title="Actualizar lista de correos"
          >
            <RefreshIcon size={14} className={loading ? 'spin' : ''} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setIsImportModalOpen(true)}
            title="Importar cuentas desde texto, CSV o JSON"
          >
            <UploadIcon size={14} /> Importar
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setEditingEmail(null);
              setEmailForm({
                email: '',
                name: '',
                alias: '',
                provider: 'gmail',
                group_name: groups[0]?.name || 'Personales',
                color: '#6366f1',
                notes: '',
                favorite: 0,
              });
              setIsAddModalOpen(true);
            }}
          >
            <PlusIcon size={14} /> Agregar Correo
          </button>
        </div>
      </div>

      {/* Search and Batch Open Bar */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
        <div className="search-bar" style={{ flex: 1, marginBottom: 0 }}>
          <SearchIcon size={16} />
          <input
            type="text"
            className="input"
            placeholder="Buscar por correo, alias, nombre o grupo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {selectedIds.size > 0 && (
          <button
            className="btn btn-primary"
            onClick={() => handleOpenBatch(Array.from(selectedIds))}
          >
            <GlobeIcon size={14} /> Abrir ({selectedIds.size}) seleccionados
          </button>
        )}

        <button
          className="btn btn-secondary"
          onClick={() => {
            const favIds = emails.filter((e) => e.favorite).map((e) => e.id);
            if (favIds.length === 0) {
              error('No tenés cuentas favoritas');
              return;
            }
            handleOpenBatch(favIds);
          }}
        >
          <StarIcon size={14} filled color="var(--accent-amber)" /> Abrir Favoritos
        </button>
      </div>

      {/* Batch Open Progress Indicator */}
      {batchProgress && (
        <div className="batch-progress card" style={{ padding: 14 }}>
          <div className="batch-progress-bar">
            <div
              className="batch-progress-fill"
              style={{ width: `${(batchProgress.opened / batchProgress.total) * 100}%` }}
            />
          </div>
          <div className="batch-progress-text">
            <span>{batchProgress.cancelled ? 'Cancelado' : batchProgress.done ? 'Finalizado' : 'Abriendo'}: {batchProgress.opened} abiertos, {batchProgress.failed} fallidos de {batchProgress.total}.</span>
            {!batchProgress.done && <button className="btn btn-secondary btn-sm" onClick={() => window.electronAPI.emails.cancelBatch().catch(err => error(err.message))}>Cancelar lote</button>}
            {batchProgress.done && <button className="btn btn-ghost btn-sm" onClick={() => setBatchProgress(null)}>Ocultar</button>}
          </div>
        </div>
      )}

      {/* Groups Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="input" aria-label="Nuevo grupo" placeholder="Nuevo grupo" value={newGroup} onChange={e => setNewGroup(e.target.value)} style={{ maxWidth: 220 }} />
        <button className="btn btn-secondary btn-sm" disabled={!newGroup.trim()} onClick={async () => {
          try { await window.electronAPI.groups.add(newGroup.trim()); setNewGroup(''); await loadData(); }
          catch (err) { error(err instanceof Error ? err.message : 'No se pudo crear el grupo.'); }
        }}>Crear grupo</button>
        {groups.some(g => g.name === selectedTab) && <button className="btn btn-ghost btn-sm" onClick={async () => {
          const group = groups.find(g => g.name === selectedTab);
          if (!group || !confirm('¿Eliminar este grupo? Sus correos se conservarán sin grupo.')) return;
          try { await window.electronAPI.groups.delete(group.id); setSelectedTab('all'); await loadData(); }
          catch (err) { error(err instanceof Error ? err.message : 'No se pudo eliminar el grupo.'); }
        }}>Eliminar grupo</button>}
      </div>
      <div className="tabs">
        <button
          className={`tab ${selectedTab === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedTab('all')}
        >
          Todas ({emails.length})
        </button>
        <button
          className={`tab ${selectedTab === 'favorites' ? 'active' : ''}`}
          onClick={() => setSelectedTab('favorites')}
        >
          ⭐ Favoritas ({emails.filter((e) => e.favorite).length})
        </button>
        {groups.map((g) => {
          const count = emails.filter((e) => e.group_name === g.name).length;
          return (
            <button
              key={g.id}
              className={`tab ${selectedTab === g.name ? 'active' : ''}`}
              onClick={() => setSelectedTab(g.name)}
            >
              {g.name} ({count})
            </button>
          );
        })}
      </div>

      {/* Email Accounts List */}
      {filteredEmails.length === 0 ? (
        <div className="empty-state">
          <MailIcon size={48} />
          <h3>No se encontraron cuentas de correo</h3>
          <p>Podés agregar tus cuentas de Gmail, Outlook u otros proveedores para aislarlas.</p>
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditingEmail(null);
              setIsAddModalOpen(true);
            }}
          >
            <PlusIcon size={14} /> Agregar Primera Cuenta
          </button>
        </div>
      ) : (
        <div className="email-list">
          {filteredEmails.map((acc) => {
            const isSelected = selectedIds.has(acc.id);

            return (
              <div
                key={acc.id}
                className={`email-item ${isSelected ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => handleToggleSelect(acc.id)}
                  style={{ accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
                />

                <span
                  className="email-dot"
                  style={{ background: acc.color || 'var(--accent-indigo)' }}
                />

                <button
                  className={`email-star ${acc.favorite ? 'active' : ''}`}
                  onClick={() => handleToggleFavorite(acc)}
                  style={{ background: 'none', border: 'none', padding: 0 }}
                  title={acc.favorite ? 'Quitar de favoritos' : 'Marcar favorito'}
                >
                  <StarIcon size={16} filled={!!acc.favorite} />
                </button>

                <div className="email-info">
                  <div className="email-name">
                    {acc.name || acc.alias || acc.email}
                    {acc.alias && acc.name && (
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 6 }}>
                        ({acc.alias})
                      </span>
                    )}
                  </div>
                  <div className="email-address">{acc.email}</div>
                </div>

                <span className="email-group-tag">
                  {acc.group_name || 'Sin grupo'}
                </span>

                <span className={`project-tag ${acc.provider === 'gmail' ? 'node' : acc.provider === 'outlook' ? 'python' : 'git'}`}>
                  {acc.provider.toUpperCase()}
                </span>

                <div className="btn-group">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleOpenSingle(acc)}
                    title="Abrir navegador con perfil de esta cuenta"
                  >
                    <GlobeIcon size={13} /> Abrir
                  </button>

                  <button
                    className="btn btn-ghost btn-sm btn-icon"
                    onClick={() => {
                      setEditingEmail(acc);
                      setEmailForm({
                        email: acc.email,
                        name: acc.name,
                        alias: acc.alias,
                        provider: acc.provider,
                        group_name: acc.group_name,
                        color: acc.color,
                        notes: acc.notes,
                        favorite: acc.favorite,
                        url: acc.url,
                      });
                      setIsAddModalOpen(true);
                    }}
                    title="Editar cuenta"
                  >
                    <EditIcon size={14} />
                  </button>

                  <button
                    className="btn btn-ghost btn-sm btn-icon btn-danger"
                    onClick={() => handleDelete(acc.id, acc.email)}
                    title="Eliminar cuenta"
                  >
                    <TrashIcon size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingEmail(null);
        }}
        title={editingEmail ? 'Editar Cuenta de Correo' : 'Nueva Cuenta de Correo'}
        footer={
          <>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                setEditingEmail(null);
              }}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleSaveEmail} disabled={saving}>
              <CheckIcon size={14} /> {editingEmail ? 'Guardar Cambios' : 'Crear Cuenta'}
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label">Dirección de Correo *</label>
          <input
            type="email"
            className="input"
            value={emailForm.email || ''}
            onChange={(e) => setEmailForm({ ...emailForm, email: e.target.value })}
            placeholder="ejemplo@gmail.com"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Nombre / Titular</label>
            <input
              type="text"
              className="input"
              value={emailForm.name || ''}
              onChange={(e) => setEmailForm({ ...emailForm, name: e.target.value })}
              placeholder="Juan Pérez"
            />
          </div>

          <div className="input-group">
            <label className="input-label">Alias Corto</label>
            <input
              type="text"
              className="input"
              value={emailForm.alias || ''}
              onChange={(e) => setEmailForm({ ...emailForm, alias: e.target.value })}
              placeholder="jp-personal"
            />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="input-group">
            <label className="input-label">Proveedor</label>
            <select
              className="select"
              value={emailForm.provider || 'gmail'}
              onChange={(e) => setEmailForm({ ...emailForm, provider: e.target.value as EmailProvider, url: '' })}
            >
              <option value="gmail">Gmail</option>
              <option value="outlook">Outlook / Hotmail</option>
              <option value="other">Otro Proveedor Web</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">Grupo / Categoría</label>
            <select
              className="select"
              value={emailForm.group_name || ''}
              onChange={(e) => setEmailForm({ ...emailForm, group_name: e.target.value })}
            >
              <option value="">Sin grupo</option>
              {groups.map((g) => (
                <option key={g.id} value={g.name}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="input-group">
          <label className="input-label" htmlFor="email-url">URL del correo {emailForm.provider === 'other' ? '(obligatoria)' : '(opcional)'}</label>
          <input id="email-url" className="input" type="url" value={emailForm.url || ''} placeholder="https://correo.empresa.com" onChange={e => setEmailForm({ ...emailForm, url: e.target.value })} />
        </div>
        <div className="input-group">
          <label className="input-label">Color de Distinción</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="color"
              value={emailForm.color || '#6366f1'}
              onChange={(e) => setEmailForm({ ...emailForm, color: e.target.value })}
              style={{ width: 44, height: 36, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
            <input
              type="text"
              className="input"
              value={emailForm.color || ''}
              onChange={(e) => setEmailForm({ ...emailForm, color: e.target.value })}
              style={{ width: 120 }}
            />
          </div>
        </div>

        <div className="input-group">
          <label className="input-label">Notas</label>
          <textarea
            className="textarea"
            value={emailForm.notes || ''}
            onChange={(e) => setEmailForm({ ...emailForm, notes: e.target.value })}
            placeholder="Detalles sobre uso, servicios vinculados, etc."
          />
        </div>

        <label className="checkbox-group">
          <input
            type="checkbox"
            checked={!!emailForm.favorite}
            onChange={(e) => setEmailForm({ ...emailForm, favorite: e.target.checked ? 1 : 0 })}
          />
          <span>Marcar como cuenta favorita (acceso rápido)</span>
        </label>
      </Modal>

      {/* Bulk Import Modal */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Cuentas de Correo"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setIsImportModalOpen(false)}>
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={handleImportSubmit}>
              <UploadIcon size={14} /> Importar Datos
            </button>
          </>
        }
      >
        <div className="input-group">
          <label className="input-label" htmlFor="emails-file">Seleccionar archivo TXT, CSV o JSON</label>
          <input id="emails-file" type="file" accept=".json,.txt,.csv" onChange={async e => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 2 * 1024 * 1024) { error('El archivo supera 2 MB.'); return; }
            setImportJsonText(await file.text());
          }} />
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Pegá un correo por línea, un CSV con encabezados email,name,group,provider o un array JSON. Para dominios propios, indicá el proveedor y la URL. Ejemplo JSON:
        </p>
        <pre style={{ background: 'var(--bg-root)', padding: 12, borderRadius: 'var(--radius-sm)', fontSize: 11, color: 'var(--accent-indigo-hover)', overflowX: 'auto', marginBottom: 16 }}>
{`[
  {
    "email": "usuario1@gmail.com",
    "name": "Usuario Uno",
    "alias": "u1",
    "provider": "gmail",
    "group_name": "Trabajo"
  }
]`}
        </pre>
        <div className="input-group">
          <textarea
            className="textarea"
            rows={8}
            value={importJsonText}
            onChange={(e) => setImportJsonText(e.target.value)}
            placeholder="Pegá aquí el JSON..."
          />
        </div>
      </Modal>
    </div>
  );
};

export default EmailsPage;
