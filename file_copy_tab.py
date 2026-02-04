import os
import shutil
import threading
import queue
import tkinter as tk
from tkinter import ttk, filedialog, messagebox, simpledialog
from fnmatch import fnmatch
import time
import logging
from datetime import datetime
import re

class WorkerSignals:
    def __init__(self):
        self.finished = threading.Event()
        self.error = None
        self.progress = 0
        self.status = ""

class FileCopyWorker(threading.Thread):
    def __init__(self, queue, source, dest, tree, include_subdirs, overwrite, preserve_metadata, file_types, operation, rename_map=None, skip_existing=False):
        super().__init__()
        self.queue = queue
        self.source = source
        self.dest = dest
        self.tree = tree
        self.include_subdirs = include_subdirs
        self.overwrite = overwrite
        self.preserve_metadata = preserve_metadata
        self.file_types = file_types
        self.operation = operation
        self.rename_map = rename_map or {}
        self.skip_existing = skip_existing
        self.signals = WorkerSignals()
        self.start_time = None
        self.total_size = 0
        self.processed_size = 0
        self.cancelled = False
        
    def cancel(self):
        """Cancel the operation"""
        self.cancelled = True

    def run(self):
        try:
            self.start_time = time.time()
            processed_files = 0
            total_files = self.count_files_to_process(self.tree.get_children())

            for item in self.tree.get_children():
                if self.cancelled:
                    self.queue.put(("cancelled", "Operation cancelled by user"))
                    return
                    
                self.process_items([item])
                processed_files += 1
                progress = int((processed_files / total_files) * 100) if total_files > 0 else 0
                elapsed_time = time.time() - self.start_time
                speed = self.processed_size / elapsed_time if elapsed_time > 0 else 0
                eta = (self.total_size - self.processed_size) / speed if speed > 0 else 0
                status = f"{self.operation.capitalize()}ed {processed_files}/{total_files} files | Speed: {self.format_size(speed)}/s | ETA: {self.format_time(eta)}"
                self.queue.put(("progress", progress, status))
            
            self.signals.finished.set()

        except Exception as e:
            self.signals.error = str(e)
            logging.error(f"Error during file {self.operation}: {str(e)}")

    def count_files_to_process(self, items):
        count = 0
        for item in items:
            item_values = self.tree.item(item)
            if 'checked' in self.tree.item(item, "tags"):
                if item_values['values'][0] == 'File':
                    count += 1
                    size_str = item_values['values'][1].split()[0]
                    try:
                        size = float(size_str)
                        unit = item_values['values'][1].split()[1]
                        if unit == 'KB':
                            size *= 1024
                        elif unit == 'MB':
                            size *= 1024 * 1024
                        elif unit == 'GB':
                            size *= 1024 * 1024 * 1024
                        elif unit == 'TB':
                            size *= 1024 * 1024 * 1024 * 1024
                        self.total_size += size
                    except ValueError:
                        logging.warning(f"Could not parse size for file: {item_values['text']}")
                elif item_values['values'][0] == 'Folder' and self.include_subdirs:
                    count += self.count_files_to_process(self.tree.get_children(item))
        return count

    def process_items(self, items):
        for item in items:
            item_values = self.tree.item(item)
            item_text = self.get_full_path(item)
            item_path = os.path.join(self.source, item_text)
            
            if 'checked' in self.tree.item(item, "tags"):
                if item_values['values'][0] == 'File':
                    self.process_file(item_path, item)
                elif item_values['values'][0] == 'Folder' and self.include_subdirs:
                    self.process_folder(item_path, item)
                    self.process_items(self.tree.get_children(item))

    def get_full_path(self, item):
        path = []
        while item:
            item_text = self.tree.item(item, 'text')
            path.insert(0, item_text.split(' ', 2)[2])  # Extract the item name
            item = self.tree.parent(item)
        return os.path.join(*path)

    def get_renamed_path(self, original_path, item):
        if item in self.rename_map:
            new_name = self.rename_map[item]
            dir_path = os.path.dirname(original_path)
            return os.path.join(dir_path, new_name) if dir_path else new_name
        return original_path

    def process_folder(self, src_folder, item):
        rel_path = os.path.relpath(src_folder, self.source)
        dest_folder = os.path.join(self.dest, rel_path)
        
        # Apply renaming if specified
        if item in self.rename_map:
            folder_name = os.path.basename(dest_folder)
            parent_path = os.path.dirname(dest_folder)
            new_folder_name = self.rename_map[item]
            dest_folder = os.path.join(parent_path, new_folder_name)
        
        os.makedirs(dest_folder, exist_ok=True)

    def process_file(self, src_file, item):
        if self.cancelled:
            return
            
        rel_path = os.path.relpath(src_file, self.source)
        dest_file = os.path.join(self.dest, rel_path)

        # Apply renaming if specified
        if item in self.rename_map:
            file_name = os.path.basename(dest_file)
            dir_path = os.path.dirname(dest_file)
            new_file_name = self.rename_map[item]
            dest_file = os.path.join(dir_path, new_file_name)

        # Handle existing files based on options
        if os.path.exists(dest_file):
            if self.skip_existing and not self.overwrite:
                self.queue.put(("status", f"Skipped existing: {os.path.basename(dest_file)}"))
                return
            elif not self.overwrite:
                return

        _, ext = os.path.splitext(src_file)
        if self.file_types and not any(fnmatch(ext.lower(), f"*{ft}") for ft in self.file_types):
            return

        os.makedirs(os.path.dirname(dest_file), exist_ok=True)

        try:
            if self.operation == 'copy':
                if self.preserve_metadata:
                    shutil.copy2(src_file, dest_file)
                else:
                    shutil.copy(src_file, dest_file)
            elif self.operation == 'move':
                shutil.move(src_file, dest_file)
            
            file_size = os.path.getsize(dest_file)
            self.processed_size += file_size
            status = f"{self.operation.capitalize()}ing: {os.path.basename(dest_file)}"
            self.queue.put(("status", status))
        except Exception as e:
            logging.error(f"Error {self.operation}ing file {src_file}: {str(e)}")
            self.queue.put(("error", f"Error {self.operation}ing {os.path.basename(dest_file)}: {str(e)}"))

    @staticmethod
    def format_size(size):
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024

    @staticmethod
    def format_time(seconds):
        return str(datetime.utcfromtimestamp(seconds).strftime("%H:%M:%S"))

class RenameDialog(tk.Toplevel):
    def __init__(self, parent, original_name, is_folder=False):
        super().__init__(parent)
        self.original_name = original_name
        self.is_folder = is_folder
        self.result = None
        
        self.title("Rename Item")
        self.geometry("400x150")
        self.resizable(False, False)
        
        self.setup_ui()
        self.grab_set()
        self.focus_set()
        
    def setup_ui(self):
        ttk.Label(self, text=f"Rename {'folder' if self.is_folder else 'file'}:").pack(pady=10)
        
        self.name_var = tk.StringVar(value=self.original_name)
        self.entry = ttk.Entry(self, textvariable=self.name_var, width=50)
        self.entry.pack(pady=5)
        self.entry.select_range(0, len(self.original_name))
        self.entry.focus()
        
        button_frame = ttk.Frame(self)
        button_frame.pack(pady=20)
        
        ttk.Button(button_frame, text="OK", command=self.on_ok).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="left", padx=5)
        
        self.bind('<Return>', lambda e: self.on_ok())
        self.bind('<Escape>', lambda e: self.destroy())
        
    def on_ok(self):
        new_name = self.name_var.get().strip()
        if new_name and new_name != self.original_name:
            self.result = new_name
        self.destroy()

class BulkRenameDialog(tk.Toplevel):
    def __init__(self, parent, items, tree):
        super().__init__(parent)
        self.items = items
        self.tree = tree
        self.rename_map = {}
        
        self.title("Bulk Rename")
        self.geometry("500x400")
        self.resizable(False, False)
        
        self.setup_ui()
        self.grab_set()
        
    def setup_ui(self):
        # Main frame
        main_frame = ttk.Frame(self)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        
        # Pattern frame
        pattern_frame = ttk.LabelFrame(main_frame, text="Rename Pattern")
        pattern_frame.pack(fill="x", pady=5)
        
        # Prefix
        ttk.Label(pattern_frame, text="Add Prefix:").grid(row=0, column=0, sticky="w", padx=5, pady=2)
        self.prefix_var = tk.StringVar()
        ttk.Entry(pattern_frame, textvariable=self.prefix_var, width=30).grid(row=0, column=1, padx=5, pady=2)
        
        # Suffix
        ttk.Label(pattern_frame, text="Add Suffix:").grid(row=1, column=0, sticky="w", padx=5, pady=2)
        self.suffix_var = tk.StringVar()
        ttk.Entry(pattern_frame, textvariable=self.suffix_var, width=30).grid(row=1, column=1, padx=5, pady=2)
        
        # Find/Replace
        ttk.Label(pattern_frame, text="Find:").grid(row=2, column=0, sticky="w", padx=5, pady=2)
        self.find_var = tk.StringVar()
        ttk.Entry(pattern_frame, textvariable=self.find_var, width=15).grid(row=2, column=1, sticky="w", padx=5, pady=2)
        
        ttk.Label(pattern_frame, text="Replace:").grid(row=3, column=0, sticky="w", padx=5, pady=2)
        self.replace_var = tk.StringVar()
        ttk.Entry(pattern_frame, textvariable=self.replace_var, width=15).grid(row=3, column=1, sticky="w", padx=5, pady=2)
        
        # Sequential numbering
        ttk.Label(pattern_frame, text="Sequential:").grid(row=4, column=0, sticky="w", padx=5, pady=2)
        self.seq_var = tk.BooleanVar()
        ttk.Checkbutton(pattern_frame, variable=self.seq_var).grid(row=4, column=1, sticky="w", padx=5, pady=2)
        
        ttk.Label(pattern_frame, text="Start:").grid(row=4, column=1, sticky="e", padx=5, pady=2)
        self.start_num_var = tk.StringVar(value="1")
        ttk.Entry(pattern_frame, textvariable=self.start_num_var, width=5).grid(row=4, column=2, padx=5, pady=2)
        
        # Preview frame
        preview_frame = ttk.LabelFrame(main_frame, text="Preview")
        preview_frame.pack(fill="both", expand=True, pady=5)
        
        self.preview_text = tk.Text(preview_frame, height=10, width=60)
        self.preview_text.pack(fill="both", expand=True, padx=5, pady=5)
        
        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.pack(pady=10)
        
        ttk.Button(button_frame, text="Preview", command=self.preview_changes).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Apply", command=self.apply_changes).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Cancel", command=self.destroy).pack(side="left", padx=5)
        
        # Bind changes to update preview
        self.prefix_var.trace('w', lambda *args: self.preview_changes())
        self.suffix_var.trace('w', lambda *args: self.preview_changes())
        self.find_var.trace('w', lambda *args: self.preview_changes())
        self.replace_var.trace('w', lambda *args: self.preview_changes())
        self.seq_var.trace('w', lambda *args: self.preview_changes())
        self.start_num_var.trace('w', lambda *args: self.preview_changes())
        
    def preview_changes(self):
        self.preview_text.delete(1.0, tk.END)
        
        prefix = self.prefix_var.get()
        suffix = self.suffix_var.get()
        find_text = self.find_var.get()
        replace_text = self.replace_var.get()
        use_seq = self.seq_var.get()
        start_num = int(self.start_num_var.get()) if self.start_num_var.get().isdigit() else 1
        
        count = 0
        for item in self.items:
            if 'checked' in self.tree.item(item, "tags") and 'grayed' not in self.tree.item(item, "tags"):
                original_name = self.tree.item(item, "text").split(' ', 2)[2]
                new_name = original_name
                
                # Apply find/replace
                if find_text:
                    new_name = new_name.replace(find_text, replace_text)
                
                # Add prefix/suffix
                name_part, ext_part = os.path.splitext(new_name)
                new_name = prefix + name_part + suffix + ext_part
                
                # Add sequential numbering
                if use_seq:
                    name_part, ext_part = os.path.splitext(new_name)
                    new_name = f"{name_part}_{start_num + count}{ext_part}"
                
                self.preview_text.insert(tk.END, f"Original: {original_name}\n")
                self.preview_text.insert(tk.END, f"New:      {new_name}\n\n")
                count += 1
                
    def apply_changes(self):
        prefix = self.prefix_var.get()
        suffix = self.suffix_var.get()
        find_text = self.find_var.get()
        replace_text = self.replace_var.get()
        use_seq = self.seq_var.get()
        start_num = int(self.start_num_var.get()) if self.start_num_var.get().isdigit() else 1
        
        count = 0
        for item in self.items:
            if 'checked' in self.tree.item(item, "tags") and 'grayed' not in self.tree.item(item, "tags"):
                original_name = self.tree.item(item, "text").split(' ', 2)[2]
                new_name = original_name
                
                # Apply transformations
                if find_text:
                    new_name = new_name.replace(find_text, replace_text)
                
                name_part, ext_part = os.path.splitext(new_name)
                new_name = prefix + name_part + suffix + ext_part
                
                if use_seq:
                    name_part, ext_part = os.path.splitext(new_name)
                    new_name = f"{name_part}_{start_num + count}{ext_part}"
                
                self.rename_map[item] = new_name
                count += 1
        
        self.destroy()

class FileCopyTab(ttk.Frame):
    def __init__(self, parent, master):
        super().__init__(parent)
        self.master = master
        self.file_extensions = set()
        self.selected_file_types = set()
        self.dark_mode = tk.BooleanVar(value=False)
        self.operation = tk.StringVar(value="copy")
        self.rename_enabled = tk.BooleanVar(value=False)
        self.rename_map = {}
        self.exclude_temp_files = tk.BooleanVar(value=True)  # Default to excluding temp files
        
        # Define common temporary file patterns
        self.temp_file_patterns = [
            '~*',           # Microsoft Office temp files
            '*.tmp',        # General temp files
            '*.temp',       # General temp files
            '*.bak',        # Backup files
            '*.swp',        # Vim swap files
            '*.swo',        # Vim swap files
            '*~',           # Unix backup files
            '.DS_Store',    # macOS system files
            'Thumbs.db',    # Windows thumbnail cache
            '*.log',        # Log files (optional - user might want these)
            '*.cache',      # Cache files
            '*.pid',        # Process ID files
            '*.lock',       # Lock files
            '.git*',        # Git files
            '.svn*',        # SVN files
            '__pycache__*', # Python cache
            '*.pyc',        # Python compiled files
            '*.pyo',        # Python optimized files
            '.vscode*',     # VS Code settings
            '.idea*',       # IntelliJ IDEA files
            'node_modules*' # Node.js modules
        ]
        
        self.init_ui()
        self.init_logging()

    def init_logging(self):
        log_file = 'file_copy.log'
        logging.basicConfig(filename=log_file, level=logging.ERROR, 
                            format='%(asctime)s - %(levelname)s - %(message)s')

    def init_ui(self):
        self.columnconfigure(1, weight=1)

        # Source path
        ttk.Label(self, text="Source Path:").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        self.source_path = ttk.Entry(self)
        self.source_path.grid(row=0, column=1, sticky="ew", padx=5, pady=5)
        ttk.Button(self, text="Browse", command=self.browse_source).grid(row=0, column=2, padx=5, pady=5)

        # Destination path
        ttk.Label(self, text="Destination Path:").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.dest_path = ttk.Entry(self)
        self.dest_path.grid(row=1, column=1, sticky="ew", padx=5, pady=5)
        ttk.Button(self, text="Browse", command=self.browse_dest).grid(row=1, column=2, padx=5, pady=5)

        # File type filter
        ttk.Label(self, text="File Types:").grid(row=2, column=0, sticky="w", padx=5, pady=5)
        self.file_types = ttk.Entry(self)
        self.file_types.grid(row=2, column=1, sticky="ew", padx=5, pady=5)
        self.file_types.bind('<KeyRelease>', self.update_file_type_tags)

        # File type tags
        self.file_type_tags_frame = ttk.Frame(self)
        self.file_type_tags_frame.grid(row=3, column=0, columnspan=3, sticky="ew", padx=5, pady=5)

        # Search functionality
        ttk.Label(self, text="Search:").grid(row=4, column=0, sticky="w", padx=5, pady=5)
        self.search_entry = ttk.Entry(self)
        self.search_entry.grid(row=4, column=1, sticky="ew", padx=5, pady=5)
        self.search_entry.bind('<KeyRelease>', self.search_files)

        # File selection treeView
        self.tree = ttk.Treeview(self, columns=("type", "size"), selectmode="none")
        self.tree.heading("#0", text="Name")
        self.tree.heading("type", text="Type")
        self.tree.heading("size", text="Size")
        self.tree.column("#0", width=300)
        self.tree.column("type", width=100, anchor="w")
        self.tree.column("size", width=100, anchor="e")
        self.tree.grid(row=5, column=0, columnspan=3, sticky="nsew", padx=5, pady=5)
        self.rowconfigure(5, weight=1)

        # Configure tags for tree items
        self.tree.tag_configure('selected', background='light blue')
        self.tree.tag_configure('grayed', foreground='gray')

        # Scrollbar for tree
        tree_scroll = ttk.Scrollbar(self, orient="vertical", command=self.tree.yview)
        tree_scroll.grid(row=5, column=3, sticky="ns")
        self.tree.configure(yscrollcommand=tree_scroll.set)

        # Tally label
        self.tally_label = ttk.Label(self, text="")
        self.tally_label.grid(row=6, column=0, columnspan=3, sticky="w", padx=5, pady=5)

        # Options
        options_frame = ttk.Frame(self)
        options_frame.grid(row=7, column=0, columnspan=3, sticky="ew", padx=5, pady=5)
        self.include_subdirs = tk.BooleanVar(value=True)
        self.overwrite = tk.BooleanVar(value=False)
        self.skip_existing = tk.BooleanVar(value=True)
        self.preserve_metadata = tk.BooleanVar(value=True)
        ttk.Checkbutton(options_frame, text="Include Subdirectories", variable=self.include_subdirs).pack(side="left", padx=5)
        ttk.Checkbutton(options_frame, text="Overwrite Existing Files", variable=self.overwrite).pack(side="left", padx=5)
        ttk.Checkbutton(options_frame, text="Skip Existing Files", variable=self.skip_existing).pack(side="left", padx=5)
        ttk.Checkbutton(options_frame, text="Preserve Metadata", variable=self.preserve_metadata).pack(side="left", padx=5)
        ttk.Checkbutton(options_frame, text="Exclude Temp Files", variable=self.exclude_temp_files, command=self.update_tree_item_visibility).pack(side="left", padx=5)

        # Operation selection
        operation_frame = ttk.Frame(self)
        operation_frame.grid(row=8, column=0, columnspan=3, sticky="ew", padx=5, pady=5)
        ttk.Radiobutton(operation_frame, text="Copy", variable=self.operation, value="copy", command=self.update_button_text).pack(side="left", padx=5)
        ttk.Radiobutton(operation_frame, text="Move", variable=self.operation, value="move", command=self.update_button_text).pack(side="left", padx=5)

        # Rename and Copy/Move buttons
        button_frame = ttk.Frame(self)
        button_frame.grid(row=9, column=0, columnspan=3, pady=10)
        
        ttk.Button(button_frame, text="Rename Selected", command=self.rename_selected).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Bulk Rename", command=self.bulk_rename).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Select All (Filtered)", command=self.select_all_filtered).pack(side="left", padx=5)
        self.action_btn = ttk.Button(button_frame, text="Copy Files", command=self.start_operation)
        self.action_btn.pack(side="left", padx=5)
        self.cancel_btn = ttk.Button(button_frame, text="Cancel", command=self.cancel_operation, state="disabled")
        self.cancel_btn.pack(side="left", padx=5)
        ttk.Button(button_frame, text="Clear Renames", command=self.clear_renames).pack(side="left", padx=5)

        # Progress bar
        self.progress_bar = ttk.Progressbar(self, orient="horizontal", length=300, mode="determinate")
        self.progress_bar.grid(row=10, column=0, columnspan=3, sticky="ew", padx=5, pady=5)

        # Status label
        self.status_label = ttk.Label(self, text="")
        self.status_label.grid(row=11, column=0, columnspan=3, sticky="w", padx=5, pady=5)

        # Bind events
        self.tree.bind("<Button-1>", self.on_click)
        self.tree.bind("<Button-3>", self.show_context_menu)  # Right-click context menu
        self.tree.bind("<space>", self.toggle_selection)
        self.tree.bind("<Double-1>", self.rename_item)  # Double-click to rename
        self.bind_all("<Control-f>", self.focus_search)
        self.bind_all("<Control-c>", self.start_operation)
        self.bind_all("<F2>", self.rename_selected)  # F2 to rename
        
        # Create context menu
        self.context_menu = tk.Menu(self, tearoff=0)
        self.context_menu.add_command(label="Rename", command=self.rename_item)
        self.context_menu.add_command(label="Bulk Rename Selected", command=self.bulk_rename)
        self.context_menu.add_separator()
        self.context_menu.add_command(label="Select All", command=self.select_all)
        self.context_menu.add_command(label="Select All (Filtered)", command=self.select_all_filtered)
        self.context_menu.add_command(label="Deselect All", command=self.deselect_all)
        
        # Initialize worker reference
        self.copy_worker = None

    def update_button_text(self):
        self.action_btn.config(text=f"{self.operation.get().capitalize()} Files")

    def browse_source(self):
        path = filedialog.askdirectory()
        if path:
            self.source_path.delete(0, tk.END)
            self.source_path.insert(0, path)
            self.populate_tree(path)

    def browse_dest(self):
        path = filedialog.askdirectory()
        if path:
            self.dest_path.delete(0, tk.END)
            self.dest_path.insert(0, path)

    def populate_tree(self, path):
        self.tree.delete(*self.tree.get_children())
        self.file_extensions.clear()
        self.load_directory_contents("", path)
        self.update_file_type_tags()

    def load_directory_contents(self, parent, path):
        try:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                checkbox = "â˜ "  # Unchecked box
                
                # Skip temporary files if the option is enabled
                if not os.path.isdir(item_path) and self.is_temp_file(item):
                    continue
                
                if os.path.isdir(item_path):
                    # Skip temporary directories as well
                    if self.is_temp_file(item):
                        continue
                    folder = self.tree.insert(parent, "end", text=f"{checkbox}ðŸ“ {item}", values=("Folder", ""))
                    self.tree.item(folder, tags=('unchecked',))
                    self.load_directory_contents(folder, item_path)
                else:
                    size = os.path.getsize(item_path)
                    file = self.tree.insert(parent, "end", text=f"{checkbox}ðŸ“„ {item}", values=("File", self.format_size(size)))
                    self.tree.item(file, tags=('unchecked',))
                    _, ext = os.path.splitext(item)
                    self.file_extensions.add(ext.lower())
        except PermissionError:
            logging.error(f"Permission denied: {path}")
        except Exception as e:
            logging.error(f"Error loading directory contents: {str(e)}")

    def format_size(self, size):
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024

    def is_temp_file(self, filename):
        """Check if a file matches temporary file patterns"""
        if not self.exclude_temp_files.get():
            return False
            
        filename_lower = filename.lower()
        
        # Check against each pattern
        for pattern in self.temp_file_patterns:
            if fnmatch(filename_lower, pattern.lower()):
                return True
        
        return False

    def update_file_type_tags(self, event=None):
        self.file_type_tags_frame.destroy()
        self.file_type_tags_frame = ttk.Frame(self)
        self.file_type_tags_frame.grid(row=3, column=0, columnspan=3, sticky="ew", padx=5, pady=5)

        for ext in sorted(self.file_extensions):
            tag = ttk.Checkbutton(self.file_type_tags_frame, text=ext, command=lambda e=ext: self.toggle_file_type(e))
            tag.pack(side="left", padx=2)
            if ext in self.selected_file_types:
                tag.state(['selected'])

        self.update_file_types_entry()
        self.update_tree_item_visibility()

    def toggle_file_type(self, ext):
        if ext in self.selected_file_types:
            self.selected_file_types.remove(ext)
        else:
            self.selected_file_types.add(ext)
        self.update_file_types_entry()
        self.update_tree_item_visibility()

    def update_file_types_entry(self):
        self.file_types.delete(0, tk.END)
        self.file_types.insert(0, ",".join(sorted(self.selected_file_types)))

    def update_tree_item_visibility(self):
        def update_item(item):
            item_text = self.tree.item(item, "text")
            if self.tree.item(item, "values")[0] == "File":
                _, ext = os.path.splitext(item_text.split(" ", 2)[2])
                if self.selected_file_types and ext.lower() not in self.selected_file_types:
                    self.tree.item(item, tags=('grayed',))
                else:
                    self.tree.item(item, tags=('',))
            for child in self.tree.get_children(item):
                update_item(child)

        for item in self.tree.get_children():
            update_item(item)

    def on_click(self, event):
        item = self.tree.identify_row(event.y)
        if item:
            self.toggle_item(item)

    def toggle_item(self, item):
        current_tags = list(self.tree.item(item, "tags"))
        current_text = self.tree.item(item, "text")
        
        if 'grayed' in current_tags:
            return

        if "unchecked" in current_tags:
            new_text = current_text.replace("â˜", "â˜‘")
            current_tags.remove("unchecked")
            current_tags.extend(["checked", "selected"])
        else:  # This covers both "checked" and any other unexpected state
            new_text = current_text.replace("â˜‘", "â˜")
            if "checked" in current_tags:
                current_tags.remove("checked")
            if "selected" in current_tags:
                current_tags.remove("selected")
            current_tags.append("unchecked")
        
        self.tree.item(item, text=new_text, tags=current_tags)
        self.toggle_children(item, "checked" in current_tags)
        
        self.update_parent_selection(self.tree.parent(item))
        self.update_tally_label()

    def toggle_children(self, parent, checked):
        for child in self.tree.get_children(parent):
            current_text = self.tree.item(child, "text")
            current_tags = list(self.tree.item(child, "tags"))
            
            if 'grayed' in current_tags:
                continue

            if checked:
                new_text = current_text.replace("â˜", "â˜‘")
                new_tags = ["checked", "selected"]
            else:
                new_text = current_text.replace("â˜‘", "â˜")
                new_tags = ["unchecked"]
            self.tree.item(child, text=new_text, tags=new_tags)
            if self.tree.get_children(child):  # If the child is a folder
                self.toggle_children(child, checked)
    
    def update_parent_selection(self, parent):
        if not parent:
            return

        children = self.tree.get_children(parent)
        all_checked = all('checked' in self.tree.item(child, "tags") for child in children if 'grayed' not in self.tree.item(child, "tags"))
        any_checked = any('checked' in self.tree.item(child, "tags") for child in children)
        
        current_text = self.tree.item(parent, "text")
        
        if all_checked:
            new_text = current_text.replace("â˜", "â˜‘")
            new_tags = ["checked", "selected"]
        elif any_checked:
            new_text = current_text.replace("â˜", "â˜‘")
            new_tags = ["checked", "selected", "partial"]
        else:
            new_text = current_text.replace("â˜‘", "â˜")
            new_tags = ["unchecked"]
            
        self.tree.item(parent, text=new_text, tags=new_tags)
        self.update_parent_selection(self.tree.parent(parent))
    
    def update_tally_label(self):
        checked_files, checked_folders, total_size = self.count_checked_items(self.tree.get_children())
        self.tally_label.config(text=f"Selected: {checked_files} files, {checked_folders} folders | Total size: {self.format_size(total_size)}")

    def count_checked_items(self, items):
        files = 0
        folders = 0
        total_size = 0
        for item in items:
            if 'checked' in self.tree.item(item, "tags") and 'grayed' not in self.tree.item(item, "tags"):
                if self.tree.item(item, "values")[0] == "File":
                    files += 1
                    size_str = self.tree.item(item, "values")[1].split()[0]
                    try:
                        size = float(size_str)
                        unit = self.tree.item(item, "values")[1].split()[1]
                        if unit == 'KB':
                            size *= 1024
                        elif unit == 'MB':
                            size *= 1024 * 1024
                        elif unit == 'GB':
                            size *= 1024 * 1024 * 1024
                        elif unit == 'TB':
                            size *= 1024 * 1024 * 1024 * 1024
                        total_size += size
                    except ValueError:
                        logging.warning(f"Could not parse size for file: {self.tree.item(item, 'text')}")
                elif self.tree.item(item, "values")[0] == "Folder":
                    folders += 1
                    sub_files, sub_folders, sub_size = self.count_checked_items(self.tree.get_children(item))
                    files += sub_files
                    folders += sub_folders
                    total_size += sub_size
        return files, folders, total_size

    def start_operation(self, event=None):
        src = self.source_path.get().strip()
        dest = self.dest_path.get().strip()

        if not src or not dest:
            messagebox.showerror("Error", "Source and destination paths must be specified.")
            return

        include_subdirs = self.include_subdirs.get()
        overwrite = self.overwrite.get()
        preserve_metadata = self.preserve_metadata.get()
        file_types = [ft.strip() for ft in self.file_types.get().lower().split(",") if ft.strip()]
        operation = self.operation.get()

        self.queue = queue.Queue()
        self.copy_worker = FileCopyWorker(self.queue, src, dest, self.tree, include_subdirs, overwrite, preserve_metadata, file_types, operation, self.rename_map)
        self.copy_worker.start()
        self.action_btn.config(state="disabled")
        self.after(100, self.check_queue)

    def check_queue(self):
        try:
            message = self.queue.get_nowait()
            if message[0] == "progress":
                self.progress_bar['value'] = message[1]
                self.status_label.config(text=message[2])
            elif message[0] == "status":
                self.status_label.config(text=message[1])
            elif message[0] == "error":
                messagebox.showerror("Error", message[1])
            elif message[0] == "cancelled":
                self.on_operation_cancelled()
                return
            self.after(100, self.check_queue)
        except queue.Empty:
            if self.copy_worker and self.copy_worker.signals.finished.is_set():
                self.on_operation_finished()
            elif self.copy_worker and self.copy_worker.signals.error:
                self.on_operation_error(self.copy_worker.signals.error)
            elif self.copy_worker and self.copy_worker.cancelled:
                self.on_operation_cancelled()
            else:
                self.after(100, self.check_queue)

    def on_operation_finished(self):
        operation = self.operation.get().capitalize()
        self.status_label.config(text=f"{operation} complete.")
        self.progress_bar['value'] = 100
        self.action_btn.config(state="normal")
        self.cancel_btn.config(state="disabled")

    def on_operation_error(self, error_message):
        messagebox.showerror("Error", error_message)
        self.status_label.config(text="")
        self.action_btn.config(state="normal")
        self.cancel_btn.config(state="disabled")

    def search_files(self, event=None):
        search_term = self.search_entry.get().lower()
        for item in self.tree.get_children():
            self.search_item(item, search_term)

    def search_item(self, item, search_term):
        item_text = self.tree.item(item, "text").lower()
        if search_term in item_text:
            self.tree.item(item, tags=("match",))
            self.tree.see(item)
        else:
            self.tree.item(item, tags=())
        
        for child in self.tree.get_children(item):
            self.search_item(child, search_term)

    def toggle_selection(self, event):
        item = self.tree.focus()
        if item:
            self.toggle_item(item)

    def focus_search(self, event=None):
        self.search_entry.focus_set()
    
    def show_context_menu(self, event):
        item = self.tree.identify_row(event.y)
        if item:
            self.tree.selection_set(item)
            self.tree.focus(item)
            self.context_menu.post(event.x_root, event.y_root)
    
    def rename_item(self, event=None):
        item = self.tree.focus()
        if not item:
            selected = self.tree.selection()
            if selected:
                item = selected[0]
        
        if item:
            original_name = self.tree.item(item, "text").split(' ', 2)[2]
            is_folder = self.tree.item(item, "values")[0] == "Folder"
            
            dialog = RenameDialog(self, original_name, is_folder)
            self.wait_window(dialog)
            
            if dialog.result:
                self.rename_map[item] = dialog.result
                self.update_tree_display(item, dialog.result)
    
    def rename_selected(self, event=None):
        selected_items = []
        for item in self.tree.get_children():
            self.collect_selected_items(item, selected_items)
        
        if len(selected_items) == 1:
            self.tree.focus(selected_items[0])
            self.rename_item()
        elif len(selected_items) > 1:
            self.bulk_rename()
        else:
            messagebox.showinfo("No Selection", "Please select one or more items to rename.")
    
    def collect_selected_items(self, item, selected_items):
        if 'checked' in self.tree.item(item, "tags") and 'grayed' not in self.tree.item(item, "tags"):
            selected_items.append(item)
        
        for child in self.tree.get_children(item):
            self.collect_selected_items(child, selected_items)
    
    def bulk_rename(self):
        selected_items = []
        for item in self.tree.get_children():
            self.collect_selected_items(item, selected_items)
        
        if not selected_items:
            messagebox.showinfo("No Selection", "Please select items to rename.")
            return
        
        dialog = BulkRenameDialog(self, selected_items, self.tree)
        self.wait_window(dialog)
        
        if dialog.rename_map:
            self.rename_map.update(dialog.rename_map)
            for item, new_name in dialog.rename_map.items():
                self.update_tree_display(item, new_name)
    
    def update_tree_display(self, item, new_name):
        current_text = self.tree.item(item, "text")
        parts = current_text.split(' ', 2)
        if len(parts) >= 3:
            checkbox = parts[0] + " "
            icon = parts[1] + " "
            new_text = checkbox + icon + new_name
            self.tree.item(item, text=new_text)
    
    def clear_renames(self):
        if self.rename_map:
            result = messagebox.askyesno("Clear Renames", 
                                       f"Clear all {len(self.rename_map)} rename operations?")
            if result:
                # Restore original names in tree display
                for item in self.rename_map.keys():
                    if self.tree.exists(item):
                        # Get original name by reconstructing from path
                        original_name = self.get_original_name(item)
                        self.update_tree_display(item, original_name)
                
                self.rename_map.clear()
                messagebox.showinfo("Cleared", "All rename operations have been cleared.")
    
    def get_original_name(self, item):
        # Reconstruct original name from tree hierarchy
        path_parts = []
        current = item
        while current:
            current_text = self.tree.item(current, "text")
            name = current_text.split(' ', 2)[2] if len(current_text.split(' ', 2)) >= 3 else current_text
            path_parts.insert(0, name)
            current = self.tree.parent(current)
        
        # Return just the filename/foldername (last part)
        return path_parts[-1] if path_parts else ""
    
    def select_all(self):
        for item in self.tree.get_children():
            self.select_all_recursive(item)
        self.update_tally_label()
    
    def select_all_recursive(self, item):
        current_tags = list(self.tree.item(item, "tags"))
        if 'grayed' not in current_tags:
            current_text = self.tree.item(item, "text")
            new_text = current_text.replace("â˜", "â˜‘")
            self.tree.item(item, text=new_text, tags=["checked", "selected"])
        
        for child in self.tree.get_children(item):
            self.select_all_recursive(child)
    
    def deselect_all(self):
        for item in self.tree.get_children():
            self.deselect_all_recursive(item)
        self.update_tally_label()
    
    def deselect_all_recursive(self, item):
        current_text = self.tree.item(item, "text")
        new_text = current_text.replace("â˜‘", "â˜")
        self.tree.item(item, text=new_text, tags=["unchecked"])
        
        for child in self.tree.get_children(item):
            self.deselect_all_recursive(child)

    def select_all_filtered(self):
        """Select all items that match the current file type filters"""
        for item in self.tree.get_children():
            self.select_all_filtered_recursive(item)
        self.update_tally_label()
    
    def select_all_filtered_recursive(self, item):
        """Recursively select items that are not grayed out (match filters)"""
        current_tags = list(self.tree.item(item, "tags"))
        
        # Only select items that are not grayed out (i.e., match the file type filter)
        if 'grayed' not in current_tags:
            current_text = self.tree.item(item, "text")
            new_text = current_text.replace("â˜", "â˜‘")
            self.tree.item(item, text=new_text, tags=["checked", "selected"])
        
        for child in self.tree.get_children(item):
            self.select_all_filtered_recursive(child)

    def cancel_operation(self):
        """Cancel the current copy/move operation"""
        if self.copy_worker and self.copy_worker.is_alive():
            self.copy_worker.cancel()
            self.status_label.config(text="Cancelling operation...")
            self.cancel_btn.config(state="disabled")

    def on_operation_cancelled(self):
        """Handle operation cancellation"""
        self.status_label.config(text="Operation cancelled.")
        self.progress_bar['value'] = 0
        self.action_btn.config(state="normal")
        self.cancel_btn.config(state="disabled")

    def preserve_folder_selection_state(self, folder_item):
        """Preserve selection state when folder is expanded/collapsed"""
        # Store current selection state of all children
        selection_state = {}
        
        def store_state(item):
            selection_state[item] = 'checked' in self.tree.item(item, "tags")
            for child in self.tree.get_children(item):
                store_state(child)
        
        store_state(folder_item)
        return selection_state

    def restore_folder_selection_state(self, folder_item, selection_state):
        """Restore selection state after folder expansion/collapse"""
        def restore_state(item):
            if item in selection_state and selection_state[item]:
                current_text = self.tree.item(item, "text")
                new_text = current_text.replace("â˜", "â˜‘")
                self.tree.item(item, text=new_text, tags=["checked", "selected"])
            for child in self.tree.get_children(item):
                restore_state(child)
        
        restore_state(folder_item)

# Main Application
class FileCopyApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("File Copy Utility")
        self.geometry("600x600")
        self.resizable(True, True)

        tab_control = ttk.Notebook(self)
        file_copy_tab = FileCopyTab(tab_control, self)
        tab_control.add(file_copy_tab, text="File Copy")
        tab_control.pack(expand=1, fill="both")

if __name__ == "__main__":
    app = FileCopyApp()
    app.mainloop()
