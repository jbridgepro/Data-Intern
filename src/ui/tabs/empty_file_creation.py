import flet as ft
import datetime
import os

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
        )
        self.numbering_fmt.on_change = self.update_preview
        self.use_timestamp = ft.Checkbox(label="Include Timestamp", value=False, on_change=self.update_preview)
        self.preview_text = ft.TextField(multiline=True, read_only=True, min_lines=5, max_lines=10)
        self.status_text = ft.Text("")
        
        self.folder_picker = ft.FilePicker()

        self.controls = [
            ft.Container(
                content=ft.Row([
                        ft.ElevatedButton("Select Folder", icon="folder_open", on_click=lambda _: self.folder_picker.get_directory_path()),
                        self.folder_text
                ]),
                padding=10,
                border=ft.border.all(1, "outline"),
                border_radius=8
            ),
            ft.Row([self.extensions, self.num_files]),
            ft.Row([self.prefix, self.separator, self.suffix]),
            ft.Row([self.numbering_fmt, self.use_timestamp]),
            ft.Container(
                content=self.preview_text,
                border=ft.border.all(1, "outline"),
                border_radius=8,
                padding=10
            ),
            self.status_text,
            ft.ElevatedButton(
                "Create Empty Files",
                icon="note_add",
                on_click=self.create_files,
                style=ft.ButtonStyle(
                    bgcolor={ft.ControlState.DEFAULT: "blue600"},
                    color={ft.ControlState.DEFAULT: "white"},
                )
            )
        ]


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
