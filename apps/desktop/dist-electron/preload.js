"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('chaty', {
    getAppInfo: () => electron_1.ipcRenderer.invoke('app:get-info'),
    windowControl: (action) => electron_1.ipcRenderer.invoke('window:control', action),
});
