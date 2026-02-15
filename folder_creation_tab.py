import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import os
import threading
import datetime

class FolderCreationTab:
    def __init__(self, parent, app):
        self.parent = parent
        self.app = app
        self.frame = ttk.Frame(self.parent)

        # Variables
        self.root_folder_path = tk.StringVar()
        self.num_main_folders = tk.IntVar(value=1)
        self.main_folder_prefix = tk.StringVar()
        self.subfolder_names = tk.StringVar()
        self.use_date_prefix = tk.BooleanVar(value=False)
        self.date_format = tk.StringVar(value="YYYY-MM-DD")

        # Create widgets
        self.create_widgets()

    def create_widgets(self):
        # Main frame
        main_frame = ttk.Frame(self.frame, padding="10")
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Title
        title = ttk.Label(main_frame, text="Folder Creation", font=self.app.title_font)
        title.grid(row=0, column=0, columnspan=3, pady=(0, 20))

        # Root folder location section
        location_frame = ttk.LabelFrame(main_frame, text="Root Folder Location", padding="5")
        location_frame.grid(row=1, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        ttk.Label(location_frame, text="Root Folder Path:").grid(row=0, column=0, sticky="w", padx=5, pady=3)
        path_frame = ttk.Frame(location_frame)
        path_frame.grid(row=0, column=1, columnspan=2, sticky="ew", padx=5, pady=3)
        ttk.Entry(path_frame, textvariable=self.root_folder_path, width=45).pack(side=tk.LEFT, fill=tk.X, expand=True)
        ttk.Button(path_frame, text="Browse", command=self.browse_root_folder).pack(side=tk.RIGHT, padx=(5, 0))

        # Configure column weights
        location_frame.columnconfigure(1, weight=1)

        # Folder structure section
        structure_frame = ttk.LabelFrame(main_frame, text="Folder Structure", padding="5")
        structure_frame.grid(row=2, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        # Main folders
        ttk.Label(structure_frame, text="Number of Main Folders:").grid(row=0, column=0, sticky="w", padx=5, pady=3)
        ttk.Entry(structure_frame, textvariable=self.num_main_folders, width=10).grid(row=0, column=1, sticky="w", padx=5, pady=3)

        ttk.Label(structure_frame, text="Main Folder Prefix:").grid(row=1, column=0, sticky="w", padx=5, pady=3)
        ttk.Entry(structure_frame, textvariable=self.main_folder_prefix, width=45).grid(row=1, column=1, columnspan=2, padx=5, pady=3)

        # Subfolders
        ttk.Label(structure_frame, text="Subfolder Names:").grid(row=2, column=0, sticky="w", padx=5, pady=3)
        ttk.Entry(structure_frame, textvariable=self.subfolder_names, width=45).grid(row=2, column=1, padx=5, pady=3)
        ttk.Label(structure_frame, text="(comma-separated)").grid(row=2, column=2, sticky="w", padx=5, pady=3)

        # Configure column weights
        structure_frame.columnconfigure(1, weight=1)

        # Date options section
        date_frame = ttk.LabelFrame(main_frame, text="Date Options", padding="5")
        date_frame.grid(row=3, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        ttk.Checkbutton(date_frame, text="Use Date Prefix", variable=self.use_date_prefix).grid(row=0, column=0, sticky="w", padx=5, pady=3)
        date_formats = ["YYYY-MM-DD", "YYYYMMDD", "DD-MM-YYYY", "MM-DD-YYYY"]
        ttk.Combobox(date_frame, textvariable=self.date_format, values=date_formats, state="readonly", width=15).grid(row=0, column=1, sticky="w", padx=5, pady=3)

        # Action buttons section
        action_frame = ttk.LabelFrame(main_frame, text="Actions", padding="10")
        action_frame.grid(row=4, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        # Create buttons with better layout
        button_container = ttk.Frame(action_frame)
        button_container.pack(expand=True)

        ttk.Button(button_container, text="Create Folders", command=self.start_create_folders, width=20).pack(side=tk.LEFT, padx=10)
        ttk.Button(button_container, text="Clear All", command=self.clear_all, width=15).pack(side=tk.LEFT, padx=10)

        # Progress and status section
        progress_frame = ttk.LabelFrame(main_frame, text="Progress", padding="5")
        progress_frame.grid(row=5, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="ew")

        self.progress = ttk.Progressbar(progress_frame, orient="horizontal", length=400, mode="determinate")
        self.progress.pack(fill=tk.X, pady=(0, 5))

        self.status_label = ttk.Label(progress_frame, text="")
        self.status_label.pack(anchor="w")

        # Preview area
        preview_frame = ttk.LabelFrame(main_frame, text="Preview", padding="5")
        preview_frame.grid(row=6, column=0, columnspan=3, pady=(0, 10), padx=5, sticky="nsew")

        # Create text widget with scrollbar
        text_frame = ttk.Frame(preview_frame)
        text_frame.pack(fill=tk.BOTH, expand=True)

        self.preview_text = tk.Text(text_frame, height=12, width=60, wrap=tk.WORD, state=tk.DISABLED)
        scrollbar = ttk.Scrollbar(text_frame, orient=tk.VERTICAL, command=self.preview_text.yview)
        self.preview_text.configure(yscrollcommand=scrollbar.set)

        self.preview_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        # Configure grid
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(6, weight=1)

        # Bind events
        self.num_main_folders.trace_add("write", self.update_preview)
        self.main_folder_prefix.trace_add("write", self.update_preview)
        self.subfolder_names.trace_add("write", self.update_preview)
        self.use_date_prefix.trace_add("write", self.update_preview)
        self.date_format.trace_add("write", self.update_preview)

    def browse_root_folder(self):
        folder = filedialog.askdirectory()
        if folder:
            self.root_folder_path.set(folder)

    def clear_all(self):
        self.root_folder_path.set("")
        self.num_main_folders.set(1)
        self.main_folder_prefix.set("")
        self.subfolder_names.set("")
        self.use_date_prefix.set(False)
        self.date_format.set("YYYY-MM-DD")
        self.update_preview()

    def start_create_folders(self):
        thread = threading.Thread(target=self.create_folders)
        thread.start()

    def create_folders(self):
        root_path = self.root_folder_path.get()
        num_folders = self.num_main_folders.get()
        folder_prefix = self.main_folder_prefix.get()
        subfolder_names = [name.strip() for name in self.subfolder_names.get().split(',') if name.strip()]

        if not root_path:
            messagebox.showerror("Error", "Please specify the root folder path.")
            return

        try:
            created_folders = 0
            total_folders = num_folders * (1 + len(subfolder_names))
            self.progress["value"] = 0
            self.progress["maximum"] = total_folders

            date_prefix = ""
            if self.use_date_prefix.get():
                date_format = self.date_format.get().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                date_prefix = datetime.datetime.now().strftime(date_format) + "_"

            for i in range(1, num_folders + 1):
                folder_number = f"{i:02d}"
                main_folder_name = f"{date_prefix}{folder_number} - {folder_prefix}"
                main_folder_path = os.path.join(root_path, main_folder_name)
                
                os.makedirs(main_folder_path, exist_ok=True)
                created_folders += 1
                self.progress["value"] = created_folders
                self.status_label.config(text=f"Creating: {main_folder_name}")
                self.frame.update_idletasks()

                for subfolder in subfolder_names:
                    subfolder_path = os.path.join(main_folder_path, subfolder)
                    os.makedirs(subfolder_path, exist_ok=True)
                    created_folders += 1
                    self.progress["value"] = created_folders
                    self.status_label.config(text=f"Creating: {main_folder_name}/{subfolder}")
                    self.frame.update_idletasks()

            self.status_label.config(text=f"Created {created_folders} folders and subfolders successfully.")
            messagebox.showinfo("Success", f"Created {created_folders} folders and subfolders successfully.")
        except PermissionError:
            messagebox.showerror("Error", "Permission denied. Please check your access rights.")
        except Exception as e:
            messagebox.showerror("Error", f"An unexpected error occurred: {str(e)}")
        finally:
            self.progress["value"] = 0

    def update_preview(self, *args):
        self.preview_text.config(state=tk.NORMAL)
        self.preview_text.delete(1.0, tk.END)
        
        try:
            num_folders = self.num_main_folders.get()
            folder_prefix = self.main_folder_prefix.get()
            subfolder_names = [name.strip() for name in self.subfolder_names.get().split(',') if name.strip()]

            date_prefix = ""
            if self.use_date_prefix.get():
                date_format = self.date_format.get().replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                date_prefix = datetime.datetime.now().strftime(date_format) + "_"

            preview = "Folder Structure Preview:\n\n"
            for i in range(1, min(num_folders, 5) + 1):
                folder_number = f"{i:02d}"
                main_folder_name = f"{date_prefix}{folder_number} - {folder_prefix}"
                preview += f"â”œâ”€â”€ {main_folder_name}\n"
                for subfolder in subfolder_names[:3]:
                    preview += f"â”‚   â”œâ”€â”€ {subfolder}\n"
                if len(subfolder_names) > 3:
                    preview += "â”‚   â””â”€â”€ ...\n"
            if num_folders > 5:
                preview += "â””â”€â”€ ...\n"
            
            self.preview_text.insert(tk.END, preview)
        except:
            self.preview_text.insert(tk.END, "Invalid input. Please check your settings.")
        
        self.preview_text.config(state=tk.DISABLED)
