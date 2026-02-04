#!/usr/bin/env python3
"""
File: run_file_manager_pro.py
Path: /Users/koo1j/folder-pro app Mac Version/run_file_manager_pro.py

This is a wrapper script to run the File_manager_pro.py file with the correct environment variables
to fix the Qt platform plugin "cocoa" not found error.
"""

import os
import sys
import subprocess
from pathlib import Path

# Try to locate the Qt plugins directory for PyQt6
anaconda_path = Path("/opt/anaconda3")
possible_plugin_paths = [
    Path(os.getcwd()) / "venv" / "lib" / "python3.12" / "site-packages" / "PyQt6" / "Qt6" / "plugins",
    Path(os.getcwd()) / "venv" / "lib" / "python3.12" / "site-packages" / "PyQt6" / "Qt" / "plugins",
    anaconda_path / "lib" / "python3.11" / "site-packages" / "PyQt6" / "Qt6" / "plugins",
    anaconda_path / "lib" / "python3.11" / "site-packages" / "PyQt6" / "Qt" / "plugins",
    anaconda_path / "plugins",
    Path("/usr/local/Cellar/qt/6.8.2/plugins"),  # Homebrew Qt installation
    Path.home() / "Qt" / "6.8.2" / "macos" / "plugins",  # Qt official installation
]

# Find the first existing plugin path
qt_plugin_path = None
for path in possible_plugin_paths:
    if path.exists():
        qt_plugin_path = str(path)
        print(f"Found Qt plugins directory: {qt_plugin_path}")
        break

if qt_plugin_path:
    # Set the environment variable and run the script
    env = os.environ.copy()
    env["QT_QPA_PLATFORM_PLUGIN_PATH"] = qt_plugin_path
    
    print(f"Setting QT_QPA_PLATFORM_PLUGIN_PATH to {qt_plugin_path}")
    print("Running File_manager_pro.py...")
    
    # Try to use the virtual environment's Python interpreter
    venv_python = os.path.join(os.getcwd(), "venv", "bin", "python")
    if os.path.exists(venv_python):
        print(f"Using virtual environment Python interpreter: {venv_python}")
        result = subprocess.run([venv_python, "File_manager_pro.py"], env=env)
        sys.exit(result.returncode)
    # Fall back to Anaconda Python interpreter
    anaconda_python = "/opt/anaconda3/bin/python"
    if os.path.exists(anaconda_python):
        print(f"Using Anaconda Python interpreter: {anaconda_python}")
        result = subprocess.run([anaconda_python, "File_manager_pro.py"], env=env)
        sys.exit(result.returncode)
    else:
        print(f"No suitable Python interpreter found")
        print("Falling back to current Python interpreter")
        result = subprocess.run([sys.executable, "File_manager_pro.py"], env=env)
        sys.exit(result.returncode)
else:
    print("Could not find Qt plugins directory. Please install Qt or PyQt6 properly.")
    print("Trying to run File_manager_pro.py anyway...")
    result = subprocess.run([sys.executable, "File_manager_pro.py"])
    sys.exit(result.returncode)
