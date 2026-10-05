import React, { useState, useEffect } from 'react';
import {
  CpuIcon,
  CheckIcon,
  AlertTriangleIcon,
  RefreshIcon,
  PlayIcon,
} from '../components/Icons';
import { DetectedTools, Settings } from '../types/electron';

interface OnboardingPageProps {
  onComplete: () => Promise<void>;
}

export const OnboardingPage: React.FC<OnboardingPageProps> = ({ onComplete }) => {
  const [step, setStep] = useState<number>(1);
  const [tools, setTools] = useState<DetectedTools | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [problem, setProblem] = useState('');
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<Partial<Settings>>({
    preferredBrowser: 'chrome',
    preferredTerminal: 'powershell',
    preferredEditor: 'vscode',
  });

  const runDiagnostics = async () => {
    setScanning(true);
    try {
      const detected = await window.electronAPI.settings.detectTools();
      setTools(detected);
    } catch (err) {
      console.error('Error detecting tools:', err);
    } finally {
      setScanning(false);
    }
  };

  useEffect(() => {
    if (step === 2 && !tools) {
      runDiagnostics();
    }
  }, [step]);

  const handleFinish = async () => {
    if (saving) return;
    setSaving(true); setProblem('');
    try {
      await window.electronAPI.settings.update(settings);
      await onComplete();
    } catch (err) {
      setProblem(err instanceof Error ? err.message : 'No se pudo guardar la configuración.');
    } finally { setSaving(false); }
  };

  return (
    <div className="onboarding">
      <div className="onboarding-container card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-default)' }}>
        {problem && <div className="connection-error" role="alert">{problem}</div>}
        <div className="onboarding-logo">
          <div className="onboarding-logo-icon">
            <CpuIcon size={24} />
          </div>
          <span>Account Hub</span>
        </div>

        <div className="onboarding-progress">
          <div className={`onboarding-progress-dot ${step >= 1 ? 'active' : ''} ${step > 1 ? 'done' : ''}`} />
          <div className={`onboarding-progress-dot ${step >= 2 ? 'active' : ''} ${step > 2 ? 'done' : ''}`} />
          <div className={`onboarding-progress-dot ${step >= 3 ? 'active' : ''} ${step > 3 ? 'done' : ''}`} />
          <div className={`onboarding-progress-dot ${step >= 4 ? 'active' : ''}`} />
        </div>

        {step === 1 && (
          <div>
            <h2 className="onboarding-step-title">Bienvenido a tu centro de multicuentas</h2>
            <p className="onboarding-step-desc">
              Account Hub mantiene perfiles independientes para tus sesiones de OpenAI Codex,
              ChatGPT web y tus cuentas de correo en Windows. Sin mezclar historiales, tokens ni perfiles.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
              <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ color: 'var(--accent-indigo-hover)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CpuIcon size={16} /> Codex CLI Aislado
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Ejecutá instancias independientes usando <code>CODEX_HOME</code> aislado por cuenta.
                </p>
              </div>

              <div style={{ background: 'var(--bg-tertiary)', padding: 16, borderRadius: 'var(--radius-md)' }}>
                <h4 style={{ color: 'var(--accent-emerald)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckIcon size={16} /> Navegación Segura
                </h4>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  Perfiles independientes en Chrome/Edge con <code>--user-data-dir</code> específico.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setStep(2)}>
                Comenzar configuración &rarr;
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 className="onboarding-step-title">Detección de herramientas del sistema</h2>
                <p className="onboarding-step-desc">
                  Comprobando qué utilidades y navegadores tenés instalados en Windows.
                </p>
              </div>
              <button
                className="btn btn-secondary btn-sm"
                onClick={runDiagnostics}
                disabled={scanning}
              >
                <RefreshIcon size={14} className={scanning ? 'spin' : ''} />
                {scanning ? 'Detectando...' : 'Reescanear'}
              </button>
            </div>

            <div className="tool-list">
              <div className="tool-item">
                <span className="tool-name">Git</span>
                <span className={`tool-status ${tools?.git?.found ? 'found' : 'missing'}`}>
                  {tools?.git?.found ? <><CheckIcon size={14} /> {tools.git.version || 'Instalado'}</> : <><AlertTriangleIcon size={14} /> No detectado</>}
                </span>
              </div>

              <div className="tool-item">
                <span className="tool-name">OpenAI Codex CLI</span>
                <span className={`tool-status ${tools?.codex?.found ? 'found' : 'missing'}`}>
                  {tools?.codex?.found ? <><CheckIcon size={14} /> Instalado</> : <><AlertTriangleIcon size={14} /> No detectado (opcional)</>}
                </span>
              </div>

              <div className="tool-item">
                <span className="tool-name">Google Chrome</span>
                <span className={`tool-status ${tools?.chrome?.found ? 'found' : 'missing'}`}>
                  {tools?.chrome?.found ? <><CheckIcon size={14} /> Instalado</> : <><AlertTriangleIcon size={14} /> No detectado</>}
                </span>
              </div>

              <div className="tool-item">
                <span className="tool-name">Microsoft Edge</span>
                <span className={`tool-status ${tools?.edge?.found ? 'found' : 'missing'}`}>
                  {tools?.edge?.found ? <><CheckIcon size={14} /> Instalado</> : <><AlertTriangleIcon size={14} /> No detectado</>}
                </span>
              </div>

              <div className="tool-item">
                <span className="tool-name">Visual Studio Code</span>
                <span className={`tool-status ${tools?.vscode?.found ? 'found' : 'missing'}`}>
                  {tools?.vscode?.found ? <><CheckIcon size={14} /> Instalado</> : <><AlertTriangleIcon size={14} /> No detectado</>}
                </span>
              </div>

              <div className="tool-item">
                <span className="tool-name">Windows Terminal</span>
                <span className={`tool-status ${tools?.windowsTerminal?.found ? 'found' : 'missing'}`}>
                  {tools?.windowsTerminal?.found ? <><CheckIcon size={14} /> Instalado</> : <><AlertTriangleIcon size={14} /> PowerShell clásico disponible</>}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={() => setStep(1)}>
                &larr; Volver
              </button>
              <button className="btn btn-primary" onClick={() => setStep(3)}>
                Siguiente &rarr;
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="onboarding-step-title">Preferencias iniciales</h2>
            <p className="onboarding-step-desc">
              Elegí el navegador y la terminal predeterminada para lanzar perfiles aislados.
            </p>

            <div className="input-group">
              <label className="input-label">Navegador para aislar perfiles</label>
              <select
                className="select"
                value={settings.preferredBrowser}
                onChange={(e) => setSettings({ ...settings, preferredBrowser: e.target.value })}
              >
                <option value="chrome">Google Chrome (Recomendado)</option>
                <option value="edge">Microsoft Edge</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Terminal para ejecutar Codex</label>
              <select
                className="select"
                value={settings.preferredTerminal}
                onChange={(e) => setSettings({ ...settings, preferredTerminal: e.target.value })}
              >
                <option value="wt">Windows Terminal (wt.exe)</option>
                <option value="powershell">PowerShell</option>
                <option value="cmd">Command Prompt (cmd.exe)</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label">Editor de código preferido</label>
              <select
                className="select"
                value={settings.preferredEditor}
                onChange={(e) => setSettings({ ...settings, preferredEditor: e.target.value })}
              >
                <option value="vscode">Visual Studio Code</option>
                <option value="cursor">Cursor</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
              <button className="btn btn-secondary" onClick={() => setStep(2)}>
                &larr; Volver
              </button>
              <button className="btn btn-primary" onClick={() => setStep(4)}>
                Siguiente &rarr;
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(34, 197, 94, 0.15)',
              color: 'var(--status-available)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px'
            }}>
              <CheckIcon size={28} />
            </div>

            <h2 className="onboarding-step-title">¡Todo listo para trabajar!</h2>
            <p className="onboarding-step-desc" style={{ maxWidth: 440, margin: '0 auto 28px' }}>
              Ya se crearon automáticamente 6 ranuras aisladas para Codex, tus grupos iniciales de correo
              y la base de datos local. Completá el inicio de sesión de cada cuenta para empezar.
            </p>

            <button className="btn btn-primary" disabled={saving} style={{ padding: '12px 28px', fontSize: 15 }} onClick={handleFinish}>
              <PlayIcon size={16} /> Entrar a Account Hub
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingPage;
