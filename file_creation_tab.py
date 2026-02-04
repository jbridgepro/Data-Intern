import os
import datetime
from PyQt6.QtWidgets import (QWidget, QVBoxLayout, QHBoxLayout, QLabel, QLineEdit, 
                          QPushButton, QListWidget, QSpinBox, QComboBox, 
                          QProgressBar, QTextEdit, QFileDialog, QMessageBox)
from PyQt6.QtCore import Qt, QObject, pyqtSignal, QThread

class WorkerSignals(QObject):
    finished = pyqtSignal()
    error = pyqtSignal(str)
    progress = pyqtSignal(int)
    status = pyqtSignal(str)

class FileCreationWorker(QThread):
    def __init__(self, folder_path, file_structure, prefix_type, date_format, custom_prefix, file_types):
        super().__init__()
        self.folder_path = folder_path
        self.file_structure = file_structure
        self.prefix_type = prefix_type
        self.date_format = date_format
        self.custom_prefix = custom_prefix
        self.file_types = file_types
        self.signals = WorkerSignals()

    def run(self):
        try:
            total_files = len(self.file_structure)
            created_files = 0

            prefix = self.get_prefix()

            for i, (file_name, content) in enumerate(self.file_structure.items()):
                file_number = f"{i+1:02d}"
                
                # Apply prefix if needed
                main_file_name = f"{prefix}{file_number}_{file_name}" if prefix else file_name
                
                # Apply file extension if specified
                if self.file_types:
                    for file_type in self.file_types:
                        if not main_file_name.endswith(f".{file_type}"):
                            main_file_name = f"{main_file_name}.{file_type}"
                
                file_path = os.path.join(self.folder_path, main_file_name)
                
                # Create the file
                with open(file_path, 'w') as f:
                    f.write(content)
                
                created_files += 1
                progress = int(created_files / total_files * 100)
                self.signals.progress.emit(progress)
                self.signals.status.emit(f"Creating: {main_file_name}")

            self.signals.status.emit(f"Created {created_files} files successfully.")
            self.signals.finished.emit()
        except Exception as e:
            self.signals.error.emit(str(e))

    def get_prefix(self):
        if self.prefix_type == "No Prefix":
            return ""
        elif self.prefix_type == "Date Prefix":
            date_format = self.date_format.replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
            return datetime.datetime.now().strftime(date_format) + "_"
        elif self.prefix_type == "Custom Prefix":
            return self.custom_prefix + "_"
        elif self.prefix_type == "Numeric Prefix":
            return "{:03d}_"
        return ""

class FileCreationTab(QWidget):
    def __init__(self, main_app):
        super().__init__()
        self.main_app = main_app
        self.file_structure = {}
        self.current_file = None
        self.worker = None
        self.init_ui()

    def init_ui(self):
        # Main layout
        layout = QVBoxLayout(self)
        layout.setSpacing(10)

        # Destination folder path
        path_layout = QHBoxLayout()
        path_layout.addWidget(QLabel("Destination Folder:"))
        self.folder_path = QLineEdit()
        path_layout.addWidget(self.folder_path, 1)  # 1 is the stretch factor
        browse_button = QPushButton("Browse")
        browse_button.clicked.connect(self.browse_folder)
        path_layout.addWidget(browse_button)
        layout.addLayout(path_layout)

        # Number of files
        files_layout = QHBoxLayout()
        files_layout.addWidget(QLabel("Number of Files:"))
        self.num_files = QSpinBox()
        self.num_files.setMinimum(1)
        self.num_files.setMaximum(100)
        self.num_files.setValue(1)
        self.num_files.valueChanged.connect(self.update_file_structure)
        files_layout.addWidget(self.num_files)
        files_layout.addStretch(1)
        layout.addLayout(files_layout)

        # File selection and editing
        layout.addWidget(QLabel("Files:"))
        self.file_list = QListWidget()
        self.file_list.currentItemChanged.connect(self.update_file_name_field)
        layout.addWidget(self.file_list)

        # File name editing
        name_layout = QHBoxLayout()
        name_layout.addWidget(QLabel("File Name:"))
        self.file_name_edit = QLineEdit()
        self.file_name_edit.textChanged.connect(self.update_file_name)
        name_layout.addWidget(self.file_name_edit, 1)
        layout.addLayout(name_layout)

        # File content editing
        layout.addWidget(QLabel("File Content:"))
        self.file_content = QTextEdit()
        self.file_content.textChanged.connect(self.update_file_content)
        layout.addWidget(self.file_content)

        # Prefix options
        prefix_layout = QHBoxLayout()
        prefix_layout.addWidget(QLabel("Prefix Options:"))
        self.prefix_combo = QComboBox()
        self.prefix_combo.addItems(["No Prefix", "Date Prefix", "Custom Prefix", "Numeric Prefix"])
        self.prefix_combo.currentTextChanged.connect(self.update_prefix_options)
        prefix_layout.addWidget(self.prefix_combo, 1)
        layout.addLayout(prefix_layout)

        # Date format options
        date_layout = QHBoxLayout()
        date_layout.addWidget(QLabel("Date Format:"))
        self.date_format_combo = QComboBox()
        self.date_format_combo.addItems(["YYYY-MM-DD", "YYYYMMDD", "DD-MM-YYYY", "MM-DD-YYYY"])
        date_layout.addWidget(self.date_format_combo, 1)
        layout.addLayout(date_layout)
        self.date_format_layout = date_layout
        
        # Custom prefix options
        custom_layout = QHBoxLayout()
        custom_layout.addWidget(QLabel("Custom Prefix:"))
        self.custom_prefix = QLineEdit()
        custom_layout.addWidget(self.custom_prefix, 1)
        layout.addLayout(custom_layout)
        self.custom_prefix_layout = custom_layout
        
        # Initially hide date and custom prefix layouts
        self.date_format_widget = QWidget()
        self.date_format_widget.setLayout(date_layout)
        self.date_format_widget.setVisible(False)
        layout.addWidget(self.date_format_widget)
        
        self.custom_prefix_widget = QWidget()
        self.custom_prefix_widget.setLayout(custom_layout)
        self.custom_prefix_widget.setVisible(False)
        layout.addWidget(self.custom_prefix_widget)

        # File type options
        file_type_layout = QHBoxLayout()
        file_type_layout.addWidget(QLabel("File Extensions:"))
        self.file_type_entry = QLineEdit()
        file_type_layout.addWidget(self.file_type_entry, 1)
        file_type_layout.addWidget(QLabel("(comma separated, e.g.: txt, md, py)"))
        layout.addLayout(file_type_layout)

        # Create files button
        self.create_button = QPushButton("Create Files")
        self.create_button.clicked.connect(self.start_create_files)
        layout.addWidget(self.create_button)

        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setRange(0, 100)
        self.progress_bar.setValue(0)
        layout.addWidget(self.progress_bar)

        # Status label
        self.status_label = QLabel("")
        layout.addWidget(self.status_label)

        # Initialize file structure
        self.update_file_structure()

    def browse_folder(self):
        folder = QFileDialog.getExistingDirectory(self, "Select Folder")
        if folder:
            self.folder_path.setText(folder)

    def update_file_structure(self):
        num_files = self.num_files.value()
        current_structure = self.file_structure.copy()
        self.file_structure = {f"file_{i+1}": "Content for file {i+1}" for i in range(num_files)}
        
        # Preserve existing file names and content
        for i, (file, content) in enumerate(current_structure.items()):
            if i < num_files:
                new_file = f"file_{i+1}"
                self.file_structure[new_file] = current_structure[file]

        self.update_file_list()

    def update_prefix_options(self):
        prefix_type = self.prefix_combo.currentText()
        self.date_format_widget.setVisible(prefix_type == "Date Prefix")
        self.custom_prefix_widget.setVisible(prefix_type == "Custom Prefix")

    def update_file_list(self):
        self.file_list.clear()
        for file in self.file_structure.keys():
            self.file_list.addItem(file)

    def update_file_name_field(self, current, previous):
        if current:
            file_name = current.text()
            self.current_file = file_name
            self.file_name_edit.setText(file_name)
            self.file_content.setText(self.file_structure[file_name])
        else:
            self.current_file = None
            self.file_name_edit.clear()
            self.file_content.clear()

    def update_file_name(self):
        new_name = self.file_name_edit.text().strip()
        if self.current_file and new_name and new_name != self.current_file:
            content = self.file_structure[self.current_file]
            del self.file_structure[self.current_file]
            self.file_structure[new_name] = content
            self.current_file = new_name
            self.update_file_list()
            
            # Select the renamed file in the list
            items = self.file_list.findItems(new_name, Qt.MatchFlag.MatchExactly)
            if items:
                self.file_list.setCurrentItem(items[0])

    def update_file_content(self):
        if self.current_file:
            content = self.file_content.toPlainText()
            self.file_structure[self.current_file] = content

    def get_file_types(self):
        file_types_text = self.file_type_entry.text().strip()
        if file_types_text:
            return [ft.strip() for ft in file_types_text.split(',') if ft.strip()]
        return []

    def start_create_files(self):
        folder_path = self.folder_path.text()
        if not folder_path:
            QMessageBox.warning(self, "Error", "Please specify the destination folder path.")
            return

        file_types = self.get_file_types()

        self.worker = FileCreationWorker(
            folder_path, 
            self.file_structure,
            self.prefix_combo.currentText(),
            self.date_format_combo.currentText(),
            self.custom_prefix.text(),
            file_types
        )
        
        # Connect signals
        self.worker.signals.progress.connect(self.progress_bar.setValue)
        self.worker.signals.status.connect(self.status_label.setText)
        self.worker.signals.finished.connect(self.on_worker_finished)
        self.worker.signals.error.connect(self.on_worker_error)
        
        # Start the thread
        self.create_button.setEnabled(False)
        self.progress_bar.setValue(0)
        self.worker.start()

    def on_worker_finished(self):
        self.create_button.setEnabled(True)
        self.progress_bar.setValue(100)
        QMessageBox.information(self, "Success", "Files created successfully.")

    def on_worker_error(self, error):
        self.create_button.setEnabled(True)
        self.status_label.setText(f"Error: {error}")
        QMessageBox.critical(self, "Error", f"An error occurred: {error}")

if __name__ == "__main__":
    import sys
    from PyQt6.QtWidgets import QApplication
    
    app = QApplication(sys.argv)
    window = QWidget()
    window.setWindowTitle("File Creation Tool")
    window.resize(800, 600)
    
    layout = QVBoxLayout(window)
    file_tab = FileCreationTab(None)
    layout.addWidget(file_tab)
    
    window.show()
    sys.exit(app.exec())