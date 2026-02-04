import flet as ft
from src.utils.file_mapper_utils import get_structure_data, format_data

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
        )
        self.format_dropdown.on_change = self.update_preview
        self.save_dlg = ft.FilePicker()
        self.folder_picker = ft.FilePicker()
        
        self.controls = [
            ft.Row(
                [
                    ft.ElevatedButton(
                        "Select Folder",
                        icon="folder_open",
                        on_click=lambda _: self.folder_picker.get_directory_path(),
                        style=ft.ButtonStyle(
                            color={ft.ControlState.DEFAULT: "white"},
                            bgcolor={ft.ControlState.DEFAULT: "blue700"},
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
                            color={ft.ControlState.DEFAULT: "white"},
                            bgcolor={ft.ControlState.DEFAULT: "green600"},
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
                # Note: Theme checking logic moved or simplified
                bgcolor="surfaceVariant", 
            )
        ]


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
