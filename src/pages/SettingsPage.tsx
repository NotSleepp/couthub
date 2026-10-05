import React, { useState, useEffect } from 'react';
import {
  RefreshIcon,
  CheckIcon,
  AlertTriangleIcon,
  DownloadIcon,
  UploadIcon,
} from '../components/Icons';
import { Settings, DetectedTools } from '../types/electron';
import { useToast } from '../components/Toast';

export const SettingsPage: React.FC = () => {
  const { success, error } = useToast();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [tools, setTools] = useState<DetectedTools | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [scanning, setScanning] = useState<boolean>(false);
  const [loadError, setLoadError] = useState('');

  const loadData = async () => {
    setLoadError('');
    try {
      const [fetchedSettings, fetchedTools, fetchedLogs] = await Promise.all([
        window.electronAPI.settings.getAll(),
        window.electronAPI.settings.detectTools(),
        window.electronAPI.logs.getRecent(),
      ]);
      setSettings(fetchedSettings);
      setTools(fetchedTools);
      setLogs(fetchedLogs);
    } catch (err) {
      console.error(err);
      setLoadError(err instanceof Error ? err.message : 'No se pudo cargar la configuración.');
      error('Error al cargar configuración');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdate = async (key: keyof Settings, value: unknown) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    try {
      await window.electronAPI.settings.update({ [key]: value });
      setSettings(current => current ? { ...current, [key]: value } : updated);
      success('Configuración guardada');
    } catch (err) {
      console.error(err);
      error(err instanceof Error ? err.message : 'Error al guardar configuración');
    }
  };

  const handleRescanTools = async () => {
    setScanning(true);
    try {
      const res = await window.electronAPI.settings.detectTools();
      setTools(res);
      success('Detección del sistema completada');
    } catch (err) {
      console.error(err);
      error('Error al detectar herramientas');
    } finally {
      setScanning(false);
    }
  };

  const handleExportConfig = async () => {
    try {
      const exported = await window.electronAPI.config.export();
      if (exported) {
        success('Copia de seguridad exportada correctamente');
      }
    } catch (err) {
      console.error(err);
      error('Error al exportar configuración');
    }
  };

  const handleImportConfig = async () => {
    try {
      const imported = await window.electronAPI.config.import();
      if (imported) {
        success('Copia de seguridad restaurada. Recargando datos...');
        loadData();
      }
    } catch (err) {
      console.error(err);
      error('Error al importar copia de seguridad');
    }
  };

  if (!settings) {
    return (
      <div className="page">
        {loadError ? <div className="connection-error" role="alert">{loadError} <button className="btn btn-secondary" onClick={loadData}>Reintentar</button></div> : <div className="loading-spinner" />}
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Configuración y Diagnóstico</h1>
        <p className="page-subtitle">
          Ajustes generales, herramientas detectadas en Windows y copias de seguridad de la base de datos.
        </p>
      </div>

      {/* System Diagnostics & Detected Tools */}
      <div className="settings-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 className="settings-section-title" style={{ margin: 0, border: 'none' }}>
            Herramientas del Sistema Detectadas
          </h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleRescanTools}
            disabled={scanning}
          >
            <RefreshIcon size={14} className={scanning ? 'spin' : ''} />
            {scanning ? 'Escaneando...' : 'Volver a detectar'}
          </button>
        </div>

        <div className="tool-list">
          <div className="tool-item">
            <div>
              <div className="tool-name">Git</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tools?.git.path || 'git.exe'}
              </div>
            </div>
            <span className={`tool-status ${tools?.git.found ? 'found' : 'missing'}`}>
              {tools?.git.found ? <><CheckIcon size={14} /> {tools.git.version || 'Detectado'}</> : <><AlertTriangleIcon size={14} /> No encontrado</>}
            </span>
          </div>

          <div className="tool-item">
            <div>
              <div className="tool-name">OpenAI Codex CLI</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tools?.codex.path || 'codex'}
              </div>
            </div>
            <span className={`tool-status ${tools?.codex.found ? 'found' : 'missing'}`}>
              {tools?.codex.found ? <><CheckIcon size={14} /> {tools.codex.version || 'Instalado'}</> : <><AlertTriangleIcon size={14} /> No detectado</>}
            </span>
          </div>

          <div className="tool-item">
            <div>
              <div className="tool-name">Windows PowerShell</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tools?.powershell?.version || 'PowerShell 5.1'} &bull; Terminal principal para instancias de Codex
              </div>
            </div>
            <span className={`tool-status ${tools?.powershell.found ? 'found' : 'missing'}`}>
              {tools?.powershell.found ? 'Detectada' : 'No encontrada'}
            </span>
          </div>

          <div className="tool-item">
            <div>
              <div className="tool-name">Google Chrome</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tools?.chrome.path || 'chrome.exe'}
              </div>
            </div>
            <span className={`tool-status ${tools?.chrome.found ? 'found' : 'missing'}`}>
              {tools?.chrome.found ? <><CheckIcon size={14} /> Instalado</> : <><AlertTriangleIcon size={14} /> No encontrado</>}
            </span>
          </div>

          <div className="tool-item">
            <div>
              <div className="tool-name">Microsoft Edge</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tools?.edge.path || 'msedge.exe'}
              </div>
            </div>
            <span className={`tool-status ${tools?.edge.found ? 'found' : 'missing'}`}>
              {tools?.edge.found ? <><CheckIcon size={14} /> Instalado</> : <><AlertTriangleIcon size={14} /> No encontrado</>}
            </span>
          </div>

          <div className="tool-item">
            <div>
              <div className="tool-name">Editor de Código (VS Code / Cursor)</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {tools?.vscode?.found ? tools.vscode.path : 'VS Code no detectado (se abrirá en Explorador o podés instalarlo)'}
              </div>
            </div>
            <span className={`tool-status ${tools?.vscode?.found ? 'found' : 'missing'}`}>
              {tools?.vscode?.found ? <><CheckIcon size={14} /> {tools.vscode.version || 'Instalado'}</> : 'Opcional'}
            </span>
          </div>
        </div>
      </div>

      {/* General Preferences */}
      <div className="settings-section">
        <h2 className="settings-section-title">Preferencias Generales de Lanzamiento</h2>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Navegador para aislar perfiles</div>
            <div className="settings-row-desc">Navegador usado al abrir ChatGPT y cuentas de correo.</div>
          </div>
          <select
            className="select"
            style={{ width: 220 }}
            value={settings.preferredBrowser}
            onChange={(e) => handleUpdate('preferredBrowser', e.target.value)}
          >
            <option value="chrome">Google Chrome</option>
            <option value="edge">Microsoft Edge</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Terminal predeterminada</div>
            <div className="settings-row-desc">Aplicación que ejecutará las instancias de OpenAI Codex.</div>
          </div>
          <select
            className="select"
            style={{ width: 220 }}
            value={settings.preferredTerminal}
            onChange={(e) => handleUpdate('preferredTerminal', e.target.value)}
          >
            <option value="wt">Windows Terminal (wt.exe)</option>
            <option value="powershell">PowerShell</option>
            <option value="cmd">Command Prompt (cmd.exe)</option>
          </select>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Intervalo de apertura por lotes</div>
            <div className="settings-row-desc">Segundos de espera entre cada ventana para evitar saturar la CPU.</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number"
              min={1}
              max={10}
              className="input"
              style={{ width: 80, textAlign: 'center' }}
              value={settings.batchOpenInterval}
              onChange={(e) => handleUpdate('batchOpenInterval', parseInt(e.target.value) || 2)}
            />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>segundos</span>
          </div>
        </div>
      </div>

      {/* Windows Integration */}
      <div className="settings-section">
        <h2 className="settings-section-title">Editor preferido</h2>
        <select aria-label="Editor preferido" className="select" value={settings.preferredEditor === 'code' ? 'vscode' : settings.preferredEditor} onChange={e => handleUpdate('preferredEditor', e.target.value)}>
          <option value="vscode">Visual Studio Code</option><option value="cursor">Cursor</option>
        </select>
      </div>
      <div className="settings-section">
        <h2 className="settings-section-title">Integración con Windows</h2>
        {window.electronAPI.isWeb && <p className="page-subtitle">Estas preferencias se aplican al abrir la aplicación de escritorio.</p>}

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Minimizar a la bandeja del sistema (Tray)</div>
            <div className="settings-row-desc">Al cerrar la ventana, la aplicación sigue disponible junto al reloj.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.minimizeToTray}
            onChange={(e) => handleUpdate('minimizeToTray', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
          />
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Iniciar con Windows</div>
            <div className="settings-row-desc">Abrir Account Hub automáticamente al encender la computadora.</div>
          </div>
          <input
            type="checkbox"
            checked={settings.startWithWindows}
            onChange={(e) => handleUpdate('startWithWindows', e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--accent-indigo)', cursor: 'pointer' }}
          />
        </div>
      </div>

      {/* Backup & Restore */}
      <div className="settings-section">
        <div className="settings-row">
          <div><div className="settings-row-label">Iniciar minimizado</div><div className="settings-row-desc">Al iniciar, mostrar el icono junto al reloj y mantener oculta la ventana.</div></div>
          <input aria-label="Iniciar minimizado" type="checkbox" checked={settings.startMinimized} onChange={e => handleUpdate('startMinimized', e.target.checked)} />
        </div>
        <div className="settings-row">
          <div><div className="settings-row-label">Atajo para abrir Account Hub</div><div className="settings-row-desc">Por ejemplo: Alt+Shift+A. Dejalo vacío para desactivarlo.</div></div>
          <input aria-label="Atajo global" className="input" style={{ maxWidth: 220 }} defaultValue={settings.globalShortcut} onBlur={e => { if (e.target.value !== settings.globalShortcut) handleUpdate('globalShortcut', e.target.value.trim()); }} />
        </div>
      </div>
      <div className="settings-section">
        <h2 className="settings-section-title">Copias de Seguridad y Base de Datos</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          La copia incluye cuentas, grupos, proyectos y preferencias. Al restaurar se combinan los registros y se actualizan los coincidentes. No incluye contraseñas, sesiones de navegador ni credenciales de Codex; esas cuentas deben autenticarse de nuevo en otra computadora.
        </p>

        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-secondary" onClick={handleExportConfig}>
            <DownloadIcon size={14} /> Exportar Copia de Seguridad
          </button>
          <button className="btn btn-secondary" onClick={handleImportConfig}>
            <UploadIcon size={14} /> Restaurar desde Archivo
          </button>
        </div>
      </div>

      {/* Recent Application Logs */}
      <div className="settings-section">
        <h2 className="settings-section-title">Registros del Sistema (Logs)</h2>
        <div style={{ background: 'var(--bg-root)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 14, maxHeight: 180, overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
          {logs.length === 0 ? (
            <div>No hay logs registrados en esta sesión.</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} style={{ marginBottom: 4 }}>
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
