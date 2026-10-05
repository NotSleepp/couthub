// Type definitions for the Electron API exposed via preload
export type CodexStatus = 'available' | 'working' | 'limit' | 'resting' | 'unknown';
export type EmailProvider = 'gmail' | 'outlook' | 'other';

export interface CodexAccount {
  id: string;
  slot_number: number;
  label: string;
  email: string;
  alias: string;
  color: string;
  avatar: string | null;
  status: CodexStatus;
  notes: string;
  last_used: string | null;
  restore_at: string | null;
  current_project_id: string | null;
  profile_path: string;
  configured: number;
  created_at: string;
  updated_at: string;
}

export interface EmailAccount {
  id: string;
  email: string;
  name: string;
  alias: string;
  provider: EmailProvider;
  group_name: string;
  color: string;
  notes: string;
  browser_profile: string;
  url: string;
  favorite: number;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  has_git: number;
  project_type: string;
  remote_url: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Group {
  id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  action: string;
  details: string;
  created_at: string;
}

export interface DashboardStats {
  codex: {
    total: number;
    available: number;
    working: number;
    limit: number;
    resting: number;
    unknown: number;
  };
  emails: {
    total: number;
    favorites: number;
  };
  projects: {
    total: number;
  };
  recentActivity: ActivityLog[];
}

export interface ToolInfo {
  found: boolean;
  version?: string;
  path?: string;
}

export interface DetectedTools {
  git: ToolInfo;
  codex: ToolInfo;
  chrome: ToolInfo;
  edge: ToolInfo;
  vscode: ToolInfo;
  windowsTerminal: ToolInfo;
  powershell: ToolInfo;
  node: ToolInfo;
}

export interface Settings {
  preferredBrowser: string;
  preferredTerminal: string;
  preferredEditor: string;
  profilesDir: string;
  worktreesDir: string;
  theme: string;
  startWithWindows: boolean;
  startMinimized: boolean;
  minimizeToTray: boolean;
  batchOpenInterval: number;
  globalShortcut: string;
  onboardingComplete: boolean;
}

export interface WorktreeInfo {
  isMain?: boolean;
  locked?: boolean;
  error?: string;
  path: string;
  head?: string;
  branch?: string;
  bare?: boolean;
  detached?: boolean;
  dirty: boolean;
  lastCommit: string;
  modifiedFiles: number;
}

export interface OpenProgress {
  opened: number;
  total: number;
  cancelled: boolean;
  failed: number;
  done: boolean;
  errors: { id: string; error: string }[];
}

export interface ProjectDetection {
  name: string;
  path: string;
  has_git: boolean;
  project_type: string;
  remote_url: string;
}

// Electron API interface
export interface ElectronAPI {
  isWeb?: boolean;
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
  };
  settings: {
    getAll: () => Promise<Settings>;
    update: (settings: Partial<Settings>) => Promise<void>;
    detectTools: () => Promise<DetectedTools>;
  };
  codex: {
    addAccount: (data?: { label?: string; color?: string }) => Promise<string>;
    getAccounts: () => Promise<CodexAccount[]>;
    getAccount: (id: string) => Promise<CodexAccount>;
    updateAccount: (id: string, data: Partial<CodexAccount>) => Promise<CodexAccount>;
    launch: (accountId: string, projectId?: string) => Promise<{ success: boolean; pid: number }>;
    configure: (accountId: string) => Promise<{ success: boolean }>;
    getProfilePath: (accountId: string) => Promise<string>;
    isAuthenticated: (accountId: string) => Promise<boolean>;
    logout: (accountId: string) => Promise<{ success: boolean }>;
    importExisting: (accountId: string) => Promise<{ success: boolean }>;
    generateLauncher: (accountId: string, projectId?: string) => Promise<{ filename: string; content: string; batPath: string }>;
  };
  chatgpt: {
    open: (accountId: string) => Promise<{ success: boolean; pid: number }>;
  };
  emails: {
    getAll: () => Promise<EmailAccount[]>;
    search: (query: string) => Promise<EmailAccount[]>;
    getByGroup: (group: string) => Promise<EmailAccount[]>;
    add: (data: Partial<EmailAccount>) => Promise<string>;
    update: (id: string, data: Partial<EmailAccount>) => Promise<EmailAccount>;
    delete: (id: string) => Promise<void>;
    import: (data: Partial<EmailAccount>[]) => Promise<{ count: number; ids: string[] }>;
    open: (id: string) => Promise<{ success: boolean; pid: number }>;
    openMultiple: (ids: string[], interval: number) => Promise<OpenProgress>;
    onOpenProgress: (callback: (progress: OpenProgress) => void) => () => void;
    cancelBatch: () => Promise<void>;
    getProgress: () => Promise<OpenProgress>;
  };
  groups: {
    getAll: () => Promise<Group[]>;
    add: (name: string) => Promise<string>;
    delete: (id: string) => Promise<void>;
  };
  projects: {
    getAll: () => Promise<Project[]>;
    add: (data: Partial<Project>) => Promise<string>;
    update: (id: string, data: Partial<Project>) => Promise<Project>;
    delete: (id: string) => Promise<void>;
    detect: (dirPath: string) => Promise<ProjectDetection>;
    openFolder: (path: string) => Promise<void>;
    openTerminal: (path: string) => Promise<{ success: boolean }>;
    openVSCode: (path: string) => Promise<{ success: boolean }>;
    openGitHub: (path: string) => Promise<{ success: boolean; url: string }>;
    selectDirectory: () => Promise<string | null>;
  };
  worktrees: {
    launch: (projectId: string, path: string, accountId: string) => Promise<{ success: boolean; pid: number }>;
    getForProject: (projectId: string) => Promise<WorktreeInfo[]>;
    create: (projectId: string, accounts: { slot_number: number }[]) => Promise<{ slot: number; success: boolean; error?: string; path?: string; branch?: string }[]>;
    remove: (path: string) => Promise<{ success: boolean }>;
    getStatus: (path: string) => Promise<{ branch: string; lastCommit: string; dirty: boolean; modifiedFiles: { status: string; file: string }[] }>;
  };
  process: {
    checkRunning: (type: string, id: string) => Promise<boolean>;
  };
  terminal: {
    start: (options: { accountId: string; projectId?: string; mode: 'codex' | 'login' | 'browser-login' | 'shell' }) => Promise<{ sessionId: string; pid: number; isRunning: boolean; cwd: string }>;
    input: (id: string, data: string) => Promise<void>;
    output: (id: string, cursor: number, generation?: string) => Promise<{ lines: { id: number; text: string }[]; nextIndex: number; generation: string; reset: boolean; truncated: boolean; isRunning: boolean; pid: number; exitCode: number | null }>;
    resize: (id: string, cols: number, rows: number) => Promise<void>;
    kill: (id: string) => Promise<void>;
    clear: (id: string) => Promise<{ nextIndex: number }>;
  };
  system: { openExternal: (url: string) => Promise<{ success: boolean; url: string }> };
  launchers: { openFolder: () => Promise<boolean> };
  logs: {
    getRecent: () => Promise<string[]>;
  };
  activity: {
    log: (action: string, details: Record<string, unknown>) => Promise<void>;
  };
  dashboard: {
    getStats: () => Promise<DashboardStats>;
  };
  config: {
    export: () => Promise<boolean>;
    import: () => Promise<boolean>;
    exportData: () => Promise<Record<string, unknown>>;
    importData: (data: unknown) => Promise<boolean>;
  };
  onboarding: {
    isComplete: () => Promise<boolean>;
    complete: () => Promise<void>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
