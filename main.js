const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

// Helper function to escape special characters in regex patterns
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    minWidth: 800,
    minHeight: 600,
    icon: path.join(__dirname, 'Folder_icon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    show: false,
    backgroundColor: '#f5f5f5'
  });

  mainWindow.loadFile('index.html');
  
  // Only show window when fully loaded to prevent white flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });
  
  // Open DevTools only in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => mainWindow = null);
  
  // Create application menu
  createMenu();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) createWindow();
});

function createMenu() {
  const isMac = process.platform === 'darwin';
  
  const template = [
    // App menu (macOS only)
    ...(isMac ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    
    // File menu
    {
      label: 'File',
      submenu: [
        {
          label: 'Select Folder',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            mainWindow.webContents.send('menu-select-folder');
          }
        },
        {
          label: 'Save Structure',
          accelerator: 'CmdOrCtrl+S',
          click: async () => {
            mainWindow.webContents.send('menu-save-structure');
          }
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    
    // Edit menu
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        ...(isMac ? [
          { role: 'pasteAndMatchStyle' },
          { role: 'delete' },
          { role: 'selectAll' },
          { type: 'separator' },
          {
            label: 'Speech',
            submenu: [
              { role: 'startSpeaking' },
              { role: 'stopSpeaking' }
            ]
          }
        ] : [
          { role: 'delete' },
          { type: 'separator' },
          { role: 'selectAll' }
        ])
      ]
    },
    
    // View menu
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    
    // Window menu
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(isMac ? [
          { type: 'separator' },
          { role: 'front' },
          { type: 'separator' },
          { role: 'window' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    
    // Help menu
    {
      role: 'help',
      submenu: [
        {
          label: 'Learn More',
          click: async () => {
            const { shell } = require('electron');
            await shell.openExternal('https://github.com/yourusername/file-manager-pro');
          }
        }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

ipcMain.handle('select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    return result.canceled ? null : result.filePaths[0];
  } catch (error) {
    console.error('Error in select-folder:', error);
    return null;
  }
});

ipcMain.handle('select-path', async (event, options) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, options);
    return result.canceled ? null : result.filePaths[0];
  } catch (error) {
    console.error('Error in select-path:', error);
    return null;
  }
});

ipcMain.handle('create-directory', async (event, dirPath) => {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error('Error creating directory:', error);
    throw error;
  }
});

ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.writeFile(filePath, content);
    return true;
  } catch (error) {
    console.error('Error writing file:', error);
    throw error;
  }
});

ipcMain.handle('list-files', async (event, dirPath, pattern = null) => {
  const { promisify } = require('util');
  const glob = promisify(require('glob'));
  
  try {
    if (pattern) {
      // If a pattern is provided, use it
      return await glob(path.join(dirPath, pattern));
    } else {
      // Otherwise, get all files (not directories)
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isFile())
        .map(entry => path.join(dirPath, entry.name));
    }
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
});

ipcMain.handle('copy-file', async (event, source, destination) => {
  try {
    await fs.copyFile(source, destination);
    return true;
  } catch (error) {
    console.error('Error copying file:', error);
    throw error;
  }
});

ipcMain.handle('move-file', async (event, source, destination) => {
  try {
    await fs.rename(source, destination);
    return true;
  } catch (error) {
    console.error('Error moving file:', error);
    throw error;
  }
});

ipcMain.handle('find-replace', async (event, options) => {
  const { searchPath, searchPattern, replacePattern, fileFilter, caseSensitive, wholeWord, useRegex, includeSubfolders, doReplace } = options;
  const { promisify } = require('util');
  const glob = promisify(require('glob'));
  
  try {
    // Get files to search
    const pattern = includeSubfolders 
      ? path.join(searchPath, '**', fileFilter || '*.*') 
      : path.join(searchPath, fileFilter || '*.*');
    
    const files = await glob(pattern, { nodir: true });
    
    // Build regex
    let flags = caseSensitive ? 'g' : 'gi';
    let regex;
    
    if (useRegex) {
      // Use provided regex
      regex = new RegExp(searchPattern, flags);
    } else if (wholeWord) {
      // Word boundary
      regex = new RegExp(`\\b${escapeRegExp(searchPattern)}\\b`, flags);
    } else {
      // Plain text
      regex = new RegExp(escapeRegExp(searchPattern), flags);
    }
    
    const results = [];
    
    // Process each file
    for (const file of files) {
      const content = await fs.readFile(file, 'utf8');
      const lines = content.split('\n');
      const matches = [];
      
      // Check each line
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let match;
        let hasMatch = false;
        
        regex.lastIndex = 0; // Reset regex
        
        while ((match = regex.exec(line)) !== null) {
          hasMatch = true;
          
          // For search only, add context around the match
          if (!doReplace) {
            const start = Math.max(0, match.index - 10);
            const end = Math.min(line.length, match.index + match[0].length + 10);
            const prefix = start > 0 ? '...' : '';
            const suffix = end < line.length ? '...' : '';
            const highlight = line.substring(match.index, match.index + match[0].length);
            
            // Create context with highlighted match
            const context = prefix + line.substring(start, match.index) + 
                            '[' + highlight + ']' + 
                            line.substring(match.index + match[0].length, end) + suffix;
            
            matches.push({
              line: i + 1,
              position: match.index,
              context
            });
          }
        }
        
        // For replace, handle entire line at once
        if (doReplace && hasMatch) {
          const before = line;
          const after = line.replace(regex, replacePattern);
          lines[i] = after;
          
          matches.push({
            line: i + 1,
            before,
            after
          });
        }
        
        // Reset regex for the next line
        regex.lastIndex = 0;
      }
      
      // If we found matches
      if (matches.length > 0) {
        results.push({
          path: file,
          matches
        });
        
        // Write back the file if we're replacing
        if (doReplace) {
          await fs.writeFile(file, lines.join('\n'));
        }
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error in find-replace:', error);
    throw error;
  }
});

ipcMain.handle('read-folder', async (event, folderPath) => {
  async function readDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return {
          name: entry.name,
          type: 'folder',
          children: await readDir(fullPath)
        };
      }
      return { name: entry.name, type: 'file' };
    }));
  }

  try {
    return await readDir(folderPath);
  } catch (error) {
    console.error('Error reading folder:', error);
    return null;
  }
});

ipcMain.handle('save-structure', async (event, data, format) => {
  const options = {
    title: 'Save Folder Structure',
    defaultPath: app.getPath('documents') + '/folder_structure',
    filters: [
      { name: 'JSON', extensions: ['json'] },
      { name: 'Text', extensions: ['txt'] },
      { name: 'XML', extensions: ['xml'] },
      { name: 'Mermaid', extensions: ['mmd'] },
      { name: 'DOT', extensions: ['dot'] }
    ]
  };

  const result = await dialog.showSaveDialog(mainWindow, options);
  if (result.canceled) return false;

  const formatFunctions = {
    json: data => JSON.stringify(data, null, 2),
    txt: formatToTxt,
    xml: formatToXml,
    mmd: formatToMermaid,
    dot: formatToDot
  };

  try {
    const content = formatFunctions[format](data);
    await fs.writeFile(result.filePath, content);
    return true;
  } catch (error) {
    console.error('Error saving file:', error);
    return false;
  }
});

function formatToTxt(data, indent = '') {
  return data.map(item => {
    let result = `${indent}${item.type === 'folder' ? '📁' : '📄'} ${item.name}\n`;
    if (item.type === 'folder' && item.children) {
      result += formatToTxt(item.children, indent + '  ');
    }
    return result;
  }).join('');
}

function formatToXml(data) {
  function toXml(item) {
    if (item.type === 'file') return `<file name="${item.name}"/>`;
    let result = `<folder name="${item.name}">`;
    if (item.children) result += item.children.map(toXml).join('');
    return result + '</folder>';
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<root>${data.map(toXml).join('')}</root>`;
}

function formatToMermaid(data) {
  let result = 'graph TD\n';
  let id = 0;
  function processItem(item, parentId = null) {
    const currentId = `id${id++}`;
    result += `    ${currentId}[${item.type === 'folder' ? '📁' : '📄'} ${item.name}]\n`;
    if (parentId !== null) result += `    ${parentId} --> ${currentId}\n`;
    if (item.type === 'folder' && item.children) {
      item.children.forEach(child => processItem(child, currentId));
    }
  }
  data.forEach(item => processItem(item));
  return result;
}

function formatToDot(data) {
  let result = 'digraph FolderStructure {\n';
  let id = 0;
  function processItem(item, parentId = null) {
    const currentId = `id${id++}`;
    const shape = item.type === 'folder' ? 'folder' : 'note';
    result += `    ${currentId} [label="${item.name}" shape="${shape}"];\n`;
    if (parentId !== null) result += `    ${parentId} -> ${currentId};\n`;
    if (item.type === 'folder' && item.children) {
      item.children.forEach(child => processItem(child, currentId));
    }
  }
  data.forEach(item => processItem(item));
  return result + '}';
}