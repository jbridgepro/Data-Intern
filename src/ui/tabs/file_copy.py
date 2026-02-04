import flet as ft
import os
import shutil
import threading

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
        
        self.source_picker = ft.FilePicker()
        self.dest_picker = ft.FilePicker()

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
                border=ft.border.all(1, "outline"),
                border_radius=8
            ),
            ft.Text("Select items to copy:", weight=ft.FontWeight.BOLD),
            ft.Container(
                content=self.file_tree_col,
                expand=True,
                border=ft.border.all(1, "outline"),
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
                    bgcolor={ft.ControlState.DEFAULT: "blue600"},
                    color={ft.ControlState.DEFAULT: "white"},
                )
            )
        ]


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
