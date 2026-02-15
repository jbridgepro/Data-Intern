import flet as ft
import datetime
import os

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
        )
        self.date_fmt.on_change = self.update_preview
        self.preview_text = ft.TextField(multiline=True, read_only=True, min_lines=5, max_lines=10)
        self.status_text = ft.Text("")
        
        self.root_picker = ft.FilePicker()

        self.controls = [
            ft.Container(
                content=ft.Row([
                        ft.ElevatedButton("Select Root Folder", icon="folder_open", on_click=lambda _: self.root_picker.get_directory_path()),
                        self.root_text
                ]),
                padding=10,
                border=ft.border.all(1, "outline"),
                border_radius=8
            ),
            ft.Row([self.num_folders, self.use_date, self.date_fmt]),
            ft.Row([self.folder_prefix, self.subfolders]),
            ft.Container(
                content=self.preview_text,
                border=ft.border.all(1, "outline"),
                border_radius=8,
                padding=10
            ),
            self.status_text,
            ft.ElevatedButton(
                "Create Folders",
                icon="create_new_folder",
                on_click=self.create_folders,
                style=ft.ButtonStyle(
                    bgcolor={ft.ControlState.DEFAULT: "blue600"},
                    color={ft.ControlState.DEFAULT: "white"},
                )
            )
        ]


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
