import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('chaty', {
  getAppInfo: () => ipcRenderer.invoke('app:get-info') as Promise<{
    version: string;
    platform: string;
    theme: 'dark' | 'light';
  }>,
  windowControl: (action: 'minimize' | 'maximize' | 'close') => ipcRenderer.invoke('window:control', action) as Promise<void>,
});
