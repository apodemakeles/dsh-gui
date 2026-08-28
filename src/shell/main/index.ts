/**
 * Electron main process for the dsh-gui shell.
 * Scaffold stage: opens a placeholder window. Design stage (see
 * .scratch/dsh-gui-scaffold/, ticket 03): host the dsh host process,
 * load the official web client over file://, and keep the window native
 * surface (dialogs, menu, tray) here.
 */
import { app, BrowserWindow, shell } from 'electron'
import { join } from 'node:path'
import { APP_NAME } from '../shared/index.ts'

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: APP_NAME,
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

void app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
