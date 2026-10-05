import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import '@xterm/xterm/css/xterm.css';
import type { CodexAccount } from '../types/electron';
import { useToast } from './Toast';
import { downloadFile } from '../services/web-adapter';

interface TerminalDrawerProps {
  isOpen: boolean; onClose: () => void; account: CodexAccount | null;
  allAccounts?: CodexAccount[]; onSelectAccount?: (account: CodexAccount) => void;
  projectId?: string; projectName?: string; initialCommand?: string;
}
type Mode = 'codex' | 'login' | 'browser-login' | 'shell';
export const TerminalDrawer: React.FC<TerminalDrawerProps> = props => props.isOpen && props.account
  ? <TerminalContent key={[props.account.id, props.projectId, props.initialCommand].join(':')} {...props} /> : null;

const TerminalContent: React.FC<TerminalDrawerProps> = ({isOpen,onClose,account,allAccounts=[],onSelectAccount,projectId,projectName,initialCommand}) => {
  const {success,error}=useToast();
  const host=useRef<HTMLDivElement>(null);
  const terminal=useRef<Terminal | null>(null);
  const session=useRef('');
  const cursor=useRef(0);
  const [mode,setMode]=useState<Mode>('codex');
  const [revision,setRevision]=useState(0);
  const [running,setRunning]=useState(false);
  const [starting,setStarting]=useState(true);
  const [problem,setProblem]=useState('');
  const [cwd,setCwd]=useState('');
  const [authenticated,setAuthenticated]=useState(false);
  const [pid,setPid]=useState<number | null>(null);
  const activeMode:Mode=initialCommand?.includes('login') && revision===0 ? 'login' : mode;
  const report=(err:unknown)=>error(err instanceof Error ? err.message : 'La operación falló.');

  useEffect(()=>{
    if(!isOpen || !account || !host.current) return;
    let disposed=false, pollTimer:ReturnType<typeof setTimeout> | undefined, lastAuth=0, generation:string | undefined;
    setStarting(true);setRunning(false);setProblem('');setCwd('');setPid(null);setAuthenticated(false);
    session.current='';cursor.current=0;
    const term=new Terminal({cursorBlink:true,convertEol:false,fontSize:13,fontFamily:'Cascadia Code, Consolas, monospace',scrollback:5000,theme:{background:'#0d1117',foreground:'#e6edf3'},allowProposedApi:false});
    const fit=new FitAddon();
    term.loadAddon(fit);
    term.loadAddon(new WebLinksAddon((_event,url)=>{window.electronAPI.system.openExternal(url).catch(report);}));
    term.open(host.current);terminal.current=term;
    let inputQueue=Promise.resolve();
    const input=term.onData(data=>{
      if(!session.current) return;
      const id=session.current;
      inputQueue=inputQueue.then(()=>window.electronAPI.terminal.input(id,data)).catch(report);
    });
    const resize=()=>{
      if(disposed || !host.current?.clientWidth) return;
      fit.fit();
      if(session.current) window.electronAPI.terminal.resize(session.current,Math.max(2,Math.min(500,term.cols)),Math.max(2,Math.min(250,term.rows))).catch(()=>{});
    };
    const observer=new ResizeObserver(resize); observer.observe(host.current);
    const poll=async(id:string)=>{
      try {
        const result=await window.electronAPI.terminal.output(id,cursor.current,generation);
        if(disposed) return;
        if(result.reset) term.reset();
        generation=result.generation;
        if(result.truncated) term.writeln('\r\n[Se omitió salida antigua para limitar el uso de memoria.]');
        for(const line of result.lines) term.write(line.text);
        cursor.current=result.nextIndex;setRunning(result.isRunning);setPid(result.pid);
        if(Date.now()-lastAuth>3000) {
          lastAuth=Date.now();
          const value=await window.electronAPI.codex.isAuthenticated(account.id);
          if(!disposed) setAuthenticated(value);
        }
      } catch(err) {
        if(disposed) return;
        setProblem(err instanceof Error ? err.message : 'Se perdió la conexión con la terminal.');
        return;
      }
      if(!disposed) pollTimer=setTimeout(()=>poll(id),200);
    };
    window.electronAPI.terminal.start({accountId:account.id,projectId:projectId || undefined,mode:activeMode}).then(result=>{
      if(disposed) return;
      session.current=result.sessionId;setRunning(result.isRunning);setPid(result.pid);setCwd(result.cwd);setStarting(false);
      resize();term.focus();poll(result.sessionId);
    }).catch(err=>{if(!disposed){setProblem(err.message);setStarting(false);}});
    return ()=>{disposed=true;clearTimeout(pollTimer);observer.disconnect();input.dispose();term.dispose();terminal.current=null;session.current='';};
  },[isOpen,account?.id,projectId,activeMode,revision]);

  const switchMode=(next:Mode)=>{setMode(next);setRevision(r=>r+1);};
  const stop=async()=>{try{await window.electronAPI.terminal.kill(session.current);setRunning(false);success('Terminal detenida.');}catch(err){report(err);}};
  const logout=async()=>{
    if(!account || !confirm('¿Cerrar la sesión de esta cuenta y detener sus terminales integradas?')) return;
    try {await window.electronAPI.codex.logout(account.id);setAuthenticated(false);setRunning(false);success('Sesión local cerrada.');} catch(err){report(err);}
  };
  const download=async()=>{
    if(!account) return;
    try {const data=await window.electronAPI.codex.generateLauncher(account.id,projectId || undefined);downloadFile(data.filename,data.content,'application/x-bat');success('Lanzador guardado.');}catch(err){report(err);}
  };
  if(!isOpen || !account) return null;
  return <div className="modal-backdrop" style={{zIndex:1100,padding:20}} role="dialog" aria-modal="true" aria-label={'Terminal de '+account.label}>
    <div className="terminal-panel">
      <div className="terminal-tabs">
        {allAccounts.map(a=><button key={a.id} className={'btn btn-sm '+(a.id===account.id?'btn-primary':'btn-secondary')} onClick={()=>{setRevision(0);setMode('codex');onSelectAccount?.(a);}}>#{a.slot_number} {a.label}</button>)}
        <button className="btn btn-ghost" style={{marginLeft:'auto'}} onClick={onClose} aria-label="Cerrar terminal">✕</button>
      </div>
      <div className="terminal-toolbar">
        <div><strong>#{account.slot_number} · {account.label}</strong><span className="terminal-state">{starting?'Conectando…':running?'Terminal activa':'Terminal detenida'}{pid?' · PID '+pid:''}</span></div>
        <div className="terminal-actions">
          <button className="btn btn-sm btn-secondary" onClick={()=>switchMode('codex')}>Codex</button>
          <button className="btn btn-sm btn-secondary" onClick={()=>switchMode('login')}>Login con código</button>
          <button className="btn btn-sm btn-secondary" onClick={()=>switchMode('browser-login')}>Login en navegador</button>
          <button className="btn btn-sm btn-secondary" onClick={()=>switchMode('shell')}>PowerShell</button>
        </div>
      </div>
      <div className="terminal-location">{projectName || 'Directorio de trabajo'}: {cwd || '…'} · {authenticated?'Credenciales locales guardadas':'Sin credenciales locales'}</div>
      {problem && <div className="connection-error" role="alert">{problem} <button className="btn btn-sm btn-secondary" onClick={()=>setRevision(r=>r+1)}>Reintentar</button></div>}
      <div ref={host} className="terminal-surface" />
      <div className="terminal-footer">
        <span>Escribí directamente en la terminal. Ctrl+C interrumpe. Cerrar este panel conserva la sesión.</span>
        <div className="terminal-actions">
          <button className="btn btn-sm btn-secondary" onClick={()=>window.electronAPI.codex.launch(account.id,projectId || undefined).then(()=>success('Terminal externa abierta.')).catch(report)}>Abrir externa</button>
          <button className="btn btn-sm btn-secondary" onClick={download}>Guardar .bat</button>
          <button className="btn btn-sm btn-secondary" disabled={!authenticated} onClick={logout}>Cerrar sesión</button>
          <button className="btn btn-sm btn-danger" disabled={!running} onClick={stop}>Detener</button>
        </div>
      </div>
    </div>
  </div>;
};
