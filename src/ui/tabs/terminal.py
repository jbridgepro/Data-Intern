import flet as ft
import os
import subprocess

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
