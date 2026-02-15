# Standard library imports
import sys
import os
import json
import logging
from datetime import datetime
import shutil

# Third-party imports
from PyQt6.QtWidgets import (
    QApplication, QMainWindow, QTabWidget, QWidget, QVBoxLayout, QHBoxLayout,
    QLabel, QLineEdit, QPushButton, QTreeWidget, QTreeWidgetItem, QTreeView,
    QFileDialog, QMessageBox, QGroupBox, QTextEdit, QComboBox, QCheckBox,
    QProgressBar, QSpinBox, QSplitter, QFormLayout, QFrame, QListWidget,
    QListWidgetItem, QScrollArea, QGridLayout
)
from PyQt6.QtGui import QFont, QStandardItemModel, QStandardItem, QDesktopServices, QColor
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QUrl

# Logging setup
logging.basicConfig(filename='app.log', level=logging.DEBUG,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CheckableFileSystemModel(QStandardItemModel):
    progress_updated = pyqtSignal(int)
    items_processed = 0
    total_items = 0

    def __init__(self):
        super().__init__()
        self.setHorizontalHeaderLabels(['Name'])
        self.itemChanged.connect(self.handle_item_changed)

    def populate_tree(self, path):
        self.clear()
        self.setHorizontalHeaderLabels(['Name'])
        root_node = self.invisibleRootItem()
        self.total_items = sum([len(files) + len(dirs) for _, dirs, files in os.walk(path)])
        self.items_processed = 0
        self._populate_tree_recursive(path, root_node)

    def _populate_tree_recursive(self, path, parent):
        try:
            for entry in os.scandir(path):
                item = QStandardItem(entry.name)
                item.setCheckable(True)
                item.setAutoTristate(True)
                item.setCheckState(Qt.CheckState.Checked)
                item.setEditable(False)
                if entry.is_dir():
                    item.setIcon(QApplication.style().standardIcon(QApplication.style().StandardPixmap.SP_DirIcon))
                    self._populate_tree_recursive(entry.path, item)
                else:
                    item.setIcon(QApplication.style().standardIcon(QApplication.style().StandardPixmap.SP_FileIcon))
                parent.appendRow(item)
                self.items_processed += 1
                self.progress_updated.emit(int(self.items_processed / self.total_items * 100))
        except PermissionError:
            logger.warning(f"Permission denied: {path}")
        except Exception as e:
            logger.error(f"Error accessing {path}: {str(e)}", exc_info=True)

    def handle_item_changed(self, item):
        try:
            if item.hasChildren():
                check_state = item.checkState()
                for row in range(item.rowCount()):
                    child = item.child(row)
                    child.setCheckState(check_state)
            
            parent = item.parent()
            while parent and parent != self.invisibleRootItem():
                parent_check_state = Qt.CheckState.Unchecked
                checked_count = sum(1 for row in range(parent.rowCount()) if parent.child(row).checkState() != Qt.CheckState.Unchecked)
                total_count = parent.rowCount()
                
                if checked_count == 0:
                    parent_check_state = Qt.CheckState.Unchecked
                elif checked_count == total_count:
                    parent_check_state = Qt.CheckState.Checked
                else:
                    parent_check_state = Qt.CheckState.PartiallyChecked
                
                parent.setCheckState(parent_check_state)
                parent = parent.parent()
        except Exception as e:
            logger.error(f"Error in handle_item_changed: {str(e)}", exc_info=True)

class FileMapperWorker(QThread):
    progress = pyqtSignal(dict)
    finished = pyqtSignal(dict)

    def __init__(self, root_path):
        super().__init__()
        self.root_path = root_path

    def run(self):
        file_count = 0
        folder_count = 0
        total_size = 0

        for root, dirs, files in os.walk(self.root_path):
            folder_count += len(dirs)
            file_count += len(files)
            for file in files:
                file_path = os.path.join(root, file)
                total_size += os.path.getsize(file_path)
            
            self.progress.emit({
                'file_count': file_count,
                'folder_count': folder_count,
                'total_size': total_size
            })

        self.finished.emit({
            'file_count': file_count,
            'folder_count': folder_count,
            'total_size': total_size
        })

class FileSystemTab(QWidget):
    def __init__(self, tab_name):
        super().__init__()
        self.tab_name = tab_name
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout(self)

        # Top section
        top_layout = QHBoxLayout()
        self.folder_label = QLabel("No folder selected")
        select_folder_button = QPushButton("Select Folder")
        select_folder_button.clicked.connect(self.select_folder)
        top_layout.addWidget(self.folder_label)
        top_layout.addWidget(select_folder_button)
        layout.addLayout(top_layout)

        # Middle section
        splitter = QSplitter(Qt.Orientation.Horizontal)
        self.tree_view = QTreeView()
        self.tree_view.setMinimumWidth(300)
        self.model = CheckableFileSystemModel()
        self.tree_view.setModel(self.model)
        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        splitter.addWidget(self.tree_view)
        splitter.addWidget(self.preview_text)
        layout.addWidget(splitter)

        # Bottom section
        bottom_layout = QHBoxLayout()
        action_button = QPushButton(f"{self.tab_name} Action")
        action_button.clicked.connect(self.perform_action)
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        bottom_layout.addWidget(action_button)
        bottom_layout.addWidget(self.progress_bar)
        layout.addLayout(bottom_layout)

        self.model.progress_updated.connect(self.update_progress)
        self.tree_view.clicked.connect(self.update_preview)

    def select_folder(self):
        try:
            folder = QFileDialog.getExistingDirectory(self, "Select Folder")
            if folder:
                logger.info(f"Selected folder: {folder}")
                self.folder_label.setText(f"Selected folder: {folder}")
                self.model.populate_tree(folder)
                self.tree_view.expandToDepth(0)
        except Exception as e:
            logger.error(f"Error in select_folder: {str(e)}", exc_info=True)
            QMessageBox.critical(self, "Error", f"Error populating tree: {str(e)}")

    def update_progress(self, value):
        self.progress_bar.setValue(value)

    def update_preview(self, index):
        try:
            item = self.model.itemFromIndex(index)
            data = self._get_structure_data(item)
            preview = self._format_data(data, 'txt')
            self.preview_text.setText(preview)
        except Exception as e:
            logger.error(f"Error in update_preview: {str(e)}", exc_info=True)

    def perform_action(self):
        # Implement specific action for each tab
        pass

    def _get_structure_data(self, root_item=None):
        # Implementation same as in the FileMapper example
        pass

    def _format_data(self, data, format):
        # Implementation same as in the FileMapper example
        pass

class EmptyFileCreationTab(FileSystemTab):
    def __init__(self):
        super().__init__("Empty File Creation")
        self.initAdditionalUI()

    def initAdditionalUI(self):
        main_layout = QHBoxLayout()
        left_layout = QVBoxLayout()
        right_layout = QVBoxLayout()

        # Left side: Folder selection and file name list
        left_layout.addWidget(self.folder_label)
        self.folder_button = QPushButton("Select Folder")
        left_layout.addWidget(self.folder_button)
        open_folder_button = QPushButton("Open Destination Folder")
        open_folder_button.clicked.connect(self.open_destination_folder)
        left_layout.addWidget(open_folder_button)
        
        left_layout.addWidget(QLabel("Number of Files:"))
        self.num_files = QSpinBox()
        self.num_files.setMinimum(1)
        self.num_files.setValue(1)
        self.num_files.valueChanged.connect(self.update_file_list)
        left_layout.addWidget(self.num_files)

        left_layout.addWidget(QLabel("File Names:"))
        self.file_list = QListWidget()
        self.file_list.itemChanged.connect(self.update_preview)
        left_layout.addWidget(self.file_list)

        main_layout.addLayout(left_layout, 1)

        # Right side: Other options
        form_layout = QGridLayout()
        
        # Prefix options
        self.prefix_combo = QComboBox()
        self.prefix_combo.addItems(["No Prefix", "Date Prefix", "(1 - , 2 - , 3 - )", "(01, 02, 03)", "1), 2), 3)", "1., 2., 3."])
        self.prefix_combo.currentIndexChanged.connect(self.update_prefix_options)
        form_layout.addWidget(QLabel("Prefix Type:"), 0, 0)
        form_layout.addWidget(self.prefix_combo, 0, 1)

        self.date_format = QComboBox()
        self.date_format.addItems(["YYYY-MM-DD", "YYYYMMDD", "DD-MM-YYYY", "MM-DD-YYYY"])
        self.date_format.setVisible(False)
        form_layout.addWidget(QLabel("Date Format:"), 1, 0)
        form_layout.addWidget(self.date_format, 1, 1)

        self.custom_prefix_check = QCheckBox("Use Custom Prefix")
        self.custom_prefix_check.stateChanged.connect(self.update_prefix_options)
        form_layout.addWidget(self.custom_prefix_check, 2, 0, 1, 2)

        self.custom_prefix_input = QLineEdit()
        self.custom_prefix_input.setVisible(False)
        form_layout.addWidget(self.custom_prefix_input, 3, 0, 1, 2)

        # File type input and tags
        form_layout.addWidget(QLabel("File Types:"), 4, 0)
        self.file_types_input = QLineEdit()
        self.file_types_input.textChanged.connect(self.update_file_type_tags)
        form_layout.addWidget(self.file_types_input, 4, 1)

        self.file_type_tags_scroll = QScrollArea()
        self.file_type_tags_widget = QWidget()
        self.file_type_tags_layout = QHBoxLayout(self.file_type_tags_widget)
        self.file_type_tags_scroll.setWidget(self.file_type_tags_widget)
        self.file_type_tags_scroll.setWidgetResizable(True)
        form_layout.addWidget(self.file_type_tags_scroll, 5, 0, 1, 2)

        right_layout.addLayout(form_layout)

        # Preview area
        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        right_layout.addWidget(QLabel("Preview:"))
        right_layout.addWidget(self.preview_text)

        main_layout.addLayout(right_layout, 1)

        # Add the main layout to the tab
        self.layout().addLayout(main_layout)

        # Progress bar (initially hidden)
        self.progress_bar.setVisible(False)

        # Initialize file type tags
        self.update_file_type_tags()

        # Connect signals
        self.custom_prefix_input.textChanged.connect(self.update_preview)
        self.date_format.currentTextChanged.connect(self.update_preview)
        self.file_types_input.textChanged.connect(self.update_preview)

        # Initial update
        self.update_file_list()

    def update_file_list(self):
        self.file_list.clear()
        for i in range(self.num_files.value()):
            item = QListWidgetItem(f"file_{i+1}")
            item.setFlags(item.flags() | Qt.ItemFlag.ItemIsEditable)
            self.file_list.addItem(item)
        self.update_preview()

    def get_prefix(self):
        prefix_type = self.prefix_combo.currentText()
        if prefix_type == "No Prefix":
            return ""
        elif prefix_type == "Date Prefix":
            date_format = self.date_format.currentText().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
            return datetime.now().strftime(date_format) + "_"
        elif prefix_type in ["(1 - , 2 - , 3 - )", "(01, 02, 03)", "1), 2), 3)", "1., 2., 3."]:
            return prefix_type.split(',')[0].strip()[:-1] + "_"  # Return the first option without the last character
        
        custom_prefix = self.custom_prefix_input.text() if self.custom_prefix_check.isChecked() else ""
        return (prefix_type + custom_prefix + "_") if prefix_type != "No Prefix" else custom_prefix

    def update_file_type_tags(self):
        # Clear existing tags
        for i in reversed(range(self.file_type_tags_layout.count())): 
            self.file_type_tags_layout.itemAt(i).widget().setParent(None)

        current_types = set(ext.strip() for ext in self.file_types_input.text().split(',') if ext.strip())
        common_extensions = ['.txt', '.csv', '.json', '.xml', '.docx', '.xlsx', '.sql']

        for ext in common_extensions:
            tag_button = QPushButton(ext)
            tag_button.setCheckable(True)
            tag_button.setChecked(ext in current_types)
            tag_button.clicked.connect(self.toggle_file_type)
            self.file_type_tags_layout.addWidget(tag_button)

        self.update_file_type_colors()

    def toggle_file_type(self):
        sender = self.sender()
        current_types = set(ext.strip() for ext in self.file_types_input.text().split(',') if ext.strip())
        
        if sender.isChecked() and sender.text() not in current_types:
            current_types.add(sender.text())
        elif not sender.isChecked() and sender.text() in current_types:
            current_types.remove(sender.text())
        
        self.file_types_input.setText(','.join(current_types))
        self.update_file_type_colors()

    def update_file_type_colors(self):
        current_types = set(ext.strip() for ext in self.file_types_input.text().split(',') if ext.strip())
        for i in range(self.file_type_tags_layout.count()):
            button = self.file_type_tags_layout.itemAt(i).widget()
            if button.text() in current_types:
                button.setStyleSheet("background-color: #4a90e2; color: white;")
            else:
                button.setStyleSheet("")

    def create_empty_files(self):
        folder_path = self.folder_label.text().replace("Selected folder: ", "")
        if not folder_path or folder_path == "No folder selected":
            QMessageBox.warning(self, "Error", "Please select a folder first.")
            return

        file_types = [ext.strip() for ext in self.file_types_input.text().split(',') if ext.strip()]
        if not file_types:
            QMessageBox.warning(self, "Error", "Please specify at least one file type.")
            return

        try:
            created_files = 0
            total_files = len(file_types) * self.num_files.value()
            self.progress_bar.setMaximum(total_files)
            self.progress_bar.setValue(0)
            self.progress_bar.setVisible(True)

            prefix = self.get_prefix()

            for i in range(self.num_files.value()):
                base_name = self.file_list.item(i).text()
                for ext in file_types:
                    filename = f"{prefix}{base_name}{ext}"
                    file_path = os.path.join(folder_path, filename)

                    with open(file_path, 'w') as f:
                        pass  # Create an empty file

                    created_files += 1
                    self.progress_bar.setValue(created_files)
                    QApplication.processEvents()

            QMessageBox.information(self, "Success", f"Created {created_files} empty files successfully.")
            self.model.populate_tree(folder_path)  # Refresh the tree view
        except Exception as e:
            logger.error(f"Error in create_empty_files: {str(e)}", exc_info=True)
            QMessageBox.critical(self, "Error", f"An error occurred while creating files: {str(e)}")
        finally:
            self.progress_bar.setVisible(False)

    def update_preview(self):
        try:
            preview = "File Creation Preview:\n\n"
            prefix = self.get_prefix()
            file_types = [ext.strip() for ext in self.file_types_input.text().split(',') if ext.strip()]

            for i in range(min(self.num_files.value(), 5)):
                base_name = self.file_list.item(i).text()
                for ext in file_types[:3]:
                    filename = f"{prefix}{base_name}{ext}"
                    preview += f"{filename}\n"
                if len(file_types) > 3:
                    preview += "...\n"
            if self.num_files.value() > 5:
                preview += "...\n"
            
            self.preview_text.setPlainText(preview)
        except Exception as e:
            logger.error(f"Error in update_preview: {str(e)}", exc_info=True)
            self.preview_text.setPlainText("Invalid input. Please check your settings.")

    def open_destination_folder(self):
        folder_path = self.folder_label.text().replace("Selected folder: ", "")
        if not folder_path or folder_path == "No folder selected":
            QMessageBox.warning(self, "Error", "No destination folder selected.")
            return
        
        QDesktopServices.openUrl(QUrl.fromLocalFile(folder_path))

    def update_prefix_options(self):
        prefix_type = self.prefix_combo.currentText()
        self.date_format.setVisible(prefix_type == "Date Prefix")
        self.custom_prefix_input.setVisible(self.custom_prefix_check.isChecked())
        self.update_preview()
        
class FolderCreationTab(FileSystemTab):
    def __init__(self):
        super().__init__("Folder Creation")
        self.initAdditionalUI()

    def initAdditionalUI(self):
        # Add additional UI elements specific to folder creation
        form_layout = QFormLayout()
        
        self.num_main_folders = QSpinBox()
        self.num_main_folders.setMinimum(1)
        self.num_main_folders.setValue(1)
        form_layout.addRow("Number of Main Folders:", self.num_main_folders)

        self.main_folder_prefix = QLineEdit()
        form_layout.addRow("Main Folder Prefix:", self.main_folder_prefix)

        self.subfolder_names = QLineEdit()
        form_layout.addRow("Subfolder Names (comma-separated):", self.subfolder_names)

        self.use_date_prefix = QCheckBox("Use Date Prefix")
        form_layout.addRow(self.use_date_prefix)

        self.date_format = QComboBox()
        self.date_format.addItems(["YYYY-MM-DD", "YYYYMMDD", "DD-MM-YYYY", "MM-DD-YYYY"])
        form_layout.addRow("Date Format:", self.date_format)

        # Insert the form layout after the folder selection
        self.layout().insertLayout(1, form_layout)

        # Replace the generic action button with a specific one
        self.layout().itemAt(self.layout().count() - 1).layout().itemAt(0).widget().deleteLater()
        create_folders_button = QPushButton("Create Folders")
        create_folders_button.clicked.connect(self.create_folders)
        self.layout().itemAt(self.layout().count() - 1).layout().insertWidget(0, create_folders_button)

        # Connect signals for preview update
        self.num_main_folders.valueChanged.connect(self.update_preview)
        self.main_folder_prefix.textChanged.connect(self.update_preview)
        self.subfolder_names.textChanged.connect(self.update_preview)
        self.use_date_prefix.stateChanged.connect(self.update_preview)
        self.date_format.currentTextChanged.connect(self.update_preview)

    def create_folders(self):
        root_path = self.folder_label.text().replace("Selected folder: ", "")
        if not root_path or root_path == "No folder selected":
            QMessageBox.warning(self, "Error", "Please select a root folder first.")
            return

        num_folders = self.num_main_folders.value()
        folder_prefix = self.main_folder_prefix.text()
        subfolder_names = [name.strip() for name in self.subfolder_names.text().split(',') if name.strip()]

        try:
            created_folders = 0
            total_folders = num_folders * (1 + len(subfolder_names))
            self.progress_bar.setMaximum(total_folders)
            self.progress_bar.setValue(0)

            date_prefix = ""
            if self.use_date_prefix.isChecked():
                date_format = self.date_format.currentText().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                date_prefix = datetime.now().strftime(date_format) + "_"

            for i in range(1, num_folders + 1):
                folder_number = f"{i:02d}"
                main_folder_name = f"{date_prefix}{folder_number} - {folder_prefix}"
                main_folder_path = os.path.join(root_path, main_folder_name)
                
                os.makedirs(main_folder_path, exist_ok=True)
                created_folders += 1
                self.progress_bar.setValue(created_folders)
                QApplication.processEvents()

                for subfolder in subfolder_names:
                    subfolder_path = os.path.join(main_folder_path, subfolder)
                    os.makedirs(subfolder_path, exist_ok=True)
                    created_folders += 1
                    self.progress_bar.setValue(created_folders)
                    QApplication.processEvents()

            QMessageBox.information(self, "Success", f"Created {created_folders} folders and subfolders successfully.")
            self.model.populate_tree(root_path)  # Refresh the tree view
        except Exception as e:
            logger.error(f"Error in create_folders: {str(e)}", exc_info=True)
            QMessageBox.critical(self, "Error", f"An error occurred while creating folders: {str(e)}")
        finally:
            self.progress_bar.setValue(0)

    def update_preview(self):
        try:
            num_folders = self.num_main_folders.value()
            folder_prefix = self.main_folder_prefix.text()
            subfolder_names = [name.strip() for name in self.subfolder_names.text().split(',') if name.strip()]

            date_prefix = ""
            if self.use_date_prefix.isChecked():
                date_format = self.date_format.currentText().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                date_prefix = datetime.now().strftime(date_format) + "_"

            preview = "Folder Structure Preview:\n\n"
            for i in range(1, min(num_folders, 5) + 1):
                folder_number = f"{i:02d}"
                main_folder_name = f"{date_prefix}{folder_number} - {folder_prefix}"
                preview += f"├── {main_folder_name}\n"
                for subfolder in subfolder_names[:3]:
                    preview += f"│   ├── {subfolder}\n"
                if len(subfolder_names) > 3:
                    preview += "│   └── ...\n"
            if num_folders > 5:
                preview += "└── ...\n"
            
            self.preview_text.setPlainText(preview)
        except Exception as e:
            logger.error(f"Error in update_preview: {str(e)}", exc_info=True)
            self.preview_text.setPlainText("Invalid input. Please check your settings.")

class FileCopyWorker(QThread):
    progress = pyqtSignal(int)
    status = pyqtSignal(str)
    finished = pyqtSignal(int)

    def __init__(self, source, dest, selected_items, include_subdirs, overwrite, preserve_metadata):
        super().__init__()
        self.source = source
        self.dest = dest
        self.selected_items = selected_items
        self.include_subdirs = include_subdirs
        self.overwrite = overwrite
        self.preserve_metadata = preserve_metadata

    def run(self):
        copied_files = 0
        total_files = len(self.selected_items)

        for item in self.selected_items:
            src_path = item.data(0, Qt.ItemDataRole.UserRole)
            rel_path = os.path.relpath(src_path, self.source)
            dest_path = os.path.join(self.dest, rel_path)

            if os.path.isdir(src_path):
                if self.include_subdirs:
                    shutil.copytree(src_path, dest_path, dirs_exist_ok=self.overwrite)
            else:
                os.makedirs(os.path.dirname(dest_path), exist_ok=True)
                if self.preserve_metadata:
                    shutil.copy2(src_path, dest_path)
                else:
                    shutil.copy(src_path, dest_path)

            copied_files += 1
            self.progress.emit(int((copied_files / total_files) * 100))
            self.status.emit(f"Copying: {rel_path}")

        self.finished.emit(copied_files)

    def __init__(self):
        super().__init__()
        self.initUI()

    def initUI(self):
        layout = QVBoxLayout()

        # Source path
        source_layout = QHBoxLayout()
        self.source_path = QLineEdit()
        source_layout.addWidget(QLabel("Source Path:"))
        source_layout.addWidget(self.source_path)
        source_layout.addWidget(QPushButton("Browse", clicked=self.browse_source))
        layout.addLayout(source_layout)

        # File tree
        self.file_tree = QTreeWidget()
        self.file_tree.setHeaderLabels(["Name", "Size"])
        self.file_tree.setSelectionMode(QTreeWidget.SelectionMode.MultiSelection)
        layout.addWidget(self.file_tree)

        # Destination path
        dest_layout = QHBoxLayout()
        self.dest_path = QLineEdit()
        dest_layout.addWidget(QLabel("Destination Path:"))
        dest_layout.addWidget(self.dest_path)
        dest_layout.addWidget(QPushButton("Browse", clicked=self.browse_dest))
        layout.addLayout(dest_layout)

        # Options
        self.include_subdirs = QCheckBox("Include Subdirectories")
        self.overwrite = QCheckBox("Overwrite Existing Files")
        self.preserve_metadata = QCheckBox("Preserve Metadata")
        layout.addWidget(self.include_subdirs)
        layout.addWidget(self.overwrite)
        layout.addWidget(self.preserve_metadata)

        # Copy button
        self.copy_button = QPushButton("Copy Files", clicked=self.start_copy_files)
        layout.addWidget(self.copy_button)

        # Progress bar
        self.progress_bar = QProgressBar()
        layout.addWidget(self.progress_bar)

        # Status label
        self.status_label = QLabel()
        layout.addWidget(self.status_label)

        self.setLayout(layout)

    def browse_source(self):
        path = QFileDialog.getExistingDirectory(self, "Select Source Folder")
        if path:
            self.source_path.setText(path)
            self.populate_tree(path)

    def browse_dest(self):
        path = QFileDialog.getExistingDirectory(self, "Select Destination Folder")
        if path:
            self.dest_path.setText(path)

    def populate_tree(self, path):
        self.file_tree.clear()
        root_item = QTreeWidgetItem(self.file_tree, [os.path.basename(path)])
        root_item.setData(0, Qt.ItemDataRole.UserRole, path)
        self.add_directory(root_item, path)

    def add_directory(self, parent, path):
        for item in os.listdir(path):
            item_path = os.path.join(path, item)
            tree_item = QTreeWidgetItem(parent, [item])
            tree_item.setData(0, Qt.ItemDataRole.UserRole, item_path)
            if os.path.isdir(item_path):
                self.add_directory(tree_item, item_path)
            else:
                size = os.path.getsize(item_path)
                tree_item.setText(1, f"{size/1024:.2f} KB")

    def start_copy_files(self):
        source = self.source_path.text()
        dest = self.dest_path.text()
        selected_items = self.file_tree.selectedItems()

        if not source or not dest:
            QMessageBox.warning(self, "Error", "Please specify both source and destination paths.")
            return

        if not selected_items:
            QMessageBox.warning(self, "Error", "Please select files or folders to copy.")
            return

        self.worker = FileCopyWorker(
            source, dest, selected_items,
            self.include_subdirs.isChecked(),
            self.overwrite.isChecked(),
            self.preserve_metadata.isChecked()
        )
        self.worker.progress.connect(self.update_progress)
        self.worker.status.connect(self.update_status)
        self.worker.finished.connect(self.copy_finished)
        self.worker.start()

        self.copy_button.setEnabled(False)

    def update_progress(self, value):
        self.progress_bar.setValue(value)

    def update_status(self, message):
        self.status_label.setText(message)

    def copy_finished(self, copied_files):
        self.copy_button.setEnabled(True)
        self.status_label.setText(f"Copied {copied_files} files/folders successfully.")
        QMessageBox.information(self, "Success", f"Copied {copied_files} files/folders successfully.")

class FileMapperTab(FileSystemTab):
    def __init__(self):
        super().__init__("File Mapper")

    def perform_action(self):
        # Implement File Mapper specific action (e.g., save structure)
        pass

class FileCopyTab(FileSystemTab):
    def __init__(self):
        super().__init__("File Copy")
        self.dest_folder = ""

    def initUI(self):
        super().initUI()
        dest_layout = QHBoxLayout()
        dest_layout.addWidget(QLabel("Destination:"))
        self.dest_label = QLabel("No destination selected")
        dest_layout.addWidget(self.dest_label)
        dest_button = QPushButton("Select Destination")
        dest_button.clicked.connect(self.select_destination)
        dest_layout.addWidget(dest_button)
        self.layout().insertLayout(1, dest_layout)

    def select_destination(self):
        self.dest_folder = QFileDialog.getExistingDirectory(self, "Select Destination Folder")
        if self.dest_folder:
            self.dest_label.setText(f"Destination: {self.dest_folder}")

    def perform_action(self):
        # Implement file copy action
        if not self.dest_folder:
            QMessageBox.warning(self, "Error", "Please select a destination folder.")
            return
        # Implement file copying logic here

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("File Pro")
        self.setGeometry(100, 100, 1200, 800)

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        self.tabs = QTabWidget()
        self.file_mapper_tab = FileMapperTab()
        self.file_copy_tab = FileCopyTab()
        self.folder_creation_tab = FolderCreationTab()
        self.empty_file_creation_tab = EmptyFileCreationTab()
        self.tabs.addTab(self.file_mapper_tab, "File Mapper")
        self.tabs.addTab(self.file_copy_tab, "File Copy")
        self.tabs.addTab(self.folder_creation_tab, "Folder Creation")
        self.tabs.addTab(self.empty_file_creation_tab, "Empty File Creation")
        main_layout.addWidget(self.tabs)

        # Apply styling (same as before)
        self.setStyleSheet("""
            QMainWindow, QWidget {
                background-color: #f0f0f0;
                color: #333333;
            }
            QTreeView {
                background-color: white;
                border: 1px solid #cccccc;
            }
            QPushButton {
                background-color: #4a90e2;
                color: white;
                border: none;
                padding: 5px 10px;
                border-radius: 3px;
            }
            QPushButton:hover {
                background-color: #3a80d2;
            }
            QProgressBar {
                border: 1px solid #cccccc;
                border-radius: 3px;
                text-align: center;
            }
            QProgressBar::chunk {
                background-color: #4a90e2;
            }
        """)
if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())