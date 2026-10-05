import React from 'react';
import { CpuIcon } from './Icons';

export const Titlebar: React.FC = () => {
  const isWeb = !!(window.electronAPI && window.electronAPI.isWeb);

  return (
    <div className="titlebar">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <div style={{
          width: 20,
          height: 20,
          borderRadius: 4,
          background: 'linear-gradient(135deg, var(--accent-indigo), var(--accent-violet))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff'
        }}>
          <CpuIcon size={12} />
        </div>
        <span className="titlebar-title">Account Hub</span>
        {isWeb ? (
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(99, 102, 241, 0.18)',
            color: 'var(--accent-indigo)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            fontWeight: 600,
            letterSpacing: 0.5
          }}>
            MODO WEB
          </span>
        ) : (
          <span style={{
            fontSize: 10,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'rgba(16, 185, 129, 0.15)',
            color: 'var(--status-available)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            fontWeight: 600,
            letterSpacing: 0.5
          }}>
            ESCRITORIO
          </span>
        )}
      </div>
      <div className="titlebar-spacer" />
      {!isWeb && <div style={{ display: 'flex', WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button className="btn btn-ghost" aria-label="Minimizar" onClick={() => window.electronAPI.window.minimize()}>−</button>
        <button className="btn btn-ghost" aria-label="Maximizar o restaurar" onClick={() => window.electronAPI.window.maximize()}>□</button>
        <button className="btn btn-ghost" aria-label="Cerrar ventana" onClick={() => window.electronAPI.window.close()}>×</button>
      </div>}
    </div>
  );
};
