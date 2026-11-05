interface Window {
  chaty?: {
    getAppInfo: () => Promise<{ version: string; platform: string; theme: 'dark' | 'light' }>;
    windowControl: (action: 'minimize' | 'maximize' | 'close') => Promise<void>;
  };
}
