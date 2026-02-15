import flet as ft

def main(page: ft.Page):
    page.title = "FilePicker Test"
    
    # Create FilePicker
    file_picker = ft.FilePicker(on_result=lambda e: print(f"Selected: {e.path}"))
    
    # Add to overlay FIRST
    page.overlay.append(file_picker)
    
    # Then add UI
    page.add(
        ft.ElevatedButton(
            "Pick File",
            icon="folder_open",
            on_click=lambda _: file_picker.get_directory_path()
        )
    )

if __name__ == "__main__":
    ft.app(target=main)