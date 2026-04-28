const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("cleanflowDesktop", {
  getRuntimeInfo: () => ipcRenderer.invoke("cleanflow:get-runtime-info"),
  openPath: (targetPath) => ipcRenderer.invoke("cleanflow:open-path", targetPath),
  showItemInFolder: (targetPath) => ipcRenderer.invoke("cleanflow:show-item-in-folder", targetPath)
});
