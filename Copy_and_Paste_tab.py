import os
import shutil
import fnmatch
import re
import time
from datetime import datetime
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
                         QPushButton, QCheckBox, QTreeWidget, QTreeWidgetItem,
                         QProgressBar, QFileDialog, QMessageBox, QComboBox,
                         QSplitter, QTabWidget, QTextEdit, QGroupBox, QRadioButton,
                         QButtonGroup, QMenu, QApplication)
from PyQt6.QtCore import Qt, QObject, pyqtSignal, QThread, QSize, QTimer
from PyQt6.QtGui import QIcon, QAction, QCursor, QColor

class WorkerSignals(QObject):
    finished = pyqtSignal()
    error = pyqtSignal(str)
    progress = pyqtSignal(int, str)
    log = pyqtSignal(str)

class FileOperationWorker(QThread):
    def __init__(self, source, dest, items, operation_type, options):
        super().__init__()
        self.source = source
        self.dest = dest
        self.items = items
        self.operation_type = operation_type  # "copy" or "move"
        self.options = options
        self.signals = WorkerSignals()
        self.cancelled = False

    def run(self):
        try:
            # Count total files
            total_files = self.count_files_to_process(self.items)
            if total_files == 0:
                self.signals.log.emit("No files match the specified filters")
                self.signals.finished.emit()
                return
                
            self.signals.log.emit(f"Starting {self.operation_type} operation with {total_files} files")
            processed_files = 0
            skipped_files = 0
            
            # Create target directory structure first to avoid race conditions
            if self.options.get('create_structure_first', False):
                self.signals.log.emit("Pre-creating directory structure...")
                self.create_directory_structure(self.items)

            # Process files
            for item in self.items:
                if self.cancelled:
                    self.signals.log.emit("Operation cancelled by user")
                    break
                
                result = self.process_items([item], processed_files, total_files)
                processed_files += result['processed']
                skipped_files += result['skipped']
                
                # Update progress
                progress = int((processed_files / total_files) * 100) if total_files > 0 else 100
                status = f"{self.operation_type.capitalize()}ing: {processed_files}/{total_files} files"
                self.signals.progress.emit(progress, status)
            
            self.signals.log.emit(f"Operation completed: {processed_files} files processed, {skipped_files} files skipped")
            self.signals.finished.emit()
        except Exception as e:
            self.signals.log.emit(f"Error: {str(e)}")
            self.signals.error.emit(str(e))

    def cancel(self):
        self.cancelled = True
        self.signals.log.emit("Cancelling operation...")

    def count_files_to_process(self, items):
        count = 0
        for item in items:
            if self.cancelled:
                break
                
            file_path = item.data(0, Qt.ItemDataRole.UserRole)
            
            if os.path.isdir(file_path):
                # Count directory as 1 if we're not including subfolders
                if not self.options.get('include_subdirs', True):
                    count += 1
                    continue
                    
                # If we have children items, count those
                if item.childCount() > 0:
                    children = [item.child(i) for i in range(item.childCount())]
                    count += self.count_files_to_process(children)
                else:
                    # Otherwise scan the directory
                    for root, dirs, files in os.walk(file_path):
                        if self.cancelled:
                            break
                        for file in files:
                            if self.should_process_file(os.path.join(root, file)):
                                count += 1
            elif os.path.isfile(file_path):
                if self.should_process_file(file_path):
                    count += 1
                    
        return count

    def should_process_file(self, file_path):
        """Check if a file should be processed based on filters"""
        # Skip hidden files if option is set
        if self.options.get('skip_hidden', True) and os.path.basename(file_path).startswith('.'):
            return False
            
        # File type filters
        file_types = self.options.get('file_types', [])
        if file_types:
            match_found = False
            for pattern in file_types:
                if fnmatch.fnmatch(file_path.lower(), pattern.lower()):
                    match_found = True
                    break
            if not match_found:
                return False
                
        # File size filters
        min_size = self.options.get('min_size', 0)
        max_size = self.options.get('max_size', float('inf'))
        file_size = os.path.getsize(file_path)
        if file_size < min_size or file_size > max_size:
            return False
            
        # Date filters
        if self.options.get('date_filter', None):
            file_mtime = os.path.getmtime(file_path)
            file_date = datetime.fromtimestamp(file_mtime)
            
            if self.options['date_filter'] == 'newer_than':
                compare_date = self.options.get('compare_date', datetime.now())
                if file_date < compare_date:
                    return False
            elif self.options['date_filter'] == 'older_than':
                compare_date = self.options.get('compare_date', datetime.now())
                if file_date > compare_date:
                    return False
                    
        # Name pattern filter
        name_pattern = self.options.get('name_pattern', None)
        if name_pattern:
            try:
                if not re.search(name_pattern, os.path.basename(file_path)):
                    return False
            except re.error:
                # If regex is invalid, treat it as literal string
                if name_pattern not in os.path.basename(file_path):
                    return False
                    
        return True

    def create_directory_structure(self, items):
        """Pre-create directory structure at destination"""
        for item in items:
            if self.cancelled:
                break
                
            file_path = item.data(0, Qt.ItemDataRole.UserRole)
            if os.path.isdir(file_path):
                rel_path = os.path.relpath(file_path, self.source)
                dest_path = os.path.join(self.dest, rel_path)
                try:
                    os.makedirs(dest_path, exist_ok=True)
                    self.signals.log.emit(f"Created directory: {dest_path}")
                except Exception as e:
                    self.signals.log.emit(f"Failed to create directory {dest_path}: {str(e)}")
                
                if self.options.get('include_subdirs', True) and item.childCount() > 0:
                    children = [item.child(i) for i in range(item.childCount())]
                    self.create_directory_structure(children)

    def process_items(self, items, processed_count, total_files):
        """Process a list of items (copy or move)"""
        result = {'processed': 0, 'skipped': 0}
        
        for item in items:
            if self.cancelled:
                break
                
            source_path = item.data(0, Qt.ItemDataRole.UserRole)
            rel_path = os.path.relpath(source_path, self.source)
            dest_path = os.path.join(self.dest, rel_path)
            
            if os.path.isfile(source_path):
                # Skip if file should not be processed
                if not self.should_process_file(source_path):
                    result['skipped'] += 1
                    continue
                
                # Process the file
                try:
                    # Create parent directory if it doesn't exist
                    os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                    
                    if os.path.exists(dest_path) and not self.options.get('overwrite', True):
                        # Skip if file exists and overwrite is not enabled
                        self.signals.log.emit(f"Skipped existing file: {dest_path}")
                        result['skipped'] += 1
                        continue
                        
                    if self.operation_type == "copy":
                        # Copy with or without metadata
                        if self.options.get('preserve_metadata', True):
                            shutil.copy2(source_path, dest_path)
                        else:
                            shutil.copy(source_path, dest_path)
                        self.signals.log.emit(f"Copied: {source_path} -> {dest_path}")
                    else:  # move
                        shutil.move(source_path, dest_path)
                        self.signals.log.emit(f"Moved: {source_path} -> {dest_path}")
                        
                    result['processed'] += 1
                    
                    # Update progress more frequently for large operations
                    if result['processed'] % 10 == 0 or processed_count + result['processed'] >= total_files:
                        progress = int(((processed_count + result['processed']) / total_files) * 100)
                        status = f"{self.operation_type.capitalize()}ing: {processed_count + result['processed']}/{total_files} files"
                        self.signals.progress.emit(progress, status)
                        
                except Exception as e:
                    self.signals.log.emit(f"Error processing {source_path}: {str(e)}")
                    result['skipped'] += 1
            
            elif os.path.isdir(source_path):
                if not self.options.get('include_subdirs', True):
                    # Create the directory and don't process its contents
                    try:
                        os.makedirs(dest_path, exist_ok=True)
                        self.signals.log.emit(f"Created directory: {dest_path}")
                        result['processed'] += 1
                    except Exception as e:
                        self.signals.log.emit(f"Error creating directory {dest_path}: {str(e)}")
                        result['skipped'] += 1
                    continue
                
                # Create the directory
                try:
                    os.makedirs(dest_path, exist_ok=True)
                except Exception as e:
                    self.signals.log.emit(f"Error creating directory {dest_path}: {str(e)}")
                    continue
                
                # Process children
                if item.childCount() > 0:
                    children = [item.child(i) for i in range(item.childCount())]
                    child_result = self.process_items(children, processed_count + result['processed'], total_files)
                    result['processed'] += child_result['processed']
                    result['skipped'] += child_result['skipped']
                    
        return result

class CopyandPaste(QWidget):
    def __init__(self, main_app):
        super().__init__()
        self.main_app = main_app
        self.worker = None
        self.last_source_path = ""
        self.last_refresh_time = 0
        self.init_ui()

    def init_ui(self):
        # Main layout
        main_layout = QVBoxLayout(self)
        main_layout.setSpacing(10)

        # Create splitter for resizable sections
        splitter = QSplitter(Qt.Orientation.Vertical)
        main_layout.addWidget(splitter)

        # Top section - Controls
        top_widget = QWidget()
        top_layout = QVBoxLayout(top_widget)
        splitter.addWidget(top_widget)

        # Source and destination layout
        paths_widget = QWidget()
        paths_layout = QHBoxLayout(paths_widget)
        paths_layout.setContentsMargins(0, 0, 0, 0)
        top_layout.addWidget(paths_widget)
        
        # Source panel
        source_group = QGroupBox("Source")
        source_layout = QVBoxLayout(source_group)
        
        source_path_layout = QHBoxLayout()
        self.source_path = QLineEdit()
        self.source_path.setPlaceholderText("Select source folder or file")
        source_path_layout.addWidget(self.source_path)
        
        browse_source_button = QPushButton("Browse")
        browse_source_button.clicked.connect(self.browse_source)
        source_path_layout.addWidget(browse_source_button)
        
        source_layout.addLayout(source_path_layout)
        
        # Source options
        source_options_layout = QHBoxLayout()
        
        self.include_subdirs = QCheckBox("Include Subdirectories")
        self.include_subdirs.setChecked(True)
        self.include_subdirs.stateChanged.connect(self.refresh_file_list)
        source_options_layout.addWidget(self.include_subdirs)
        
        self.skip_hidden = QCheckBox("Skip Hidden Files")
        self.skip_hidden.setChecked(True)
        self.skip_hidden.stateChanged.connect(self.refresh_file_list)
        source_options_layout.addWidget(self.skip_hidden)
        
        refresh_button = QPushButton("Refresh")
        refresh_button.clicked.connect(self.refresh_file_list)
        source_options_layout.addWidget(refresh_button)
        
        source_layout.addLayout(source_options_layout)
        
        # File type filter
        filter_layout = QHBoxLayout()
        filter_layout.addWidget(QLabel("File Filters:"))
        self.file_type_entry = QLineEdit()
        self.file_type_entry.setPlaceholderText("*.txt, *.py, etc. (comma separated)")
        self.file_type_entry.textChanged.connect(self.on_filter_changed)
        filter_layout.addWidget(self.file_type_entry)
        
        source_layout.addLayout(filter_layout)
        
        paths_layout.addWidget(source_group)
        
        # Destination panel
        dest_group = QGroupBox("Destination")
        dest_layout = QVBoxLayout(dest_group)
        
        dest_path_layout = QHBoxLayout()
        self.dest_path = QLineEdit()
        self.dest_path.setPlaceholderText("Select destination folder")
        dest_path_layout.addWidget(self.dest_path)
        
        browse_dest_button = QPushButton("Browse")
        browse_dest_button.clicked.connect(self.browse_destination)
        dest_path_layout.addWidget(browse_dest_button)
        
        dest_layout.addLayout(dest_path_layout)
        
        # Operation type
        operation_layout = QHBoxLayout()
        operation_layout.addWidget(QLabel("Operation:"))
        
        operation_group = QButtonGroup(self)
        self.copy_radio = QRadioButton("Copy")
        self.copy_radio.setChecked(True)
        self.move_radio = QRadioButton("Move")
        operation_group.addButton(self.copy_radio)
        operation_group.addButton(self.move_radio)
        
        operation_layout.addWidget(self.copy_radio)
        operation_layout.addWidget(self.move_radio)
        operation_layout.addStretch(1)
        
        dest_layout.addLayout(operation_layout)
        
        # Destination options
        dest_options_layout = QHBoxLayout()
        
        self.overwrite = QCheckBox("Overwrite Existing Files")
        self.overwrite.setChecked(True)
        dest_options_layout.addWidget(self.overwrite)
        
        self.preserve_metadata = QCheckBox("Preserve Metadata")
        self.preserve_metadata.setChecked(True)
        dest_options_layout.addWidget(self.preserve_metadata)
        
        self.create_structure_first = QCheckBox("Create Structure First")
        self.create_structure_first.setChecked(True)
        self.create_structure_first.setToolTip("Create all directories before copying files (recommended for large operations)")
        dest_options_layout.addWidget(self.create_structure_first)
        
        dest_layout.addLayout(dest_options_layout)
        
        paths_layout.addWidget(dest_group)

        # Middle section - File tree
        middle_widget = QWidget()
        middle_layout = QVBoxLayout(middle_widget)
        middle_layout.setContentsMargins(0, 0, 0, 0)
        splitter.addWidget(middle_widget)
        
        tree_label = QLabel("Files:")
        middle_layout.addWidget(tree_label)
        
        self.file_tree = QTreeWidget()
        self.file_tree.setHeaderLabels(["Name", "Size", "Date Modified", "Type"])
        self.file_tree.setAlternatingRowColors(True)
        self.file_tree.setSelectionMode(QTreeWidget.SelectionMode.ExtendedSelection)
        self.file_tree.setContextMenuPolicy(Qt.ContextMenuPolicy.CustomContextMenu)
        self.file_tree.customContextMenuRequested.connect(self.show_context_menu)
        self.file_tree.setColumnWidth(0, 300)
        self.file_tree.setSortingEnabled(True)
        middle_layout.addWidget(self.file_tree)
        
        # Selection info
        self.selection_info = QLabel("0 items selected (0 bytes)")
        middle_layout.addWidget(self.selection_info)
        
        # Connect selection changed signal
        self.file_tree.itemSelectionChanged.connect(self.update_selection_info)

        # Bottom section - Execution and logs
        bottom_widget = QWidget()
        bottom_layout = QVBoxLayout(bottom_widget)
        bottom_layout.setContentsMargins(0, 0, 0, 0)
        splitter.addWidget(bottom_widget)
        
        # Tab widget for progress and logs
        tab_widget = QTabWidget()
        bottom_layout.addWidget(tab_widget)
        
        # Progress tab
        progress_widget = QWidget()
        progress_layout = QVBoxLayout(progress_widget)
        
        button_layout = QHBoxLayout()
        self.execute_button = QPushButton("Execute")
        self.execute_button.clicked.connect(self.start_operation)
        button_layout.addWidget(self.execute_button)
        
        self.cancel_button = QPushButton("Cancel")
        self.cancel_button.clicked.connect(self.cancel_operation)
        self.cancel_button.setEnabled(False)
        button_layout.addWidget(self.cancel_button)
        
        progress_layout.addLayout(button_layout)
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        progress_layout.addWidget(self.progress_bar)
        
        self.status_label = QLabel("Ready")
        progress_layout.addWidget(self.status_label)
        
        tab_widget.addTab(progress_widget, "Progress")
        
        # Log tab
        log_widget = QWidget()
        log_layout = QVBoxLayout(log_widget)
        
        self.log_text = QTextEdit()
        self.log_text.setReadOnly(True)
        log_layout.addWidget(self.log_text)
        
        log_buttons_layout = QHBoxLayout()
        clear_log_button = QPushButton("Clear Log")
        clear_log_button.clicked.connect(self.clear_log)
        log_buttons_layout.addWidget(clear_log_button)
        
        save_log_button = QPushButton("Save Log")
        save_log_button.clicked.connect(self.save_log)
        log_buttons_layout.addWidget(save_log_button)
        
        log_layout.addLayout(log_buttons_layout)
        
        tab_widget.addTab(log_widget, "Log")
        
        # Set initial splitter sizes
        splitter.setSizes([200, 400, 200])
        
        # Add a default log entry
        self.add_log_entry("Ready. Select source and destination to begin.")
        
        # Set up timer for delayed filtering
        self.filter_timer = QTimer()
        self.filter_timer.setSingleShot(True)
        self.filter_timer.timeout.connect(self.apply_delayed_filter)

    def on_filter_changed(self):
        # Delay the filter application to avoid excessive refreshing while typing
        self.filter_timer.start(500)  # 500ms delay
        
    def apply_delayed_filter(self):
        self.refresh_file_list()

    def browse_source(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Source Folder")
        if folder:
            self.source_path.setText(folder)
            self.refresh_file_list()

    def browse_destination(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Destination Folder")
        if folder:
            self.dest_path.setText(folder)

    def get_file_types(self):
        file_types_text = self.file_type_entry.text().strip()
        if file_types_text:
            return [ft.strip() for ft in file_types_text.split(',') if ft.strip()]
        return []

    def format_size(self, size_in_bytes):
        """Convert a file size to human-readable form."""
        if size_in_bytes < 0:
            return "Unknown"
            
        for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
            if size_in_bytes < 1024.0:
                if unit == 'B':
                    return f"{size_in_bytes} {unit}"
                return f"{size_in_bytes:.2f} {unit}"
            size_in_bytes /= 1024.0
        return f"{size_in_bytes:.2f} PB"

    def format_date(self, timestamp):
        """Format timestamp as date string."""
        try:
            dt = datetime.fromtimestamp(timestamp)
            return dt.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            return "Unknown"

    def refresh_file_list(self):
        """Reload the file tree with the current source and filters."""
        source_path = self.source_path.text()
        if not source_path or not os.path.exists(source_path):
            QMessageBox.warning(self, "Error", "Please specify a valid source path.")
            return
            
        # Don't refresh too frequently
        current_time = time.time()
        if source_path == self.last_source_path and current_time - self.last_refresh_time < 1.0:
            return
            
        self.last_source_path = source_path
        self.last_refresh_time = current_time
        
        # Show loading cursor
        QApplication.setOverrideCursor(QCursor(Qt.CursorShape.WaitCursor))
        
        try:
            self.add_log_entry(f"Loading files from {source_path}...")
            self.file_tree.clear()
            
            # Load the files
            self.populate_tree(source_path, self.file_tree)
            
            # Expand first level
            for i in range(self.file_tree.topLevelItemCount()):
                self.file_tree.topLevelItem(i).setExpanded(True)
                
            self.add_log_entry(f"Loaded file list from {source_path}")
            self.update_selection_info()
            
        except Exception as e:
            self.add_log_entry(f"Error loading files: {str(e)}")
        finally:
            # Restore cursor
            QApplication.restoreOverrideCursor()

    def populate_tree(self, path, parent_item, max_recursion=10):
        """Recursively populate the tree widget with files and folders."""
        if max_recursion <= 0:
            return  # Prevent excessive recursion
            
        try:
            include_subdirs = self.include_subdirs.isChecked()
            skip_hidden = self.skip_hidden.isChecked()
            file_types = self.get_file_types()
            
            if isinstance(parent_item, QTreeWidget):
                # This is the root tree widget
                if os.path.isfile(path):
                    # Single file was selected as source
                    file_name = os.path.basename(path)
                    if skip_hidden and file_name.startswith('.'):
                        return
                        
                    if file_types and not any(fnmatch.fnmatch(file_name.lower(), pattern.lower()) for pattern in file_types):
                        return
                        
                    root_item = QTreeWidgetItem(parent_item, [file_name])
                    root_item.setData(0, Qt.ItemDataRole.UserRole, path)
                    root_item.setIcon(0, self.style().standardIcon(QStyle.StandardPixmap.SP_FileIcon))
                    
                    file_size = os.path.getsize(path)
                    root_item.setText(1, self.format_size(file_size))
                    
                    file_mtime = os.path.getmtime(path)
                    root_item.setText(2, self.format_date(file_mtime))
                    
                    _, ext = os.path.splitext(path)
                    root_item.setText(3, ext[1:] if ext else "")
                    return
                    
                # Directory was selected - create root node
                root_item = QTreeWidgetItem(parent_item, [os.path.basename(path)])
                root_item.setData(0, Qt.ItemDataRole.UserRole, path)
                root_item.setIcon(0, self.style().standardIcon(QStyle.StandardPixmap.SP_DirIcon))
                parent_item = root_item

            # If path is a directory, recursively populate it
            if os.path.isdir(path):
                try:
                    items = os.listdir(path)
                except PermissionError:
                    item_error = QTreeWidgetItem(parent_item, ["[Permission Denied]"])
                    item_error.setForeground(0, QColor("red"))
                    return
                except Exception as e:
                    item_error = QTreeWidgetItem(parent_item, [f"[Error: {str(e)}]"])
                    item_error.setForeground(0, QColor("red"))
                    return
                    
                # Sort items: directories first, then files
                dirs = []
                files = []
                for item in items:
                    item_path = os.path.join(path, item)
                    # Skip hidden items if option is checked
                    if skip_hidden and item.startswith('.'):
                        continue
                        
                    if os.path.isdir(item_path):
                        dirs.append(item)
                    else:
                        # Check file type filter
                        if file_types and not any(fnmatch.fnmatch(item.lower(), pattern.lower()) for pattern in file_types):
                            continue
                        files.append(item)
                
                # Process directories first
                for item in sorted(dirs):
                    item_path = os.path.join(path, item)
                    item_widget = QTreeWidgetItem(parent_item, [item])
                    item_widget.setData(0, Qt.ItemDataRole.UserRole, item_path)
                    item_widget.setIcon(0, self.style().standardIcon(QStyle.StandardPixmap.SP_DirIcon))
                    
                    # Add modification date
                    try:
                        mtime = os.path.getmtime(item_path)
                        item_widget.setText(2, self.format_date(mtime))
                    except:
                        pass
                        
                    item_widget.setText(3, "Folder")
                    
                    # Recursively populate subdirectories if enabled
                    if include_subdirs:
                        self.populate_tree(item_path, item_widget, max_recursion - 1)
                
                # Process files
                for item in sorted(files):
                    item_path = os.path.join(path, item)
                    item_widget = QTreeWidgetItem(parent_item, [item])
                    item_widget.setData(0, Qt.ItemDataRole.UserRole, item_path)
                    item_widget.setIcon(0, self.style().standardIcon(QStyle.StandardPixmap.SP_FileIcon))
                    
                    # Add file size
                    try:
                        item_size = os.path.getsize(item_path)
                        item_widget.setText(1, self.format_size(item_size))
                    except:
                        item_widget.setText(1, "Error")
                    
                    # Add modification date
                    try:
                        mtime = os.path.getmtime(item_path)
                        item_widget.setText(2, self.format_date(mtime))
                    except:
                        pass
                        
                    # Add file type
                    _, ext = os.path.splitext(item_path)
                    item_widget.setText(3, ext[1:] if ext else "")
                
        except Exception as e:
            self.add_log_entry(f"Error populating tree: {str(e)}")

    def show_context_menu(self, position):
        """Show context menu for file tree items."""
        menu = QMenu()
        
        # Get selected items
        selected_items = self.file_tree.selectedItems()
        if not selected_items:
            return
            
        # Add common actions
        select_all_action = QAction("Select All", self)
        select_all_action.triggered.connect(self.file_tree.selectAll)
        menu.addAction(select_all_action)
        
        invert_selection_action = QAction("Invert Selection", self)
        invert_selection_action.triggered.connect(self.invert_selection)
        menu.addAction(invert_selection_action)
        
        menu.addSeparator()
        
        # Expand/collapse actions
        expand_all_action = QAction("Expand All", self)
        expand_all_action.triggered.connect(lambda: self.file_tree.expandAll())
        menu.addAction(expand_all_action)
        
        collapse_all_action = QAction("Collapse All", self)
        collapse_all_action.triggered.connect(lambda: self.file_tree.collapseAll())
        menu.addAction(collapse_all_action)
        
        menu.addSeparator()
        
        # File operations
        select_children_action = QAction("Select All Children", self)
        select_children_action.triggered.connect(self.select_all_children)
        menu.addAction(select_children_action)
        
        if len(selected_items) == 1:
            item = selected_items[0]
            file_path = item.data(0, Qt.ItemDataRole.UserRole)
            
            if os.path.isdir(file_path):
                set_as_source_action = QAction("Set as Source", self)
                set_as_source_action.triggered.connect(lambda: self.set_as_source(file_path))
                menu.addAction(set_as_source_action)
                
            set_as_dest_action = QAction("Set as Destination", self)
            set_as_dest_action.triggered.connect(lambda: self.set_as_destination(file_path))
            menu.addAction(set_as_dest_action)
        
        # Execute the menu
        menu.exec(QCursor.pos())

    def select_all_children(self):
        """Select all children of the selected items."""
        for item in self.file_tree.selectedItems():
            self.select_item_and_children(item)
            
    def select_item_and_children(self, item):
        """Recursively select an item and all its children."""
        item.setSelected(True)
        for i in range(item.childCount()):
            self.select_item_and_children(item.child(i))

    def invert_selection(self):
        """Invert the current selection."""
        all_items = self.get_all_items()
        selected_items = self.file_tree.selectedItems()
        
        for item in all_items:
            item.setSelected(item not in selected_items)
    
    def get_all_items(self):
        """Get all items in the tree."""
        all_items = []
        for i in range(self.file_tree.topLevelItemCount()):
            top_item = self.file_tree.topLevelItem(i)
            all_items.append(top_item)
            self.get_children(top_item, all_items)
        return all_items
        
    def get_children(self, item, items_list):
        """Recursively get all children of an item."""
        for i in range(item.childCount()):
            child = item.child(i)
            items_list.append(child)
            self.get_children(child, items_list)

    def set_as_source(self, path):
        """Set the given path as the source path."""
        self.source_path.setText(path)
        self.refresh_file_list()
        
    def set_as_destination(self, path):
        """Set the given path as the destination path."""
        self.dest_path.setText(path)

    def update_selection_info(self):
        """Update the selection info label with count and size of selected items."""
        selected_items = self.file_tree.selectedItems()
        total_size = 0
        file_count = 0
        folder_count = 0
        
        for item in selected_items:
            path = item.data(0, Qt.ItemDataRole.UserRole)
            if os.path.isfile(path):
                try:
                    total_size += os.path.getsize(path)
                    file_count += 1
                except:
                    pass
            elif os.path.isdir(path):
                folder_count += 1
                
        text_parts = []
        if file_count > 0:
            text_parts.append(f"{file_count} file{'s' if file_count != 1 else ''}")
        if folder_count > 0:
            text_parts.append(f"{folder_count} folder{'s' if folder_count != 1 else ''}")
            
        if text_parts:
            self.selection_info.setText(f"{' and '.join(text_parts)} selected ({self.format_size(total_size)})")
        else:
            self.selection_info.setText("No items selected")

    def get_selected_items(self):
        """Get all selected items from the tree."""
        return self.file_tree.selectedItems()

    def start_operation(self):
        """Start the copy or move operation."""
        source_path = self.source_path.text()
        dest_path = self.dest_path.text()
        
        if not source_path or not os.path.exists(source_path):
            QMessageBox.warning(self, "Error", "Please specify a valid source path.")
            return
        
        if not dest_path:
            QMessageBox.warning(self, "Error", "Please specify a destination path.")
            return
            
        # Get selected items or all items if none selected
        selected_items = self.get_selected_items()
        if not selected_items:
            reply = QMessageBox.question(
                self, "No Selection", 
                "No items are selected. Do you want to process all items?",
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            if reply == QMessageBox.StandardButton.Yes:
                selected_items = []
                for i in range(self.file_tree.topLevelItemCount()):
                    selected_items.append(self.file_tree.topLevelItem(i))
            else:
                return

        # Create the destination directory if it doesn't exist
        try:
            os.makedirs(dest_path, exist_ok=True)
        except Exception as e:
            QMessageBox.critical(self, "Error", f"Could not create destination directory: {str(e)}")
            return

        # Determine operation type
        operation_type = "copy" if self.copy_radio.isChecked() else "move"
        
        # Confirm the operation
        file_count = self.count_selected_files(selected_items)
        if file_count == 0:
            QMessageBox.warning(self, "No Files", "No files match the current filters.")
            return
            
        reply = QMessageBox.question(
            self, f"Confirm {operation_type.capitalize()}", 
            f"Are you sure you want to {operation_type} {file_count} files to {dest_path}?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )
        
        if reply == QMessageBox.StandardButton.No:
            return

        # Set up options
        options = {
            'include_subdirs': self.include_subdirs.isChecked(),
            'skip_hidden': self.skip_hidden.isChecked(),
            'overwrite': self.overwrite.isChecked(),
            'preserve_metadata': self.preserve_metadata.isChecked(),
            'create_structure_first': self.create_structure_first.isChecked(),
            'file_types': self.get_file_types()
        }
        
        # Start the worker thread
        self.worker = FileOperationWorker(
            source_path,
            dest_path,
            selected_items,
            operation_type,
            options
        )
        
        # Connect signals
        self.worker.signals.progress.connect(self.update_progress)
        self.worker.signals.finished.connect(self.on_worker_finished)
        self.worker.signals.error.connect(self.on_worker_error)
        self.worker.signals.log.connect(self.add_log_entry)
        
        # Start the thread
        self.execute_button.setEnabled(False)
        self.cancel_button.setEnabled(True)
        self.progress_bar.setValue(0)
        self.status_label.setText(f"Starting {operation_type} operation...")
        self.worker.start()

    def count_selected_files(self, items):
        """Count how many files will be processed in the selected items."""
        # Use the worker's counting functionality
        options = {
            'include_subdirs': self.include_subdirs.isChecked(),
            'skip_hidden': self.skip_hidden.isChecked(),
            'file_types': self.get_file_types()
        }
        
        temp_worker = FileOperationWorker(
            self.source_path.text(),
            self.dest_path.text(),
            items,
            "count",  # Just for counting
            options
        )
        
        return temp_worker.count_files_to_process(items)

    def cancel_operation(self):
        """Cancel the current operation."""
        if self.worker and self.worker.isRunning():
            self.add_log_entry("Cancelling operation...")
            self.worker.cancel()
            self.cancel_button.setEnabled(False)
            self.status_label.setText("Cancelling operation...")

    def update_progress(self, progress, status):
        """Update the progress bar and status label."""
        self.progress_bar.setValue(progress)
        self.status_label.setText(status)

    def on_worker_finished(self):
        """Handle completion of the worker thread."""
        self.execute_button.setEnabled(True)
        self.cancel_button.setEnabled(False)
        self.progress_bar.setValue(100)
        self.status_label.setText("Operation completed")
        
        # Update file tree after move operations
        if self.move_radio.isChecked():
            QTimer.singleShot(500, self.refresh_file_list)

    def on_worker_error(self, error):
        """Handle error from the worker thread."""
        self.execute_button.setEnabled(True)
        self.cancel_button.setEnabled(False)
        self.status_label.setText(f"Error: {error}")
        QMessageBox.critical(self, "Error", f"An error occurred: {error}")

    def add_log_entry(self, message):
        """Add an entry to the log."""
        timestamp = datetime.now().strftime("%H:%M:%S")
        self.log_text.append(f"[{timestamp}] {message}")
        
        # Auto-scroll to bottom
        scrollbar = self.log_text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())

    def clear_log(self):
        """Clear the log text."""
        self.log_text.clear()
        self.add_log_entry("Log cleared")

    def save_log(self):
        """Save the log to a file."""
        file_path, _ = QFileDialog.getSaveFileName(
            self, "Save Log", "", "Text Files (*.txt);;All Files (*)"
        )
        
        if file_path:
            try:
                with open(file_path, 'w') as f:
                    f.write(self.log_text.toPlainText())
                self.add_log_entry(f"Log saved to {file_path}")
            except Exception as e:
                QMessageBox.critical(self, "Error", f"Failed to save log: {str(e)}")

if __name__ == "__main__":
    import sys
    from PyQt6.QtWidgets import QApplication, QStyle
    
    app = QApplication(sys.argv)
    window = QWidget()
    window.setWindowTitle("Copy and Paste Tool")
    window.resize(900, 700)
    
    layout = QVBoxLayout(window)
    copy_tab = CopyandPaste(None)
    layout.addWidget(copy_tab)
    
    window.show()
    sys.exit(app.exec())