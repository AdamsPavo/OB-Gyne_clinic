const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 720,
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false },
  });
  window.loadURL(process.env.ELECTRON_START_URL || `file://${path.join(__dirname, "../client/dist/index.html")}`);
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
