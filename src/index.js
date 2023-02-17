const {
  app,
  BrowserWindow,
  desktopCapturer,
  ipcMain,
  globalShortcut,
  Menu,
  Tray,
  screen,
} = require("electron");
const path = require("path");

const ioHook = require("iohook");

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require("electron-squirrel-startup")) {
  // eslint-disable-line global-require
  app.quit();
}

require("@electron/remote/main").initialize();

var mainWindow;
var hintWindow;
var tray;
var menu;
var sources = [];
var currentSourceId;

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    resizable: false,
    minWidth: 720,
    minHeight: 720,
    maxWidth: 5000,
    maxHeight: 5000,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      backgroundThrottling: false,
    },
    frame: false,
    roundedCorners: false,
    hasShadow: false,
    show: false,
  });
  moveWindowToOffset();

  hintWindow = new BrowserWindow({
    x: 0,
    y: 0,
    focusable: false,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    roundedCorners: false,
    resizable: false,
    movable: false,
    enableLargerThanScreen: true,
    hasShadow: false,
    skipTaskbar: true,
    show: false,
  });
  hintWindow.setIgnoreMouseEvents(true);

  require("@electron/remote/main").enable(mainWindow.webContents);

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, "index.html"));
  hintWindow.loadFile(path.join(__dirname, "hint.html"));

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
  // hintWindow.webContents.openDevTools({ mode: "detach" });

  mainWindow.addListener("closed", () => app.quit());
};

ipcMain.on("source-bounds-change", (_, bounds) => {
  hintWindow.setBounds(bounds);
});

let keys = {};
ioHook.on("keydown", (event) => (keys = event));
ioHook.on("keyup", (event) => (keys = event));
ioHook.on("mousewheel", (event) => {
  if (keys.metaKey && keys.altKey) {
    mainWindow.webContents.send("bounds-x", event.rotation * 10);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  ioHook.stop();
  ioHook.unload();
});

app.whenReady().then(() => {
  createWindow();

  globalShortcut.register("Super+Control+Option+Shift+Left", () => {
    mainWindow.webContents.send("bounds-x", -50);
  });
  globalShortcut.register("Super+Control+Option+Shift+Right", () => {
    mainWindow.webContents.send("bounds-x", 50);
  });
  globalShortcut.register("Super+Control+Option+Shift+S", () => {
    toggleSharing();
  });

  tray = new Tray(path.join(__dirname, "icons/tray2.png"));
  tray.setToolTip("WNDW");

  renderMenu();
  screen.addListener("display-added", () => renderMenu());
  screen.addListener("display-removed", () => renderMenu());
});

const renderMenu = async () => {
  sources = await desktopCapturer.getSources({
    types: ["screen"],
  });
  currentSourceId ??= screen.getPrimaryDisplay().id.toString();

  menu = Menu.buildFromTemplate([
    {
      label: isSharing ? "Stop sharing" : "Start sharing",
      click: () => toggleSharing(),
      accelerator: "Super+Control+Option+Shift+S",
    },
    { type: "separator" },
    ...sources.map((source) => ({
      label: source.id,
      type: "radio",
      checked: source.display_id === currentSourceId,
      click: () => {
        currentSourceId = source.display_id;
        renderMenu();
      },
    })),
    { type: "separator" },
    { label: "WNDW Version 2.0.0", enabled: false },
    { label: "Quit", click: () => app.quit() },
  ]);
  tray.setContextMenu(menu);
};

let isSharing = false;
const startSharing = () => {
  ioHook.start();
  hintWindow.showInactive();
  mainWindow.showInactive();
  mainWindow.webContents.send("sharing-start", getCurrentSource());
  moveWindowToOffset();

  isSharing = true;
  renderMenu();
};
const stopSharing = async () => {
  await stopShareInMainWindow();
  ioHook.stop();
  hintWindow.hide();
  mainWindow.hide();

  isSharing = false;
  renderMenu();
};
const toggleSharing = () => {
  if (isSharing) {
    stopSharing();
  } else {
    startSharing();
  }
};

const getCurrentSource = () => {
  return (
    sources.find((source) => source.display_id === currentSourceId) ??
    sources[0]
  );
};

const stopShareInMainWindow = () =>
  new Promise((resolve) => {
    mainWindow.webContents.send("sharing-stop");
    // Wait until the content of the screen is no longer visible in the window.
    // May be helpful when screen-sharing has to be abruptly cancelled.
    setTimeout(resolve, 100);
  });

const getMainWindowScreen = () => {
  const bounds = mainWindow.getBounds();
  return screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y });
};

const moveWindowToOffset = () => {
  const currentScreen = getMainWindowScreen();
  mainWindow.setBounds({
    x: currentScreen.bounds.width - 40,
    y: currentScreen.bounds.height - 40,
  });
};
