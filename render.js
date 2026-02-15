const { ipcRenderer } = require('electron');
const path = require('path');
const os = require('os');

// Global state
let folderStructure = null;
let folderCreationStructure = {};
let currentFolderInList = null;

function init() {
    // Set app version
    document.getElementById('appVersion').textContent = `v${require('./package.json').version}`;
    
    // Initialize tab switching
    setupTabs();
    
    // Setup event listeners for folder structure tab
    setupFolderStructureTab();
    
    // Setup event listeners for folder creation tab
    setupFolderCreationTab();
    
    // Setup event listeners for file creation tab
    setupFileCreationTab();
    
    // Setup event listeners for copy & paste tab
    setupCopyPasteTab();
    
    // Setup event listeners for find & replace tab
    setupFindReplaceTab();
    
    // Listen for menu events from main process
    setupMenuListeners();
    
    // Set initial status
    updateStatus('Ready');
}

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Hide all tab contents
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding tab content
            const tabContentId = tab.getAttribute('data-tab');
            document.getElementById(tabContentId).classList.add('active');
        });
    });
}

function setupMenuListeners() {
    ipcRenderer.on('menu-select-folder', handleSelectFolder);
    ipcRenderer.on('menu-save-structure', handleSaveStructure);
}

function setupFolderStructureTab() {
    document.getElementById('selectFolder').addEventListener('click', handleSelectFolder);
    document.getElementById('saveStructure').addEventListener('click', handleSaveStructure);
    populateSaveFormatOptions();
}

function setupFolderCreationTab() {
    // Browse button
    document.getElementById('browseFolderPath').addEventListener('click', async () => {
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            document.getElementById('rootFolderPath').value = folderPath;
        }
    });
    
    // Initialize folder creation structure
    folderCreationStructure = { 'Folder 1': [] };
    updateFolderCreationList();
    
    // Number of folders input
    document.getElementById('numMainFolders').addEventListener('change', updateFolderCreationStructure);
    
    // Folder list selection
    document.getElementById('folderList').addEventListener('change', updateFolderNameField);
    
    // Folder name edit
    document.getElementById('folderNameEdit').addEventListener('input', updateFolderName);
    
    // Subfolder edit
    document.getElementById('subfolderEdit').addEventListener('input', updateSubfolders);
    
    // Prefix options
    document.getElementById('prefixCombo').addEventListener('change', () => {
        const prefixType = document.getElementById('prefixCombo').value;
        document.getElementById('dateFormatOptions').style.display = prefixType === 'Date Prefix' ? 'block' : 'none';
        document.getElementById('customPrefixOptions').style.display = prefixType === 'Custom Prefix' ? 'block' : 'none';
        updateFolderCreationPreview();
    });
    
    // Date format
    document.getElementById('dateFormatCombo').addEventListener('change', updateFolderCreationPreview);
    
    // Custom prefix
    document.getElementById('customPrefix').addEventListener('input', updateFolderCreationPreview);
    
    // Create folders button
    document.getElementById('createFoldersBtn').addEventListener('click', createFolders);
    
    // Initial preview
    updateFolderCreationPreview();
}

function setupFileCreationTab() {
    // Browse button
    document.getElementById('browseFileDestPath').addEventListener('click', async () => {
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            document.getElementById('fileDestPath').value = folderPath;
        }
    });
    
    // Create files button
    document.getElementById('createFilesBtn').addEventListener('click', createFiles);
}

function setupCopyPasteTab() {
    // Browse source button
    document.getElementById('browseSourcePath').addEventListener('click', async () => {
        const result = await ipcRenderer.invoke('select-path', { properties: ['openFile', 'openDirectory'] });
        if (result) {
            document.getElementById('sourcePath').value = result;
        }
    });
    
    // Browse destination button
    document.getElementById('browseDestinationPath').addEventListener('click', async () => {
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            document.getElementById('destinationPath').value = folderPath;
        }
    });
    
    // Execute button
    document.getElementById('executeCopyPasteBtn').addEventListener('click', executeCopyPaste);
}

function setupFindReplaceTab() {
    // Browse search path button
    document.getElementById('browseSearchPath').addEventListener('click', async () => {
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            document.getElementById('searchPath').value = folderPath;
        }
    });
    
    // Find All button
    document.getElementById('findAllBtn').addEventListener('click', () => findReplace(false));
    
    // Replace All button
    document.getElementById('replaceAllBtn').addEventListener('click', () => findReplace(true));
}

function updateStatus(message) {
    document.getElementById('appStatus').textContent = message;
}

async function handleSelectFolder() {
    try {
        updateStatus('Selecting folder...');
        const folderPath = await ipcRenderer.invoke('select-folder');
        if (folderPath) {
            updateStatus('Reading folder structure...');
            folderStructure = await ipcRenderer.invoke('read-folder', folderPath);
            addSelectionToStructure(folderStructure);
            renderFolderStructure(folderStructure);
            document.getElementById('saveOptions').style.display = 'block';
            updateStatus('Folder structure loaded');
        } else {
            updateStatus('Folder selection cancelled');
        }
    } catch (error) {
        console.error('Error in folder selection:', error);
        updateStatus('Error loading folder structure');
    }
}

function addSelectionToStructure(structure) {
    structure.forEach(item => {
        item.selected = true;
        item.expanded = false;
        if (item.children) addSelectionToStructure(item.children);
    });
}

function renderFolderStructure(structure, parentElement = document.getElementById('folderStructure')) {
    parentElement.innerHTML = '';
    structure.forEach(item => {
        const element = document.createElement('div');
        
        const checkbox = createCheckbox(item);
        const label = createLabel(item);

        element.appendChild(checkbox);
        element.appendChild(label);

        if (item.type === 'folder' && item.children) {
            const childrenContainer = createChildrenContainer(item);
            renderFolderStructure(item.children, childrenContainer);
            element.appendChild(childrenContainer);

            label.addEventListener('click', (e) => toggleFolder(e, item, childrenContainer, label));
        }

        parentElement.appendChild(element);
    });
}

function createCheckbox(item) {
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = item.selected;
    checkbox.className = 'checkbox';
    checkbox.addEventListener('change', (e) => {
        item.selected = e.target.checked;
        if (item.children) {
            updateChildrenSelection(item.children, e.target.checked);
        }
        renderFolderStructure(folderStructure);
    });
    return checkbox;
}

function createLabel(item) {
    const label = document.createElement('span');
    label.textContent = `${item.type === 'folder' ? '📁' : '📄'} ${item.name}`;
    label.className = item.type;
    label.style.cursor = 'pointer';
    return label;
}

function createChildrenContainer(item) {
    const childrenContainer = document.createElement('div');
    childrenContainer.style.marginLeft = '20px';
    childrenContainer.style.display = item.expanded ? 'block' : 'none';
    return childrenContainer;
}

function toggleFolder(e, item, childrenContainer, label) {
    e.stopPropagation();
    item.expanded = !item.expanded;
    childrenContainer.style.display = item.expanded ? 'block' : 'none';
    label.textContent = `${item.expanded ? '📂' : '📁'} ${item.name}`;
}

function updateChildrenSelection(children, selected) {
    children.forEach(child => {
        child.selected = selected;
        if (child.children) updateChildrenSelection(child.children, selected);
    });
}

async function handleSaveStructure() {
    try {
        updateStatus('Saving structure...');
        const format = document.getElementById('saveFormat').value;
        const selectedStructure = filterSelectedItems(folderStructure);
        const success = await ipcRenderer.invoke('save-structure', selectedStructure, format);
        
        if (success) {
            updateStatus('Structure saved successfully');
        } else {
            updateStatus('Failed to save structure');
        }
    } catch (error) {
        console.error('Error saving structure:', error);
        updateStatus('Error saving structure');
    }
}

// Folder Creation Tab Functions
function updateFolderCreationList() {
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '';
    
    Object.keys(folderCreationStructure).forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        option.textContent = folder;
        folderList.appendChild(option);
    });
}

function updateFolderCreationStructure() {
    const numFolders = parseInt(document.getElementById('numMainFolders').value);
    const currentStructure = { ...folderCreationStructure };
    
    // Create new structure with required number of folders
    folderCreationStructure = {};
    for (let i = 0; i < numFolders; i++) {
        const folderName = `Folder ${i+1}`;
        folderCreationStructure[folderName] = currentStructure[folderName] || [];
    }
    
    updateFolderCreationList();
    updateFolderCreationPreview();
}

function updateFolderNameField() {
    const folderList = document.getElementById('folderList');
    if (folderList.selectedIndex === -1) return;
    
    const folderName = folderList.options[folderList.selectedIndex].value;
    currentFolderInList = folderName;
    
    document.getElementById('folderNameEdit').value = folderName;
    document.getElementById('subfolderEdit').value = folderCreationStructure[folderName].join(', ');
}

function updateFolderName() {
    if (!currentFolderInList) return;
    
    const newName = document.getElementById('folderNameEdit').value.trim();
    if (!newName) return;
    
    // Skip if the name hasn't changed
    if (newName === currentFolderInList) return;
    
    // Store the subfolders
    const subfolders = folderCreationStructure[currentFolderInList];
    
    // Delete the old entry
    delete folderCreationStructure[currentFolderInList];
    
    // Create the new entry
    folderCreationStructure[newName] = subfolders;
    
    // Update current folder reference
    currentFolderInList = newName;
    
    // Update the UI
    updateFolderCreationList();
    updateFolderCreationPreview();
    
    // Keep the new folder selected
    const folderList = document.getElementById('folderList');
    for (let i = 0; i < folderList.options.length; i++) {
        if (folderList.options[i].value === newName) {
            folderList.selectedIndex = i;
            break;
        }
    }
}

function updateSubfolders() {
    if (!currentFolderInList) return;
    
    const subfoldersText = document.getElementById('subfolderEdit').value;
    folderCreationStructure[currentFolderInList] = subfoldersText
        .split(',')
        .map(s => s.trim())
        .filter(s => s);
    
    updateFolderCreationPreview();
}

function updateFolderCreationPreview() {
    const previewText = document.getElementById('previewText');
    let preview = "Folder Structure Preview:\n\n";
    
    const prefix = getFolderPrefix();
    
    let i = 0;
    for (const [folder, subfolders] of Object.entries(folderCreationStructure)) {
        const folderNumber = `${i+1:02d}`.padStart(2, '0');
        const mainFolderName = prefix 
            ? `${prefix.replace('{:03d}', folderNumber)}${folderNumber} - ${folder}` 
            : folder;
        
        preview += `├── ${mainFolderName}\n`;
        
        for (const subfolder of subfolders) {
            preview += `│   ├── ${subfolder}\n`;
        }
        
        if (subfolders.length > 0) {
            preview += "│   └── ...\n";
        }
        
        i++;
    }
    
    previewText.value = preview;
}

function getFolderPrefix() {
    const prefixType = document.getElementById('prefixCombo').value;
    
    switch (prefixType) {
        case 'No Prefix':
            return '';
        
        case 'Date Prefix':
            const formatString = document.getElementById('dateFormatCombo').value;
            const date = new Date();
            const year = date.getFullYear();
            const month = (date.getMonth() + 1).toString().padStart(2, '0');
            const day = date.getDate().toString().padStart(2, '0');
            
            let dateString = formatString
                .replace('YYYY', year)
                .replace('MM', month)
                .replace('DD', day);
                
            return dateString + '_';
        
        case 'Custom Prefix':
            const prefix = document.getElementById('customPrefix').value.trim();
            return prefix ? prefix + '_' : '';
        
        case 'Numeric Prefix':
            return '{:03d}_';
            
        default:
            return '';
    }
}

async function createFolders() {
    const rootPath = document.getElementById('rootFolderPath').value;
    if (!rootPath) {
        alert('Please specify the root folder path.');
        return;
    }
    
    try {
        updateStatus('Creating folders...');
        document.getElementById('createFoldersBtn').disabled = true;
        const progressContainer = document.querySelector('#folder-creation .progress-container');
        const progressBar = progressContainer.querySelector('.progress-bar');
        const statusElement = document.getElementById('folderCreationStatus');
        
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        statusElement.textContent = 'Starting folder creation...';
        
        const prefix = getFolderPrefix();
        const totalItems = Object.entries(folderCreationStructure).reduce(
            (count, [_, subfolders]) => count + 1 + subfolders.length, 0
        );
        let createdItems = 0;
        
        for (const [i, [folder, subfolders]] of Object.entries(folderCreationStructure).entries()) {
            const folderNumber = `${parseInt(i)+1:02d}`.padStart(2, '0');
            const mainFolderName = prefix 
                ? `${prefix.replace('{:03d}', folderNumber)}${folderNumber} - ${folder}` 
                : folder;
            
            const mainFolderPath = path.join(rootPath, mainFolderName);
            
            // Create main folder
            await ipcRenderer.invoke('create-directory', mainFolderPath);
            createdItems++;
            
            // Update progress
            const progress = Math.round((createdItems / totalItems) * 100);
            progressBar.style.width = `${progress}%`;
            statusElement.textContent = `Creating: ${mainFolderName}`;
            
            // Create subfolders
            for (const subfolder of subfolders) {
                const subfolderPath = path.join(mainFolderPath, subfolder);
                await ipcRenderer.invoke('create-directory', subfolderPath);
                createdItems++;
                
                // Update progress
                const progress = Math.round((createdItems / totalItems) * 100);
                progressBar.style.width = `${progress}%`;
                statusElement.textContent = `Creating: ${mainFolderName}/${subfolder}`;
            }
        }
        
        // Complete
        progressBar.style.width = '100%';
        statusElement.textContent = `Created ${createdItems} folders successfully.`;
        updateStatus('Folders created successfully');
        alert('Folders created successfully!');
    } catch (error) {
        console.error('Error creating folders:', error);
        document.getElementById('folderCreationStatus').textContent = `Error: ${error.message}`;
        updateStatus('Error creating folders');
    } finally {
        document.getElementById('createFoldersBtn').disabled = false;
    }
}

function filterSelectedItems(structure) {
    return structure.filter(item => item.selected).map(item => {
        const newItem = { name: item.name, type: item.type };
        if (item.children) newItem.children = filterSelectedItems(item.children);
        return newItem;
    });
}

// File Creation Functions
async function createFiles() {
    const destPath = document.getElementById('fileDestPath').value;
    const template = document.getElementById('fileTemplate').value;
    const namePattern = document.getElementById('fileNamePattern').value;
    const numFiles = parseInt(document.getElementById('numFiles').value);
    const fileExtension = document.getElementById('fileExtension').value.replace(/^\./, '');
    
    if (!destPath) {
        alert('Please specify the destination folder path.');
        return;
    }
    
    if (!namePattern) {
        alert('Please specify a file name pattern.');
        return;
    }
    
    try {
        updateStatus('Creating files...');
        document.getElementById('createFilesBtn').disabled = true;
        const progressContainer = document.querySelector('#file-creation .progress-container');
        const progressBar = progressContainer.querySelector('.progress-bar');
        const statusElement = document.getElementById('fileCreationStatus');
        
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        statusElement.textContent = 'Starting file creation...';
        
        for (let i = 0; i < numFiles; i++) {
            // Generate file name
            let fileName = namePattern.replace('{index}', (i + 1).toString());
            fileName = fileName.replace('{date}', new Date().toISOString().split('T')[0]);
            
            // Add extension if not already in pattern
            if (fileExtension && !fileName.endsWith('.' + fileExtension)) {
                fileName += '.' + fileExtension;
            }
            
            // Generate content
            let content = template;
            content = content.replace(/{index}/g, (i + 1).toString());
            content = content.replace(/{date}/g, new Date().toISOString().split('T')[0]);
            
            // Create file
            const filePath = path.join(destPath, fileName);
            await ipcRenderer.invoke('write-file', filePath, content);
            
            // Update progress
            const progress = Math.round(((i + 1) / numFiles) * 100);
            progressBar.style.width = `${progress}%`;
            statusElement.textContent = `Creating: ${fileName}`;
        }
        
        // Complete
        progressBar.style.width = '100%';
        statusElement.textContent = `Created ${numFiles} files successfully.`;
        updateStatus('Files created successfully');
        alert('Files created successfully!');
    } catch (error) {
        console.error('Error creating files:', error);
        document.getElementById('fileCreationStatus').textContent = `Error: ${error.message}`;
        updateStatus('Error creating files');
    } finally {
        document.getElementById('createFilesBtn').disabled = false;
    }
}

// Copy & Paste Functions
async function executeCopyPaste() {
    const sourcePath = document.getElementById('sourcePath').value;
    const destPath = document.getElementById('destinationPath').value;
    const operation = document.querySelector('input[name="operation"]:checked').value;
    const filterPattern = document.getElementById('filterPattern').value;
    
    if (!sourcePath) {
        alert('Please specify the source path.');
        return;
    }
    
    if (!destPath) {
        alert('Please specify the destination path.');
        return;
    }
    
    try {
        updateStatus(`${operation === 'copy' ? 'Copying' : 'Moving'} files...`);
        document.getElementById('executeCopyPasteBtn').disabled = true;
        const progressContainer = document.querySelector('#copy-paste .progress-container');
        const progressBar = progressContainer.querySelector('.progress-bar');
        const statusElement = document.getElementById('copyPasteStatus');
        
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        statusElement.textContent = `Starting ${operation === 'copy' ? 'copy' : 'move'} operation...`;
        
        // Get list of files to process
        const files = await ipcRenderer.invoke('list-files', sourcePath, filterPattern);
        
        if (files.length === 0) {
            statusElement.textContent = 'No files found matching the criteria.';
            progressBar.style.width = '100%';
            return;
        }
        
        let processedCount = 0;
        
        for (const file of files) {
            const destFilePath = path.join(destPath, path.basename(file));
            
            if (operation === 'copy') {
                await ipcRenderer.invoke('copy-file', file, destFilePath);
            } else {
                await ipcRenderer.invoke('move-file', file, destFilePath);
            }
            
            processedCount++;
            
            // Update progress
            const progress = Math.round((processedCount / files.length) * 100);
            progressBar.style.width = `${progress}%`;
            statusElement.textContent = `${operation === 'copy' ? 'Copying' : 'Moving'}: ${path.basename(file)}`;
        }
        
        // Complete
        progressBar.style.width = '100%';
        statusElement.textContent = `${operation === 'copy' ? 'Copied' : 'Moved'} ${processedCount} files successfully.`;
        updateStatus(`Files ${operation === 'copy' ? 'copied' : 'moved'} successfully`);
        alert(`Files ${operation === 'copy' ? 'copied' : 'moved'} successfully!`);
    } catch (error) {
        console.error(`Error ${operation === 'copy' ? 'copying' : 'moving'} files:`, error);
        document.getElementById('copyPasteStatus').textContent = `Error: ${error.message}`;
        updateStatus(`Error ${operation === 'copy' ? 'copying' : 'moving'} files`);
    } finally {
        document.getElementById('executeCopyPasteBtn').disabled = false;
    }
}

// Find & Replace Functions
async function findReplace(doReplace) {
    const searchPath = document.getElementById('searchPath').value;
    const searchPattern = document.getElementById('searchPattern').value;
    const replacePattern = document.getElementById('replacePattern').value;
    const fileFilter = document.getElementById('fileFilter').value;
    const caseSensitive = document.getElementById('caseSensitiveOption').checked;
    const wholeWord = document.getElementById('wholeWordOption').checked;
    const useRegex = document.getElementById('regexOption').checked;
    const includeSubfolders = document.getElementById('includeSubfoldersOption').checked;
    
    if (!searchPath) {
        alert('Please specify the search path.');
        return;
    }
    
    if (!searchPattern) {
        alert('Please specify a search pattern.');
        return;
    }
    
    if (doReplace && !replacePattern && !confirm('Replace with empty string?')) {
        return;
    }
    
    try {
        updateStatus(doReplace ? 'Replacing...' : 'Searching...');
        document.getElementById('findAllBtn').disabled = true;
        document.getElementById('replaceAllBtn').disabled = true;
        const statusElement = document.getElementById('findReplaceStatus');
        const resultsElement = document.getElementById('searchResults');
        const resultsHeaderElement = document.getElementById('resultsHeader');
        const resultsListElement = document.getElementById('resultsList');
        
        resultsElement.style.display = 'none';
        statusElement.textContent = doReplace ? 'Replacing...' : 'Searching...';
        
        // Perform search/replace
        const results = await ipcRenderer.invoke('find-replace', {
            searchPath,
            searchPattern,
            replacePattern,
            fileFilter,
            caseSensitive,
            wholeWord,
            useRegex,
            includeSubfolders,
            doReplace
        });
        
        // Update UI with results
        resultsElement.style.display = 'block';
        
        if (results.length === 0) {
            resultsHeaderElement.textContent = 'No matches found.';
            resultsListElement.innerHTML = '';
        } else {
            const totalMatches = results.reduce((sum, file) => sum + file.matches.length, 0);
            resultsHeaderElement.textContent = doReplace 
                ? `Replaced ${totalMatches} occurrence(s) in ${results.length} file(s).`
                : `Found ${totalMatches} occurrence(s) in ${results.length} file(s).`;
            
            resultsListElement.innerHTML = '';
            
            results.forEach(file => {
                const fileDiv = document.createElement('div');
                fileDiv.style.marginBottom = '10px';
                
                const fileHeader = document.createElement('div');
                fileHeader.style.fontWeight = 'bold';
                fileHeader.textContent = `${file.path} (${file.matches.length} match${file.matches.length === 1 ? '' : 'es'})`;
                fileDiv.appendChild(fileHeader);
                
                file.matches.forEach(match => {
                    const matchDiv = document.createElement('div');
                    matchDiv.style.marginLeft = '20px';
                    matchDiv.style.fontFamily = 'monospace';
                    matchDiv.style.whiteSpace = 'pre-wrap';
                    
                    if (doReplace) {
                        matchDiv.textContent = `Line ${match.line}: "${match.before}" → "${match.after}"`;
                    } else {
                        matchDiv.textContent = `Line ${match.line}: ${match.context}`;
                    }
                    
                    fileDiv.appendChild(matchDiv);
                });
                
                resultsListElement.appendChild(fileDiv);
            });
        }
        
        updateStatus(doReplace ? 'Replace completed' : 'Search completed');
    } catch (error) {
        console.error(`Error ${doReplace ? 'replacing' : 'searching'}:`, error);
        document.getElementById('findReplaceStatus').textContent = `Error: ${error.message}`;
        updateStatus(`Error ${doReplace ? 'replacing' : 'searching'}`);
    } finally {
        document.getElementById('findAllBtn').disabled = false;
        document.getElementById('replaceAllBtn').disabled = false;
    }
}

function populateSaveFormatOptions() {
    const saveFormatSelect = document.getElementById('saveFormat');
    saveFormatSelect.innerHTML = `
        <option value="json">JSON</option>
        <option value="txt">Text</option>
        <option value="xml">XML</option>
        <option value="mmd">Mermaid</option>
        <option value="dot">DOT</option>
    `;
}

document.addEventListener('DOMContentLoaded', init);

window.addEventListener('error', (event) => {
    console.error('Unhandled error:', event.error);
});