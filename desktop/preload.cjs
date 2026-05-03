const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cleanflowDesktop", {
  getRuntimeInfo: () => ipcRenderer.invoke("cleanflow:get-runtime-info"),
  pickDatabaseFile: () => ipcRenderer.invoke("cleanflow:pick-database-file"),
  openPath: (targetPath) => ipcRenderer.invoke("cleanflow:open-path", targetPath),
  showItemInFolder: (targetPath) => ipcRenderer.invoke("cleanflow:show-item-in-folder", targetPath),
  windowMinimize: () => ipcRenderer.invoke("cleanflow:window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("cleanflow:window-maximize"),
  windowClose: () => ipcRenderer.invoke("cleanflow:window-close")
});
