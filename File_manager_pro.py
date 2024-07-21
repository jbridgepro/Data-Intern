import sys
import os
import tkinter as tk
from tkinter import ttk
from tkinter import font as tkfont

from Copy_and_Paste_tab import CopyandPaste
from folder_creation_tab import FolderCreationTab
from file_creation_tab import FileCreationTab
from find_replace_tab import FindReplaceTab

class FileManagerProApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("File Manager Pro")
        self.geometry("900x700")
        self.minsize(800, 600)

        self.style = ttk.Style(self)
        self.create_notebook()
        
        print("Initializing File Manager Pro...")
        
        # Color scheme
        self.bg_color = "#f0f0f0"
        self.accent_color = "#4a90e2"
        self.text_color = "#333333"
        self.button_color = "#4a90e2"
        self.button_text_color = "white"

        # Fonts
        self.title_font = tkfont.Font(family="Helvetica", size=16, weight="bold")
        self.label_font = tkfont.Font(family="Helvetica", size=10)
        self.button_font = tkfont.Font(family="Helvetica", size=10, weight="bold")

        # Set the application style
        self.style = ttk.Style(self)
        self.style.theme_use('clam')  # You can try different themes like 'alt', 'default', 'classic'

        # Create the main frame
        main_frame = ttk.Frame(self)
        main_frame.pack(fill=tk.BOTH, expand=True)

        # Create the tab widget
        self.tab_widget = ttk.Notebook(main_frame)
        self.tab_widget.pack(fill=tk.BOTH, expand=True)

        # Create tabs
        print("Creating Copy & Paste Tab...")
        self.Copy_and_Paste_tab = CopyandPaste(self.tab_widget, self)
        print("Creating Folder Creation Tab...")
        self.folder_creation_tab = FolderCreationTab(self.tab_widget, self)
        print("Creating File Creation Tab...")
        self.file_creation_tab = FileCreationTab(self.tab_widget, self)
        print("Creating Find & Replace Tab...")
        self.find_replace_tab = FindReplaceTab(self.tab_widget, self)

        # Add tabs to the tab widget
        print("Adding tabs to tab widget...")
        self.tab_widget.add(self.Copy_and_Paste_tab, text="Copy & Paste")
        self.tab_widget.add(self.folder_creation_tab, text="Folder Creation")
        self.tab_widget.add(self.file_creation_tab, text="File Creation")
        self.tab_widget.add(self.find_replace_tab, text="Find & Replace")

        self.set_style()

        print("File Manager Pro initialization complete.")

    def set_style(self):
        # Configure styles for various widgets
        self.style.configure('TFrame', background=self.bg_color)
        self.style.configure('TNotebook', background=self.bg_color)
        self.style.configure('TNotebook.Tab', background=self.bg_color, foreground=self.text_color)
        self.style.map('TNotebook.Tab', background=[('selected', self.accent_color)], 
                       foreground=[('selected', self.button_text_color)])
        self.style.configure('TButton', background=self.button_color, foreground=self.button_text_color, 
                             font=self.button_font)
        self.style.configure('TLabel', background=self.bg_color, foreground=self.text_color, 
                             font=self.label_font)
        self.style.configure('TEntry', foreground=self.text_color, font=self.label_font)

if __name__ == "__main__":
    try:
        app = FileManagerProApp()
        app.mainloop()
    except Exception as e:
        print(f"An error occurred: {e}")
        sys.exit(1)
