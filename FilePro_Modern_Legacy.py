import flet as ft
import os
import json
import datetime
from pathlib import Path
import shutil
import threading
import subprocess

# --- File Mapper Logic (Adapted from FileMapper.py) ---

def get_structure_data(path, recursive=True):
    try:
        def process_entry(entry_path):
            entry_name = os.path.basename(entry_path)
            is_dir = os.path.isdir(entry_path)
            
            result = {
                "name": entry_name,
                "type": "folder" if is_dir else "file"
            }
            
            if is_dir and recursive:
                try:
                    children = []
                    # sorted for consistent order
                    for child in sorted(os.listdir(entry_path)):
                        child_path = os.path.join(entry_path, child)
                        child_data = process_entry(child_path)
                        if child_data:
                            children.append(child_data)
                    
                    if children:
                        result["children"] = children
                except PermissionError:
                    pass # Skip if permission denied
            
            return result

        return process_entry(path)
    except Exception as e:
        print(f"Error getting structure: {e}")
        return None

def format_data(data, format_type):
    if format_type == 'json':
        return json.dumps(data, indent=2)
    elif format_type == 'txt':
        return format_to_txt(data)
    elif format_type == 'xml':
        return format_to_xml(data)
    elif format_type == 'mermaid':
        return format_to_mermaid(data)
    elif format_type == 'dot':
        return format_to_dot(data)
    return str(data)

def format_to_txt(data, indent=''):
    result = ''
    if isinstance(data, list):
        for item in data:
            result += format_to_txt(item, indent)
    else:
        icon = '📁' if data['type'] == 'folder' else '📄'
        result += f"{indent}{icon} {data['name']}\n"
        if 'children' in data:
            for child in data['children']:
                result += format_to_txt(child, indent + '  ')
    return result

def format_to_xml(data):
    def to_xml(item):
        if item['type'] == 'file':
            return f'<file name="{item["name"]}"/>'
        result = f'<folder name="{item["name"]}">'
        if 'children' in item:
            result += ''.join(to_xml(child) for child in item['children'])
        return result + '</folder>'
    
    content = ""
    if isinstance(data, list):
        content = "".join(to_xml(item) for item in data)
    else:
        content = to_xml(data)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<root>{content}</root>'

def format_to_mermaid(data):
    result = 'graph TD\n'
    id_counter = 0

    def process_item(item, parent_id=None):
        nonlocal id_counter
        current_id = f'id{id_counter}'
        id_counter += 1
        icon = '📁' if item['type'] == 'folder' else '📄'
        # Sanitize name for mermaid label
        safe_name = item["name"].replace('"', "'").replace('[', '(').replace(']', ')')
        result = f'    {current_id}["{icon} {safe_name}"]\n'
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

def format_to_dot(data):
    result = 'digraph FolderStructure {\n'
    id_counter = 0

    def process_item(item, parent_id=None):
        nonlocal id_counter
        current_id = f'id{id_counter}'
        id_counter += 1
        shape = 'folder' if item['type'] == 'folder' else 'note'
        safe_name = item["name"].replace('"', '\\"')
        result = f'    {current_id} [label="{safe_name}" shape="{shape}"];\n'
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


# --- UI Components ---

def main(page: ft.Page):
    page.title = "FilePro Premium"
    page.theme_mode = ft.ThemeMode.LIGHT # Start with light, toggleable
    page.padding = 20
    
    # --- Theme Toggle ---
    def toggle_theme(e):
        page.theme_mode = ft.ThemeMode.DARK if page.theme_mode == ft.ThemeMode.LIGHT else ft.ThemeMode.LIGHT
        theme_icon.icon = "brightness_2" if page.theme_mode == ft.ThemeMode.LIGHT else "brightness_7"
        
        # Propagate theme change to terminal if initialized
        # Since we can't easily reach into the class instance from here without reference, 
        # we can rely on the fact that page.update() triggers UI refresh, but manual property updates 
        # inside components might need a trigger. 
        # Ideally we'd use a broadcast or dependency injection, but for now let's just update the page.
        # Adding a hack to update terminal colors if it exists in the scope
        if 'terminal_tab' in locals():
            terminal_tab.update_theme_colors()
            
        page.update()

    theme_icon = ft.IconButton(
        "brightness_2", 
        on_click=toggle_theme,
        tooltip="Toggle Dark Mode"
    )

    # --- File Mapper Tab ---
# ... (lines 156-783 match existing content roughly, but I only need to target the specific blocks)
# Actually, I should use separate replacements or just target the Icon block first, then the EOF block.

# Let's do two chunks or just replace the Theme Toggle block and the main block separately.
# The tool allow_multiple=False, so I'll do the theme toggle first.

# Wait, replace_file_content is for *single contiguous block*.
# I will use multi_replace.


    # --- File Mapper Tab ---
    class FileMapperTab(ft.Column):
        def __init__(self):
            super().__init__()
            self.expand = True
            self.spacing = 20
            
            self.selected_path = None
            self.folder_text = ft.Text("No folder selected", italic=True)
            self.preview_text = ft.TextField(
                multiline=True, 
                read_only=True, 
                min_lines=10, 
                max_lines=20,
                text_size=12,
                expand=True,
                border_color="outline"
            )
            self.format_dropdown = ft.Dropdown(
                width=150,
                options=[
                    ft.dropdown.Option("txt", "Text"),
                    ft.dropdown.Option("json", "JSON"),
                    ft.dropdown.Option("xml", "XML"),
                    ft.dropdown.Option("mermaid", "Mermaid"),
                    ft.dropdown.Option("dot", "DOT"),
                ],
                value="txt",
                label="Format",
                on_change=self.update_preview
            )
            self.save_dlg = ft.FilePicker(on_result=self.save_file_result)
            self.folder_picker = ft.FilePicker(on_result=self.pick_folder_result)
            
            self.controls = [
                ft.Row(
                    [
                        ft.ElevatedButton(
                            "Select Folder",
                            icon="folder_open",
                            on_click=lambda _: self.folder_picker.get_directory_path(),
                            style=ft.ButtonStyle(
                                color={ft.MaterialState.DEFAULT: "white"},
                                bgcolor={ft.MaterialState.DEFAULT: "blue700"},
                                shape=ft.RoundedRectangleBorder(radius=8),
                            )
                        ),
                        self.folder_text,
                    ],
                    alignment=ft.MainAxisAlignment.START,
                    vertical_alignment=ft.CrossAxisAlignment.CENTER,
                ),
                ft.Divider(),
                ft.Row(
                    [
                        ft.Text("Preview Structure", size=16, weight=ft.FontWeight.BOLD),
                        ft.Container(expand=True),
                        self.format_dropdown,
                        ft.ElevatedButton(
                            "Save Structure",
                            icon="save",
                            on_click=self.save_structure_click,
                            style=ft.ButtonStyle(
                                color={ft.MaterialState.DEFAULT: "white"},
                                bgcolor={ft.MaterialState.DEFAULT: "green600"},
                                shape=ft.RoundedRectangleBorder(radius=8),
                            )
                        )
                    ]
                ),
                ft.Container(
                    content=self.preview_text,
                    expand=True,
                    border=ft.border.all(1, "outline"),
                    border_radius=8,
                    padding=10,
                    bgcolor="surfaceVariant" if self.page and self.page.theme_mode == ft.ThemeMode.LIGHT else "surfaceVariant",
                )
            ]

        def did_mount(self):
            self.page.overlay.append(self.save_dlg)
            self.page.overlay.append(self.folder_picker)
            self.update()

        def pick_folder_result(self, e):
            if e.path:
                self.selected_path = e.path
                self.folder_text.value = f"Selected: {e.path}"
                self.folder_text.italic = False
                self.folder_text.weight = ft.FontWeight.BOLD
                self.update_preview()
                self.update()

        def update_preview(self, e=None):
            if not self.selected_path:
                return
            
            # Show loading
            self.preview_text.value = "Generating preview..."
            self.update()

            # Process in background (simulated for now, purely synchronous is OK for small trees)
            structure = get_structure_data(self.selected_path)
            formatted = format_data(structure, self.format_dropdown.value)
            self.preview_text.value = formatted
            self.update()

        def save_structure_click(self, e):
            if not self.preview_text.value or not self.selected_path:
                self.page.show_snack_bar(ft.SnackBar(ft.Text("No data to save. Select a folder first.")))
                return
            
            ext = self.format_dropdown.value
            file_name_preset = f"folder_structure.{ext}"
            self.save_dlg.save_file(
                dialog_title="Save Structure",
                file_name=file_name_preset,
                allowed_extensions=[ext]
            )

        def save_file_result(self, e):
            if e.path:
                try:
                    with open(e.path, "w", encoding="utf-8") as f:
                        f.write(self.preview_text.value)
                    self.page.show_snack_bar(ft.SnackBar(ft.Text(f"Saved to {e.path}"), open=True))
                except Exception as ex:
                    self.page.show_snack_bar(ft.SnackBar(ft.Text(f"Error saving: {ex}"), open=True))

    # --- File Copy Tab ---
    class FileCopyTab(ft.Column):
        def __init__(self):
            super().__init__()
            self.expand = True
            self.spacing = 10
            self.source_path = None
            self.dest_path = None
            self.source_text = ft.Text("No source selected", italic=True)
            self.dest_text = ft.Text("No destination selected", italic=True)
            self.file_tree_col = ft.Column(scroll=ft.ScrollMode.AUTO, expand=True)
            self.include_subdirs = ft.Checkbox(label="Include Subdirectories", value=True)
            self.overwrite = ft.Checkbox(label="Overwrite Existing Files", value=False)
            self.preserve_metadata = ft.Checkbox(label="Preserve Metadata", value=False)
            self.progress_bar = ft.ProgressBar(value=0, visible=False)
            self.status_text = ft.Text("")
            self.selected_items = set() 
            
            self.source_picker = ft.FilePicker(on_result=self.pick_source_result)
            self.dest_picker = ft.FilePicker(on_result=self.pick_dest_result)

            self.controls = [
                ft.Container(
                    content=ft.Column([
                        ft.Row([
                            ft.ElevatedButton("Select Source", icon="folder", on_click=lambda _: self.source_picker.get_directory_path()),
                            self.source_text
                        ]),
                        ft.Row([
                            ft.ElevatedButton("Select Destination", icon="drive_file_move", on_click=lambda _: self.dest_picker.get_directory_path()),
                            self.dest_text
                        ]),
                    ]),
                    padding=10,
                    border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                    border_radius=8
                ),
                ft.Text("Select items to copy:", weight=ft.FontWeight.BOLD),
                ft.Container(
                    content=self.file_tree_col,
                    expand=True,
                    border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                    border_radius=8,
                    padding=10
                ),
                ft.Row([self.include_subdirs, self.overwrite, self.preserve_metadata]),
                self.progress_bar,
                self.status_text,
                ft.ElevatedButton(
                    "Start Copy", 
                    icon="copy_all", 
                    on_click=self.start_copy,
                    style=ft.ButtonStyle(
                        bgcolor={ft.MaterialState.DEFAULT: "blue600"},
                        color={ft.MaterialState.DEFAULT: "white"},
                    )
                )
            ]

        def did_mount(self):
            self.page.overlay.extend([self.source_picker, self.dest_picker])
            self.update()

        def pick_source_result(self, e):
            if e.path:
                self.source_path = e.path
                self.source_text.value = f"Source: {e.path}"
                self.source_text.italic = False
                self.source_text.weight = ft.FontWeight.BOLD
                self.populate_tree(self.source_path)
                self.update()

        def pick_dest_result(self, e):
            if e.path:
                self.dest_path = e.path
                self.dest_text.value = f"Destination: {e.path}"
                self.dest_text.italic = False
                self.dest_text.weight = ft.FontWeight.BOLD
                self.update()

        def populate_tree(self, path):
            self.file_tree_col.controls.clear()
            self.selected_items.clear()
            try:
                # Top level items only for simplicity in this demo, checkable
                processed_items = sorted(os.listdir(path))
                if not processed_items:
                     self.file_tree_col.controls.append(ft.Text("Empty folder"))
                else:
                    for item_name in processed_items:
                        full_path = os.path.join(path, item_name)
                        is_dir = os.path.isdir(full_path)
                        icon = "folder" if is_dir else "insert_drive_file"
                        
                        cb = ft.Checkbox(
                            label=item_name, 
                            value=True, 
                            data=full_path,
                            on_change=self.item_checked
                        )
                        self.selected_items.add(full_path)
                        self.file_tree_col.controls.append(ft.Row([ft.Icon(icon), cb]))
            except Exception as e:
                self.status_text.value = f"Error reading source: {e}"
            self.update()

        def item_checked(self, e):
            path = e.control.data
            if e.control.value:
                self.selected_items.add(path)
            else:
                self.selected_items.discard(path)

        def start_copy(self, e):
            if not self.source_path or not self.dest_path:
                self.page.show_snack_bar(ft.SnackBar(ft.Text("Please select source and destination.")))
                return
            if not self.selected_items:
                self.page.show_snack_bar(ft.SnackBar(ft.Text("No items selected to copy.")))
                return

            self.progress_bar.visible = True
            self.status_text.value = "Starting copy..."
            self.update()
            
            t = threading.Thread(target=self.run_copy_logic)
            t.start()

        def run_copy_logic(self):
            try:
                total = len(self.selected_items)
                count = 0
                for src_path in self.selected_items:
                    rel_path = os.path.relpath(src_path, self.source_path)
                    dest_full_path = os.path.join(self.dest_path, rel_path)
                    
                    count += 1
                    # Update status safely from thread? Flet might need logic, but page.update is usually thread-safe in recent versions or just works.
                    # Ideally use page.run_task or similar, but for now direct update:
                    self.status_text.value = f"Copying {rel_path}..."
                    self.progress_bar.value = count / total if total > 0 else 0
                    self.update()

                    if os.path.isdir(src_path):
                        if self.include_subdirs.value:
                            shutil.copytree(src_path, dest_full_path, dirs_exist_ok=self.overwrite.value)
                    else:
                        os.makedirs(os.path.dirname(dest_full_path), exist_ok=True)
                        if self.preserve_metadata.value:
                            shutil.copy2(src_path, dest_full_path)
                        else:
                            shutil.copy(src_path, dest_full_path)
                
                self.status_text.value = f"Successfully copied {count} items."
                self.page.show_snack_bar(ft.SnackBar(ft.Text("Copy completed successfully."), open=True))
            except Exception as e:
                self.status_text.value = f"Error during copy: {e}"
                print(f"Copy Error: {e}")
            finally:
                self.progress_bar.visible = False
                self.update()

    # --- Folder Creation Tab ---
    class FolderCreationTab(ft.Column):
        def __init__(self):
            super().__init__()
            self.spacing = 20
            self.root_path = None
            self.root_text = ft.Text("No user root folder selected", italic=True)
            self.num_folders = ft.TextField(label="Number of Main Folders", value="1", width=200, keyboard_type=ft.KeyboardType.NUMBER, on_change=self.update_preview)
            self.folder_prefix = ft.TextField(label="Main Folder Prefix", value="Project", expand=True, on_change=self.update_preview)
            self.subfolders = ft.TextField(label="Subfolder Names (comma-separated)", value="Docs, Images, Src", expand=True, on_change=self.update_preview)
            self.use_date = ft.Checkbox(label="Use Date Prefix", value=False, on_change=self.update_preview)
            self.date_fmt = ft.Dropdown(
                label="Date Format",
                options=[
                    ft.dropdown.Option("YYYY-MM-DD"),
                    ft.dropdown.Option("YYYYMMDD"),
                    ft.dropdown.Option("DD-MM-YYYY"),
                    ft.dropdown.Option("MM-DD-YYYY"),
                ],
                value="YYYY-MM-DD",
                width=150,
                on_change=self.update_preview
            )
            self.preview_text = ft.TextField(multiline=True, read_only=True, min_lines=5, max_lines=10)
            self.status_text = ft.Text("")
            
            self.root_picker = ft.FilePicker(on_result=self.pick_root_result)

            self.controls = [
                ft.Container(
                    content=ft.Row([
                         ft.ElevatedButton("Select Root Folder", icon="folder_open", on_click=lambda _: self.root_picker.get_directory_path()),
                         self.root_text
                    ]),
                    padding=10,
                    border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                    border_radius=8
                ),
                ft.Row([self.num_folders, self.use_date, self.date_fmt]),
                ft.Row([self.folder_prefix, self.subfolders]),
                ft.Container(
                    content=self.preview_text,
                    border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                    border_radius=8,
                    padding=10
                ),
                self.status_text,
                ft.ElevatedButton(
                    "Create Folders",
                    icon="create_new_folder",
                    on_click=self.create_folders,
                    style=ft.ButtonStyle(
                        bgcolor={ft.MaterialState.DEFAULT: ft.colors.BLUE_600},
                        color={ft.MaterialState.DEFAULT: ft.colors.WHITE},
                    )
                )
            ]

        def did_mount(self):
            self.page.overlay.append(self.root_picker)
            self.update()

        def pick_root_result(self, e):
            if e.path:
                self.root_path = e.path
                self.root_text.value = f"Selected: {e.path}"
                self.root_text.italic = False
                self.root_text.weight = ft.FontWeight.BOLD
                self.update()

        def update_preview(self, e=None):
            try:
                num = int(self.num_folders.value) if self.num_folders.value.isdigit() else 0
                prefix = self.folder_prefix.value
                subs = [s.strip() for s in self.subfolders.value.split(',') if s.strip()]
                
                date_str = ""
                if self.use_date.value:
                    fmt = self.date_fmt.value.replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                    date_str = datetime.datetime.now().strftime(fmt) + "_"
                
                preview = "Folder Structure Preview:\n\n"
                # Show first 3 only
                limit = min(num, 3)
                for i in range(1, limit + 1):
                    main_name = f"{date_str}{i:02d} - {prefix}"
                    preview += f"├── {main_name}\n"
                    for sub in subs:
                        preview += f"│   ├── {sub}\n"
                
                if num > 3:
                     preview += "└── ... (more folders)\n"
                
                self.preview_text.value = preview
                self.update()
            except Exception:
                pass

        def create_folders(self, e):
            if not self.root_path:
                self.page.show_snack_bar(ft.SnackBar(ft.Text("Please select a root folder.")))
                return
            
            try:
                num = int(self.num_folders.value)
                prefix = self.folder_prefix.value
                subs = [s.strip() for s in self.subfolders.value.split(',') if s.strip()]
                
                date_str = ""
                if self.use_date.value:
                    fmt = self.date_fmt.value.replace("YYYY", "%Y").replace("MM", "%m").replace("DD", "%d")
                    date_str = datetime.datetime.now().strftime(fmt) + "_"
                
                count = 0
                for i in range(1, num + 1):
                    main_name = f"{date_str}{i:02d} - {prefix}"
                    main_path = os.path.join(self.root_path, main_name)
                    os.makedirs(main_path, exist_ok=True)
                    count += 1
                    
                    for sub in subs:
                        sub_path = os.path.join(main_path, sub)
                        os.makedirs(sub_path, exist_ok=True)
                        count += 1
                
                self.status_text.value = f"Created {count} folders successfully."
                self.page.show_snack_bar(ft.SnackBar(ft.Text("Folders created successfully."), open=True))
                self.update()
            except Exception as ex:
                self.status_text.value = f"Error: {ex}"
                self.update()

    # --- Empty File Creation Tab ---
    class EmptyFileCreationTab(ft.Column):
        def __init__(self):
            super().__init__()
            self.spacing = 20
            self.folder_path = None
            self.folder_text = ft.Text("No folder selected", italic=True)
            self.extensions = ft.TextField(label="Extensions (e.g. .txt, .csv)", value=".txt", expand=True, on_change=self.update_preview)
            self.num_files = ft.TextField(label="Number of Files", value="1", width=150, keyboard_type=ft.KeyboardType.NUMBER, on_change=self.update_preview)
            self.prefix = ft.TextField(label="Prefix", value="file", width=200, on_change=self.update_preview)
            self.suffix = ft.TextField(label="Suffix", value="", width=200, on_change=self.update_preview)
            self.separator = ft.TextField(label="Separator", value="_", width=100, on_change=self.update_preview)
            self.numbering_fmt = ft.Dropdown(
                label="Numbering",
                options=[ft.dropdown.Option("1"), ft.dropdown.Option("01"), ft.dropdown.Option("001"), ft.dropdown.Option("0001")],
                value="001",
                width=100,
                on_change=self.update_preview
            )
            self.use_timestamp = ft.Checkbox(label="Include Timestamp", value=False, on_change=self.update_preview)
            self.preview_text = ft.TextField(multiline=True, read_only=True, min_lines=5, max_lines=10)
            self.status_text = ft.Text("")
            
            self.folder_picker = ft.FilePicker(on_result=self.pick_folder_result)

            self.controls = [
                ft.Container(
                    content=ft.Row([
                         ft.ElevatedButton("Select Folder", icon="folder_open", on_click=lambda _: self.folder_picker.get_directory_path()),
                         self.folder_text
                    ]),
                    padding=10,
                    border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                    border_radius=8
                ),
                ft.Row([self.extensions, self.num_files]),
                ft.Row([self.prefix, self.separator, self.suffix]),
                ft.Row([self.numbering_fmt, self.use_timestamp]),
                ft.Container(
                    content=self.preview_text,
                    border=ft.border.all(1, ft.colors.OUTLINE_VARIANT),
                    border_radius=8,
                    padding=10
                ),
                self.status_text,
                ft.ElevatedButton(
                    "Create Empty Files",
                    icon="note_add",
                    on_click=self.create_files,
                    style=ft.ButtonStyle(
                        bgcolor={ft.MaterialState.DEFAULT: ft.colors.BLUE_600},
                        color={ft.MaterialState.DEFAULT: ft.colors.WHITE},
                    )
                )
            ]

        def did_mount(self):
            self.page.overlay.append(self.folder_picker)
            self.update()

        def pick_folder_result(self, e):
            if e.path:
                self.folder_path = e.path
                self.folder_text.value = f"Selected: {e.path}"
                self.folder_text.italic = False
                self.folder_text.weight = ft.FontWeight.BOLD
                self.update()

        def construct_filename(self, i):
            prefix_val = self.prefix.value
            suffix_val = self.suffix.value
            sep_val = self.separator.value
            fmt = self.numbering_fmt.value
            
            num_str = str(i)
            if fmt == "01": num_str = f"{i:02d}"
            elif fmt == "001": num_str = f"{i:03d}"
            elif fmt == "0001": num_str = f"{i:04d}"
            
            timestamp_str = ""
            if self.use_timestamp.value:
                timestamp_str = datetime.datetime.now().strftime("%H%M%S") + sep_val
            
            # Pattern: prefix + sep + timestamp + number + suffix
            parts = [p for p in [prefix_val, timestamp_str + num_str, suffix_val] if p]
            return sep_val.join(parts) # Actually join might double separators if not careful, sticking to simple logic
            
            # Simple logic: prefix_timestamp_number_suffix but better
            name = f"{prefix_val}{sep_val}{timestamp_str}{num_str}"
            if suffix_val:
                name += f"{sep_val}{suffix_val}"
            return name

        def update_preview(self, e=None):
            try:
                num = int(self.num_files.value) if self.num_files.value.isdigit() else 0
                exts = [x.strip() for x in self.extensions.value.split(',') if x.strip()]
                
                preview = "File Creation Preview:\n\n"
                limit = min(num, 5)
                for i in range(1, limit + 1):
                    base = self.construct_filename(i)
                    for ext in exts:
                        preview += f"{base}{ext}\n"
                if num > 5:
                    preview += "... (more files)\n"
                
                self.preview_text.value = preview
                self.update()
            except Exception:
                pass

        def create_files(self, e):
            if not self.folder_path:
                self.page.show_snack_bar(ft.SnackBar(ft.Text("Please select a folder.")))
                return
            
            try:
                num = int(self.num_files.value)
                exts = [x.strip() for x in self.extensions.value.split(',') if x.strip()]
                if not exts:
                    self.page.show_snack_bar(ft.SnackBar(ft.Text("Please specify extensions.")))
                    return

                count = 0
                for i in range(1, num + 1):
                    base = self.construct_filename(i)
                    for ext in exts:
                        full_name = f"{base}{ext}"
                        full_path = os.path.join(self.folder_path, full_name)
                        if not os.path.exists(full_path):
                            with open(full_path, 'w') as f:
                                pass
                            count += 1
                
                self.status_text.value = f"Created {count} files successfully."
                self.page.show_snack_bar(ft.SnackBar(ft.Text("Files created successfully."), open=True))
                self.update()
            except Exception as ex:
                self.status_text.value = f"Error: {ex}"
                self.update()


    # --- Terminal Tab ---
    class TerminalTab(ft.Column):
        def __init__(self):
            super().__init__()
            self.expand = True
            self.cwd = os.getcwd()
            self.output_text = ft.TextField(
                value=f"Welcome to FilePro Terminal\nCurrent Directory: {self.cwd}\n",
                multiline=True,
                read_only=True,
                text_size=12,
                cursor_color="green",
                text_style=ft.TextStyle(font_family="Consolas, monospace"),
                expand=True,
                border_color="transparent",
            )
            self.cmd_input = ft.TextField(
                label="Command",
                hint_text="Enter command (e.g., ls, cd ..)",
                text_size=13,
                text_style=ft.TextStyle(font_family="Consolas, monospace"),
                expand=True,
                on_submit=self.execute_command
            )
            self.ai_mode = ft.Switch(label="AI Assistant", value=False, on_change=self.toggle_ai_mode)
            self.run_btn = ft.ElevatedButton("Run", icon="play_arrow", on_click=self.execute_command)
            
            self.controls = [
                ft.Container(
                    content=self.output_text,
                    expand=True,
                    # We will set a default color, darker for terminal feel usually, 
                    # but respects theme in did_mount
                    # We will set a default color, darker for terminal feel usually, 
                    # but respects theme in did_mount
                    bgcolor="#ECEFF1", 
                    border_radius=8,
                    padding=10,
                ),
                ft.Row(
                    [
                        ft.Text("$", weight=ft.FontWeight.BOLD),
                        self.cmd_input,
                        self.ai_mode,
                        self.run_btn
                    ],
                    alignment=ft.MainAxisAlignment.CENTER
                )
            ]

        def did_mount(self):
            self.update_theme_colors()
            self.update()

        def toggle_ai_mode(self, e):
            is_ai = self.ai_mode.value
            self.cmd_input.label = "Ask AI" if is_ai else "Command"
            self.cmd_input.hint_text = "Describe a task (e.g., 'Organize my desktop')..." if is_ai else "Enter command (e.g., ls, cd ..)"
            self.run_btn.text = "Ask" if is_ai else "Run"
            self.run_btn.icon = "auto_awesome" if is_ai else "play_arrow"
            self.update()

        def update_theme_colors(self):
            if not self.page: return
            is_dark = self.page.theme_mode == ft.ThemeMode.DARK
            # Update container background
            self.controls[0].bgcolor = "black" if is_dark else "#ECEFF1"
            # Update text color
            self.output_text.color = "green" if is_dark else "black"
            self.cmd_input.border_color = "outline"
            self.update()
            
        def execute_command(self, e):
            cmd = self.cmd_input.value.strip()
            if not cmd:
                return
            
            if self.ai_mode.value:
                self.output_text.value += f"\n(AI) > {cmd}\n"
                self.output_text.value += "AI: I can help you with that! (AI integration coming soon...)\n"
                self.cmd_input.value = ""
                self.update()
                return

            self.output_text.value += f"\n$ {cmd}\n"
            self.cmd_input.value = ""
            self.update()
            
            # Special handling for CD
            if cmd.startswith("cd "):
                try:
                    target_dir = cmd[3:].strip()
                    # Handle empty path or quoted path roughly if needed, usually os.chdir handles simple paths
                    os.chdir(target_dir)
                    self.cwd = os.getcwd()
                    self.output_text.value += f"Changed directory to: {self.cwd}\n"
                except Exception as ex:
                    self.output_text.value += f"Error: {ex}\n"
            else:
                try:
                    # Run command
                    res = subprocess.run(
                        cmd, 
                        shell=True, 
                        cwd=self.cwd,
                        capture_output=True,
                        text=True
                    )
                    if res.stdout:
                        self.output_text.value += res.stdout
                    if res.stderr:
                        self.output_text.value += res.stderr
                except Exception as ex:
                    self.output_text.value += f"Execution Error: {ex}\n"
            
            self.update()

    # --- Main Layout ---
    
    file_mapper = FileMapperTab()
    file_copy = FileCopyTab()
    folder_creation = FolderCreationTab()
    empty_file_creation = EmptyFileCreationTab()
    terminal_tab = TerminalTab()
    
    # Placeholder for other tabs
    tabs = ft.Tabs(
        selected_index=0,
        animation_duration=300,
        tabs=[
            ft.Tab(
                text="File Mapper",
                icon="account_tree",
                content=ft.Container(
                    content=file_mapper,
                    padding=20
                )
            ),
            ft.Tab(
                text="File Copy",
                icon="copy_all",
                content=ft.Container(
                    content=file_copy,
                    padding=20
                )
            ),
            ft.Tab(
                text="Folder Creation",
                icon="create_new_folder",
                content=ft.Container(
                    content=folder_creation,
                    padding=20
                )
            ),
            ft.Tab(
                text="Empty File Creation",
                icon="note_add",
                content=ft.Container(
                    content=empty_file_creation,
                    padding=20
                )
            ),
            ft.Tab(
                text="Tool & Terminal",
                icon="terminal",
                content=ft.Container(
                    content=terminal_tab,
                    padding=20
                )
            ),
        ],
        expand=True,
    )

    page.add(
        ft.Row(
            [
                ft.Text("FilePro Premium", size=24, weight=ft.FontWeight.BOLD, color="blue800"),
                ft.Container(expand=True),
                theme_icon
            ],
            alignment=ft.MainAxisAlignment.SPACE_BETWEEN
        ),
        tabs
    )

if __name__ == "__main__":
    ft.app(target=main)
