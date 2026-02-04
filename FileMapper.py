import sys
import os
import json
import logging
from PyQt6.QtWidgets import (QApplication, QMainWindow, QFileDialog, QTreeView, QVBoxLayout, QHBoxLayout, 
                             QWidget, QPushButton, QLabel, QProgressBar, QMessageBox, QSplitter, QTextEdit,
                             QCheckBox)
from PyQt6.QtGui import QStandardItemModel, QStandardItem, QFont, QColor, QPalette
from PyQt6.QtCore import Qt, QObject, pyqtSignal, QTimer, QSize

# Set up logging
logging.basicConfig(filename='app.log', level=logging.DEBUG, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class CheckableFileSystemModel(QStandardItemModel):
    progress_updated = pyqtSignal(int)
    items_processed = 0
    total_items = 0

    def __init__(self):
        super().__init__()
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
            logger.debug(f"Item changed: {item.text()}")
            self.itemChanged.disconnect(self.handle_item_changed)
            
            if item.hasChildren():
                check_state = item.checkState()
                for row in range(item.rowCount()):
                    child = item.child(row)
                    child.setCheckState(check_state)
            
            parent = item.parent()
            while parent is not None and parent != self.invisibleRootItem():
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
        finally:
            self.itemChanged.connect(self.handle_item_changed)

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Folder Structure Viewer")
        self.setGeometry(100, 100, 1000, 700)
        self.night_mode = False
        self.set_style()

        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QVBoxLayout(central_widget)

        # Top section
        top_layout = QHBoxLayout()
        self.folder_label = QLabel("No folder selected")
        select_folder_button = QPushButton("Select Folder")
        select_folder_button.clicked.connect(self.select_folder)
        self.night_mode_checkbox = QCheckBox("Night Mode")
        self.night_mode_checkbox.stateChanged.connect(self.toggle_night_mode)
        top_layout.addWidget(self.folder_label)
        top_layout.addWidget(select_folder_button)
        top_layout.addWidget(self.night_mode_checkbox)
        main_layout.addLayout(top_layout)

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
        main_layout.addWidget(splitter)

        # Bottom section
        bottom_layout = QHBoxLayout()
        save_structure_button = QPushButton("Save Structure")
        save_structure_button.clicked.connect(self.save_structure)
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        bottom_layout.addWidget(save_structure_button)
        bottom_layout.addWidget(self.progress_bar)
        main_layout.addLayout(bottom_layout)

        self.model.progress_updated.connect(self.update_progress)
        self.tree_view.clicked.connect(self.update_preview)

        # Timer for auto-save
        self.auto_save_timer = QTimer(self)
        self.auto_save_timer.timeout.connect(self.auto_save)
        self.auto_save_timer.start(300000)  # Auto-save every 5 minutes

    def set_style(self):
        # (Style setting code remains the same)
        pass

    def toggle_night_mode(self, state):
        self.night_mode = (state == Qt.CheckState.Checked.value)
        self.set_style()

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

    def save_structure(self):
        try:
            file_name, _ = QFileDialog.getSaveFileName(self, "Save Folder Structure", "", 
                                                       "JSON Files (*.json);;Text Files (*.txt);;XML Files (*.xml);;Mermaid Files (*.mmd);;DOT Files (*.dot)")
            if file_name:
                format = file_name.split('.')[-1]
                data = self._get_structure_data()
                content = self._format_data(data, format)
                with open(file_name, 'w', encoding='utf-8') as f:
                    f.write(content)
                logger.info(f"Structure saved to {file_name}")
                QMessageBox.information(self, "Success", "File structure saved successfully!")
        except Exception as e:
            logger.error(f"Error in save_structure: {str(e)}", exc_info=True)
            QMessageBox.critical(self, "Error", f"Error saving file: {str(e)}")

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

    def auto_save(self):
        try:
            data = self._get_structure_data()
            content = json.dumps(data, indent=2)
            with open('auto_save.json', 'w', encoding='utf-8') as f:
                f.write(content)
            logger.info("Auto-save completed")
        except Exception as e:
            logger.error(f"Auto-save failed: {str(e)}", exc_info=True)

    def _get_structure_data(self, root_item=None):
        try:
            def process_item(item):
                if item.checkState() == Qt.CheckState.Unchecked:
                    return None
                result = {"name": item.text(), "type": "folder" if item.hasChildren() else "file"}
                if item.hasChildren():
                    children = [process_item(item.child(i)) for i in range(item.rowCount())]
                    result["children"] = [child for child in children if child is not None]
                    if not result["children"]:
                        del result["children"]
                return result

            if root_item is None:
                root = self.model.invisibleRootItem()
                return [process_item(root.child(i)) for i in range(root.rowCount()) if process_item(root.child(i)) is not None]
            else:
                return process_item(root_item)
        except Exception as e:
            logger.error(f"Error in _get_structure_data: {str(e)}", exc_info=True)
            return None

    def _format_data(self, data, format):
        try:
            if format == 'json':
                return json.dumps(data, indent=2)
            elif format == 'txt':
                return self._format_to_txt(data)
            elif format == 'xml':
                return self._format_to_xml(data)
            elif format == 'mmd':
                return self._format_to_mermaid(data)
            elif format == 'dot':
                return self._format_to_dot(data)
            else:
                return str(data)
        except Exception as e:
            logger.error(f"Error in _format_data: {str(e)}", exc_info=True)
            return str(data)


    def _format_to_txt(self, data, indent=''):
        result = ''
        if isinstance(data, list):
            for item in data:
                result += self._format_to_txt(item, indent)
        else:
            result += f"{indent}{'📁' if 'children' in data else '📄'} {data['name']}\n"
            if 'children' in data:
                for child in data['children']:
                    result += self._format_to_txt(child, indent + '  ')
        return result

    def _format_to_xml(self, data):
        def to_xml(item):
            if 'children' not in item:
                return f'<file name="{item["name"]}"/>'
            result = f'<folder name="{item["name"]}">'
            if 'children' in item:
                result += ''.join(to_xml(child) for child in item['children'])
            return result + '</folder>'
        if isinstance(data, list):
            return f'<?xml version="1.0" encoding="UTF-8"?>\n<root>{"".join(to_xml(item) for item in data)}</root>'
        else:
            return f'<?xml version="1.0" encoding="UTF-8"?>\n<root>{to_xml(data)}</root>'

    def _format_to_mermaid(self, data):
        result = 'graph TD\n'
        id_counter = 0

        def process_item(item, parent_id=None):
            nonlocal id_counter
            current_id = f'id{id_counter}'
            id_counter += 1
            result = f'    {current_id}[{"📁" if "children" in item else "📄"} {item["name"]}]\n'
            if parent_id is not None:
                result += f'    {parent_id} --> {current_id}\n'
            if 'children' in item:
                for child in item['children']:
                    result += process_item(child, current_id)
            return result

        if isinstance(data, list):
            for item in data:
                result += process_item(item)
        else:
            result += process_item(data)
        return result
def _format_to_dot(self, data):
        result = 'digraph FolderStructure {\n'
        id_counter = 0

        def process_item(item, parent_id=None):
            nonlocal id_counter
            current_id = f'id{id_counter}'
            id_counter += 1
            shape = 'folder' if 'children' in item else 'note'
            result = f'    {current_id} [label="{item["name"]}" shape="{shape}"];\n'
            if parent_id is not None:
                result += f'    {parent_id} -> {current_id};\n'
            if 'children' in item:
                for child in item['children']:
                    result += process_item(child, current_id)
            return result

        if isinstance(data, list):
            for item in data:
                result += process_item(item)
        else:
            result += process_item(data)
        return result + '}'

if __name__ == '__main__':
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    sys.exit(app.exec())