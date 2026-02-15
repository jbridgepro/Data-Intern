import flet as ft
from src.ui.tabs.file_mapper import FileMapperTab
from src.ui.tabs.file_copy import FileCopyTab
from src.ui.tabs.folder_creation import FolderCreationTab
from src.ui.tabs.empty_file_creation import EmptyFileCreationTab
from src.ui.tabs.terminal import TerminalTab

class FileProApp:
    def __init__(self, page: ft.Page):
        self.page = page
        self.page.title = "FilePro Premium"
        self.page.theme_mode = ft.ThemeMode.LIGHT
        self.page.padding = 20
        self.page.window_width = 1200
        self.page.window_height = 800
        self.page.window_resizable = True
        
        # State management
        self.selected_index = 0
        self.views = []
        self.buttons = []
        
        # Initialize UI components
        self.init_ui()
    
    def init_ui(self):
        # Initialize all tabs FIRST
        self.file_mapper = FileMapperTab()
        self.file_copy = FileCopyTab()
        self.folder_creation = FolderCreationTab()
        self.empty_file_creation = EmptyFileCreationTab()
        self.terminal_tab = TerminalTab()
        
        self.views = [
            self.file_mapper,
            self.file_copy,
            self.folder_creation,
            self.empty_file_creation,
            self.terminal_tab
        ]
        
        # Register all FilePickers with page overlay BEFORE building UI
        self.register_file_pickers()
        
        # Theme toggle button
        self.theme_icon = ft.IconButton(
            icon="brightness_2", 
            on_click=self.toggle_theme,
            tooltip="Toggle Dark Mode"
        )
        
        # Navigation bar
        self.create_navigation()
        
        # Main content area
        self.body = ft.Container(
            content=self.views[0], 
            expand=True, 
            padding=20, 
            border=ft.border.all(1, "outlineVariant"), 
            border_radius=10
        )
        
        # Layout - add to page
        self.page.add(
            ft.Column([
                ft.Row([
                    ft.Text("FilePro Premium", size=24, weight=ft.FontWeight.BOLD, color="blue800"),
                    ft.Container(expand=True),
                    self.theme_icon
                ], alignment=ft.MainAxisAlignment.SPACE_BETWEEN),
                ft.Container(height=10),
                self.nav_bar,
                ft.Divider(),
                self.body
            ], expand=True)
        )
        
        # Update page to render everything
        self.page.update()
    
    def create_navigation(self):
        nav_items = [
            {"icon": "account_tree", "label": "File Mapper"},
            {"icon": "copy_all", "label": "File Copy"},
            {"icon": "create_new_folder", "label": "Folder Creation"},
            {"icon": "note_add", "label": "Empty Files"},
            {"icon": "terminal", "label": "Terminal"},
        ]
        
        self.buttons = []
        for i, item in enumerate(nav_items):
            is_selected = i == self.selected_index
            btn = ft.ElevatedButton(
                content=ft.Row([
                    ft.Icon(item["icon"]),
                    ft.Text(item["label"])
                ], tight=True),
                data=i,
                on_click=self.on_nav_click,
                style=ft.ButtonStyle(
                    shape=ft.RoundedRectangleBorder(radius=8),
                    color={ft.ControlState.DEFAULT: "white" if is_selected else "onSurface"},
                    bgcolor={ft.ControlState.DEFAULT: "blue700" if is_selected else "transparent"},
                    elevation={ft.ControlState.DEFAULT: 0},
                )
            )
            self.buttons.append(btn)
        
        self.nav_bar = ft.Row(
            controls=self.buttons,
            scroll=ft.ScrollMode.ALWAYS,
            alignment=ft.MainAxisAlignment.START,
        )
    
    def on_nav_click(self, e):
        idx = e.control.data
        self.selected_index = idx
        
        # Update body content
        self.body.content = self.views[idx]
        
        # Update button styles
        for i, btn in enumerate(self.buttons):
            is_selected = i == idx
            btn.style.color = {ft.ControlState.DEFAULT: "white" if is_selected else "onSurface"}
            btn.style.bgcolor = {ft.ControlState.DEFAULT: "blue700" if is_selected else "transparent"}
            if not is_selected:
                btn.style.bgcolor = {ft.ControlState.HOVERED: "blue50"}
        
        self.page.update()
    
    def register_file_pickers(self):
        """Register all FilePicker controls from tabs to page overlay and set callbacks"""
        # File Mapper tab
        if hasattr(self.file_mapper, 'save_dlg'):
            self.file_mapper.save_dlg.on_result = self.file_mapper.save_file_result
            self.page.overlay.append(self.file_mapper.save_dlg)
        if hasattr(self.file_mapper, 'folder_picker'):
            self.file_mapper.folder_picker.on_result = self.file_mapper.pick_folder_result
            self.page.overlay.append(self.file_mapper.folder_picker)
        
        # File Copy tab
        if hasattr(self.file_copy, 'source_picker'):
            self.file_copy.source_picker.on_result = self.file_copy.pick_source_result
            self.page.overlay.append(self.file_copy.source_picker)
        if hasattr(self.file_copy, 'dest_picker'):
            self.file_copy.dest_picker.on_result = self.file_copy.pick_dest_result
            self.page.overlay.append(self.file_copy.dest_picker)
        
        # Folder Creation tab
        if hasattr(self.folder_creation, 'root_picker'):
            self.folder_creation.root_picker.on_result = self.folder_creation.pick_root_result
            self.page.overlay.append(self.folder_creation.root_picker)
        
        # Empty File Creation tab
        if hasattr(self.empty_file_creation, 'folder_picker'):
            self.empty_file_creation.folder_picker.on_result = self.empty_file_creation.pick_folder_result
            self.page.overlay.append(self.empty_file_creation.folder_picker)
    
    def toggle_theme(self, e):
        self.page.theme_mode = ft.ThemeMode.DARK if self.page.theme_mode == ft.ThemeMode.LIGHT else ft.ThemeMode.LIGHT
        self.theme_icon.icon = "brightness_2" if self.page.theme_mode == ft.ThemeMode.LIGHT else "brightness_7"
        
        # Propagate theme change to all tabs
        for view in self.views:
            if hasattr(view, 'update_theme_colors'):
                view.update_theme_colors()
        
        self.page.update()

def main(page: ft.Page):
    app = FileProApp(page)
    return app
