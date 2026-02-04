#!/usr/bin/env python3
"""
File: run_allstate_db_exporter.py
Path: /Users/koo1j/folder-pro app Mac Version/run_allstate_db_exporter.py

This is a wrapper script to run the allstate-db-exporter.py file with the correct environment variables
to fix the Qt platform plugin "cocoa" not found error and ensure all dependencies are present.
"""

import os
import sys
import subprocess
import platform
import importlib.util
from pathlib import Path

def check_dependencies():
    """Check if required dependencies are installed"""
    dependencies = {
        "pyodbc": "SQL Server connection support",
        "pandas": "Data processing and export", 
        "sqlalchemy": "Advanced database operations",
        "PyQt6": "Modern GUI interface (primary option)",
        "PyQt5": "GUI interface (backup option)",
        "openpyxl": "Excel export support",
        "xlsxwriter": "Excel export formatting"
    }
    
    missing = []
    
    for package, purpose in dependencies.items():
        if importlib.util.find_spec(package) is None:
            missing.append(f"{package} ({purpose})")
    
    if missing:
        print("\nMISSING DEPENDENCIES")
        print("====================")
        print("The following packages are required but not installed:")
        for pkg in missing:
            print(f"  - {pkg}")
        print("\nTo install missing dependencies, run:")
        print("pip install pyodbc pandas sqlalchemy openpyxl xlsxwriter")
        print("pip install PyQt6  # or PyQt5 as a fallback option")
        print("\nNote: For SQL Server connectivity, you may need to install the Microsoft ODBC driver.")
        print("Visit: https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server")
        
        return False
    
    return True

# Try to locate the Qt plugins directory for PyQt
def find_qt_plugins():
    qt_version = 6  # Default to QT6
    
    # Check if PyQt6 is available
    if importlib.util.find_spec("PyQt6") is not None:
        try:
            from PyQt6.QtCore import QLibraryInfo
            plugins_path = QLibraryInfo.path(QLibraryInfo.LibraryPath.PluginsPath)
            print(f"Found Qt6 plugins directory: {plugins_path}")
            return plugins_path, 6
        except ImportError:
            print("PyQt6 is installed but couldn't get plugins path")
    
    # Fall back to PyQt5
    if importlib.util.find_spec("PyQt5") is not None:
        try:
            from PyQt5.QtCore import QLibraryInfo
            plugins_path = QLibraryInfo.location(QLibraryInfo.PluginsPath)
            print(f"Found Qt5 plugins directory: {plugins_path}")
            return plugins_path, 5
        except ImportError:
            print("PyQt5 is installed but couldn't get plugins path")
    
    # Manual search as a fallback
    anaconda_path = Path("/opt/anaconda3")
    possible_plugin_paths = [
        Path(os.getcwd()) / "venv" / "lib" / "python3.12" / "site-packages" / "PyQt6" / "Qt6" / "plugins",
        Path(os.getcwd()) / "venv" / "lib" / "python3.12" / "site-packages" / "PyQt6" / "Qt" / "plugins",
        Path(os.getcwd()) / "venv" / "lib" / "python3.12" / "site-packages" / "PyQt5" / "Qt5" / "plugins",
        Path(os.getcwd()) / "venv" / "lib" / "python3.12" / "site-packages" / "PyQt5" / "Qt" / "plugins",
        anaconda_path / "lib" / "python3.11" / "site-packages" / "PyQt6" / "Qt6" / "plugins",
        anaconda_path / "lib" / "python3.11" / "site-packages" / "PyQt6" / "Qt" / "plugins",
        anaconda_path / "lib" / "python3.11" / "site-packages" / "PyQt5" / "Qt5" / "plugins",
        anaconda_path / "lib" / "python3.11" / "site-packages" / "PyQt5" / "Qt" / "plugins",
        Path("/usr/local/Cellar/qt@6/6.5.0/plugins"),  # Homebrew Qt6 installation
        Path("/usr/local/Cellar/qt@5/5.15.16/plugins"),  # Homebrew Qt5 installation
        Path.home() / "Qt" / "6.5.0" / "macos" / "plugins",  # Qt6 official installation
        Path.home() / "Qt" / "5.15.16" / "macos" / "plugins",  # Qt5 official installation
    ]
    
    # Find the first existing plugin path
    for path in possible_plugin_paths:
        if path.exists():
            qt_version = 6 if "6" in str(path) else 5
            print(f"Found Qt{qt_version} plugins directory: {path}")
            return str(path), qt_version
    
    return None, None

def main():
    # Display banner 
    print("""
    ╔═══════════════════════════════════════════╗
    ║     ALLSTATE DB EXPORTER PRO v2.0.0       ║
    ║     Compatible with SSMS 2022             ║
    ╚═══════════════════════════════════════════╝
    """)
    
    # Check dependencies
    if not check_dependencies():
        input("\nPress Enter to exit...")
        sys.exit(1)
    
    # Find Qt plugins
    qt_plugin_path, qt_version = find_qt_plugins()
    
    if qt_plugin_path:
        # Set the environment variable and run the script
        env = os.environ.copy()
        env["QT_QPA_PLATFORM_PLUGIN_PATH"] = qt_plugin_path
        env["QT_VERSION"] = str(qt_version)
        
        print(f"Setting QT_QPA_PLATFORM_PLUGIN_PATH to {qt_plugin_path}")
        print("Running allstate-db-exporter.py...")
        
        # Try to use the virtual environment's Python interpreter
        venv_python = os.path.join(os.getcwd(), "venv", "bin", "python")
        if os.path.exists(venv_python):
            print(f"Using virtual environment Python interpreter: {venv_python}")
            result = subprocess.run([venv_python, "allstate-db-exporter.py"], env=env)
            sys.exit(result.returncode)
        
        # Fall back to Anaconda Python interpreter
        anaconda_python = "/opt/anaconda3/bin/python"
        if os.path.exists(anaconda_python):
            print(f"Using Anaconda Python interpreter: {anaconda_python}")
            result = subprocess.run([anaconda_python, "allstate-db-exporter.py"], env=env)
            sys.exit(result.returncode)
        
        # Last resort - use current Python interpreter
        print(f"Using current Python interpreter: {sys.executable}")
        result = subprocess.run([sys.executable, "allstate-db-exporter.py"], env=env)
        sys.exit(result.returncode)
    else:
        print("Could not find Qt plugins directory.")
        print("Try installing PyQt6 or PyQt5 properly, or set QT_QPA_PLATFORM_PLUGIN_PATH manually.")
        print("Running allstate-db-exporter.py anyway (may fail on GUI initialization)...")
        
        result = subprocess.run([sys.executable, "allstate-db-exporter.py"])
        sys.exit(result.returncode)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nError running the application: {e}")
        import traceback
        traceback.print_exc()
        input("\nPress Enter to exit...")
        sys.exit(1)