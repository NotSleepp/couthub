import { Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CodexPage from './pages/CodexPage';
import EmailsPage from './pages/EmailsPage';
import ProjectsPage from './pages/ProjectsPage';
import WorktreesPage from './pages/WorktreesPage';
import SettingsPage from './pages/SettingsPage';
import OnboardingPage from './pages/OnboardingPage';

function App() {
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [problem, setProblem] = useState('');
  const connect = () => {
    setProblem('');
    window.electronAPI.onboarding.isComplete().then(setOnboardingComplete).catch(err => setProblem(err.message));
  };

  useEffect(() => {
    connect();
  }, []);

  if (problem) return <div className="app-loading"><div className="connection-error" role="alert"><h2>No se pudo conectar con Account Hub</h2><p>{problem}</p><button className="btn btn-primary" onClick={connect}>Reintentar</button></div></div>;

  if (onboardingComplete === null) {
    return (
      <div className="app-loading">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!onboardingComplete) {
    return (
      <OnboardingPage
        onComplete={async () => {
          await window.electronAPI.onboarding.complete();
          setOnboardingComplete(true);
        }}
      />
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/codex" element={<CodexPage />} />
        <Route path="/emails" element={<EmailsPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/worktrees" element={<WorktreesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

export default App;
