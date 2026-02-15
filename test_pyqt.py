import sys
from PyQt6.QtWidgets import QApplication, QLabel

# Simple test to verify PyQt6 is working
app = QApplication(sys.argv)
label = QLabel("PyQt6 is working!")
print("PyQt6 imported successfully")
# Don't show the window, just verify import works
sys.exit(0)
