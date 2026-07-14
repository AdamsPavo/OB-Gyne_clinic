const { contextBridge } = require("electron");
contextBridge.exposeInMainWorld("clinicDesktop", { isDesktop: true });
