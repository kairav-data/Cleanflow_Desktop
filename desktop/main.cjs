const { app, BrowserWindow, dialog, ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const BACKEND_HOST = process.env.CLEANFLOW_BACKEND_HOST || "127.0.0.1";
const BACKEND_PORT = process.env.CLEANFLOW_BACKEND_PORT || "38123";
const API_BASE_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`;

let backendProcess = null;
let mainWindow = null;

function projectRoot() {
  return path.join(__dirname, "..");
}

function ensureRuntimeDirectories() {
  const dataRoot = path.join(app.getPath("userData"), "data");
  const folders = ["uploads", "results", "logs", "config"];

  fs.mkdirSync(dataRoot, { recursive: true });
  for (const folder of folders) {
    fs.mkdirSync(path.join(dataRoot, folder), { recursive: true });
  }

  return {
    dataRoot,
    uploadsDir: path.join(dataRoot, "uploads"),
    resultsDir: path.join(dataRoot, "results"),
    logsDir: path.join(dataRoot, "logs"),
    configDir: path.join(dataRoot, "config")
  };
}

function loadEnvFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {};
  }

  const parsed = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      parsed[key] = value;
    }
  }

  return parsed;
}

function resolveBackendLaunchConfig() {
  if (app.isPackaged) {
    const backendDir = path.join(process.resourcesPath, "backend");
    return {
      command: path.join(backendDir, "CleanFlowBackend.exe"),
      args: [],
      cwd: backendDir
    };
  }

  return {
    command: "python",
    args: [path.join(projectRoot(), "backend", "desktop_backend.py")],
    cwd: projectRoot()
  };
}

function resolveEnvFilePaths(runtimePaths) {
  const candidates = [];

  if (app.isPackaged) {
    candidates.push(path.join(process.resourcesPath, "config", "root.env"));
    candidates.push(path.join(process.resourcesPath, "config", "backend.env"));
    return candidates;
  }

  const repoEnv = path.join(projectRoot(), ".env");
  const backendEnv = path.join(projectRoot(), "backend", ".env");

  if (fs.existsSync(repoEnv)) {
    candidates.push(repoEnv);
  }
  if (fs.existsSync(backendEnv)) {
    candidates.push(backendEnv);
  }
  const runtimeEnv = path.join(runtimePaths.configDir, ".env");
  if (fs.existsSync(runtimeEnv)) {
    candidates.push(runtimeEnv);
  }

  return candidates;
}

async function waitForBackend(timeoutMs = 30000) {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { method: "GET" });
      if (response.ok) {
        return;
      }
    } catch (error) {
      // Retry until the backend is ready.
    }

    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  throw new Error(`Timed out waiting for the CleanFlow backend at ${API_BASE_URL}.`);
}

function logBackendStream(stream, prefix, logger) {
  if (!stream) {
    return;
  }

  stream.on("data", (chunk) => {
    const message = chunk.toString().trim();
    if (message) {
      logger(`${prefix} ${message}`);
    }
  });
}

async function startBackend() {
  const runtimePaths = ensureRuntimeDirectories();
  const { command, args, cwd } = resolveBackendLaunchConfig();
  const envFilePaths = resolveEnvFilePaths(runtimePaths);
  const fileEnv = envFilePaths.reduce(
    (merged, filePath) => ({ ...merged, ...loadEnvFile(filePath) }),
    {}
  );
  const preferredEnvFile = envFilePaths.find((filePath) => /backend\.env$/i.test(filePath)) || envFilePaths[0] || "";

  backendProcess = spawn(command, args, {
    cwd,
    env: {
      ...process.env,
      ...fileEnv,
      BACKEND_HOST,
      BACKEND_PORT,
      CLEANFLOW_DATA_DIR: runtimePaths.dataRoot,
      CLEANFLOW_ENV_FILE: preferredEnvFile,
      FRONTEND_URL: "null"
    },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"]
  });

  logBackendStream(backendProcess.stdout, "[backend]", console.log);
  logBackendStream(backendProcess.stderr, "[backend]", console.error);

  backendProcess.on("exit", (code) => {
    if (!app.isQuitting && code !== 0) {
      console.error(`[backend] CleanFlow backend exited with code ${code}.`);
    }
  });

  await waitForBackend();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    title: "CleanFlow Desktop",
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });

  const rendererEntry = path.join(projectRoot(), "frontend", "dist", "index.html");
  mainWindow.loadFile(rendererEntry);
}

function stopBackend() {
  if (!backendProcess || backendProcess.killed) {
    return;
  }

  app.isQuitting = true;
  backendProcess.kill();
}

app.whenReady().then(async () => {
  app.setAppUserModelId("com.cleanflow.desktop");
  await startBackend();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
}).catch((error) => {
  console.error(error);
  dialog.showErrorBox("CleanFlow Desktop", `The desktop app could not start.\n\n${error.message}`);
  app.quit();
});

app.on("before-quit", () => {
  stopBackend();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("cleanflow:get-runtime-info", () => {
  const runtimePaths = ensureRuntimeDirectories();
  return {
    apiBaseUrl: API_BASE_URL,
    appDataDir: runtimePaths.dataRoot,
    uploadsDir: runtimePaths.uploadsDir,
    resultsDir: runtimePaths.resultsDir
  };
});

ipcMain.handle("cleanflow:open-path", async (_event, targetPath) => {
  if (!targetPath) {
    return { success: false, error: "No path provided." };
  }

  const result = await shell.openPath(targetPath);
  return result ? { success: false, error: result } : { success: true };
});

ipcMain.handle("cleanflow:show-item-in-folder", async (_event, targetPath) => {
  if (!targetPath) {
    return { success: false, error: "No path provided." };
  }

  shell.showItemInFolder(targetPath);
  return { success: true };
});
