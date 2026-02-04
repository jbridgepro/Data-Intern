import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import re
import threading
import queue
import mimetypes
import time
from pathlib import Path
from fnmatch import fnmatch

try:
    import chardet # type: ignore
except ImportError:
    chardet = None

class FindReplaceTab:
    def __init__(self, parent, app):
        self.parent = parent
        self.app = app
        self.frame = ttk.Frame(self.parent)

        # Variables
        self.root_path = tk.StringVar()
        self.find_text = tk.StringVar()
        self.replace_text = tk.StringVar()
        self.case_sensitive = tk.BooleanVar(value=False)
        self.use_regex = tk.BooleanVar(value=False)
        self.whole_word = tk.BooleanVar(value=False)
        self.file_extensions = tk.StringVar(value="*.txt,*.py,*.js,*.sql,*.css,*.md")
        self.folder_filter = tk.BooleanVar(value=False)
        self.file_filter = tk.BooleanVar(value=True)
        self.contents_filter = tk.BooleanVar(value=True)
        self.include_subdirs = tk.BooleanVar(value=True)
        self.backup_files = tk.BooleanVar(value=True)
        self.exclude_temp_files = tk.BooleanVar(value=True)  # Default to excluding temp files
        
        # File filtering system (from file_copy_tab.py)
        self.detected_file_extensions = set()
        self.selected_file_types = set()
        
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

        self.current_match_index = 0
        self.total_matches = 0
        self.matches = []
        self.search_in_progress = False
        self.last_search_time = 0
        self.search_delay = 500  # milliseconds

        # Debouncing for search input
        self.search_after_id = None  # ID for scheduled search
        self.search_delay_ms = 2000  # 2-second delay for search input

        # Performance optimization settings
        self.max_results = 1000  # Limit total results to prevent overwhelming UI
        self.max_file_size = 10 * 1024 * 1024  # 10MB file size limit
        self.batch_size = 50  # Process files in batches
        self.yield_interval = 0.01  # Yield control every 10ms
        self.last_yield_time = 0
        self.max_matches_per_file = 100  # Limit matches per file
        self.search_timeout = 30  # Maximum search time in seconds
        self.search_start_time = 0

        self.create_widgets()
        self.bind_events()

        # Threading
        self.queue = queue.Queue()
        self.search_thread = None
        self.stop_search = threading.Event()
        
        # Status tracking
        self.files_processed = 0
        self.total_files = 0
        self.current_status = "Ready"

    def create_widgets(self):
        # Main paned window
        self.paned_window = ttk.PanedWindow(self.frame, orient=tk.HORIZONTAL)
        self.paned_window.pack(fill=tk.BOTH, expand=True)

        # Left column (Folder Map)
        left_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(left_frame, weight=1)

        # Right column (Preview and Controls)
        right_frame = ttk.Frame(self.paned_window)
        self.paned_window.add(right_frame, weight=1)

        # Folder Map (Left column)
        self.create_folder_map(left_frame)

        # Preview and Controls (Right column)
        self.create_preview_and_controls(right_frame)

    def create_folder_map(self, parent):
        # Root path selection
        ttk.Label(parent, text="Root Directory:").pack(fill=tk.X, padx=5, pady=5)
        path_frame = ttk.Frame(parent)
        path_frame.pack(fill=tk.X, padx=5, pady=5)
        ttk.Entry(path_frame, textvariable=self.root_path).pack(side=tk.LEFT, expand=True, fill=tk.X)
        ttk.Button(path_frame, text="Browse", command=self.browse_root_directory).pack(side=tk.RIGHT)

        # Folder map view
        self.tree = ttk.Treeview(parent, columns=("type", "size"), selectmode="browse")
        self.tree.heading("#0", text="Name")
        self.tree.heading("type", text="Type")
        self.tree.heading("size", text="Size")
        self.tree.column("#0", width=200)
        self.tree.column("type", width=50, anchor="w")
        self.tree.column("size", width=50, anchor="e")
        self.tree.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)

        # Scrollbar for tree
        tree_scroll = ttk.Scrollbar(parent, orient="vertical", command=self.tree.yview)
        tree_scroll.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.configure(yscrollcommand=tree_scroll.set)

    def create_preview_and_controls(self, parent):
        # Find and Replace inputs
        input_frame = ttk.LabelFrame(parent, text="Search & Replace")
        input_frame.pack(fill=tk.X, padx=5, pady=5)

        ttk.Label(input_frame, text="Find:").grid(row=0, column=0, sticky="w", padx=5, pady=5)
        self.find_entry = ttk.Entry(input_frame, textvariable=self.find_text, font=("Consolas", 10))
        self.find_entry.grid(row=0, column=1, sticky="we", padx=5, pady=5)
        ttk.Button(input_frame, text="ðŸ”", command=self.start_search, width=3).grid(row=0, column=2, padx=2)

        ttk.Label(input_frame, text="Replace:").grid(row=1, column=0, sticky="w", padx=5, pady=5)
        self.replace_entry = ttk.Entry(input_frame, textvariable=self.replace_text, font=("Consolas", 10))
        self.replace_entry.grid(row=1, column=1, sticky="we", padx=5, pady=5)
        ttk.Button(input_frame, text="âš¡", command=self.quick_replace, width=3).grid(row=1, column=2, padx=2)

        input_frame.columnconfigure(1, weight=1)

        # Search Options
        options_frame = ttk.LabelFrame(parent, text="Search Options")
        options_frame.pack(fill=tk.X, padx=5, pady=5)

        # First row of options
        opt_row1 = ttk.Frame(options_frame)
        opt_row1.pack(fill=tk.X, padx=5, pady=2)
        ttk.Checkbutton(opt_row1, text="Case Sensitive", variable=self.case_sensitive).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(opt_row1, text="Whole Word", variable=self.whole_word).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(opt_row1, text="Use Regex", variable=self.use_regex).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(opt_row1, text="Include Subdirs", variable=self.include_subdirs).pack(side=tk.LEFT, padx=5)

        # Second row of options
        opt_row2 = ttk.Frame(options_frame)
        opt_row2.pack(fill=tk.X, padx=5, pady=2)
        ttk.Checkbutton(opt_row2, text="Search Folders", variable=self.folder_filter).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(opt_row2, text="Search Files", variable=self.file_filter).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(opt_row2, text="Search Contents", variable=self.contents_filter).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(opt_row2, text="Backup Files", variable=self.backup_files).pack(side=tk.LEFT, padx=5)
        ttk.Checkbutton(opt_row2, text="Exclude Temp Files", variable=self.exclude_temp_files).pack(side=tk.LEFT, padx=5)

        # File extensions and filters
        filter_frame = ttk.LabelFrame(parent, text="File Filters")
        filter_frame.pack(fill=tk.X, padx=5, pady=5)

        ttk.Label(filter_frame, text="Extensions:").pack(side=tk.LEFT, padx=5)
        self.ext_entry = ttk.Entry(filter_frame, textvariable=self.file_extensions, font=("Consolas", 9))
        self.ext_entry.pack(side=tk.LEFT, expand=True, fill=tk.X, padx=5)

        # Quick filter buttons
        quick_filters = ttk.Frame(filter_frame)
        quick_filters.pack(side=tk.RIGHT, padx=5)
        ttk.Button(quick_filters, text="Text", command=lambda: self.set_quick_filter("*.txt,*.md,*.log"), width=6).pack(side=tk.LEFT, padx=1)
        ttk.Button(quick_filters, text="Code", command=lambda: self.set_quick_filter("*.py,*.js,*.html,*.css,*.java,*.cpp,*.c"), width=6).pack(side=tk.LEFT, padx=1)
        ttk.Button(quick_filters, text="All", command=lambda: self.set_quick_filter("*"), width=6).pack(side=tk.LEFT, padx=1)

        # File type tags (visual checkboxes for detected extensions)
        self.file_type_tags_frame = ttk.Frame(parent)
        self.file_type_tags_frame.pack(fill=tk.X, padx=5, pady=2)

        # Preview area
        preview_frame = ttk.LabelFrame(parent, text="Preview")
        preview_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # Preview Treeview
        self.preview_tree = ttk.Treeview(preview_frame, columns=("type", "path", "match"), selectmode="browse", show="headings")
        self.preview_tree.heading("type", text="Type")
        self.preview_tree.heading("path", text="Path")
        self.preview_tree.heading("match", text="Match")
        self.preview_tree.column("type", width=50, anchor="w")
        self.preview_tree.column("path", width=200, anchor="w")
        self.preview_tree.column("match", width=400, anchor="w")
        self.preview_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Vertical scrollbar for preview tree
        preview_scroll_y = ttk.Scrollbar(preview_frame, orient="vertical", command=self.preview_tree.yview)
        preview_scroll_y.pack(side=tk.RIGHT, fill=tk.Y)

        # Horizontal scrollbar for preview tree
        preview_scroll_x = ttk.Scrollbar(preview_frame, orient="horizontal", command=self.preview_tree.xview)
        preview_scroll_x.pack(side=tk.BOTTOM, fill=tk.X)

        self.preview_tree.configure(yscrollcommand=preview_scroll_y.set, xscrollcommand=preview_scroll_x.set)

        # Create tags for highlighting
        self.preview_tree.tag_configure("find", background="yellow", foreground="black")
        self.preview_tree.tag_configure("replace", background="lightgreen", foreground="black")

        # Navigation and action buttons
        nav_frame = ttk.Frame(parent)
        nav_frame.pack(fill=tk.X, padx=5, pady=5)
        
        ttk.Button(nav_frame, text="Previous", command=self.previous_match).pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="Next", command=self.next_match).pack(side=tk.LEFT, padx=5)
        self.match_label = ttk.Label(nav_frame, text="")
        self.match_label.pack(side=tk.LEFT, padx=5)
        ttk.Button(nav_frame, text="Replace Selected", command=self.replace_selected).pack(side=tk.RIGHT, padx=5)
        ttk.Button(nav_frame, text="Replace All", command=self.replace_all).pack(side=tk.RIGHT, padx=5)

        # Progress bar and status
        progress_frame = ttk.Frame(parent)
        progress_frame.pack(fill=tk.X, padx=5, pady=5)
        
        self.progress_var = tk.DoubleVar()
        self.progress_bar = ttk.Progressbar(progress_frame, variable=self.progress_var, maximum=100)
        self.progress_bar.pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 5))
        
        # Cancel button
        self.cancel_btn = ttk.Button(progress_frame, text="Cancel", command=self.cancel_search, state="disabled")
        self.cancel_btn.pack(side=tk.RIGHT)
        
        # Status label
        self.status_label = ttk.Label(parent, text="Ready")
        self.status_label.pack(fill=tk.X, padx=5, pady=2)

    def bind_events(self):
        self.root_path.trace_add("write", self.update_preview)
        self.find_text.trace_add("write", self.update_preview)
        self.replace_text.trace_add("write", self.update_preview)
        self.case_sensitive.trace_add("write", self.update_preview)
        self.use_regex.trace_add("write", self.update_preview)
        self.whole_word.trace_add("write", self.update_preview)
        self.file_extensions.trace_add("write", self.update_preview)
        self.folder_filter.trace_add("write", self.update_preview)
        self.file_filter.trace_add("write", self.update_preview)
        self.contents_filter.trace_add("write", self.update_preview)
        self.include_subdirs.trace_add("write", self.update_preview)
        self.exclude_temp_files.trace_add("write", self.update_preview)
        self.tree.bind("<<TreeviewOpen>>", self.on_folder_open)
        self.preview_tree.bind("<<TreeviewSelect>>", self.on_preview_select)
        
        # Add keyboard shortcuts
        self.find_entry.bind('<Return>', lambda e: self.start_search())
        self.replace_entry.bind('<Return>', lambda e: self.quick_replace())
        self.find_entry.bind('<Control-f>', lambda e: self.find_entry.focus_set())

    def browse_root_directory(self):
        directory = filedialog.askdirectory()
        if directory:
            self.root_path.set(directory)
            self.populate_tree(directory)

    def populate_tree(self, path):
        self.tree.delete(*self.tree.get_children())
        self.detected_file_extensions.clear()
        self.load_directory_contents("", path)
        self.update_file_type_tags()

    def load_directory_contents(self, parent, path):
        try:
            for item in os.listdir(path):
                item_path = os.path.join(path, item)
                
                # Skip temporary files if the option is enabled
                if self.is_temp_file(item):
                    continue
                
                if os.path.isdir(item_path):
                    folder = self.tree.insert(parent, "end", text=f"ðŸ“ {item}", values=("Folder", ""))
                    self.tree.insert(folder, "end", text="Loading...")
                else:
                    size = os.path.getsize(item_path)
                    self.tree.insert(parent, "end", text=f"ðŸ“„ {item}", values=("File", self.format_size(size)))
                    # Collect file extensions for filtering
                    _, ext = os.path.splitext(item)
                    if ext:
                        self.detected_file_extensions.add(ext.lower())
        except PermissionError:
            print(f"Permission denied: {path}")
        except Exception as e:
            print(f"Error loading directory contents: {str(e)}")

    def on_folder_open(self, event):
        item = self.tree.focus()
        if self.tree.item(item, "values")[0] == "Folder":
            children = self.tree.get_children(item)
            if len(children) == 1 and self.tree.item(children[0], "text") == "Loading...":
                self.tree.delete(children[0])
                path = self.get_full_path(item)
                self.load_directory_contents(item, path)

    def get_full_path(self, item):
        path_parts = []
        while item:
            path_parts.insert(0, self.tree.item(item, "text").split(" ", 1)[1])
            item = self.tree.parent(item)
        return os.path.join(self.root_path.get(), *path_parts)

    def format_size(self, size):
        for unit in ["B", "KB", "MB", "GB", "TB"]:
            if size < 1024:
                return f"{size:.2f} {unit}"
            size /= 1024

    def update_preview(self, *args):
        root_path = self.root_path.get()
        find_text = self.find_text.get()

        if not root_path or not find_text:
            self.clear_preview()
            # Cancel any scheduled search
            if self.search_after_id:
                self.frame.after_cancel(self.search_after_id)
                self.search_after_id = None
            return

        # Cancel any existing scheduled search
        if self.search_after_id:
            self.frame.after_cancel(self.search_after_id)

        # Cancel any existing search
        self.cancel_search()

        # Schedule the search to happen after the delay
        self.search_after_id = self.frame.after(self.search_delay_ms, self.execute_debounced_search)

    def execute_debounced_search(self):
        """Execute the search after the debouncing delay"""
        # Clear the scheduled search ID since we're executing now
        self.search_after_id = None

        # Get current values (in case they changed during the delay)
        root_path = self.root_path.get()
        find_text = self.find_text.get()

        # Double-check that we still have valid inputs
        if not root_path or not find_text:
            self.clear_preview()
            return

        # Reset state
        self.matches = []
        self.files_processed = 0
        self.total_files = 0
        self.search_in_progress = True
        self.search_start_time = time.time()

        # Update UI
        self.cancel_btn.config(state="normal")
        self.status_label.config(text="Starting search...")
        self.progress_var.set(0)

        self.stop_search.clear()
        self.search_thread = threading.Thread(target=self.optimized_find_matches, args=(root_path, find_text))
        self.search_thread.start()

        self.process_queue()

    def process_queue(self):
        """Enhanced queue processing with better UI updates"""
        processed_items = 0
        try:
            while processed_items < 10:  # Process max 10 items per cycle to keep UI responsive
                item = self.queue.get_nowait()

                if isinstance(item, tuple) and len(item) == 3:
                    item_type, data, extra = item

                    if item_type in ["Folder", "File", "Content"]:
                        # Regular match result
                        self.matches.append(item)
                        self.total_matches = len(self.matches)

                        # Update preview periodically, not for every match
                        if self.total_matches % 10 == 0 or self.total_matches <= 5:
                            self.update_match_label()
                            self.show_preview()

                    elif item_type == "progress":
                        self.progress_var.set(data)
                        self.status_label.config(text=extra)

                    elif item_type == "status":
                        self.status_label.config(text=data)

                    elif item_type == "error":
                        messagebox.showerror("Search Error", data)
                        self.search_in_progress = False
                        self.cancel_btn.config(state="disabled")

                    elif item_type == "complete":
                        self.search_in_progress = False
                        self.cancel_btn.config(state="disabled")
                        self.status_label.config(text=f"Search complete - Found {self.total_matches} matches")
                        self.update_match_label()
                        self.show_preview()
                        return

                    elif item_type in ["cancelled", "timeout", "limit"]:
                        self.search_in_progress = False
                        self.cancel_btn.config(state="disabled")
                        self.status_label.config(text=data)
                        self.update_match_label()
                        self.show_preview()
                        return

                processed_items += 1

        except queue.Empty:
            pass

        # Continue processing if search is still active
        if self.search_thread and self.search_thread.is_alive():
            self.frame.after(50, self.process_queue)  # Check more frequently
        else:
            # Final update
            self.search_in_progress = False
            self.cancel_btn.config(state="disabled")
            if not self.status_label.cget("text").startswith("Search"):
                self.status_label.config(text=f"Ready - Found {self.total_matches} matches")
            self.update_match_label()
            self.show_preview()

    def update_match_label(self):
        if self.total_matches > 0:
            self.match_label.config(text=f"Match {self.current_match_index + 1} of {self.total_matches}")
        else:
            self.match_label.config(text="No matches found")

    def show_preview(self):
        self.preview_tree.delete(*self.preview_tree.get_children())
        for match_type, path, match_text in self.matches:
            item = self.preview_tree.insert("", "end", values=(match_type, path, ""))
            self.highlight_item(item, match_text)

    def highlight_item(self, item, text):
        find_text = self.find_text.get()
        replace_text = self.replace_text.get()
        
        if self.use_regex.get():
            flags = 0 if self.case_sensitive.get() else re.IGNORECASE
            try:
                pattern = re.compile(find_text, flags)
            except re.error:
                messagebox.showerror("Invalid Regex", "The provided regular expression is invalid.")
                return
            
            highlighted_text = ""
            last_end = 0
            for match in pattern.finditer(text):
                start, end = match.span()
                highlighted_text += text[last_end:start]
                highlighted_text += f"[find]{text[start:end]}[/find]"
                last_end = end
            highlighted_text += text[last_end:]
            
            highlighted_text = pattern.sub(f"[find]\\g<0>[/find] â†’ [replace]{replace_text}[/replace]", highlighted_text)
        else:
            if self.case_sensitive.get():
                highlighted_text = text.replace(find_text, f"[find]{find_text}[/find] â†’ [replace]{replace_text}[/replace]")
            else:
                pattern = re.compile(re.escape(find_text), re.IGNORECASE)
                highlighted_text = pattern.sub(lambda m: f"[find]{m.group()}[/find] â†’ [replace]{replace_text}[/replace]", text)

        self.preview_tree.set(item, "match", highlighted_text)
        self.apply_tags(item, "match")

    def apply_tags(self, item, column):
        text = self.preview_tree.set(item, column)
        chunks = re.split(r'(\[find\].*?\[/find\]|\[replace\].*?\[/replace\])', text)
        
        displayed_text = ""
        tag_ranges = []
        
        start = "0"
        for chunk in chunks:
            if chunk.startswith("[find]") and chunk.endswith("[/find]"):
                end = f"{start}+{len(chunk)-13}c"
                tag_ranges.append(("find", start, end))
                displayed_text += chunk[6:-7]
                start = end
            elif chunk.startswith("[replace]") and chunk.endswith("[/replace]"):
                end = f"{start}+{len(chunk)-19}c"
                tag_ranges.append(("replace", start, end))
                displayed_text += chunk[9:-10]
                start = end
            else:
                displayed_text += chunk
                start = f"{start}+{len(chunk)}c"

        self.preview_tree.set(item, column, displayed_text)

        # Apply tags
        for tag, start, end in tag_ranges:
            self.preview_tree.tag_add(tag, (item, column, start), (item, column, end))

    def clear_preview(self):
        self.preview_tree.delete(*self.preview_tree.get_children())
        self.match_label.config(text="")

    def previous_match(self):
        if self.total_matches > 0:
            self.current_match_index = (self.current_match_index - 1) % self.total_matches
            self.update_match_label()
            self.preview_tree.selection_set(self.preview_tree.get_children()[self.current_match_index])
            self.preview_tree.see(self.preview_tree.get_children()[self.current_match_index])

    def next_match(self):
        if self.total_matches > 0:
            self.current_match_index = (self.current_match_index + 1) % self.total_matches
            self.update_match_label()
            self.preview_tree.selection_set(self.preview_tree.get_children()[self.current_match_index])
            self.preview_tree.see(self.preview_tree.get_children()[self.current_match_index])

    def on_preview_select(self, event):
        selected_items = self.preview_tree.selection()
        if selected_items:
            self.current_match_index = self.preview_tree.index(selected_items[0])
            self.update_match_label()

    def find_matches(self, root_path, find_text):
        try:
            # Use the get_search_pattern method for consistent pattern building
            find_pattern = self.get_search_pattern(find_text)
        except re.error as e:
            messagebox.showerror("Invalid Regex", f"The provided regular expression is invalid: {str(e)}")
            return

        extensions = [ext.strip() for ext in self.file_extensions.get().split(',') if ext.strip()]

        for root, dirs, files in os.walk(root_path):
            if self.stop_search.is_set():
                return

            # Skip if not including subdirectories and we're not in the root
            if not self.include_subdirs.get() and root != root_path:
                break

            # Filter out temporary directories
            if self.exclude_temp_files.get():
                dirs[:] = [d for d in dirs if not self.is_temp_file(d)]

            if self.folder_filter.get():
                folder_name = os.path.basename(root)
                # Skip temporary folders in search results too
                if not self.is_temp_file(folder_name) and find_pattern.search(folder_name):
                    self.queue.put(("Folder", root, f"Folder name: {folder_name}"))

            for file in files:
                if self.stop_search.is_set():
                    return

                # Skip temporary files if the option is enabled
                if self.is_temp_file(file):
                    continue

                # Apply file extension filtering
                if extensions and extensions != ['*']:
                    file_matches = False
                    for ext in extensions:
                        ext_clean = ext.strip().replace('*', '')
                        if ext_clean == '' or file.lower().endswith(ext_clean.lower()):
                            file_matches = True
                            break
                    if not file_matches:
                        continue

                file_path = os.path.join(root, file)
                
                if self.file_filter.get() and find_pattern.search(file):
                    self.queue.put(("File", file_path, f"File name: {file}"))

                if self.contents_filter.get():
                    self.search_file_contents(file_path, find_pattern)

    def search_file_contents(self, file_path, find_pattern):
        try:
            # Check if the file is a text file
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type and not mime_type.startswith('text'):
                return

            # Check file size
            if os.path.getsize(file_path) > 10 * 1024 * 1024:  # 10 MB limit
                return

            # Detect file encoding
            encodings_to_try = ['utf-8', 'utf-16', 'utf-32', 'ascii', 'iso-8859-1', 'windows-1252']
            content = None

            for encoding in encodings_to_try:
                try:
                    with open(file_path, 'r', encoding=encoding) as f:
                        content = f.read()
                    break
                except UnicodeDecodeError:
                    continue

            if content is None:
                print(f"Unable to decode file {file_path} with any of the attempted encodings.")
                return

            for line_number, line in enumerate(content.splitlines(), 1):
                if self.stop_search.is_set():
                    return
                for match in find_pattern.finditer(line):
                    self.queue.put(("Content", file_path, f"Line {line_number}: {line.strip()}"))
        except Exception as e:
            print(f"Error reading file {file_path}: {str(e)}")

    def detect_encoding(self, file_path):
        if chardet:
            with open(file_path, 'rb') as f:
                raw_data = f.read(4096)  # Read first 4KB for encoding detection
            result = chardet.detect(raw_data)
            return result['encoding']
        else:
            # Fallback to UTF-8 if chardet is not available
            return 'utf-8'


    def replace_selected(self):
        selected_items = self.preview_tree.selection()
        if not selected_items:
            messagebox.showinfo("No Selection", "Please select a match to replace.")
            return

        find_text = self.find_text.get()
        replace_text = self.replace_text.get()

        changes_made = False
        for item in selected_items:
            match_type, file_path, match_text = self.preview_tree.item(item)["values"]
            try:
                if match_type == "Folder" and self.folder_filter.get():
                    new_path = os.path.join(os.path.dirname(file_path), replace_text)
                    os.rename(file_path, new_path)
                    changes_made = True
                elif match_type in ["File", "Content"]:
                    if self.replace_in_file(file_path, find_text, replace_text):
                        changes_made = True
                        messagebox.showinfo("Success", f"Applied change to '{file_path}'.")
                    else:
                        messagebox.showinfo("No Change", f"No changes were made to '{file_path}'.")
            except Exception as e:
                messagebox.showerror("Error", f"Failed to modify '{file_path}': {str(e)}")

        if changes_made:
            self.update_preview()

    def replace_in_file(self, file_path, find_text, replace_text):
        # Create backup if enabled
        backup_path = self.create_backup(file_path)
        
        encoding = self.detect_encoding(file_path)
        try:
            with open(file_path, 'r', encoding=encoding) as file:
                content = file.read()
            
            new_content, count = self.replace_in_content(content, find_text, replace_text)
            
            if count > 0:  # Only write if changes were made
                with open(file_path, 'w', encoding=encoding) as file:
                    file.write(new_content)
                print(f"Replaced {count} occurrences in '{file_path}'")
                if backup_path:
                    print(f"Backup created: {backup_path}")
                return True
            else:
                print(f"No replacements made in '{file_path}'")
                return False
        except Exception as e:
            print(f"Error replacing content in file {file_path}: {str(e)}")
            # If backup was created and operation failed, we could restore it here
            return False

    def replace_in_content(self, content, find_text, replace_text):
        try:
            # Use the same pattern building logic as search
            pattern = self.get_search_pattern(find_text)
            new_content, count = re.subn(pattern, replace_text, content)
            return new_content, count
        except re.error as e:
            print(f"Error in replace pattern: {str(e)}")
            return content, 0

    def replace_all(self):
        if not self.matches:
            messagebox.showinfo("No Changes", "No matches found. No changes were made.")
            return

        if messagebox.askyesno("Confirm", f"Apply changes to {len(self.matches)} matches?"):
            self.progress_var.set(0)
            self.progress_bar["maximum"] = len(self.matches)
            
            find_text = self.find_text.get()
            replace_text = self.replace_text.get()
            
            changes_made = False
            total_replacements = 0
            for i, (match_type, file_path, match_text) in enumerate(self.matches):
                try:
                    if match_type == "Folder" and self.folder_filter.get():
                        new_path = os.path.join(os.path.dirname(file_path), replace_text)
                        os.rename(file_path, new_path)
                        changes_made = True
                        total_replacements += 1
                    elif match_type in ["File", "Content"]:
                        if self.replace_in_file(file_path, find_text, replace_text):
                            changes_made = True
                            total_replacements += 1
                except Exception as e:
                    messagebox.showerror("Error", f"Failed to modify '{file_path}': {str(e)}")
                self.progress_var.set(i + 1)
                self.frame.update_idletasks()
            
            if changes_made:
                messagebox.showinfo("Success", f"Applied changes to {total_replacements} out of {len(self.matches)} matches.")
                self.update_preview()
            else:
                messagebox.showinfo("No Changes", "No changes were made.")
        else:
            messagebox.showinfo("Cancelled", "No changes were made.")

    def set_quick_filter(self, filter_text):
        """Set quick filter for file extensions"""
        self.file_extensions.set(filter_text)
        
    def start_search(self):
        """Manually trigger search (bypasses debouncing delay)"""
        if not self.search_in_progress:
            # Cancel any scheduled search
            if self.search_after_id:
                self.frame.after_cancel(self.search_after_id)
                self.search_after_id = None

            # Execute search immediately
            self.execute_debounced_search()
            
    def quick_replace(self):
        """Quick replace for selected item"""
        selected_items = self.preview_tree.selection()
        if selected_items:
            self.replace_selected()
        else:
            messagebox.showinfo("No Selection", "Please select a match to replace, or use 'Replace All' for all matches.")

    def create_backup(self, file_path):
        """Create backup of file before modification"""
        if self.backup_files.get():
            try:
                backup_path = f"{file_path}.backup_{int(time.time())}"
                import shutil
                shutil.copy2(file_path, backup_path)
                return backup_path
            except Exception as e:
                print(f"Warning: Could not create backup for {file_path}: {str(e)}")
        return None

    def get_search_pattern(self, find_text):
        """Build search pattern based on options"""
        if self.use_regex.get():
            flags = 0 if self.case_sensitive.get() else re.IGNORECASE
            return re.compile(find_text, flags)
        else:
            # Handle whole word option
            if self.whole_word.get():
                pattern = r'\b' + re.escape(find_text) + r'\b'
            else:
                pattern = re.escape(find_text)
            
            flags = 0 if self.case_sensitive.get() else re.IGNORECASE
            return re.compile(pattern, flags)

    def is_text_file(self, file_path):
        """Check if file is likely a text file"""
        try:
            # Check by extension first
            text_extensions = {'.txt', '.py', '.js', '.html', '.css', '.md', '.json', '.xml', '.csv', 
                             '.log', '.ini', '.cfg', '.conf', '.yml', '.yaml', '.sql', '.sh', '.bat',
                             '.c', '.cpp', '.h', '.hpp', '.java', '.php', '.rb', '.go', '.rs', '.swift'}
            
            _, ext = os.path.splitext(file_path.lower())
            if ext in text_extensions:
                return True
                
            # Check MIME type
            mime_type, _ = mimetypes.guess_type(file_path)
            if mime_type and mime_type.startswith('text'):
                return True
                
            # Try to read a small portion to detect binary
            with open(file_path, 'rb') as f:
                chunk = f.read(1024)
                if b'\0' in chunk:  # Null bytes indicate binary
                    return False
                    
            return True
        except:
            return False

    def count_total_files(self, root_path):
        """Count total files for progress tracking"""
        total = 0
        extensions = [ext.strip().replace('*', '') for ext in self.file_extensions.get().split(',') if ext.strip()]
        
        for root, dirs, files in os.walk(root_path):
            if not self.include_subdirs.get() and root != root_path:
                break
                
            for file in files:
                if not extensions or extensions == [''] or any(file.lower().endswith(ext.lower()) for ext in extensions):
                    total += 1
        return total

    def enhanced_search_file_contents(self, file_path, find_pattern):
        """Enhanced file content search with better error handling"""
        try:
            if not self.is_text_file(file_path):
                return
                
            # Check file size limit
            file_size = os.path.getsize(file_path)
            if file_size > 50 * 1024 * 1024:  # 50 MB limit
                return
                
            # Detect encoding
            encoding = self.detect_encoding(file_path)
            if not encoding:
                encoding = 'utf-8'
                
            with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
                line_number = 0
                matches_in_file = 0
                
                for line in f:
                    if self.stop_search.is_set():
                        return
                        
                    line_number += 1
                    line = line.rstrip('\n\r')
                    
                    for match in find_pattern.finditer(line):
                        matches_in_file += 1
                        # Limit matches per file to prevent overwhelming results
                        if matches_in_file <= 100:
                            context = self.get_line_context(line, match.start(), match.end())
                            self.queue.put(("Content", file_path, f"Line {line_number}: {context}"))
                        elif matches_in_file == 101:
                            self.queue.put(("Content", file_path, f"... and {matches_in_file-100} more matches in this file"))
                            break
                            
        except Exception as e:
            print(f"Error searching file {file_path}: {str(e)}")

    def get_line_context(self, line, start, end, context_chars=50):
        """Get context around match in line"""
        line_start = max(0, start - context_chars)
        line_end = min(len(line), end + context_chars)
        
        context = line[line_start:line_end]
        if line_start > 0:
            context = "..." + context
        if line_end < len(line):
            context = context + "..."
            
        return context

    def validate_regex(self, pattern):
        """Validate regex pattern"""
        try:
            re.compile(pattern)
            return True, ""
        except re.error as e:
            return False, str(e)

    def get_status_text(self):
        """Get current status text"""
        if self.search_in_progress:
            return f"Searching... {self.files_processed}/{self.total_files} files"
        elif self.total_matches > 0:
            return f"Found {self.total_matches} matches"
        else:
            return "Ready"

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
        """Update file type tags display (from file_copy_tab.py)"""
        self.file_type_tags_frame.destroy()
        self.file_type_tags_frame = ttk.Frame(self.frame)
        self.file_type_tags_frame.pack(fill=tk.X, padx=5, pady=2)

        for ext in sorted(self.detected_file_extensions):
            tag = ttk.Checkbutton(self.file_type_tags_frame, text=ext, command=lambda e=ext: self.toggle_file_type(e))
            tag.pack(side="left", padx=2)
            if ext in self.selected_file_types:
                tag.state(['selected'])

        self.update_file_types_entry()

    def toggle_file_type(self, ext):
        """Toggle file type selection (from file_copy_tab.py)"""
        if ext in self.selected_file_types:
            self.selected_file_types.remove(ext)
        else:
            self.selected_file_types.add(ext)
        self.update_file_types_entry()

    def update_file_types_entry(self):
        """Update file types entry field (from file_copy_tab.py)"""
        if self.selected_file_types:
            self.file_extensions.set(",".join(sorted(self.selected_file_types)))
        else:
            self.file_extensions.set("*")

    def optimized_find_matches(self, root_path, find_text):
        """Optimized search with performance improvements for large directories"""
        try:
            # Build search pattern
            find_pattern = self.get_search_pattern(find_text)
        except re.error as e:
            self.queue.put(("error", f"Invalid regex: {str(e)}", ""))
            return

        extensions = [ext.strip() for ext in self.file_extensions.get().split(',') if ext.strip()]
        files_batch = []
        batch_count = 0
        
        # Count total files for progress tracking
        self.total_files = self.count_total_files(root_path)
        self.queue.put(("status", f"Found {self.total_files} files to search", ""))

        try:
            for root, dirs, files in os.walk(root_path):
                # Check for cancellation and timeout
                if self.stop_search.is_set():
                    self.queue.put(("cancelled", "Search cancelled", ""))
                    return
                
                # Check timeout
                if time.time() - self.search_start_time > self.search_timeout:
                    self.queue.put(("timeout", "Search timeout reached", ""))
                    return

                # Skip if not including subdirectories
                if not self.include_subdirs.get() and root != root_path:
                    break

                # Filter out temporary directories
                if self.exclude_temp_files.get():
                    dirs[:] = [d for d in dirs if not self.is_temp_file(d)]

                # Search folder names
                if self.folder_filter.get():
                    folder_name = os.path.basename(root)
                    if not self.is_temp_file(folder_name) and find_pattern.search(folder_name):
                        self.queue.put(("Folder", root, f"Folder name: {folder_name}"))
                        
                        # Check result limit
                        if len(self.matches) >= self.max_results:
                            self.queue.put(("limit", f"Result limit ({self.max_results}) reached", ""))
                            return

                # Process files in batches
                for file in files:
                    if self.stop_search.is_set():
                        return

                    # Skip temporary files
                    if self.is_temp_file(file):
                        continue

                    # Apply file extension filtering
                    if extensions and extensions != ['*']:
                        file_matches = False
                        for ext in extensions:
                            ext_clean = ext.strip().replace('*', '')
                            if ext_clean == '' or file.lower().endswith(ext_clean.lower()):
                                file_matches = True
                                break
                        if not file_matches:
                            continue

                    file_path = os.path.join(root, file)
                    files_batch.append((file, file_path))
                    
                    # Process batch when it reaches batch_size
                    if len(files_batch) >= self.batch_size:
                        self.process_file_batch(files_batch, find_pattern)
                        files_batch = []
                        batch_count += 1
                        
                        # Yield control periodically
                        if batch_count % 5 == 0:  # Every 5 batches
                            time.sleep(0.001)  # Small yield
                        
                        # Update progress
                        progress = min(100, (self.files_processed / self.total_files) * 100) if self.total_files > 0 else 0
                        self.queue.put(("progress", progress, f"Processed {self.files_processed}/{self.total_files} files"))

            # Process remaining files in batch
            if files_batch:
                self.process_file_batch(files_batch, find_pattern)

        except Exception as e:
            self.queue.put(("error", f"Search error: {str(e)}", ""))
        finally:
            self.search_in_progress = False
            self.queue.put(("complete", "Search completed", ""))

    def process_file_batch(self, files_batch, find_pattern):
        """Process a batch of files efficiently"""
        for file, file_path in files_batch:
            if self.stop_search.is_set():
                return
                
            # Check result limit
            if len(self.matches) >= self.max_results:
                self.queue.put(("limit", f"Result limit ({self.max_results}) reached", ""))
                return

            self.files_processed += 1

            # Search file names
            if self.file_filter.get() and find_pattern.search(file):
                self.queue.put(("File", file_path, f"File name: {file}"))

            # Search file contents
            if self.contents_filter.get():
                self.optimized_search_file_contents(file_path, find_pattern)

    def optimized_search_file_contents(self, file_path, find_pattern):
        """Optimized file content search with better performance"""
        try:
            # Quick file type check
            if not self.is_text_file(file_path):
                return

            # Check file size limit
            file_size = os.path.getsize(file_path)
            if file_size > self.max_file_size:
                return

            # Detect encoding efficiently
            encoding = self.detect_encoding(file_path)
            if not encoding:
                encoding = 'utf-8'

            matches_in_file = 0
            with open(file_path, 'r', encoding=encoding, errors='ignore') as f:
                for line_number, line in enumerate(f, 1):
                    if self.stop_search.is_set():
                        return
                        
                    # Check result limit
                    if len(self.matches) >= self.max_results:
                        return

                    line = line.rstrip('\n\r')
                    
                    for match in find_pattern.finditer(line):
                        matches_in_file += 1
                        
                        # Limit matches per file
                        if matches_in_file <= self.max_matches_per_file:
                            context = self.get_line_context(line, match.start(), match.end())
                            self.queue.put(("Content", file_path, f"Line {line_number}: {context}"))
                        elif matches_in_file == self.max_matches_per_file + 1:
                            self.queue.put(("Content", file_path, f"... and more matches in this file (limit: {self.max_matches_per_file})"))
                            break

                    # Yield control periodically for very large files
                    if line_number % 1000 == 0:
                        current_time = time.time()
                        if current_time - self.last_yield_time > self.yield_interval:
                            time.sleep(0.001)
                            self.last_yield_time = current_time

        except Exception as e:
            print(f"Error searching file {file_path}: {str(e)}")

    def cancel_search(self):
        """Cancel the current search operation"""
        # Cancel any scheduled search
        if self.search_after_id:
            self.frame.after_cancel(self.search_after_id)
            self.search_after_id = None

        if self.search_thread and self.search_thread.is_alive():
            self.stop_search.set()
            self.search_thread.join(timeout=2.0)  # Wait up to 2 seconds

        self.search_in_progress = False
        self.cancel_btn.config(state="disabled")
        self.status_label.config(text="Search cancelled")
        self.progress_var.set(0)

    def process_queue(self):
        """Enhanced queue processing with better UI updates"""
        processed_items = 0
        try:
            while processed_items < 10:  # Process max 10 items per cycle to keep UI responsive
                item = self.queue.get_nowait()
                
                if isinstance(item, tuple) and len(item) == 3:
                    item_type, data, extra = item
                    
                    if item_type in ["Folder", "File", "Content"]:
                        # Regular match result
                        self.matches.append(item)
                        self.total_matches = len(self.matches)
                        
                        # Update preview periodically, not for every match
                        if self.total_matches % 20 == 0 or self.total_matches <= 20:
                            self.update_match_label()
                            self.show_preview()
                            
                    elif item_type == "progress":
                        self.progress_var.set(data)
                        self.status_label.config(text=extra)
                        
                    elif item_type == "status":
                        self.status_label.config(text=data)
                        
                    elif item_type == "error":
                        messagebox.showerror("Search Error", data)
                        self.search_in_progress = False
                        self.cancel_btn.config(state="disabled")
                        
                    elif item_type == "complete":
                        self.search_in_progress = False
                        self.cancel_btn.config(state="disabled")
                        self.status_label.config(text=f"Search complete - Found {self.total_matches} matches")
                        self.update_match_label()
                        self.show_preview()
                        return
                        
                    elif item_type in ["cancelled", "timeout", "limit"]:
                        self.search_in_progress = False
                        self.cancel_btn.config(state="disabled")
                        self.status_label.config(text=data)
                        self.update_match_label()
                        self.show_preview()
                        return
                
                processed_items += 1
                
        except queue.Empty:
            pass

        # Continue processing if search is still active
        if self.search_thread and self.search_thread.is_alive():
            self.frame.after(50, self.process_queue)  # Check more frequently
        else:
            # Final update
            self.search_in_progress = False
            self.cancel_btn.config(state="disabled")
            if not self.status_label.cget("text").startswith("Search"):
                self.status_label.config(text=f"Ready - Found {self.total_matches} matches")
            self.update_match_label()
            self.show_preview()

# Main Application
class FindReplaceApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Find and Replace Utility")
        self.geometry("1000x600")
        self.minsize(800, 600)
        self.resizable(True, True)

        tab_control = ttk.Notebook(self)
        find_replace_tab = FindReplaceTab(tab_control, self)
        tab_control.add(find_replace_tab.frame, text="Find & Replace")
        tab_control.pack(expand=1, fill="both")

if __name__ == "__main__":
    app = FindReplaceApp()
    app.mainloop()
