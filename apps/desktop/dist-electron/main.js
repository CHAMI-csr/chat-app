"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const node_path_1 = __importDefault(require("node:path"));
const isDev = !electron_1.app.isPackaged;
function createWindow() {
    const window = new electron_1.BrowserWindow({
        width: 1440,
        height: 920,
        minWidth: 1050,
        minHeight: 680,
        backgroundColor: '#f7f7f4',
        title: 'Chaty',
        titleBarStyle: 'hidden',
        autoHideMenuBar: true,
        webPreferences: {
            preload: node_path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
        },
    });
    if (isDev)
        void window.loadURL('http://localhost:5173');
    else
        void window.loadFile(node_path_1.default.join(__dirname, '../dist/index.html'));
}
electron_1.ipcMain.handle('app:get-info', () => ({
    version: electron_1.app.getVersion(),
    platform: process.platform,
    theme: electron_1.nativeTheme.shouldUseDarkColors ? 'dark' : 'light',
}));
electron_1.ipcMain.handle('window:control', (_event, action) => {
    const window = electron_1.BrowserWindow.getFocusedWindow();
    if (!window)
        return;
    if (action === 'minimize')
        window.minimize();
    if (action === 'maximize')
        window.isMaximized() ? window.unmaximize() : window.maximize();
    if (action === 'close')
        window.close();
});
electron_1.app.whenReady().then(() => {
    createWindow();
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
        electron_1.app.quit();
});
