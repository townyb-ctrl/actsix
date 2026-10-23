// Tells the page it runs as the installed desktop app (no browser install prompt, no service worker), and nothing more.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('stageplotDesktop', { platform: process.platform, version: process.env.STAGEPLOT_VERSION || '' });
