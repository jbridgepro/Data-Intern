import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import threading
import datetime

class FileCreationTab:
    def __init__(self, parent, app):
        self.parent = parent
        self.app = app
        self.frame = ttk.Frame(self.parent)

        # Variables
        self.folder_path = tk.StringVar()
        self.file_extensions = tk.StringVar()
        self.file_prefix = tk.StringVar(value="file")
        self.num_files = tk.IntVar(value=1)
        self.use_date_prefix = tk.BooleanVar(value=False)
        self.date_format = tk.StringVar(value="YYYY-MM-DD")
        self.overwrite_existing = tk.BooleanVar(value=False)
        self.numbering_format = tk.StringVar(value="001")
        self.separator = tk.StringVar(value="_")
        self.file_suffix = tk.StringVar()
        self.use_timestamp = tk.BooleanVar(value=False)
        self.timestamp_format = tk.StringVar(value="%H%M%S")
        self.include_numbering = tk.BooleanVar(value=True)
        self.numbering_position = tk.StringVar(value="After Prefix")

        # Create widgets
        self.create_widgets()

    def create_widgets(self):
        # Main frame
        main_frame = ttk.Frame(self.frame, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = ttk.Label(main_frame, text="File Creation", font=self.app.title_font)
        title.grid(row=0, column=0, columnspan=3, pady=(0, 20))

        # File location section
        location_frame = ttk.LabelFrame(main_frame, text="File Location", padding="5")
        location_frame.grid(row=1, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        ttk.Label(location_frame, text="Folder Path:").grid(row=0, column=0, sticky="w", padx=5, pady=3)
        path_frame = ttk.Frame(location_frame)
        path_frame.grid(row=0, column=1, columnspan=2, sticky="ew", padx=5, pady=3)
        ttk.Entry(path_frame, textvariable=self.folder_path, width=45).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(path_frame, text="Browse", command=self.browse_folder).pack(side=tk.RIGHT, padx=(5, 0))

        # File extensions section
        extensions_frame = ttk.LabelFrame(main_frame, text="File Extensions", padding="5")
        extensions_frame.grid(row=2, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        ttk.Label(extensions_frame, text="Extensions:").grid(row=0, column=0, sticky="w", padx=5, pady=3)
        self.file_extensions_entry = ttk.Entry(extensions_frame, textvariable=self.file_extensions, width=45)
        self.file_extensions_entry.grid(row=0, column=1, padx=5, pady=3)
        ttk.Label(extensions_frame, text="(comma-separated, e.g., .txt,.csv)").grid(row=0, column=2, sticky="w", padx=5, pady=3)

        # Configure column weights
        location_frame.columnconfigure(1, weight=1)
        extensions_frame.columnconfigure(1, weight=1)

        # File naming options - organized in sections
        naming_frame = ttk.LabelFrame(main_frame, text="File Naming Options", padding="10")
        naming_frame.grid(row=3, column=0, columnspan=3, pady=10, padx=5, sticky="ew")

        # Basic naming section
        basic_frame = ttk.LabelFrame(naming_frame, text="Basic Name", padding="5")
        basic_frame.grid(row=0, column=0, columnspan=2, pady=(0, 10), sticky="ew")

        ttk.Label(basic_frame, text="Prefix:").grid(row=0, column=0, sticky="w", padx=5, pady=3)
        ttk.Entry(basic_frame, textvariable=self.file_prefix, width=25).grid(row=0, column=1, padx=5, pady=3)

        ttk.Label(basic_frame, text="Suffix:").grid(row=1, column=0, sticky="w", padx=5, pady=3)
        ttk.Entry(basic_frame, textvariable=self.file_suffix, width=25).grid(row=1, column=1, padx=5, pady=3)

        ttk.Label(basic_frame, text="Separator:").grid(row=2, column=0, sticky="w", padx=5, pady=3)
        ttk.Entry(basic_frame, textvariable=self.separator, width=10).grid(row=2, column=1, sticky="w", padx=5, pady=3)

        # Numbering section
        numbering_frame = ttk.LabelFrame(naming_frame, text="Numbering", padding="5")
        numbering_frame.grid(row=1, column=0, pady=(0, 10), sticky="ew")

        ttk.Checkbutton(numbering_frame, text="Include Numbering", variable=self.include_numbering).grid(row=0, column=0, columnspan=2, sticky="w", padx=5, pady=3)

        ttk.Label(numbering_frame, text="Format:").grid(row=1, column=0, sticky="w", padx=5, pady=3)
        numbering_formats = ["1", "01", "001", "0001"]
        ttk.Combobox(numbering_frame, textvariable=self.numbering_format, values=numbering_formats, state="readonly", width=10).grid(row=1, column=1, sticky="w", padx=5, pady=3)

        ttk.Label(numbering_frame, text="Position:").grid(row=2, column=0, sticky="w", padx=5, pady=3)
        numbering_positions = ["After Prefix", "Before Suffix", "As Prefix", "As Suffix"]
        ttk.Combobox(numbering_frame, textvariable=self.numbering_position, values=numbering_positions, state="readonly", width=15).grid(row=2, column=1, sticky="w", padx=5, pady=3)

        # Timestamp section
        timestamp_frame = ttk.LabelFrame(naming_frame, text="Timestamp", padding="5")
        timestamp_frame.grid(row=1, column=1, pady=(0, 10), sticky="ew")

        ttk.Checkbutton(timestamp_frame, text="Include Timestamp", variable=self.use_timestamp).grid(row=0, column=0, columnspan=2, sticky="w", padx=5, pady=3)

        ttk.Label(timestamp_frame, text="Format:").grid(row=1, column=0, sticky="w", padx=5, pady=3)
        timestamp_formats = ["%H%M%S", "%H-%M-%S", "%Y%m%d_%H%M%S", "%Y-%m-%d_%H-%M-%S"]
        ttk.Combobox(timestamp_frame, textvariable=self.timestamp_format, values=timestamp_formats, state="readonly", width=15).grid(row=1, column=1, sticky="w", padx=5, pady=3)

        # Quick actions section
        quick_frame = ttk.LabelFrame(naming_frame, text="Quick Actions", padding="5")
        quick_frame.grid(row=2, column=0, columnspan=2, pady=(0, 5), sticky="ew")

        ttk.Label(quick_frame, text="Common Prefixes:").grid(row=0, column=0, sticky="w", padx=5, pady=3)
        prefix_buttons_frame = ttk.Frame(quick_frame)
        prefix_buttons_frame.grid(row=1, column=0, columnspan=2, padx=5, pady=3)

        quick_prefixes = ["file", "document", "data", "backup", "temp", "new"]
        for i, prefix in enumerate(quick_prefixes):
            ttk.Button(prefix_buttons_frame, text=prefix, width=8, command=lambda p=prefix: self.set_prefix(p)).grid(row=0, column=i, padx=2, pady=2)

        # Configure column weights for proper expansion
        basic_frame.columnconfigure(1, weight=1)
        numbering_frame.columnconfigure(1, weight=1)
        timestamp_frame.columnconfigure(1, weight=1)
        naming_frame.columnconfigure(0, weight=1)
        naming_frame.columnconfigure(1, weight=1)

        # Creation settings section
        settings_frame = ttk.LabelFrame(main_frame, text="Creation Settings", padding="5")
        settings_frame.grid(row=4, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        ttk.Label(settings_frame, text="Number of Files:").grid(row=0, column=0, sticky="w", padx=5, pady=3)
        self.num_files_spinbox = ttk.Spinbox(settings_frame, from_=1, to=1000, textvariable=self.num_files, width=10)
        self.num_files_spinbox.grid(row=0, column=1, sticky="w", padx=5, pady=3)

        ttk.Checkbutton(settings_frame, text="Use Date Prefix", variable=self.use_date_prefix).grid(row=1, column=0, sticky="w", padx=5, pady=3)
        date_formats = ["YYYY-MM-DD", "YYYYMMDD", "DD-MM-YYYY", "MM-DD-YYYY"]
        ttk.Combobox(settings_frame, textvariable=self.date_format, values=date_formats, state="readonly", width=15).grid(row=1, column=1, sticky="w", padx=5, pady=3)

        ttk.Checkbutton(settings_frame, text="Overwrite existing files", variable=self.overwrite_existing).grid(row=2, column=0, columnspan=2, sticky="w", padx=5, pady=3)

        # Configure column weights
        settings_frame.columnconfigure(1, weight=1)

        # Action buttons section
        action_frame = ttk.LabelFrame(main_frame, text="Actions", padding="10")
        action_frame.grid(row=5, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        # Create buttons with better layout
        button_container = ttk.Frame(action_frame)
        button_container.pack(expand=True)

        ttk.Button(button_container, text="Create Empty Files", command=self.start_create_files, width=20).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_container, text="Clear All", command=self.clear_all, width=15).pack(side=tk.LEFT, padx=10)

        # Progress and status section
        progress_frame = ttk.LabelFrame(main_frame, text="Progress", padding="5")
        progress_frame.grid(row=6, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        self.progress = ttk.Progressbar(progress_frame, orient="horizontal", length=400, mode="determinate")
        self.progress.pack(fill=tk.X, pady=(0, 5))

        self.status_label = ttk.Label(progress_frame, text="")
        self.status_label.pack(anchor="w")

        # Preview area
        preview_frame = ttk.LabelFrame(main_frame, text="Preview", padding="5")
        preview_frame.grid(row=7, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="nsew")

        # Create text widget with scrollbar
        text_frame = ttk.Frame(preview_frame)
        text_frame.pack(fill=tk.BOTH, expand=True)

        self.preview_text = tk.Text(text_frame, height=12, width=60, wrap=tk.WORD, state=tk.DISABLED)
        scrollbar = ttk.Scrollbar(text_frame, orient=tk.VERTICAL, command=self.preview_text.yview)
        self.preview_text.configure(yscrollcommand=scrollbar.set)

        self.preview_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # File type tags frame
        self.file_type_tags_frame = ttk.Frame(main_frame)
        self.file_type_tags_frame.grid(row=8, column=0, columnspan=3, padx=5, pady=5, sticky="ew")

        # Configure grid
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(7, weight=1)

        # Bind events
        self.file_extensions_entry.bind('<KeyRelease>', self.update_file_type_tags)
        self.file_prefix.trace_add("write", self.update_preview)
        self.file_suffix.trace_add("write", self.update_preview)
        self.separator.trace_add("write", self.update_preview)
        self.numbering_format.trace_add("write", self.update_preview)
        self.include_numbering.trace_add("write", self.update_preview)
        self.numbering_position.trace_add("write", self.update_preview)
        self.use_timestamp.trace_add("write", self.update_preview)
        self.timestamp_format.trace_add("write", self.update_preview)
        self.num_files.trace_add("write", self.update_preview)
        self.use_date_prefix.trace_add("write", self.update_preview)
        self.date_format.trace_add("write", self.update_preview)
        self.file_extensions.trace_add("write", self.update_preview)

    def browse_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.folder_path.set(folder)

    def clear_all(self):
        self.folder_path.set("")
        self.file_extensions.set("")
        self.file_prefix.set("file")
        self.num_files.set(1)
        self.use_date_prefix.set(False)
        self.date_format.set("YYYY-MM-DD")
        self.overwrite_existing.set(False)
        self.numbering_format.set("001")
        self.separator.set("_")
        self.file_suffix.set("")
        self.use_timestamp.set(False)
        self.timestamp_format.set("%H%M%S")
        self.include_numbering.set(True)
        self.numbering_position.set("After Prefix")
        self.update_file_type_tags()
        self.update_preview()

    def start_create_files(self):
        thread = threading.Thread(target=self.create_empty_files)
        thread.start()

    def create_empty_files(self):
        folder_path = self.folder_path.get()
        extensions = [ext.strip() for ext in self.file_extensions.get().split(',') if ext.strip()]
        prefix = self.file_prefix.get()
        suffix = self.file_suffix.get()
        separator = self.separator.get()
        numbering_format = self.numbering_format.get()
        num_files = self.num_files.get()

        if not folder_path:
            messagebox.showerror("Error", "Please specify the folder path.")
            return

        if not os.path.exists(folder_path):
            messagebox.showerror("Error", "The specified folder does not exist.")
            return

        if not os.path.isdir(folder_path):
            messagebox.showerror("Error", "The specified path is not a directory.")
            return

        if not os.access(folder_path, os.W_OK):
            messagebox.showerror("Error", "You do not have write permission for the specified folder.")
            return

        if not extensions:
            messagebox.showerror("Error", "Please specify at least one file extension.")
            return

        # Validate extensions
        invalid_exts = [ext for ext in extensions if not ext.startswith('.')]
        if invalid_exts:
            messagebox.showerror("Error", f"Invalid file extensions: {', '.join(invalid_exts)}. Extensions must start with a dot (e.g., .txt).")
            return

        try:
            created_files = 0
            total_files = len(extensions) * num_files
            self.progress["value"] = 0
            self.progress["maximum"] = total_files

            date_prefix = ""
            if self.use_date_prefix.get():
                date_format = self.date_format.get().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                date_prefix = datetime.datetime.now().strftime(date_format) + "_"

            timestamp_str = ""
            if self.use_timestamp.get():
                timestamp_str = datetime.datetime.now().strftime(self.timestamp_format.get()) + separator

            skipped_files = 0
            for i in range(1, num_files + 1):
                for ext in extensions:
                    base_filename = self.construct_filename(i)
                    filename = f"{base_filename}{ext}"
                    file_path = os.path.join(folder_path, filename)

                    if os.path.exists(file_path) and not self.overwrite_existing.get():
                        skipped_files += 1
                        self.status_label.config(text=f"Skipping: {filename} (already exists)")
                    else:
                        with open(file_path, 'w') as f:
                            pass  # Create an empty file
                        created_files += 1
                        self.status_label.config(text=f"Creating: {filename}")

                    self.progress["value"] = created_files + skipped_files
                    self.frame.update_idletasks()

            if skipped_files > 0:
                self.status_label.config(text=f"Created {created_files} files, skipped {skipped_files} existing files.")
                messagebox.showinfo("Success", f"Created {created_files} files, skipped {skipped_files} existing files.")
            else:
                self.status_label.config(text=f"Created {created_files} empty files successfully.")
                messagebox.showinfo("Success", f"Created {created_files} empty files successfully.")
        except PermissionError:
            messagebox.showerror("Error", "Permission denied. Please check your access rights.")
        except Exception as e:
            messagebox.showerror("Error", f"An unexpected error occurred: {str(e)}")
        finally:
            self.progress["value"] = 0
            self.status_label.config(text="")

    def update_file_type_tags(self, event=None):
        # Clear existing tags
        for widget in self.file_type_tags_frame.winfo_children():
            widget.destroy()

        # Common file extensions
        common_extensions = ['.sql','.txt', '.xlsx','.csv','.pbix','.json','.xml', '.docx', '.pdf','.jpg','.png']

        # Create tag buttons for common extensions not already in the input
        current_extensions = set(ext.strip() for ext in self.file_extensions.get().split(',') if ext.strip())
        for ext in common_extensions:
            if ext not in current_extensions:
                tag_button = ttk.Button(self.file_type_tags_frame, text=ext, command=lambda e=ext: self.add_file_type(e))
                tag_button.pack(side=tk.LEFT, padx=2, pady=2)

        # Create remove buttons for existing extensions
        for ext in current_extensions:
            tag_frame = ttk.Frame(self.file_type_tags_frame)
            tag_frame.pack(side=tk.LEFT, padx=2, pady=2)
            
            tag_label = ttk.Label(tag_frame, text=ext)
            tag_label.pack(side=tk.LEFT)
            
            remove_button = ttk.Button(tag_frame, text="x", width=2, command=lambda e=ext: self.remove_file_type(e))
            remove_button.pack(side=tk.LEFT)

    def add_file_type(self, file_type):
        current_types = self.file_extensions.get()
        if current_types:
            self.file_extensions.set(f"{current_types},{file_type}")
        else:
            self.file_extensions.set(file_type)
        self.update_file_type_tags()

    def remove_file_type(self, file_type):
        current_types = self.file_extensions.get().split(',')
        current_types = [t.strip() for t in current_types if t.strip() != file_type]
        self.file_extensions.set(','.join(current_types))
        self.update_file_type_tags()

    def set_prefix(self, prefix):
        self.file_prefix.set(prefix)

    def construct_filename(self, i):
        """Construct filename based on current settings"""
        prefix = self.file_prefix.get()
        suffix = self.file_suffix.get()
        separator = self.separator.get()
        numbering_format = self.numbering_format.get()

        date_prefix = ""
        if self.use_date_prefix.get():
            date_format = self.date_format.get().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
            date_prefix = datetime.datetime.now().strftime(date_format) + "_"

        timestamp_str = ""
        if self.use_timestamp.get():
            timestamp_str = datetime.datetime.now().strftime(self.timestamp_format.get()) + separator

        # Format the number according to the selected format
        if numbering_format == "1":
            number_str = str(i)
        elif numbering_format == "01":
            number_str = f"{i:02d}"
        elif numbering_format == "001":
            number_str = f"{i:03d}"
        elif numbering_format == "0001":
            number_str = f"{i:04d}"
        else:
            number_str = f"{i:03d}"

        # Handle numbering position
        numbering_position = self.numbering_position.get()
        include_numbering = self.include_numbering.get()

        if not include_numbering:
            # No numbering
            filename = f"{date_prefix}{prefix}{separator}{timestamp_str}{suffix}"
        elif numbering_position == "As Prefix":
            filename = f"{date_prefix}{number_str}{separator}{prefix}{separator}{timestamp_str}{suffix}"
        elif numbering_position == "After Prefix":
            filename = f"{date_prefix}{prefix}{separator}{timestamp_str}{number_str}{suffix}"
        elif numbering_position == "Before Suffix":
            filename = f"{date_prefix}{prefix}{separator}{timestamp_str}{number_str}{suffix}"
        elif numbering_position == "As Suffix":
            filename = f"{date_prefix}{prefix}{separator}{timestamp_str}{suffix}{separator}{number_str}"
        else:
            # Default to After Prefix
            filename = f"{date_prefix}{prefix}{separator}{timestamp_str}{number_str}{suffix}"

        return filename

    def update_preview(self, *args):
        self.preview_text.config(state=tk.NORMAL)
        self.preview_text.delete(1.0, tk.END)

        try:
            num_files = self.num_files.get()
            prefix = self.file_prefix.get()
            suffix = self.file_suffix.get()
            separator = self.separator.get()
            numbering_format = self.numbering_format.get()
            extensions = [ext.strip() for ext in self.file_extensions.get().split(',') if ext.strip()]

            date_prefix = ""
            if self.use_date_prefix.get():
                date_format = self.date_format.get().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                date_prefix = datetime.datetime.now().strftime(date_format) + "_"

            timestamp_str = ""
            if self.use_timestamp.get():
                timestamp_str = datetime.datetime.now().strftime(self.timestamp_format.get()) + separator

            total_files = len(extensions) * num_files
            preview = f"File Creation Preview (Total: {total_files} files):\n\n"

            if num_files <= 10:
                for i in range(1, num_files + 1):
                    for ext in extensions:
                        base_filename = self.construct_filename(i)
                        filename = f"{base_filename}{ext}"
                        preview += f"{filename}\n"
            else:
                # Show first 5
                for i in range(1, 6):
                    for ext in extensions[:3]:
                        base_filename = self.construct_filename(i)
                        filename = f"{base_filename}{ext}"
                        preview += f"{filename}\n"
                    if len(extensions) > 3:
                        preview += "...\n"
                preview += "...\n"
                # Show last 5
                for i in range(num_files - 4, num_files + 1):
                    for ext in extensions[:3]:
                        base_filename = self.construct_filename(i)
                        filename = f"{base_filename}{ext}"
                        preview += f"{filename}\n"
                    if len(extensions) > 3:
                        preview += "...\n"

            self.preview_text.insert(tk.END, preview)
        except:
            self.preview_text.insert(tk.END, "Invalid input. Please check your settings.")

        self.preview_text.config(state=tk.DISABLED)
