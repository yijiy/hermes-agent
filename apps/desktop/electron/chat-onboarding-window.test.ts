import { BrowserWindow, ipcMain, type Rectangle } from 'electron'
import { afterEach, expect, it, vi } from 'vitest'

import { registerChatOnboardingWindow } from './chat-onboarding-window'

vi.mock('electron', async () => {
  const { EventEmitter } = await import('node:events')

  return {
    BrowserWindow: class {
      bounds = { height: 900, width: 1000, x: 0, y: 0 }
      webContents = { getZoomFactor: () => 0.9 }
      isDestroyed = () => false
      getBounds = () => this.bounds
      getContentBounds = this.getBounds
      setBounds = vi.fn((bounds: Rectangle) => {
        this.bounds = bounds
      })
    },
    ipcMain: new EventEmitter(),
    screen: { getDisplayMatching: () => ({ workArea: { height: 1080, width: 1920, x: 0, y: 0 } }) }
  }
})

afterEach(() => ipcMain.removeAllListeners())

it('animates solo sizing, then grows at the renderer zoom', () => {
  const win = new BrowserWindow()

  registerChatOnboardingWindow({
    enabled: true,
    mainWindow: () => win
  })
  ipcMain.emit('hermes:chat-onboarding:solo-boot', { sender: win.webContents })
  // SAFETY: The cinematic owns the reveal; solo boot animates the already-visible window.
  expect(win.setBounds).toHaveBeenLastCalledWith({ height: 640, width: 600, x: 660, y: 220 }, true)
  ipcMain.emit('hermes:chat-onboarding:grow', { sender: win.webContents }, { left: 220, minWidth: 768 })
  // SAFETY: B1's 0.9 zoom converts 220 CSS px into 198 native DIP; height stays fixed.
  expect(win.setBounds).toHaveBeenLastCalledWith({ height: 640, width: 798, x: 561, y: 220 }, true)
})

it('ignores both channels when disabled or sent by another window', () => {
  const win = new BrowserWindow()

  for (const enabled of [false, true]) {
    registerChatOnboardingWindow({ enabled, mainWindow: () => win })
    const sender = enabled ? new BrowserWindow().webContents : win.webContents

    ipcMain.emit('hermes:chat-onboarding:solo-boot', { sender })
    ipcMain.emit('hermes:chat-onboarding:grow', { sender }, { left: 220 })
    ipcMain.removeAllListeners()
  }

  // SAFETY: Only the enabled main renderer may resize the onboarding window.
  expect(win.setBounds).not.toHaveBeenCalled()
})
