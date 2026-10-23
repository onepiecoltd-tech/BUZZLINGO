/* BuzzLingo desktop: bọc thư mục dist/ (HTML/CSS/JS tĩnh) thành ứng dụng Windows bằng Electron. */
const { app, BrowserWindow, session, shell } = require('electron');
const path = require('path');

// Khi đóng gói, dist/ được chép vào resources/app-dist; khi chạy thử (npm start) đọc thẳng ../dist
const ROOT = app.isPackaged ? path.join(process.resourcesPath, 'app-dist') : path.join(__dirname, '..', 'dist');

if (!app.requestSingleInstanceLock()) app.quit();

function createWindow() {
  const win = new BrowserWindow({
    width: 440,
    height: 900,
    minWidth: 360,
    minHeight: 600,
    title: 'BuzzLingo',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#FFF7E6',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: false },
  });
  win.loadFile(path.join(ROOT, 'index.html'));
  // liên kết ngoài mở bằng trình duyệt mặc định, không mở cửa sổ mới trong app
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (/^https?:/i.test(url)) { e.preventDefault(); shell.openExternal(url); }
  });
  return win;
}

app.whenReady().then(() => {
  // chỉ cho phép micro (bước Nói ghi âm); từ chối các quyền khác
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(permission === 'media'));
  session.defaultSession.setPermissionCheckHandler((wc, permission) => permission === 'media');
  createWindow();
});

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows();
  if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
});

app.on('window-all-closed', () => app.quit());
