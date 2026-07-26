const { app, BrowserWindow, shell } = require("electron");
const fs = require("fs");
const http = require("http");
const path = require("path");

const appRoot = path.join(__dirname, "..");
const indexPath = path.join(appRoot, "index.html");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

let staticServer;

function resolveAsset(requestUrl) {
  const url = new URL(requestUrl, "http://127.0.0.1");
  const pathname = decodeURIComponent(url.pathname);
  const requestedPath = pathname === "/" ? indexPath : path.join(appRoot, pathname);
  const normalizedPath = path.normalize(requestedPath);

  if (!normalizedPath.startsWith(appRoot)) {
    return null;
  }

  return normalizedPath;
}

function startStaticServer() {
  staticServer = http.createServer((request, response) => {
    const assetPath = resolveAsset(request.url);

    if (!assetPath) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    fs.readFile(assetPath, (error, data) => {
      if (error) {
        response.writeHead(404);
        response.end("Not found");
        return;
      }

      response.writeHead(200, {
        "Cache-Control": "no-cache",
        "Content-Type": mimeTypes[path.extname(assetPath)] || "application/octet-stream",
      });
      response.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    staticServer.once("error", reject);
    staticServer.listen(0, "127.0.0.1", () => {
      const { port } = staticServer.address();
      resolve(`http://127.0.0.1:${port}/`);
    });
  });
}

async function createWindow() {
  const appUrl = await startStaticServer();
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 390,
    minHeight: 640,
    title: "Facility Pro",
    backgroundColor: "#ffffff",
    icon: path.join(appRoot, "logo.png"),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(appUrl)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  await mainWindow.loadURL(`${appUrl}desktop.html`);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (staticServer) {
    staticServer.close();
  }

  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
