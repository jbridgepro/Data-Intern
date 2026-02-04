import sys
import os
import platform
import logging
import time
import threading
import re
import configparser
import datetime
import json
from collections import defaultdict
import traceback
import tempfile
import webbrowser
import concurrent.futures
from pathlib import Path
import shutil
from urllib.parse import quote_plus

# App metadata
__version__ = '2.0.0'
__app_name__ = 'Allstate DB Exporter Pro'
__author__ = 'Allstate IT'

# Set up logging with log rotation
log_file = 'db_exporter_log.txt'
max_log_size = 10 * 1024 * 1024  # 10 MB
log_backup_count = 5  # Keep 5 backup logs

# Check log file size and rotate if necessary
if os.path.exists(log_file) and os.path.getsize(log_file) > max_log_size:
    # Create logs directory if it doesn't exist
    logs_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'logs')
    os.makedirs(logs_dir, exist_ok=True)
    
    # Backup old log
    timestamp = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    backup_log = os.path.join(logs_dir, f'db_exporter_log_{timestamp}.bak')
    if os.path.exists(log_file):
        shutil.move(log_file, backup_log)
    
    # Clean up old logs if there are too many
    log_files = sorted([os.path.join(logs_dir, f) for f in os.listdir(logs_dir) 
                      if f.startswith('db_exporter_log_') and f.endswith('.bak')])
    if len(log_files) > log_backup_count:
        for old_log in log_files[:-log_backup_count]:
            try:
                os.remove(old_log)
            except Exception as e:
                print(f"Could not remove old log {old_log}: {e}")

# Configure logging with more detailed formatting
logging.basicConfig(
    filename=log_file, 
    level=logging.DEBUG, 
    format='%(asctime)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s',
    filemode='a'
)

# Add console handler for immediate feedback
console_handler = logging.StreamHandler()
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)
logging.getLogger('').addHandler(console_handler)

logging.info(f"Starting {__app_name__} v{__version__}")

# Suppress Tk deprecation warning on macOS
if platform.system() == "Darwin":
    os.environ['TK_SILENCE_DEPRECATION'] = '1'

# Try to use PyQt6 first, fall back to PyQt5, then to tkinter
USE_PYQT = False
try:
    from PyQt6.QtWidgets import (
        QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
        QComboBox, QLineEdit, QPushButton, QListWidget, QFileDialog, QMessageBox,
        QProgressBar, QCheckBox, QTreeWidget, QTreeWidgetItem, QTabWidget, 
        QSplitter, QTableWidget, QTableWidgetItem, QHeaderView, QTextEdit,
        QDialogButtonBox, QDialog, QGroupBox, QRadioButton, QMenu, QStatusBar,
        QToolBar, QAction, QGridLayout, QFormLayout, QScrollArea
    )
    from PyQt6.QtGui import QColor, QFont, QIcon, QPixmap, QCursor, QTextCursor
    from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QSize, QMetaObject, QUrl
    USE_PYQT = True
    PYQT_VERSION = 6
    logging.info("Successfully imported PyQt6")
except ImportError as e:
    logging.warning(f"PyQt6 import failed: {e}. Trying PyQt5...")
    try:
        from PyQt5.QtWidgets import (
            QApplication, QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, QLabel, 
            QComboBox, QLineEdit, QPushButton, QListWidget, QFileDialog, QMessageBox,
            QProgressBar, QCheckBox, QTreeWidget, QTreeWidgetItem, QTabWidget, 
            QSplitter, QTableWidget, QTableWidgetItem, QHeaderView, QTextEdit,
            QDialogButtonBox, QDialog, QGroupBox, QRadioButton, QMenu, QStatusBar,
            QToolBar, QAction, QGridLayout, QFormLayout, QScrollArea
        )
        from PyQt5.QtGui import QColor, QFont, QIcon, QPixmap, QCursor, QTextCursor
        from PyQt5.QtCore import Qt, QThread, pyqtSignal, QTimer, QSize, QMetaObject, QUrl
        USE_PYQT = True
        PYQT_VERSION = 5
        logging.info("Successfully imported PyQt5")
    except ImportError as e:
        logging.warning(f"PyQt5 import failed: {e}. Falling back to tkinter")
        try:
            import tkinter as tk
            from tkinter import ttk, filedialog, messagebox, scrolledtext
            from tkinter.ttk import Notebook, Progressbar, Treeview, Checkbutton
            logging.info("Successfully imported tkinter")
        except ImportError as e:
            logging.error(f"Failed to import tkinter: {e}")
            print(f"Error importing tkinter: {e}")
            sys.exit(1)

# Required packages
required_packages = ["pyodbc", "pandas", "sqlalchemy", "openpyxl", "xlsxwriter"]

# Import required packages
try:
    import pyodbc
    logging.info("Successfully imported pyodbc")
except ImportError as e:
    logging.error(f"Failed to import pyodbc: {e}")
    print(f"Error importing pyodbc: {e}")
    sys.exit(1)

try:
    import pandas as pd
    logging.info("Successfully imported pandas")
except ImportError as e:
    logging.error(f"Failed to import pandas: {e}")
    print(f"Error importing pandas: {e}")
    sys.exit(1)

try:
    import sqlalchemy
    from sqlalchemy.engine import URL
    logging.info("Successfully imported SQLAlchemy")
except ImportError as e:
    logging.warning(f"SQLAlchemy import failed: {e}. Some advanced features will be disabled.")
    sqlalchemy = None

# Try to import Excel support libraries
try:
    import openpyxl
    import xlsxwriter
    EXCEL_SUPPORT = True
    logging.info("Excel support enabled")
except ImportError:
    EXCEL_SUPPORT = False
    logging.warning("Excel support disabled. Missing openpyxl or xlsxwriter.")

# Allstate colors
ALLSTATE_BLUE = "#0033A0"
ALLSTATE_WHITE = "#FFFFFF"
ALLSTATE_GRAY = "#F2F2F2"
ALLSTATE_LIGHT_BLUE = "#99CCFF"
ALLSTATE_DARK_BLUE = "#001F5C"

# SQL Server ODBC drivers to try (in order of preference)
DRIVERS = [
    "ODBC Driver 18 for SQL Server",  # Latest driver for SSMS 2022
    "ODBC Driver 17 for SQL Server",  # Common driver for SSMS 2019
    "ODBC Driver 11 for SQL Server",  # For older systems
    "ODBC Driver for SQL Server",     # Generic name
    "SQL Server Native Client 11.0",  # Legacy driver
    "SQL Server Native Client 10.0",  # Legacy driver
    "SQL Server",                     # Very old driver
    "FreeTDS"                         # For Linux/macOS connections
]

def detect_sql_driver():
    """Detect available SQL Server drivers"""
    try:
        available_drivers = pyodbc.drivers()
        logging.info(f"Available ODBC drivers: {available_drivers}")
        
        # Find the first available driver from our list
        for driver in DRIVERS:
            if driver in available_drivers:
                logging.info(f"Using SQL driver: {driver}")
                return driver
        
        # If no preferred driver is found, use the first available one that contains "SQL"
        for driver in available_drivers:
            if "SQL" in driver:
                logging.warning(f"Using non-preferred SQL driver: {driver}")
                return driver
                
        # Last resort - use any available driver
        if available_drivers:
            logging.warning(f"Using non-preferred driver: {available_drivers[0]}")
            return available_drivers[0]
        
        logging.error("No SQL Server driver available")
        return None
    except Exception as e:
        logging.error(f"Error detecting SQL drivers: {e}")
        return "ODBC Driver 18 for SQL Server"  # Default to latest driver

# Get the SQL Server driver
SQL_DRIVER = detect_sql_driver()

def generate_connection_string(server, database, auth_type="SQL", username="", password="", 
                              encrypt=True, trust_server_cert=True, app_name=__app_name__,
                              timeout=30):
    """Generate a connection string based on parameters"""
    driver = SQL_DRIVER or "ODBC Driver 18 for SQL Server"
    
    # Base connection string
    conn_str = f'DRIVER={{{driver}}};SERVER={server};DATABASE={database};'
    
    # Add authentication
    if auth_type.upper() == "WINDOWS":
        conn_str += 'Trusted_Connection=yes;'
    else:
        # Escape special characters in username/password
        safe_username = username.replace(';', '%3B').replace('}', '%7D').replace('{', '%7B')
        safe_password = password.replace(';', '%3B').replace('}', '%7D').replace('{', '%7B')
        conn_str += f'UID={safe_username};PWD={safe_password};'
    
    # Add encryption settings
    if encrypt:
        conn_str += 'Encrypt=YES;'
    else:
        conn_str += 'Encrypt=NO;'
        
    if trust_server_cert:
        conn_str += 'TrustServerCertificate=yes;'
    
    # Add application name for server-side identification
    conn_str += f"Application Name={app_name};"
    
    # Add timeout
    conn_str += f"Connection Timeout={timeout};"
    
    return conn_str

def get_sqlalchemy_url(server, database, auth_type="SQL", username="", password="", 
                       driver=None, encrypt=True, trust_server_cert=True):
    """Generate a SQLAlchemy connection URL"""
    if driver is None:
        driver = SQL_DRIVER or "ODBC Driver 18 for SQL Server"
    
    # Format driver name for URL (replace spaces with +)
    driver_formatted = driver.replace(" ", "+")
    
    # Build query parameters
    params = {
        "driver": driver_formatted,
    }
    
    if encrypt:
        params["encrypt"] = "yes"
    else:
        params["encrypt"] = "no"
        
    if trust_server_cert:
        params["TrustServerCertificate"] = "yes"
    
    # Build query string
    query_string = "&".join([f"{k}={v}" for k, v in params.items()])
    
    # Create URL based on authentication type
    if auth_type.upper() == "WINDOWS":
        url = f"mssql+pyodbc://{server}/{database}?{query_string}&trusted_connection=yes"
    else:
        # URL encode username and password
        safe_username = quote_plus(username)
        safe_password = quote_plus(password)
        url = f"mssql+pyodbc://{safe_username}:{safe_password}@{server}/{database}?{query_string}"
    
    return url

class DBWorker(QThread if USE_PYQT else threading.Thread):
    """Worker thread for database operations"""
    if USE_PYQT:
        # Define signals for PyQt
        finished = pyqtSignal(object)
        progress = pyqtSignal(int)
        status = pyqtSignal(str)  # Status message with no logging
        error = pyqtSignal(str)
        log = pyqtSignal(str)
        query_started = pyqtSignal(str)
        query_completed = pyqtSignal(str, int)  # Query and row count
    
    def __init__(self, operation, params):
        super().__init__()
        self.operation = operation
        self.params = params
        self.is_canceled = False
        self.start_time = None
        
        # For threading mode, we need callback functions
        if not USE_PYQT:
            self.on_finished = None
            self.on_progress = None
            self.on_status = None
            self.on_error = None
            self.on_log = None
            self.on_query_started = None
            self.on_query_completed = None
    
    def cancel(self):
        """Cancel the current operation"""
        self.is_canceled = True
        self.log_message("Operation canceled by user")
    
    def run(self):
        self.start_time = time.time()
        try:
            # Dispatch to appropriate operation
            if self.operation == "connect":
                result = self.connect_to_db()
            elif self.operation == "get_tables":
                result = self.get_tables()
            elif self.operation == "get_table_info":
                result = self.get_table_info()
            elif self.operation == "export_data":
                result = self.export_data()
            elif self.operation == "execute_query":
                result = self.execute_query()
            elif self.operation == "analyze_database":
                result = self.analyze_database()
            elif self.operation == "generate_documentation":
                result = self.generate_documentation()
            elif self.operation == "backup_database":
                result = self.backup_database()
            elif self.operation == "get_database_info":
                result = self.get_database_info()
            else:
                raise ValueError(f"Unknown operation: {self.operation}")
            
            # Calculate execution time
            elapsed_time = time.time() - self.start_time
            logging.info(f"Operation '{self.operation}' completed in {elapsed_time:.2f} seconds")
            
            # Send the result
            if USE_PYQT:
                self.finished.emit(result)
            elif self.on_finished:
                self.on_finished(result)
                
        except Exception as e:
            error_msg = f"Error in {self.operation}: {str(e)}\n{traceback.format_exc()}"
            logging.error(error_msg)
            if USE_PYQT:
                self.error.emit(str(e))
            elif self.on_error:
                self.on_error(str(e))
    
    def log_message(self, message):
        """Log a message through the appropriate channel"""
        logging.info(message)
        if USE_PYQT:
            self.log.emit(message)
        elif self.on_log:
            self.on_log(message)
    
    def update_status(self, message):
        """Update status message (no logging)"""
        if USE_PYQT:
            self.status.emit(message)
        elif self.on_status:
            self.on_status(message)
    
    def update_progress(self, value):
        """Update progress through the appropriate channel"""
        if USE_PYQT:
            self.progress.emit(value)
        elif self.on_progress:
            self.on_progress(value)
    
    def connect_to_db(self):
        """Connect to the database"""
        server = self.params.get('server')
        database = self.params.get('database')
        auth_type = self.params.get('auth_type')
        username = self.params.get('username', '')
        password = self.params.get('password', '')
        encrypt = self.params.get('encrypt', True)
        trust_server = self.params.get('trust_server', True)
        timeout = self.params.get('timeout', 30)
        
        self.log_message(f"Connecting to {server}, database: {database}")
        
        # Generate connection string using our helper function
        connection_string = generate_connection_string(
            server=server,
            database=database,
            auth_type=auth_type,
            username=username,
            password=password,
            encrypt=encrypt,
            trust_server_cert=trust_server,
            timeout=timeout
        )
        
        # Connect using pyodbc
        self.update_status("Establishing database connection...")
        conn = pyodbc.connect(connection_string)
        conn.timeout = timeout
        
        # Verify connection is working by executing simple query
        cursor = conn.cursor()
        cursor.execute("SELECT @@VERSION")
        version = cursor.fetchone()[0]
        self.log_message(f"Connected to SQL Server: {version}")
        
        # If SQLAlchemy is available, also create a SQLAlchemy engine for advanced operations
        result = {"conn": conn, "server_version": version}
        
        if sqlalchemy:
            self.update_status("Creating SQLAlchemy engine...")
            
            # Create SQLAlchemy URL
            sql_url = get_sqlalchemy_url(
                server=server,
                database=database,
                auth_type=auth_type,
                username=username,
                password=password,
                encrypt=encrypt,
                trust_server_cert=trust_server
            )
            
            # Create engine with appropriate options
            engine = sqlalchemy.create_engine(
                sql_url,
                connect_args={"timeout": timeout},
                pool_size=5,
                max_overflow=10,
                pool_timeout=30,
                pool_recycle=3600
            )
            
            # Add to result
            result["engine"] = engine
            result["has_sqlalchemy"] = True
        else:
            result["has_sqlalchemy"] = False
            
        # Get additional connection information
        try:
            cursor.execute("SELECT DB_NAME() AS CurrentDB, CURRENT_USER AS CurrentUser")
            row = cursor.fetchone()
            if row:
                result["current_db"] = row.CurrentDB
                result["current_user"] = row.CurrentUser
        except Exception as e:
            logging.warning(f"Could not get additional connection info: {e}")
        
        # Add connection timestamp
        result["connected_at"] = datetime.datetime.now().isoformat()
        
        # Check if we're using SSMS 2022 compatible driver
        result["is_ssms_2022_compatible"] = "ODBC Driver 18" in connection_string or "ODBC Driver 17" in connection_string
        
        return result
    
    def get_tables(self):
        """Get tables from the database with extended metadata"""
        conn = self.params.get('conn')
        filters = self.params.get('filters', [])
        include_views = self.params.get('include_views', False)
        
        result = {"tables": [], "views": [], "procedures": []}
        
        # Get database tables
        cursor = conn.cursor()
        
        # Get tables
        query = """
        SELECT 
            t.TABLE_SCHEMA, 
            t.TABLE_NAME, 
            (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = t.TABLE_SCHEMA AND TABLE_NAME = t.TABLE_NAME) AS column_count,
            (SELECT ISNULL(SUM(p.rows), 0) 
             FROM sys.tables AS tbl
             INNER JOIN sys.partitions AS p ON p.object_id = tbl.object_id
             WHERE tbl.name = t.TABLE_NAME AND tbl.schema_id = SCHEMA_ID(t.TABLE_SCHEMA)
             AND p.index_id IN (0, 1)) AS row_count
        FROM INFORMATION_SCHEMA.TABLES t
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
        """
        cursor.execute(query)
        tables = cursor.fetchall()
        
        # Process tables with filtering
        for schema, name, col_count, row_count in tables:
            full_name = f"{schema}.{name}"
            if not filters or any(self._match_filter(full_name, f) for f in filters):
                result["tables"].append({
                    "schema": schema,
                    "name": name,
                    "full_name": full_name,
                    "column_count": col_count,
                    "row_count": row_count
                })
        
        # Get views if requested
        if include_views:
            query = """
            SELECT 
                v.TABLE_SCHEMA, 
                v.TABLE_NAME,
                (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = v.TABLE_SCHEMA AND TABLE_NAME = v.TABLE_NAME) AS column_count
            FROM INFORMATION_SCHEMA.VIEWS v
            ORDER BY v.TABLE_SCHEMA, v.TABLE_NAME
            """
            cursor.execute(query)
            views = cursor.fetchall()
            
            for schema, name, col_count in views:
                full_name = f"{schema}.{name}"
                if not filters or any(self._match_filter(full_name, f) for f in filters):
                    result["views"].append({
                        "schema": schema,
                        "name": name,
                        "full_name": full_name,
                        "column_count": col_count
                    })
        
        # Get stored procedures
        query = """
        SELECT 
            ROUTINE_SCHEMA, 
            ROUTINE_NAME
        FROM INFORMATION_SCHEMA.ROUTINES
        WHERE ROUTINE_TYPE = 'PROCEDURE'
        ORDER BY ROUTINE_SCHEMA, ROUTINE_NAME
        """
        cursor.execute(query)
        procs = cursor.fetchall()
        
        for schema, name in procs:
            full_name = f"{schema}.{name}"
            if not filters or any(self._match_filter(full_name, f) for f in filters):
                result["procedures"].append({
                    "schema": schema,
                    "name": name,
                    "full_name": full_name
                })
        
        return result
    
    def _match_filter(self, name, filter_text):
        """Check if name matches the filter pattern"""
        # Support wildcard patterns with * and ?
        if '*' in filter_text or '?' in filter_text:
            # Convert filter to regex pattern
            pattern = filter_text.replace('.', '\\.').replace('*', '.*').replace('?', '.')
            return bool(re.match(f"^{pattern}$", name, re.IGNORECASE))
        
        # Simple case-insensitive substring match
        return filter_text.lower() in name.lower()
    
    def get_table_info(self):
        """Get detailed information about a table"""
        conn = self.params.get('conn')
        table_name = self.params.get('table_name')
        schema = self.params.get('schema', 'dbo')
        
        cursor = conn.cursor()
        result = {
            "columns": [],
            "indexes": [],
            "foreign_keys": [],
            "sample_data": None
        }
        
        # Get column information with extended metadata
        query = """
        SELECT 
            c.COLUMN_NAME, 
            c.DATA_TYPE,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE,
            c.IS_NULLABLE,
            CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 'YES' ELSE 'NO' END AS IS_PRIMARY_KEY,
            c.COLUMN_DEFAULT,
            ep.value AS DESCRIPTION
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN (
            SELECT ku.TABLE_CATALOG, ku.TABLE_SCHEMA, ku.TABLE_NAME, ku.COLUMN_NAME
            FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
            JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                ON tc.CONSTRAINT_TYPE = 'PRIMARY KEY' 
                AND tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
        ) pk ON c.TABLE_CATALOG = pk.TABLE_CATALOG
            AND c.TABLE_SCHEMA = pk.TABLE_SCHEMA
            AND c.TABLE_NAME = pk.TABLE_NAME
            AND c.COLUMN_NAME = pk.COLUMN_NAME
        LEFT JOIN sys.tables t ON t.name = c.TABLE_NAME AND SCHEMA_NAME(t.schema_id) = c.TABLE_SCHEMA
        LEFT JOIN sys.columns sc ON sc.object_id = t.object_id AND sc.name = c.COLUMN_NAME
        LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id 
            AND ep.minor_id = sc.column_id 
            AND ep.name = 'MS_Description'
        WHERE c.TABLE_SCHEMA = ? AND c.TABLE_NAME = ?
        ORDER BY c.ORDINAL_POSITION
        """
        
        cursor.execute(query, (schema, table_name))
        columns = cursor.fetchall()
        
        for col in columns:
            col_name, data_type, char_max_len, num_precision, num_scale, is_nullable, is_pk, default_val, description = col
            
            # Format type information
            if char_max_len is not None and char_max_len > 0:
                type_info = f"{data_type}({char_max_len})"
            elif num_precision is not None and num_scale is not None:
                type_info = f"{data_type}({num_precision},{num_scale})"
            elif num_precision is not None:
                type_info = f"{data_type}({num_precision})"
            else:
                type_info = data_type
                
            result["columns"].append({
                "name": col_name,
                "type": data_type,
                "type_formatted": type_info,
                "max_length": char_max_len,
                "precision": num_precision,
                "scale": num_scale,
                "nullable": is_nullable == "YES",
                "primary_key": is_pk == "YES",
                "default": default_val,
                "description": description
            })
        
        # Get indexes
        query = """
        SELECT 
            i.name AS index_name,
            CASE WHEN i.is_primary_key = 1 THEN 'PRIMARY KEY'
                 WHEN i.is_unique = 1 THEN 'UNIQUE'
                 ELSE 'INDEX' END AS index_type,
            CASE WHEN i.is_unique = 1 THEN 'YES' ELSE 'NO' END AS is_unique,
            CASE WHEN i.is_primary_key = 1 THEN 'YES' ELSE 'NO' END AS is_primary_key,
            STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS columns
        FROM sys.indexes i
        INNER JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
        INNER JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
        INNER JOIN sys.tables t ON i.object_id = t.object_id
        WHERE t.name = ? AND SCHEMA_NAME(t.schema_id) = ?
        GROUP BY i.name, i.is_primary_key, i.is_unique
        ORDER BY i.is_primary_key DESC, i.name
        """
        
        try:
            cursor.execute(query, (table_name, schema))
            indexes = cursor.fetchall()
            
            for idx in indexes:
                index_name, index_type, is_unique, is_pk, columns = idx
                result["indexes"].append({
                    "name": index_name,
                    "type": index_type,
                    "unique": is_unique == "YES",
                    "primary_key": is_pk == "YES",
                    "columns": columns
                })
        except Exception as e:
            logging.warning(f"Could not retrieve indexes: {str(e)}")
        
        # Get foreign keys
        query = """
        SELECT 
            fk.name AS fk_name,
            cs.name AS source_column,
            OBJECT_NAME(fk.referenced_object_id) AS target_table,
            cr.name AS target_column,
            SCHEMA_NAME(fk.schema_id) AS source_schema,
            SCHEMA_NAME(OBJECT_SCHEMA_ID(fk.referenced_object_id)) AS target_schema
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.columns cs ON fkc.parent_object_id = cs.object_id AND fkc.parent_column_id = cs.column_id
        INNER JOIN sys.columns cr ON fkc.referenced_object_id = cr.object_id AND fkc.referenced_column_id = cr.column_id
        INNER JOIN sys.tables t ON fk.parent_object_id = t.object_id
        WHERE t.name = ? AND SCHEMA_NAME(t.schema_id) = ?
        ORDER BY fk.name, fkc.constraint_column_id
        """
        
        try:
            cursor.execute(query, (table_name, schema))
            fkeys = cursor.fetchall()
            
            for fk in fkeys:
                fk_name, source_col, target_table, target_col, source_schema, target_schema = fk
                result["foreign_keys"].append({
                    "name": fk_name,
                    "source_column": source_col,
                    "target_table": f"{target_schema}.{target_table}",
                    "target_column": target_col
                })
        except Exception as e:
            logging.warning(f"Could not retrieve foreign keys: {str(e)}")
        
        # Get sample data (top 10 rows)
        try:
            query = f"SELECT TOP 10 * FROM [{schema}].[{table_name}]"
            df = pd.read_sql(query, conn)
            result["sample_data"] = df.to_dict(orient='records')
        except Exception as e:
            logging.warning(f"Could not retrieve sample data: {str(e)}")
        
        return result
    
    def execute_query(self):
        """Execute a custom SQL query"""
        conn = self.params.get('conn')
        query = self.params.get('query')
        
        try:
            self.log_message(f"Executing query: {query[:100]}{'...' if len(query) > 100 else ''}")
            
            # For SELECT queries, return a DataFrame
            if query.strip().upper().startswith("SELECT"):
                df = pd.read_sql(query, conn)
                self.log_message(f"Query returned {len(df)} rows")
                return {"result": df, "type": "dataframe"}
            else:
                # For other queries (UPDATE, INSERT, etc.), execute and return affected rows
                cursor = conn.cursor()
                cursor.execute(query)
                affected = cursor.rowcount
                conn.commit()
                self.log_message(f"Query affected {affected} rows")
                return {"result": affected, "type": "rowcount"}
                
        except Exception as e:
            error_msg = f"Query execution error: {str(e)}"
            self.log_message(error_msg)
            raise Exception(error_msg)
    
    def export_data(self):
        """Export data with various options"""
        conn = self.params.get('conn')
        engine = self.params.get('engine')  # SQLAlchemy engine, may be None
        items = self.params.get('items', [])
        format = self.params.get('format', 'csv')
        options = self.params.get('options', {})
        folder_path = self.params.get('folder_path')
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        results = []
        total_count = len(items)
        
        # Ensure directory exists
        if not os.path.exists(folder_path):
            os.makedirs(folder_path)
        
        # Process each item to export
        for i, item in enumerate(items):
            try:
                self.update_progress(int((i / total_count) * 100))
                
                # Extract item info
                name = item.get('name')
                schema = item.get('schema', 'dbo')
                full_name = item.get('full_name', f"{schema}.{name}")
                is_query = item.get('is_query', False)
                
                self.log_message(f"Exporting {full_name} to {format}")
                
                # Generate file name
                file_name = options.get('file_naming', 'item_name')
                if file_name == 'item_name':
                    export_name = name
                elif file_name == 'full_name':
                    export_name = full_name.replace('.', '_')
                elif file_name == 'timestamp_item_name':
                    export_name = f"{timestamp}_{name}"
                else:
                    export_name = f"{name}"
                    
                # Get data
                if is_query:
                    query = item.get('query')
                    self.log_message(f"Executing custom query: {query[:100]}...")
                    df = pd.read_sql(query, conn)
                else:
                    query = f"SELECT * FROM [{schema}].[{name}]"
                    self.log_message(f"Fetching data from {full_name}")
                    df = pd.read_sql(query, conn)
                
                # Apply row limit if specified
                row_limit = options.get('row_limit', 0)
                if row_limit > 0 and len(df) > row_limit:
                    self.log_message(f"Limiting to {row_limit} rows")
                    df = df.head(row_limit)
                
                file_path = os.path.join(folder_path, f"{export_name}.{format}")
                
                # Export based on format
                if format == 'csv':
                    delimiter = options.get('delimiter', ',')
                    encoding = options.get('encoding', 'utf-8')
                    df.to_csv(file_path, sep=delimiter, index=False, encoding=encoding)
                
                elif format == 'excel':
                    if not EXCEL_SUPPORT:
                        raise Exception("Excel export not available. Install openpyxl and xlsxwriter.")
                    
                    # Export with formatting and auto column width
                    with pd.ExcelWriter(file_path, engine='xlsxwriter') as writer:
                        df.to_excel(writer, sheet_name=name[:31], index=False)
                        worksheet = writer.sheets[name[:31]]
                        
                        # Auto-adjust column widths
                        for i, col in enumerate(df.columns):
                            max_len = max(df[col].astype(str).apply(len).max(), len(str(col))) + 2
                            worksheet.set_column(i, i, min(max_len, 50))  # Cap width at 50
                
                elif format == 'json':
                    orient = options.get('json_orient', 'records')
                    indent = options.get('json_indent', 4)
                    df.to_json(file_path, orient=orient, indent=indent)
                
                elif format == 'parquet':
                    if 'pyarrow' in sys.modules:
                        df.to_parquet(file_path)
                    else:
                        raise Exception("Parquet export requires pyarrow to be installed.")
                
                elif format == 'html':
                    df.to_html(file_path, index=False)
                
                elif format == 'sql':
                    if engine is None:
                        raise Exception("SQL export requires SQLAlchemy")
                    
                    # Generate create table statement and insert statements
                    with open(file_path, 'w') as f:
                        # Write CREATE TABLE statement
                        table_name = f"{schema}_{name}"
                        create_table = f"-- Create table statement for {full_name}\n"
                        create_table += f"CREATE TABLE {table_name} (\n"
                        
                        for i, col in enumerate(df.columns):
                            dtype = self._sql_type_from_pandas(df[col])
                            create_table += f"    {col} {dtype}"
                            if i < len(df.columns) - 1:
                                create_table += ","
                            create_table += "\n"
                        
                        create_table += ");\n\n"
                        f.write(create_table)
                        
                        # Write INSERT statements in batches
                        f.write(f"-- Data for {full_name}\n")
                        batch_size = 1000
                        for i in range(0, len(df), batch_size):
                            batch = df.iloc[i:i+batch_size]
                            insert_stmt = f"INSERT INTO {table_name} ("
                            insert_stmt += ", ".join(df.columns)
                            insert_stmt += ") VALUES\n"
                            
                            values = []
                            for _, row in batch.iterrows():
                                value_str = "("
                                for j, col in enumerate(df.columns):
                                    val = row[col]
                                    if pd.isna(val):
                                        value_str += "NULL"
                                    elif isinstance(val, (int, float)):
                                        value_str += str(val)
                                    else:
                                        # Escape single quotes
                                        val_str = str(val).replace("'", "''")
                                        value_str += f"'{val_str}'"
                                    
                                    if j < len(df.columns) - 1:
                                        value_str += ", "
                                value_str += ")"
                                values.append(value_str)
                            
                            insert_stmt += ",\n".join(values)
                            insert_stmt += ";\n\n"
                            f.write(insert_stmt)
                
                # Add to results
                results.append({
                    "name": full_name,
                    "file_path": file_path,
                    "rows_exported": len(df),
                    "columns": len(df.columns),
                    "success": True
                })
                
            except Exception as e:
                error_msg = f"Failed to export {full_name}: {str(e)}"
                logging.error(error_msg)
                
                # Add failed export to results
                results.append({
                    "name": full_name,
                    "error": str(e),
                    "success": False
                })
        
        self.update_progress(100)
        return results
    
    def _sql_type_from_pandas(self, series):
        """Determine SQL data type from pandas series"""
        dtype = series.dtype
        
        if pd.api.types.is_integer_dtype(dtype):
            max_val = series.max() if not series.empty else 0
            if max_val < 32767:
                return "SMALLINT"
            elif max_val < 2147483647:
                return "INT"
            else:
                return "BIGINT"
        
        elif pd.api.types.is_float_dtype(dtype):
            # Check precision to determine FLOAT or DECIMAL
            # If all values have no decimal places, use DECIMAL
            if series.dropna().apply(lambda x: x.is_integer()).all():
                return "DECIMAL(18,0)"
            # Try to determine decimal precision
            max_decimal_places = series.dropna().apply(lambda x: len(str(x).split('.')[-1]) if '.' in str(x) else 0).max()
            if max_decimal_places <= 4:
                return f"DECIMAL(18,{max_decimal_places})"
            else:
                return "FLOAT"
        
        elif pd.api.types.is_bool_dtype(dtype):
            return "BIT"
        
        elif pd.api.types.is_datetime64_dtype(dtype):
            # Check if time component is used
            has_time = False
            for val in series.dropna():
                if val.time().hour != 0 or val.time().minute != 0 or val.time().second != 0:
                    has_time = True
                    break
            
            if has_time:
                return "DATETIME2(7)"  # SSMS 2022 uses DATETIME2 as preferred
            else:
                return "DATE"
        
        elif pd.api.types.is_timedelta64_dtype(dtype):
            return "TIME(7)"
        
        else:
            # Determine string length and check for special patterns
            if series.empty:
                return "VARCHAR(100)"
                
            # Check if it's a GUID/UUID
            guid_pattern = r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
            if series.astype(str).str.match(guid_pattern).all():
                return "UNIQUEIDENTIFIER"
                
            # Check for email pattern
            email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if series.astype(str).str.match(email_pattern).all():
                return "VARCHAR(320)"  # Max email length
                
            # Determine string length
            max_len = series.astype(str).apply(len).max()
            if max_len <= 30:
                return f"VARCHAR(30)"
            elif max_len <= 50:
                return f"VARCHAR(50)"
            elif max_len <= 100:
                return f"VARCHAR(100)"
            elif max_len <= 255:
                return f"VARCHAR(255)"
            elif max_len <= 1000:
                return f"VARCHAR(1000)"
            elif max_len <= 4000:
                return f"VARCHAR(4000)"
            elif max_len <= 8000:
                return f"VARCHAR(8000)"
            else:
                return "VARCHAR(MAX)"  # Modern SQL Server uses VARCHAR(MAX) instead of TEXT
                
    def analyze_database(self):
        """Analyze database structure and usage"""
        conn = self.params.get('conn')
        include_data_analysis = self.params.get('include_data_analysis', False)
        database = self.params.get('database', '')
        
        self.log_message(f"Starting database analysis for {database}")
        result = {
            "database": database,
            "analysis_time": datetime.datetime.now().isoformat(),
            "tables": [],
            "views": [],
            "stored_procedures": [],
            "functions": [],
            "schemas": {},
            "dependencies": [],
            "size_info": {},
            "performance_stats": {},
        }
        
        try:
            cursor = conn.cursor()
            
            # Get database size information
            self.update_status("Retrieving database size information...")
            self.update_progress(5)
            
            cursor.execute("""
            SELECT 
                DB_NAME() AS DatabaseName,
                CAST(SUM(CAST(size AS BIGINT)) * 8 / 1024 AS DECIMAL(18,2)) AS DatabaseSizeMB
            FROM sys.database_files
            WHERE type IN (0,1)
            """)
            size_row = cursor.fetchone()
            if size_row:
                result["size_info"]["database_size_mb"] = float(size_row.DatabaseSizeMB)
            
            # Get file group information
            cursor.execute("""
            SELECT 
                f.name AS FileName,
                f.physical_name AS FilePath,
                CAST(f.size * 8 / 1024 AS DECIMAL(18,2)) AS FileSizeMB,
                fg.name AS FileGroupName,
                f.is_percent_growth AS IsPercentGrowth,
                CASE WHEN f.is_percent_growth = 1 THEN f.growth ELSE f.growth * 8 / 1024 END AS GrowthValue,
                CASE WHEN f.is_percent_growth = 1 THEN 'Percent' ELSE 'MB' END AS GrowthUnit,
                f.max_size AS MaxSize
            FROM sys.database_files f
            LEFT JOIN sys.filegroups fg ON f.data_space_id = fg.data_space_id
            ORDER BY f.type, f.name
            """)
            
            result["size_info"]["files"] = []
            for row in cursor.fetchall():
                result["size_info"]["files"].append({
                    "name": row.FileName,
                    "path": row.FilePath,
                    "size_mb": float(row.FileSizeMB),
                    "filegroup": row.FileGroupName,
                    "growth_is_percent": bool(row.IsPercentGrowth),
                    "growth_value": float(row.GrowthValue),
                    "growth_unit": row.GrowthUnit,
                    "max_size": row.MaxSize
                })
            
            # Get schema information
            self.update_status("Analyzing schema information...")
            self.update_progress(10)
            
            cursor.execute("""
            SELECT 
                s.name AS SchemaName,
                s.schema_id AS SchemaId,
                ISNULL(p.name, 'n/a') AS SchemaOwner,
                (SELECT COUNT(*) FROM sys.tables t WHERE t.schema_id = s.schema_id) AS TableCount,
                (SELECT COUNT(*) FROM sys.views v WHERE v.schema_id = s.schema_id) AS ViewCount,
                (SELECT COUNT(*) FROM sys.procedures p WHERE p.schema_id = s.schema_id) AS ProcedureCount,
                (SELECT COUNT(*) FROM sys.objects o WHERE o.schema_id = s.schema_id AND o.type IN ('FN', 'IF', 'TF')) AS FunctionCount,
                s.create_date AS CreatedDate,
                s.modify_date AS ModifiedDate
            FROM sys.schemas s
            LEFT JOIN sys.database_principals p ON s.principal_id = p.principal_id
            ORDER BY s.name
            """)
            
            for row in cursor.fetchall():
                result["schemas"][row.SchemaName] = {
                    "schema_id": row.SchemaId,
                    "owner": row.SchemaOwner,
                    "table_count": row.TableCount,
                    "view_count": row.ViewCount,
                    "procedure_count": row.ProcedureCount,
                    "function_count": row.FunctionCount,
                    "created_date": row.CreatedDate.isoformat() if row.CreatedDate else None,
                    "modified_date": row.ModifiedDate.isoformat() if row.ModifiedDate else None
                }
            
            # Get table information
            self.update_status("Analyzing tables...")
            self.update_progress(20)
            
            cursor.execute("""
            SELECT 
                t.name AS TableName,
                s.name AS SchemaName,
                t.create_date AS CreatedDate,
                t.modify_date AS ModifiedDate,
                p.rows AS RowCount,
                CAST(ROUND(SUM(a.total_pages) * 8 / 1024.00, 2) AS DECIMAL(18,2)) AS TotalSpaceMB,
                CAST(ROUND(SUM(a.used_pages) * 8 / 1024.00, 2) AS DECIMAL(18,2)) AS UsedSpaceMB,
                (SELECT COUNT(*) FROM sys.indexes i WHERE i.object_id = t.object_id) AS IndexCount,
                (SELECT COUNT(*) FROM sys.columns c WHERE c.object_id = t.object_id) AS ColumnCount,
                ISNULL(ep.value, '') AS TableDescription
            FROM sys.tables t
            INNER JOIN sys.schemas s ON t.schema_id = s.schema_id
            INNER JOIN sys.partitions p ON t.object_id = p.object_id AND p.index_id IN (0,1)
            INNER JOIN sys.allocation_units a ON p.partition_id = a.container_id
            LEFT JOIN sys.extended_properties ep ON ep.major_id = t.object_id
                AND ep.minor_id = 0
                AND ep.name = 'MS_Description'
            GROUP BY t.name, s.name, t.create_date, t.modify_date, p.rows, ep.value
            ORDER BY s.name, t.name
            """)
            
            for row in cursor.fetchall():
                table_info = {
                    "name": row.TableName,
                    "schema": row.SchemaName,
                    "created_date": row.CreatedDate.isoformat() if row.CreatedDate else None,
                    "modified_date": row.ModifiedDate.isoformat() if row.ModifiedDate else None,
                    "row_count": row.RowCount,
                    "size_mb": float(row.TotalSpaceMB),
                    "used_mb": float(row.UsedSpaceMB),
                    "index_count": row.IndexCount,
                    "column_count": row.ColumnCount,
                    "description": row.TableDescription,
                    "columns": [],
                    "indexes": [],
                    "foreign_keys": [],
                    "statistics": {}
                }
                
                # Get columns for this table
                col_cursor = conn.cursor()
                col_cursor.execute("""
                SELECT 
                    c.name AS ColumnName,
                    t.name AS DataType,
                    c.max_length AS MaxLength,
                    c.precision AS Precision,
                    c.scale AS Scale,
                    c.is_nullable AS IsNullable,
                    c.is_identity AS IsIdentity,
                    CASE WHEN pk.column_id IS NOT NULL THEN 1 ELSE 0 END AS IsPrimaryKey,
                    c.column_id AS OrdinalPosition,
                    ISNULL(d.definition, '') AS DefaultValue,
                    ISNULL(ep.value, '') AS Description
                FROM sys.columns c
                INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                LEFT JOIN sys.default_constraints d ON c.default_object_id = d.object_id
                LEFT JOIN (
                    SELECT ic.column_id, ic.object_id
                    FROM sys.index_columns ic
                    INNER JOIN sys.indexes i ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                    WHERE i.is_primary_key = 1
                ) pk ON c.object_id = pk.object_id AND c.column_id = pk.column_id
                LEFT JOIN sys.extended_properties ep ON ep.major_id = c.object_id
                    AND ep.minor_id = c.column_id
                    AND ep.name = 'MS_Description'
                WHERE c.object_id = OBJECT_ID(?)
                ORDER BY c.column_id
                """, f"[{row.SchemaName}].[{row.TableName}]")
                
                for col_row in col_cursor.fetchall():
                    # Format the data type properly
                    data_type = col_row.DataType
                    if data_type in ('varchar', 'nvarchar', 'char', 'nchar'):
                        max_length = col_row.MaxLength
                        if data_type.startswith('n'):  # Unicode types
                            max_length = max_length // 2
                        if max_length == -1:
                            type_str = f"{data_type}(MAX)"
                        else:
                            type_str = f"{data_type}({max_length})"
                    elif data_type in ('decimal', 'numeric'):
                        type_str = f"{data_type}({col_row.Precision},{col_row.Scale})"
                    else:
                        type_str = data_type
                        
                    table_info["columns"].append({
                        "name": col_row.ColumnName,
                        "data_type": col_row.DataType,
                        "formatted_type": type_str,
                        "max_length": col_row.MaxLength,
                        "precision": col_row.Precision,
                        "scale": col_row.Scale,
                        "is_nullable": bool(col_row.IsNullable),
                        "is_identity": bool(col_row.IsIdentity),
                        "is_primary_key": bool(col_row.IsPrimaryKey),
                        "ordinal_position": col_row.OrdinalPosition,
                        "default_value": col_row.DefaultValue,
                        "description": col_row.Description
                    })
                
                # Get table statistics if requested
                if include_data_analysis:
                    try:
                        # Get basic stats for numeric columns
                        for column in table_info["columns"]:
                            if column["data_type"] in ("int", "smallint", "bigint", "float", "decimal", "numeric", "money", "smallmoney"):
                                try:
                                    stats_cursor = conn.cursor()
                                    stats_cursor.execute(f"""
                                    SELECT 
                                        MIN([{column['name']}]) AS MinValue,
                                        MAX([{column['name']}]) AS MaxValue,
                                        AVG(CAST([{column['name']}] AS FLOAT)) AS AvgValue,
                                        SUM(CASE WHEN [{column['name']}] IS NULL THEN 1 ELSE 0 END) AS NullCount
                                    FROM [{row.SchemaName}].[{row.TableName}]
                                    """)
                                    stats = stats_cursor.fetchone()
                                    if stats:
                                        table_info["statistics"][column["name"]] = {
                                            "min": stats.MinValue,
                                            "max": stats.MaxValue,
                                            "avg": stats.AvgValue,
                                            "null_count": stats.NullCount
                                        }
                                except Exception as e:
                                    logging.warning(f"Could not get statistics for {row.SchemaName}.{row.TableName}.{column['name']}: {e}")
                    except Exception as e:
                        logging.warning(f"Error collecting table statistics: {e}")
                
                result["tables"].append(table_info)
                
                # Check for cancelation
                if self.is_canceled:
                    return {"status": "canceled", "message": "Operation canceled by user", "partial_results": result}
            
            # Get view information
            self.update_status("Analyzing views...")
            self.update_progress(50)
            
            cursor.execute("""
            SELECT 
                v.name AS ViewName,
                s.name AS SchemaName,
                v.create_date AS CreatedDate,
                v.modify_date AS ModifiedDate,
                CASE WHEN v.is_schema_bound = 1 THEN 'Yes' ELSE 'No' END AS IsSchemaBound,
                ISNULL(sm.definition, '') AS ViewDefinition,
                ISNULL(ep.value, '') AS Description
            FROM sys.views v
            INNER JOIN sys.schemas s ON v.schema_id = s.schema_id
            LEFT JOIN sys.sql_modules sm ON v.object_id = sm.object_id
            LEFT JOIN sys.extended_properties ep ON ep.major_id = v.object_id
                AND ep.minor_id = 0
                AND ep.name = 'MS_Description'
            ORDER BY s.name, v.name
            """)
            
            for row in cursor.fetchall():
                view_info = {
                    "name": row.ViewName,
                    "schema": row.SchemaName,
                    "created_date": row.CreatedDate.isoformat() if row.CreatedDate else None,
                    "modified_date": row.ModifiedDate.isoformat() if row.ModifiedDate else None,
                    "is_schema_bound": row.IsSchemaBound == "Yes",
                    "definition": row.ViewDefinition,
                    "description": row.Description,
                    "columns": []
                }
                
                # Get columns for this view
                try:
                    col_cursor = conn.cursor()
                    col_cursor.execute("""
                    SELECT 
                        c.name AS ColumnName,
                        t.name AS DataType,
                        c.max_length AS MaxLength,
                        c.precision AS Precision,
                        c.scale AS Scale,
                        c.is_nullable AS IsNullable,
                        c.column_id AS OrdinalPosition
                    FROM sys.columns c
                    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
                    WHERE c.object_id = OBJECT_ID(?)
                    ORDER BY c.column_id
                    """, f"[{row.SchemaName}].[{row.ViewName}]")
                    
                    for col_row in col_cursor.fetchall():
                        view_info["columns"].append({
                            "name": col_row.ColumnName,
                            "data_type": col_row.DataType,
                            "max_length": col_row.MaxLength,
                            "precision": col_row.Precision,
                            "scale": col_row.Scale,
                            "is_nullable": bool(col_row.IsNullable),
                            "ordinal_position": col_row.OrdinalPosition
                        })
                except Exception as e:
                    logging.warning(f"Could not get columns for view {row.SchemaName}.{row.ViewName}: {e}")
                
                result["views"].append(view_info)
                
                # Check for cancelation
                if self.is_canceled:
                    return {"status": "canceled", "message": "Operation canceled by user", "partial_results": result}
            
            # Get stored procedure information
            self.update_status("Analyzing stored procedures...")
            self.update_progress(70)
            
            cursor.execute("""
            SELECT 
                p.name AS ProcedureName,
                s.name AS SchemaName,
                p.create_date AS CreatedDate,
                p.modify_date AS ModifiedDate,
                ISNULL(sm.definition, '') AS ProcedureDefinition,
                ISNULL(ep.value, '') AS Description
            FROM sys.procedures p
            INNER JOIN sys.schemas s ON p.schema_id = s.schema_id
            LEFT JOIN sys.sql_modules sm ON p.object_id = sm.object_id
            LEFT JOIN sys.extended_properties ep ON ep.major_id = p.object_id
                AND ep.minor_id = 0
                AND ep.name = 'MS_Description'
            ORDER BY s.name, p.name
            """)
            
            for row in cursor.fetchall():
                proc_info = {
                    "name": row.ProcedureName,
                    "schema": row.SchemaName,
                    "created_date": row.CreatedDate.isoformat() if row.CreatedDate else None,
                    "modified_date": row.ModifiedDate.isoformat() if row.ModifiedDate else None,
                    "definition": row.ProcedureDefinition,
                    "description": row.Description,
                    "parameters": []
                }
                
                # Get parameters for this stored procedure
                try:
                    param_cursor = conn.cursor()
                    param_cursor.execute("""
                    SELECT 
                        p.name AS ParameterName,
                        t.name AS DataType,
                        p.max_length AS MaxLength,
                        p.precision AS Precision,
                        p.scale AS Scale,
                        p.is_output AS IsOutput,
                        p.has_default_value AS HasDefault,
                        p.default_value AS DefaultValue,
                        p.parameter_id AS OrdinalPosition
                    FROM sys.parameters p
                    INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
                    WHERE p.object_id = OBJECT_ID(?)
                    ORDER BY p.parameter_id
                    """, f"[{row.SchemaName}].[{row.ProcedureName}]")
                    
                    for param_row in param_cursor.fetchall():
                        proc_info["parameters"].append({
                            "name": param_row.ParameterName,
                            "data_type": param_row.DataType,
                            "max_length": param_row.MaxLength,
                            "precision": param_row.Precision,
                            "scale": param_row.Scale,
                            "is_output": bool(param_row.IsOutput),
                            "has_default": bool(param_row.HasDefault),
                            "default_value": param_row.DefaultValue,
                            "ordinal_position": param_row.OrdinalPosition
                        })
                except Exception as e:
                    logging.warning(f"Could not get parameters for procedure {row.SchemaName}.{row.ProcedureName}: {e}")
                
                result["stored_procedures"].append(proc_info)
                
                # Check for cancelation
                if self.is_canceled:
                    return {"status": "canceled", "message": "Operation canceled by user", "partial_results": result}
            
            # Get function information
            self.update_status("Analyzing functions...")
            self.update_progress(85)
            
            cursor.execute("""
            SELECT 
                o.name AS FunctionName,
                s.name AS SchemaName,
                o.create_date AS CreatedDate,
                o.modify_date AS ModifiedDate,
                CASE 
                    WHEN o.type = 'FN' THEN 'Scalar Function'
                    WHEN o.type = 'IF' THEN 'Inline Table-valued Function'
                    WHEN o.type = 'TF' THEN 'Table-valued Function'
                    ELSE 'Unknown'
                END AS FunctionType,
                ISNULL(sm.definition, '') AS FunctionDefinition,
                ISNULL(ep.value, '') AS Description
            FROM sys.objects o
            INNER JOIN sys.schemas s ON o.schema_id = s.schema_id
            LEFT JOIN sys.sql_modules sm ON o.object_id = sm.object_id
            LEFT JOIN sys.extended_properties ep ON ep.major_id = o.object_id
                AND ep.minor_id = 0
                AND ep.name = 'MS_Description'
            WHERE o.type IN ('FN', 'IF', 'TF')
            ORDER BY s.name, o.name
            """)
            
            for row in cursor.fetchall():
                func_info = {
                    "name": row.FunctionName,
                    "schema": row.SchemaName,
                    "created_date": row.CreatedDate.isoformat() if row.CreatedDate else None,
                    "modified_date": row.ModifiedDate.isoformat() if row.ModifiedDate else None,
                    "function_type": row.FunctionType,
                    "definition": row.FunctionDefinition,
                    "description": row.Description,
                    "parameters": []
                }
                
                # Get parameters for this function
                try:
                    param_cursor = conn.cursor()
                    param_cursor.execute("""
                    SELECT 
                        p.name AS ParameterName,
                        t.name AS DataType,
                        p.max_length AS MaxLength,
                        p.precision AS Precision,
                        p.scale AS Scale,
                        p.parameter_id AS OrdinalPosition
                    FROM sys.parameters p
                    INNER JOIN sys.types t ON p.user_type_id = t.user_type_id
                    WHERE p.object_id = OBJECT_ID(?)
                    ORDER BY p.parameter_id
                    """, f"[{row.SchemaName}].[{row.FunctionName}]")
                    
                    for param_row in param_cursor.fetchall():
                        func_info["parameters"].append({
                            "name": param_row.ParameterName,
                            "data_type": param_row.DataType,
                            "max_length": param_row.MaxLength,
                            "precision": param_row.Precision,
                            "scale": param_row.Scale,
                            "ordinal_position": param_row.OrdinalPosition
                        })
                except Exception as e:
                    logging.warning(f"Could not get parameters for function {row.SchemaName}.{row.FunctionName}: {e}")
                
                result["functions"].append(func_info)
                
                # Check for cancelation
                if self.is_canceled:
                    return {"status": "canceled", "message": "Operation canceled by user", "partial_results": result}
            
            # Get dependency information
            self.update_status("Analyzing object dependencies...")
            self.update_progress(95)
            
            try:
                cursor.execute("""
                WITH Dependencies AS (
                    SELECT
                        OBJECT_SCHEMA_NAME(referencing_id) AS ReferencingSchema,
                        OBJECT_NAME(referencing_id) AS ReferencingEntity,
                        o1.type_desc AS ReferencingType,
                        COALESCE(OBJECT_SCHEMA_NAME(referenced_id), SCHEMA_NAME(referenced_schema_id), '') AS ReferencedSchema,
                        COALESCE(OBJECT_NAME(referenced_id), referenced_entity_name, '') AS ReferencedEntity,
                        COALESCE(o2.type_desc, '') AS ReferencedType
                    FROM sys.sql_expression_dependencies d
                    LEFT JOIN sys.objects o1 ON d.referencing_id = o1.object_id
                    LEFT JOIN sys.objects o2 ON d.referenced_id = o2.object_id
                    WHERE is_ambiguous = 0
                )
                SELECT * FROM Dependencies
                ORDER BY ReferencingSchema, ReferencingEntity, ReferencedSchema, ReferencedEntity
                """)
                
                for row in cursor.fetchall():
                    result["dependencies"].append({
                        "referencing_schema": row.ReferencingSchema,
                        "referencing_entity": row.ReferencingEntity,
                        "referencing_type": row.ReferencingType,
                        "referenced_schema": row.ReferencedSchema,
                        "referenced_entity": row.ReferencedEntity,
                        "referenced_type": row.ReferencedType
                    })
            except Exception as e:
                logging.warning(f"Could not retrieve dependency information: {e}")
            
            # Get database performance stats
            try:
                cursor.execute("""
                SELECT TOP 10
                    OBJECT_SCHEMA_NAME(s.object_id) + '.' + OBJECT_NAME(s.object_id) AS TableName,
                    i.name AS IndexName,
                    s.user_seeks + s.user_scans + s.user_lookups AS TotalUsage,
                    s.user_seeks,
                    s.user_scans,
                    s.user_lookups,
                    s.user_updates,
                    s.last_user_seek,
                    s.last_user_scan
                FROM sys.dm_db_index_usage_stats s
                INNER JOIN sys.indexes i ON s.object_id = i.object_id AND s.index_id = i.index_id
                WHERE s.database_id = DB_ID()
                ORDER BY TotalUsage DESC
                """)
                
                result["performance_stats"]["top_used_indexes"] = []
                for row in cursor.fetchall():
                    result["performance_stats"]["top_used_indexes"].append({
                        "table_name": row.TableName,
                        "index_name": row.IndexName,
                        "total_usage": row.TotalUsage,
                        "user_seeks": row.user_seeks,
                        "user_scans": row.user_scans,
                        "user_lookups": row.user_lookups,
                        "user_updates": row.user_updates,
                        "last_user_seek": row.last_user_seek.isoformat() if row.last_user_seek else None,
                        "last_user_scan": row.last_user_scan.isoformat() if row.last_user_scan else None
                    })
            except Exception as e:
                logging.warning(f"Could not retrieve performance stats: {e}")
            
            self.update_progress(100)
            self.log_message(f"Completed database analysis for {database}")
            
            # Add analysis summary
            result["summary"] = {
                "table_count": len(result["tables"]),
                "view_count": len(result["views"]),
                "stored_procedure_count": len(result["stored_procedures"]),
                "function_count": len(result["functions"]),
                "schema_count": len(result["schemas"]),
                "dependency_count": len(result["dependencies"]),
                "database_size_mb": result["size_info"].get("database_size_mb", 0)
            }
            
            return result
            
        except Exception as e:
            error_msg = f"Error in database analysis: {str(e)}\n{traceback.format_exc()}"
            logging.error(error_msg)
            return {"status": "error", "error": str(e)}
    
    def generate_documentation(self):
        """Generate database documentation in HTML format"""
        analysis = self.params.get('analysis')
        output_format = self.params.get('format', 'html')
        output_path = self.params.get('output_path')
        database = self.params.get('database', 'Database')
        
        if not analysis:
            self.log_message("No analysis data provided, performing analysis first")
            analysis = self.analyze_database()
        
        self.log_message(f"Generating {output_format} documentation for {database}")
        
        # Create output directory if it doesn't exist
        if output_path:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
        else:
            # Create a temporary file
            output_dir = tempfile.mkdtemp()
            output_path = os.path.join(output_dir, f"{database}_documentation.html")
        
        # Generate HTML documentation
        if output_format == 'html':
            # HTML document generation
            with open(output_path, 'w', encoding='utf-8') as f:
                # Write HTML header
                f.write(f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{database} Database Documentation</title>
    <style>
        body {{ font-family: Arial, sans-serif; line-height: 1.6; margin: 0; padding: 0; color: #333; }}
        .container {{ max-width: 1200px; margin: 0 auto; padding: 20px; }}
        header {{ background-color: {ALLSTATE_BLUE}; color: white; padding: 20px; margin-bottom: 20px; }}
        h1, h2, h3, h4 {{ color: {ALLSTATE_DARK_BLUE}; }}
        table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
        th, td {{ border: 1px solid #ddd; padding: 8px; text-align: left; }}
        th {{ background-color: {ALLSTATE_LIGHT_BLUE}; color: {ALLSTATE_DARK_BLUE}; }}
        tr:nth-child(even) {{ background-color: #f2f2f2; }}
        .nav {{ background-color: #f8f8f8; padding: 10px; margin-bottom: 20px; border-radius: 5px; }}
        .nav a {{ margin-right: 15px; color: {ALLSTATE_BLUE}; text-decoration: none; }}
        .schema-section {{ margin-bottom: 30px; }}
        .object-section {{ margin-bottom: 20px; border: 1px solid #eee; padding: 15px; border-radius: 5px; }}
        .object-section h3 {{ margin-top: 0; }}
        .metadata {{ font-size: 0.9em; color: #666; margin-bottom: 15px; }}
        .description {{ background-color: #f9f9f9; padding: 10px; border-left: 4px solid {ALLSTATE_BLUE}; margin-bottom: 15px; }}
        pre {{ background-color: #f5f5f5; padding: 10px; overflow: auto; border-radius: 3px; }}
        .footer {{ text-align: center; margin-top: 30px; padding: 20px; border-top: 1px solid #eee; font-size: 0.8em; color: #777; }}
        details {{ margin-bottom: 15px; }}
        summary {{ cursor: pointer; padding: 8px; background-color: #f0f0f0; }}
        .tabs {{ display: flex; border-bottom: 1px solid #ccc; margin-bottom: 10px; }}
        .tab {{ padding: 8px 16px; cursor: pointer; background-color: #f0f0f0; margin-right: 2px; border-radius: 5px 5px 0 0; }}
        .tab.active {{ background-color: {ALLSTATE_LIGHT_BLUE}; }}
        .tab-content {{ display: none; }}
        .tab-content.active {{ display: block; }}
        .search-box {{ padding: 10px; margin-bottom: 15px; }}
        .search-box input {{ width: 100%; padding: 8px; }}
        .diagram {{ width: 100%; height: 600px; border: 1px solid #ddd; margin-bottom: 20px; }}
    </style>
</head>
<body>
    <header>
        <div class="container">
            <h1>{database} Database Documentation</h1>
            <p>Generated on {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</p>
        </div>
    </header>
    <div class="container">
        <div class="nav">
            <a href="#summary">Summary</a>
            <a href="#schemas">Schemas</a>
            <a href="#tables">Tables</a>
            <a href="#views">Views</a>
            <a href="#stored-procedures">Stored Procedures</a>
            <a href="#functions">Functions</a>
            <a href="#dependencies">Dependencies</a>
        </div>
        
        <section id="summary">
            <h2>Database Summary</h2>
            <table>
                <tr><th>Database Name</th><td>{database}</td></tr>
                <tr><th>Size</th><td>{analysis.get('size_info', {}).get('database_size_mb', 0)} MB</td></tr>
                <tr><th>Tables</th><td>{analysis.get('summary', {}).get('table_count', len(analysis.get('tables', [])))}</td></tr>
                <tr><th>Views</th><td>{analysis.get('summary', {}).get('view_count', len(analysis.get('views', [])))}</td></tr>
                <tr><th>Stored Procedures</th><td>{analysis.get('summary', {}).get('stored_procedure_count', len(analysis.get('stored_procedures', [])))}</td></tr>
                <tr><th>Functions</th><td>{analysis.get('summary', {}).get('function_count', len(analysis.get('functions', [])))}</td></tr>
                <tr><th>Schemas</th><td>{analysis.get('summary', {}).get('schema_count', len(analysis.get('schemas', {})))}</td></tr>
                <tr><th>Analysis Date</th><td>{analysis.get('analysis_time', datetime.datetime.now().isoformat())}</td></tr>
            </table>
            
            <details>
                <summary>Database Files</summary>
                <table>
                    <thead>
                        <tr>
                            <th>File Name</th>
                            <th>File Path</th>
                            <th>Size (MB)</th>
                            <th>File Group</th>
                            <th>Growth</th>
                        </tr>
                    </thead>
                    <tbody>
""")
                
                # Database files
                for db_file in analysis.get('size_info', {}).get('files', []):
                    growth = f"{db_file.get('growth_value', '')} {db_file.get('growth_unit', '')}"
                    f.write(f"""
                        <tr>
                            <td>{db_file.get('name', '')}</td>
                            <td>{db_file.get('path', '')}</td>
                            <td>{db_file.get('size_mb', '')}</td>
                            <td>{db_file.get('filegroup', '')}</td>
                            <td>{growth}</td>
                        </tr>
""")
                
                f.write("""
                    </tbody>
                </table>
            </details>
        </section>
        
        <section id="schemas">
            <h2>Schemas</h2>
            <table>
                <thead>
                    <tr>
                        <th>Schema Name</th>
                        <th>Owner</th>
                        <th>Tables</th>
                        <th>Views</th>
                        <th>Procedures</th>
                        <th>Functions</th>
                    </tr>
                </thead>
                <tbody>
""")
                
                # Schemas
                for schema_name, schema_info in analysis.get('schemas', {}).items():
                    f.write(f"""
                        <tr>
                            <td>{schema_name}</td>
                            <td>{schema_info.get('owner', '')}</td>
                            <td>{schema_info.get('table_count', 0)}</td>
                            <td>{schema_info.get('view_count', 0)}</td>
                            <td>{schema_info.get('procedure_count', 0)}</td>
                            <td>{schema_info.get('function_count', 0)}</td>
                        </tr>
""")
                
                f.write("""
                    </tbody>
                </table>
            </section>
            
            <section id="tables">
                <h2>Tables</h2>
                <div class="search-box">
                    <input type="text" id="tableSearch" onkeyup="searchTables()" placeholder="Search tables...">
                </div>
""")
                
                # Tables
                for table in analysis.get('tables', []):
                    table_id = f"{table.get('schema', '')}.{table.get('name', '')}".replace('.', '_')
                    f.write(f"""
                <div class="object-section table-item" data-name="{table.get('schema', '')}.{table.get('name', '')}">
                    <h3 id="table-{table_id}">{table.get('schema', '')}.{table.get('name', '')}</h3>
                    <div class="metadata">
                        <strong>Rows:</strong> {table.get('row_count', 0)} | 
                        <strong>Size:</strong> {table.get('size_mb', 0)} MB | 
                        <strong>Created:</strong> {table.get('created_date', 'Unknown')} | 
                        <strong>Modified:</strong> {table.get('modified_date', 'Unknown')}
                    </div>
""")
                    
                    if table.get('description'):
                        f.write(f"""
                    <div class="description">
                        {table.get('description', '')}
                    </div>
""")
                    
                    f.write("""
                    <div class="tabs">
                        <div class="tab active" onclick="switchTab(this, 'columns')">Columns</div>
                        <div class="tab" onclick="switchTab(this, 'indexes')">Indexes</div>
                        <div class="tab" onclick="switchTab(this, 'fks')">Foreign Keys</div>
                        <div class="tab" onclick="switchTab(this, 'stats')">Statistics</div>
                    </div>
                    
                    <div class="tab-content columns active">
                        <table>
                            <thead>
                                <tr>
                                    <th>Column Name</th>
                                    <th>Data Type</th>
                                    <th>Nullable</th>
                                    <th>Default</th>
                                    <th>PK</th>
                                    <th>Identity</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
""")
                    
                    # Columns
                    for column in table.get('columns', []):
                        f.write(f"""
                                <tr>
                                    <td>{column.get('name', '')}</td>
                                    <td>{column.get('formatted_type', column.get('data_type', ''))}</td>
                                    <td>{"Yes" if column.get('is_nullable') else "No"}</td>
                                    <td>{column.get('default_value', '')}</td>
                                    <td>{"Yes" if column.get('is_primary_key') else "No"}</td>
                                    <td>{"Yes" if column.get('is_identity') else "No"}</td>
                                    <td>{column.get('description', '')}</td>
                                </tr>
""")
                    
                    f.write("""
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="tab-content indexes">
                        <table>
                            <thead>
                                <tr>
                                    <th>Index Name</th>
                                    <th>Type</th>
                                    <th>Unique</th>
                                    <th>Columns</th>
                                </tr>
                            </thead>
                            <tbody>
""")
                    
                    # Indexes
                    for index in table.get('indexes', []):
                        f.write(f"""
                                <tr>
                                    <td>{index.get('name', '')}</td>
                                    <td>{index.get('type', '')}</td>
                                    <td>{"Yes" if index.get('unique') else "No"}</td>
                                    <td>{index.get('columns', '')}</td>
                                </tr>
""")
                    
                    f.write("""
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="tab-content fks">
                        <table>
                            <thead>
                                <tr>
                                    <th>FK Name</th>
                                    <th>From Column</th>
                                    <th>To Table</th>
                                    <th>To Column</th>
                                </tr>
                            </thead>
                            <tbody>
""")
                    
                    # Foreign Keys
                    for fk in table.get('foreign_keys', []):
                        f.write(f"""
                                <tr>
                                    <td>{fk.get('name', '')}</td>
                                    <td>{fk.get('source_column', '')}</td>
                                    <td>{fk.get('target_table', '')}</td>
                                    <td>{fk.get('target_column', '')}</td>
                                </tr>
""")
                    
                    f.write("""
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="tab-content stats">
""")
                    
                    # Statistics
                    if table.get('statistics'):
                        f.write("""
                        <table>
                            <thead>
                                <tr>
                                    <th>Column</th>
                                    <th>Min</th>
                                    <th>Max</th>
                                    <th>Avg</th>
                                    <th>Null Count</th>
                                </tr>
                            </thead>
                            <tbody>
""")
                        
                        for col_name, stats in table.get('statistics', {}).items():
                            f.write(f"""
                                <tr>
                                    <td>{col_name}</td>
                                    <td>{stats.get('min', '')}</td>
                                    <td>{stats.get('max', '')}</td>
                                    <td>{stats.get('avg', '')}</td>
                                    <td>{stats.get('null_count', '')}</td>
                                </tr>
""")
                        
                        f.write("""
                            </tbody>
                        </table>
""")
                    else:
                        f.write("""
                        <p>No statistics available for this table.</p>
""")
                    
                    f.write("""
                    </div>
                </div>
""")
                
                f.write("""
            </section>
            
            <section id="views">
                <h2>Views</h2>
                <div class="search-box">
                    <input type="text" id="viewSearch" onkeyup="searchViews()" placeholder="Search views...">
                </div>
""")
                
                # Views
                for view in analysis.get('views', []):
                    view_id = f"{view.get('schema', '')}.{view.get('name', '')}".replace('.', '_')
                    f.write(f"""
                <div class="object-section view-item" data-name="{view.get('schema', '')}.{view.get('name', '')}">
                    <h3 id="view-{view_id}">{view.get('schema', '')}.{view.get('name', '')}</h3>
                    <div class="metadata">
                        <strong>Schema Bound:</strong> {"Yes" if view.get('is_schema_bound') else "No"} |
                        <strong>Created:</strong> {view.get('created_date', 'Unknown')} | 
                        <strong>Modified:</strong> {view.get('modified_date', 'Unknown')}
                    </div>
""")
                    
                    if view.get('description'):
                        f.write(f"""
                    <div class="description">
                        {view.get('description', '')}
                    </div>
""")
                    
                    f.write("""
                    <div class="tabs">
                        <div class="tab active" onclick="switchTab(this, 'columns')">Columns</div>
                        <div class="tab" onclick="switchTab(this, 'definition')">Definition</div>
                    </div>
                    
                    <div class="tab-content columns active">
                        <table>
                            <thead>
                                <tr>
                                    <th>Column Name</th>
                                    <th>Data Type</th>
                                    <th>Nullable</th>
                                </tr>
                            </thead>
                            <tbody>
""")
                    
                    # View Columns
                    for column in view.get('columns', []):
                        f.write(f"""
                                <tr>
                                    <td>{column.get('name', '')}</td>
                                    <td>{column.get('data_type', '')}</td>
                                    <td>{"Yes" if column.get('is_nullable') else "No"}</td>
                                </tr>
""")
                    
                    f.write("""
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="tab-content definition">
                        <pre>{}</pre>
                    </div>
                </div>
""".format(view.get('definition', '').replace('<', '&lt;').replace('>', '&gt;')))
                
                f.write("""
            </section>
            
            <section id="stored-procedures">
                <h2>Stored Procedures</h2>
                <div class="search-box">
                    <input type="text" id="procSearch" onkeyup="searchProcs()" placeholder="Search procedures...">
                </div>
""")
                
                # Stored Procedures
                for proc in analysis.get('stored_procedures', []):
                    proc_id = f"{proc.get('schema', '')}.{proc.get('name', '')}".replace('.', '_')
                    f.write(f"""
                <div class="object-section proc-item" data-name="{proc.get('schema', '')}.{proc.get('name', '')}">
                    <h3 id="proc-{proc_id}">{proc.get('schema', '')}.{proc.get('name', '')}</h3>
                    <div class="metadata">
                        <strong>Created:</strong> {proc.get('created_date', 'Unknown')} | 
                        <strong>Modified:</strong> {proc.get('modified_date', 'Unknown')}
                    </div>
""")
                    
                    if proc.get('description'):
                        f.write(f"""
                    <div class="description">
                        {proc.get('description', '')}
                    </div>
""")
                    
                    f.write("""
                    <div class="tabs">
                        <div class="tab active" onclick="switchTab(this, 'parameters')">Parameters</div>
                        <div class="tab" onclick="switchTab(this, 'definition')">Definition</div>
                    </div>
                    
                    <div class="tab-content parameters active">
                        <table>
                            <thead>
                                <tr>
                                    <th>Parameter Name</th>
                                    <th>Data Type</th>
                                    <th>Output</th>
                                    <th>Default Value</th>
                                </tr>
                            </thead>
                            <tbody>
""")
                    
                    # Parameters
                    for param in proc.get('parameters', []):
                        f.write(f"""
                                <tr>
                                    <td>{param.get('name', '')}</td>
                                    <td>{param.get('data_type', '')}</td>
                                    <td>{"Yes" if param.get('is_output') else "No"}</td>
                                    <td>{param.get('default_value', '')}</td>
                                </tr>
""")
                    
                    f.write("""
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="tab-content definition">
                        <pre>{}</pre>
                    </div>
                </div>
""".format(proc.get('definition', '').replace('<', '&lt;').replace('>', '&gt;')))
                
                f.write("""
            </section>
            
            <section id="functions">
                <h2>Functions</h2>
                <div class="search-box">
                    <input type="text" id="funcSearch" onkeyup="searchFuncs()" placeholder="Search functions...">
                </div>
""")
                
                # Functions
                for func in analysis.get('functions', []):
                    func_id = f"{func.get('schema', '')}.{func.get('name', '')}".replace('.', '_')
                    f.write(f"""
                <div class="object-section func-item" data-name="{func.get('schema', '')}.{func.get('name', '')}">
                    <h3 id="func-{func_id}">{func.get('schema', '')}.{func.get('name', '')}</h3>
                    <div class="metadata">
                        <strong>Type:</strong> {func.get('function_type', '')} |
                        <strong>Created:</strong> {func.get('created_date', 'Unknown')} | 
                        <strong>Modified:</strong> {func.get('modified_date', 'Unknown')}
                    </div>
""")
                    
                    if func.get('description'):
                        f.write(f"""
                    <div class="description">
                        {func.get('description', '')}
                    </div>
""")
                    
                    f.write("""
                    <div class="tabs">
                        <div class="tab active" onclick="switchTab(this, 'parameters')">Parameters</div>
                        <div class="tab" onclick="switchTab(this, 'definition')">Definition</div>
                    </div>
                    
                    <div class="tab-content parameters active">
                        <table>
                            <thead>
                                <tr>
                                    <th>Parameter Name</th>
                                    <th>Data Type</th>
                                </tr>
                            </thead>
                            <tbody>
""")
                    
                    # Parameters
                    for param in func.get('parameters', []):
                        f.write(f"""
                                <tr>
                                    <td>{param.get('name', '')}</td>
                                    <td>{param.get('data_type', '')}</td>
                                </tr>
""")
                    
                    f.write("""
                            </tbody>
                        </table>
                    </div>
                    
                    <div class="tab-content definition">
                        <pre>{}</pre>
                    </div>
                </div>
""".format(func.get('definition', '').replace('<', '&lt;').replace('>', '&gt;')))
                
                f.write("""
            </section>
            
            <section id="dependencies">
                <h2>Object Dependencies</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Referencing Object</th>
                            <th>Referencing Type</th>
                            <th>Referenced Object</th>
                            <th>Referenced Type</th>
                        </tr>
                    </thead>
                    <tbody>
""")
                
                # Dependencies
                for dep in analysis.get('dependencies', []):
                    referencing = f"{dep.get('referencing_schema', '')}.{dep.get('referencing_entity', '')}"
                    referenced = f"{dep.get('referenced_schema', '')}.{dep.get('referenced_entity', '')}"
                    f.write(f"""
                        <tr>
                            <td>{referencing}</td>
                            <td>{dep.get('referencing_type', '')}</td>
                            <td>{referenced}</td>
                            <td>{dep.get('referenced_type', '')}</td>
                        </tr>
""")
                
                f.write("""
                    </tbody>
                </table>
            </section>
            
            <div class="footer">
                <p>Generated by Allstate DB Exporter Pro {__version__} on {datetime.datetime.now().strftime('%Y-%m-%d at %H:%M:%S')}</p>
                <p>© {datetime.datetime.now().year} Allstate</p>
            </div>
        </div>
        
        <script>
            function switchTab(tabElement, tabName) {
                // Get all tabs in the same container
                const tabsContainer = tabElement.parentElement;
                const tabs = tabsContainer.getElementsByClassName('tab');
                
                // Remove active class from all tabs
                for (let i = 0; i < tabs.length; i++) {
                    tabs[i].classList.remove('active');
                }
                
                // Add active class to clicked tab
                tabElement.classList.add('active');
                
                // Get parent container (object section)
                const objectSection = tabsContainer.parentElement;
                
                // Get all tab contents
                const tabContents = objectSection.getElementsByClassName('tab-content');
                
                // Hide all tab contents
                for (let i = 0; i < tabContents.length; i++) {
                    tabContents[i].classList.remove('active');
                }
                
                // Show selected tab content
                const selectedTabContent = objectSection.getElementsByClassName('tab-content ' + tabName)[0];
                selectedTabContent.classList.add('active');
            }
            
            function searchTables() {
                const input = document.getElementById('tableSearch');
                const filter = input.value.toUpperCase();
                const items = document.getElementsByClassName('table-item');
                
                for (let i = 0; i < items.length; i++) {
                    const name = items[i].getAttribute('data-name');
                    if (name.toUpperCase().indexOf(filter) > -1) {
                        items[i].style.display = "";
                    } else {
                        items[i].style.display = "none";
                    }
                }
            }
            
            function searchViews() {
                const input = document.getElementById('viewSearch');
                const filter = input.value.toUpperCase();
                const items = document.getElementsByClassName('view-item');
                
                for (let i = 0; i < items.length; i++) {
                    const name = items[i].getAttribute('data-name');
                    if (name.toUpperCase().indexOf(filter) > -1) {
                        items[i].style.display = "";
                    } else {
                        items[i].style.display = "none";
                    }
                }
            }
            
            function searchProcs() {
                const input = document.getElementById('procSearch');
                const filter = input.value.toUpperCase();
                const items = document.getElementsByClassName('proc-item');
                
                for (let i = 0; i < items.length; i++) {
                    const name = items[i].getAttribute('data-name');
                    if (name.toUpperCase().indexOf(filter) > -1) {
                        items[i].style.display = "";
                    } else {
                        items[i].style.display = "none";
                    }
                }
            }
            
            function searchFuncs() {
                const input = document.getElementById('funcSearch');
                const filter = input.value.toUpperCase();
                const items = document.getElementsByClassName('func-item');
                
                for (let i = 0; i < items.length; i++) {
                    const name = items[i].getAttribute('data-name');
                    if (name.toUpperCase().indexOf(filter) > -1) {
                        items[i].style.display = "";
                    } else {
                        items[i].style.display = "none";
                    }
                }
            }
        </script>
    </body>
</html>
""")
            
            # Open the file in a browser if requested
            if self.params.get('open_browser', False):
                try:
                    webbrowser.open(f"file://{os.path.abspath(output_path)}")
                except Exception as e:
                    self.log_message(f"Could not open browser: {e}")
            
            return {
                "status": "success", 
                "file_path": output_path, 
                "format": output_format,
                "message": f"Documentation generated successfully at {output_path}"
            }
        
        elif output_format == 'json':
            # Save analysis data as JSON
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(analysis, f, indent=2, default=str)
            
            return {
                "status": "success", 
                "file_path": output_path, 
                "format": output_format,
                "message": f"JSON documentation generated successfully at {output_path}"
            }
        
        else:
            self.log_message(f"Unsupported documentation format: {output_format}")
            return {"status": "error", "message": f"Unsupported format: {output_format}"}
    
    def get_database_info(self):
        """Get database information summary"""
        conn = self.params.get('conn')
        
        try:
            cursor = conn.cursor()
            result = {
                "database_info": {},
                "version_info": {},
                "configuration": {},
                "size_info": {},
                "users": [],
                "roles": []
            }
            
            # Get database info
            cursor.execute("""
            SELECT 
                DB_NAME() AS DatabaseName,
                SUSER_SNAME() AS CurrentUser,
                SERVERPROPERTY('ProductVersion') AS ProductVersion,
                SERVERPROPERTY('ProductLevel') AS ProductLevel,
                SERVERPROPERTY('Edition') AS Edition,
                @@VERSION AS VersionString
            """)
            
            row = cursor.fetchone()
            if row:
                result["database_info"]["name"] = row.DatabaseName
                result["database_info"]["current_user"] = row.CurrentUser
                result["version_info"]["product_version"] = row.ProductVersion
                result["version_info"]["product_level"] = row.ProductLevel
                result["version_info"]["edition"] = row.Edition
                result["version_info"]["version_string"] = row.VersionString
            
            # Get database properties
            cursor.execute("""
            SELECT
                d.name AS DatabaseName,
                d.create_date AS CreationDate,
                d.compatibility_level AS CompatibilityLevel,
                d.collation_name AS Collation,
                d.user_access_desc AS UserAccess,
                d.state_desc AS State,
                d.recovery_model_desc AS RecoveryModel,
                CASE WHEN d.is_auto_shrink_on = 1 THEN 'Yes' ELSE 'No' END AS AutoShrink,
                CASE WHEN d.is_auto_close_on = 1 THEN 'Yes' ELSE 'No' END AS AutoClose,
                CASE WHEN d.is_read_only = 1 THEN 'Yes' ELSE 'No' END AS ReadOnly
            FROM sys.databases d
            WHERE d.name = DB_NAME()
            """)
            
            row = cursor.fetchone()
            if row:
                result["database_info"].update({
                    "creation_date": row.CreationDate.isoformat() if row.CreationDate else None,
                    "compatibility_level": row.CompatibilityLevel,
                    "collation": row.Collation,
                    "user_access": row.UserAccess,
                    "state": row.State,
                    "recovery_model": row.RecoveryModel,
                    "auto_shrink": row.AutoShrink,
                    "auto_close": row.AutoClose,
                    "read_only": row.ReadOnly
                })
            
            # Get database size
            cursor.execute("""
            SELECT 
                SUM(CAST(size AS BIGINT) * 8 / 1024) AS SizeMB,
                SUM(CASE WHEN type = 0 THEN CAST(size AS BIGINT) * 8 / 1024 ELSE 0 END) AS DataSizeMB,
                SUM(CASE WHEN type = 1 THEN CAST(size AS BIGINT) * 8 / 1024 ELSE 0 END) AS LogSizeMB
            FROM sys.database_files
            """)
            
            row = cursor.fetchone()
            if row:
                result["size_info"]["total_size_mb"] = row.SizeMB
                result["size_info"]["data_size_mb"] = row.DataSizeMB
                result["size_info"]["log_size_mb"] = row.LogSizeMB
            
            # Get objects counts
            cursor.execute("""
            SELECT 
                (SELECT COUNT(*) FROM sys.tables) AS TableCount,
                (SELECT COUNT(*) FROM sys.views) AS ViewCount,
                (SELECT COUNT(*) FROM sys.procedures) AS ProcedureCount,
                (SELECT COUNT(*) FROM sys.triggers) AS TriggerCount,
                (SELECT COUNT(*) FROM sys.objects WHERE type IN ('FN', 'IF', 'TF')) AS FunctionCount
            """)
            
            row = cursor.fetchone()
            if row:
                result["database_info"]["object_counts"] = {
                    "tables": row.TableCount,
                    "views": row.ViewCount,
                    "procedures": row.ProcedureCount,
                    "triggers": row.TriggerCount,
                    "functions": row.FunctionCount
                }
            
            # Get configuration
            cursor.execute("""
            SELECT name, value, value_in_use, description
            FROM sys.configurations
            ORDER BY name
            """)
            
            for row in cursor.fetchall():
                result["configuration"][row.name] = {
                    "value": row.value,
                    "value_in_use": row.value_in_use,
                    "description": row.description
                }
            
            # Get users
            cursor.execute("""
            SELECT 
                p.name AS UserName,
                p.type_desc AS UserType,
                ISNULL(l.name, 'No login') AS LoginName,
                p.create_date AS CreationDate,
                p.modify_date AS ModifyDate,
                p.default_schema_name AS DefaultSchema
            FROM sys.database_principals p
            LEFT JOIN sys.server_principals l ON p.sid = l.sid
            WHERE p.type IN ('S', 'U', 'G')
            ORDER BY p.name
            """)
            
            for row in cursor.fetchall():
                result["users"].append({
                    "name": row.UserName,
                    "type": row.UserType,
                    "login": row.LoginName,
                    "creation_date": row.CreationDate.isoformat() if row.CreationDate else None,
                    "modify_date": row.ModifyDate.isoformat() if row.ModifyDate else None,
                    "default_schema": row.DefaultSchema
                })
            
            # Get roles
            cursor.execute("""
            SELECT 
                r.name AS RoleName,
                r.type_desc AS RoleType,
                r.create_date AS CreationDate,
                r.modify_date AS ModifyDate,
                r.is_fixed_role AS IsFixedRole
            FROM sys.database_principals r
            WHERE r.type = 'R'
            ORDER BY r.name
            """)
            
            for row in cursor.fetchall():
                result["roles"].append({
                    "name": row.RoleName,
                    "type": row.RoleType,
                    "creation_date": row.CreationDate.isoformat() if row.CreationDate else None,
                    "modify_date": row.ModifyDate.isoformat() if row.ModifyDate else None,
                    "is_fixed_role": bool(row.IsFixedRole)
                })
            
            return result
            
        except Exception as e:
            error_msg = f"Error getting database info: {str(e)}\n{traceback.format_exc()}"
            logging.error(error_msg)
            return {"status": "error", "error": str(e)}
    
    def backup_database(self):
        """Generate a database backup script"""
        conn = self.params.get('conn')
        database = self.params.get('database', '')
        backup_type = self.params.get('backup_type', 'FULL')
        backup_dir = self.params.get('backup_dir', 'C:\\Program Files\\Microsoft SQL Server\\MSSQL16.MSSQLSERVER\\MSSQL\\Backup')
        include_copy_only = self.params.get('include_copy_only', True)
        
        timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        script_path = self.params.get('script_path', f"{database}_backup_{timestamp}.sql")
        
        self.log_message(f"Generating backup script for {database}")
        
        try:
            # Generate the backup script
            copy_only = "COPY_ONLY" if include_copy_only else ""
            backup_script = f"""-- SQL Server Database Backup Script
-- Generated by Allstate DB Exporter Pro v{__version__}
-- Generated on: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M:%S')}
-- Database: {database}
-- Backup Type: {backup_type}

USE master;
GO

-- Set backup compression default
EXEC sys.sp_configure 'backup compression default', 1;
RECONFIGURE WITH OVERRIDE;
GO

-- Backup information
DECLARE @BackupName NVARCHAR(100) = '{database}_{backup_type}_Backup_{timestamp}';
DECLARE @BackupFile NVARCHAR(256) = '{backup_dir}\\{database}_{backup_type}_{timestamp}.bak';

-- Backup execution
BACKUP DATABASE [{database}] 
TO DISK = @BackupFile
WITH {copy_only},
    COMPRESSION,
    NAME = @BackupName,
    STATS = 10,
    CHECKSUM,
    CONTINUE_AFTER_ERROR;
GO

-- Verify the backup
RESTORE VERIFYONLY FROM DISK = '{backup_dir}\\{database}_{backup_type}_{timestamp}.bak';
GO

PRINT 'Backup completed successfully to {backup_dir}\\{database}_{backup_type}_{timestamp}.bak';
"""
            
            # Save the script to a file
            with open(script_path, 'w', encoding='utf-8') as f:
                f.write(backup_script)
            
            return {
                "status": "success",
                "script_path": script_path,
                "backup_file": f"{backup_dir}\\{database}_{backup_type}_{timestamp}.bak",
                "backup_type": backup_type,
                "database": database,
                "timestamp": timestamp,
                "message": f"Backup script generated successfully at {script_path}"
            }
            
        except Exception as e:
            error_msg = f"Error generating backup script: {str(e)}\n{traceback.format_exc()}"
            logging.error(error_msg)
            return {"status": "error", "error": str(e)}

class ConnectionDialog(QDialog):
    """Connection dialog for database connection settings"""
    def __init__(self, parent=None, saved_connections=None):
        super().__init__(parent)
        self.setWindowTitle("Connect to Database")
        self.setMinimumWidth(500)
        
        self.saved_connections = saved_connections or []
        self.selected_connection = None
        
        layout = QVBoxLayout(self)
        
        # Saved connections section
        if self.saved_connections:
            saved_group = QGroupBox("Saved Connections")
            saved_layout = QVBoxLayout(saved_group)
            
            self.conn_list = QListWidget()
            for conn in self.saved_connections:
                self.conn_list.addItem(conn.get('name', 'Unnamed'))
            self.conn_list.itemDoubleClicked.connect(self.load_connection)
            saved_layout.addWidget(self.conn_list)
            
            load_btn = QPushButton("Load Selected")
            load_btn.clicked.connect(self.load_connection)
            delete_btn = QPushButton("Delete Selected")
            delete_btn.clicked.connect(self.delete_connection)
            
            btn_layout = QHBoxLayout()
            btn_layout.addWidget(load_btn)
            btn_layout.addWidget(delete_btn)
            saved_layout.addLayout(btn_layout)
            
            layout.addWidget(saved_group)
        
        # Connection details group
        conn_group = QGroupBox("Connection Details")
        form_layout = QFormLayout(conn_group)
        
        # Connection name (for saving)
        self.conn_name = QLineEdit()
        form_layout.addRow("Connection Name:", self.conn_name)
        
        # Server selection
        server_layout = QHBoxLayout()
        self.server_combo = QComboBox()
        self.server_combo.addItems(["C2SST131", "CRSSP001", "Custom Server"])
        self.server_combo.currentTextChanged.connect(self.on_server_select)
        server_layout.addWidget(self.server_combo, 1)
        
        self.custom_server = QLineEdit()
        self.custom_server.setPlaceholderText("Enter server name")
        self.custom_server.setVisible(False)
        server_layout.addWidget(self.custom_server, 2)
        
        form_layout.addRow("Server:", server_layout)
        
        # Database
        self.database = QLineEdit()
        form_layout.addRow("Database:", self.database)
        
        # Authentication options
        auth_group = QGroupBox("Authentication")
        auth_layout = QVBoxLayout(auth_group)
        
        self.auth_windows = QRadioButton("Windows Authentication")
        self.auth_sql = QRadioButton("SQL Server Authentication")
        self.auth_windows.setChecked(True)
        auth_layout.addWidget(self.auth_windows)
        auth_layout.addWidget(self.auth_sql)
        
        self.auth_windows.toggled.connect(self.on_auth_changed)
        
        # Credentials
        credentials_widget = QWidget()
        credentials_layout = QFormLayout(credentials_widget)
        self.username = QLineEdit()
        self.password = QLineEdit()
        self.password.setEchoMode(QLineEdit.EchoMode.Password)
        credentials_layout.addRow("Username:", self.username)
        credentials_layout.addRow("Password:", self.password)
        credentials_widget.setVisible(False)
        auth_layout.addWidget(credentials_widget)
        
        form_layout.addRow("", auth_group)
        
        # Connection options
        options_group = QGroupBox("Options")
        options_layout = QVBoxLayout(options_group)
        
        self.encrypt = QCheckBox("Encrypt Connection")
        self.encrypt.setChecked(True)
        options_layout.addWidget(self.encrypt)
        
        self.trust_server = QCheckBox("Trust Server Certificate")
        self.trust_server.setChecked(True)
        options_layout.addWidget(self.trust_server)
        
        self.connect_timeout = QSpinBox()
        self.connect_timeout.setRange(5, 60)
        self.connect_timeout.setValue(15)
        self.connect_timeout.setSuffix(" seconds")
        options_layout.addWidget(QLabel("Connection Timeout:"))
        options_layout.addWidget(self.connect_timeout)
        
        form_layout.addRow("", options_group)
        
        # Remember connection
        self.save_connection = QCheckBox("Save connection settings")
        form_layout.addRow("", self.save_connection)
        
        layout.addWidget(conn_group)
        
        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | 
            QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
        
        # For non-Windows platforms, disable Windows Auth
        if platform.system() != "Windows":
            self.auth_windows.setEnabled(False)
            self.auth_windows.setToolTip("Windows Authentication is only available on Windows")
            self.auth_sql.setChecked(True)
            credentials_widget.setVisible(True)
        
        # Store reference to credentials widget for toggling
        self.credentials_widget = credentials_widget
    
    def on_server_select(self, text):
        """Handle server selection change"""
        is_custom = (text == "Custom Server")
        self.custom_server.setVisible(is_custom)
    
    def on_auth_changed(self, checked):
        """Handle authentication type change"""
        self.credentials_widget.setVisible(not checked)
    
    def load_connection(self):
        """Load a saved connection"""
        selected_items = self.conn_list.selectedItems()
        if not selected_items:
            return
            
        selected_name = selected_items[0].text()
        
        # Find the connection by name
        for conn in self.saved_connections:
            if conn.get('name') == selected_name:
                # Load values
                self.conn_name.setText(conn.get('name', ''))
                
                # Server
                server = conn.get('server', '')
                if server in ["C2SST131", "CRSSP001"]:
                    self.server_combo.setCurrentText(server)
                else:
                    self.server_combo.setCurrentText("Custom Server")
                    self.custom_server.setText(server)
                
                # Database
                self.database.setText(conn.get('database', ''))
                
                # Auth
                if conn.get('auth_type') == 'Windows':
                    self.auth_windows.setChecked(True)
                else:
                    self.auth_sql.setChecked(True)
                    self.username.setText(conn.get('username', ''))
                    self.password.setText(conn.get('password', ''))
                
                # Options
                self.encrypt.setChecked(conn.get('encrypt', True))
                self.trust_server.setChecked(conn.get('trust_server', True))
                self.connect_timeout.setValue(conn.get('timeout', 15))
                
                # Save
                self.save_connection.setChecked(True)
                break
    
    def delete_connection(self):
        """Delete a saved connection"""
        selected_items = self.conn_list.selectedItems()
        if not selected_items:
            return
            
        selected_name = selected_items[0].text()
        
        # Confirm deletion
        confirm = QMessageBox.question(
            self, "Confirm Deletion",
            f"Are you sure you want to delete the connection '{selected_name}'?",
            QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
            QMessageBox.StandardButton.No
        )
        
        if confirm == QMessageBox.StandardButton.Yes:
            # Remove from list
            row = self.conn_list.row(selected_items[0])
            self.conn_list.takeItem(row)
            
            # Remove from saved connections
            self.saved_connections = [c for c in self.saved_connections if c.get('name') != selected_name]
    
    def get_connection_info(self):
        """Get the connection information"""
        server = self.server_combo.currentText()
        if server == "Custom Server":
            server = self.custom_server.text()
        
        auth_type = "Windows" if self.auth_windows.isChecked() else "SQL Server"
        
        connection = {
            'name': self.conn_name.text(),
            'server': server,
            'database': self.database.text(),
            'auth_type': auth_type,
            'encrypt': self.encrypt.isChecked(),
            'trust_server': self.trust_server.isChecked(),
            'timeout': self.connect_timeout.value()
        }
        
        if auth_type == "SQL Server":
            connection['username'] = self.username.text()
            connection['password'] = self.password.text()
        
        return {
            'connection': connection,
            'save': self.save_connection.isChecked()
        }

class ExportDialog(QDialog):
    """Dialog for configuring export options"""
    def __init__(self, parent=None, items=None, export_formats=None):
        super().__init__(parent)
        self.setWindowTitle("Export Options")
        self.setMinimumWidth(500)
        
        self.items = items or []
        self.export_formats = export_formats or ['csv', 'excel', 'json', 'html', 'sql']
        
        layout = QVBoxLayout(self)
        
        # Selected items
        selected_group = QGroupBox(f"Selected Items ({len(self.items)})")
        selected_layout = QVBoxLayout(selected_group)
        
        self.item_list = QListWidget()
        for item in self.items:
            self.item_list.addItem(item.get('full_name', item.get('name', 'Unknown')))
        selected_layout.addWidget(self.item_list)
        
        layout.addWidget(selected_group)
        
        # Export format
        format_group = QGroupBox("Export Format")
        format_layout = QVBoxLayout(format_group)
        
        self.format_combo = QComboBox()
        self.format_combo.addItems(self.export_formats)
        self.format_combo.currentTextChanged.connect(self.on_format_changed)
        format_layout.addWidget(self.format_combo)
        
        layout.addWidget(format_group)
        
        # Format-specific options
        self.options_widget = QWidget()
        self.options_layout = QFormLayout(self.options_widget)
        
        # CSV options
        self.csv_options = QWidget()
        csv_layout = QFormLayout(self.csv_options)
        
        self.csv_delimiter = QLineEdit(",")
        csv_layout.addRow("Delimiter:", self.csv_delimiter)
        
        self.csv_encoding = QComboBox()
        self.csv_encoding.addItems(["utf-8", "utf-16", "ascii", "latin1", "cp1252"])
        csv_layout.addRow("Encoding:", self.csv_encoding)
        
        # Excel options
        self.excel_options = QWidget()
        excel_layout = QFormLayout(self.excel_options)
        
        self.excel_sheet_name = QLineEdit("Sheet1")
        excel_layout.addRow("Sheet Name:", self.excel_sheet_name)
        
        self.excel_autofit = QCheckBox("Auto-fit Column Widths")
        self.excel_autofit.setChecked(True)
        excel_layout.addRow("", self.excel_autofit)
        
        # JSON options
        self.json_options = QWidget()
        json_layout = QFormLayout(self.json_options)
        
        self.json_orient = QComboBox()
        self.json_orient.addItems(["records", "columns", "index", "table"])
        json_layout.addRow("JSON Format:", self.json_orient)
        
        self.json_indent = QSpinBox()
        self.json_indent.setRange(0, 8)
        self.json_indent.setValue(4)
        json_layout.addRow("Indent:", self.json_indent)
        
        # Common options
        common_group = QGroupBox("Common Options")
        common_layout = QFormLayout(common_group)
        
        self.file_naming = QComboBox()
        self.file_naming.addItems([
            "item_name", 
            "full_name", 
            "timestamp_item_name"
        ])
        common_layout.addRow("File Naming:", self.file_naming)
        
        self.row_limit = QSpinBox()
        self.row_limit.setRange(0, 1000000)
        self.row_limit.setValue(0)
        self.row_limit.setSuffix(" rows (0 = no limit)")
        self.row_limit.setSpecialValueText("No row limit")
        common_layout.addRow("Row Limit:", self.row_limit)
        
        # Add all option widgets
        self.format_widgets = {
            'csv': self.csv_options,
            'excel': self.excel_options,
            'json': self.json_options
        }
        
        # Only show options for selected format
        for widget in self.format_widgets.values():
            widget.setVisible(False)
            self.options_layout.addWidget(widget)
        
        layout.addWidget(self.options_widget)
        layout.addWidget(common_group)
        
        # Output folder
        folder_group = QGroupBox("Output Folder")
        folder_layout = QHBoxLayout(folder_group)
        
        self.output_folder = QLineEdit()
        self.output_folder.setReadOnly(True)
        folder_layout.addWidget(self.output_folder, 1)
        
        browse_btn = QPushButton("Browse...")
        browse_btn.clicked.connect(self.browse_folder)
        folder_layout.addWidget(browse_btn)
        
        layout.addWidget(folder_group)
        
        # Buttons
        buttons = QDialogButtonBox(
            QDialogButtonBox.StandardButton.Ok | 
            QDialogButtonBox.StandardButton.Cancel
        )
        buttons.accepted.connect(self.accept)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)
        
        # Initialize with CSV options visible
        self.on_format_changed(self.format_combo.currentText())
    
    def on_format_changed(self, format_name):
        """Show format-specific options based on selection"""
        for fmt, widget in self.format_widgets.items():
            widget.setVisible(fmt == format_name.lower())
    
    def browse_folder(self):
        """Browse for output folder"""
        folder = QFileDialog.getExistingDirectory(self, "Select Output Folder")
        if folder:
            self.output_folder.setText(folder)
    
    def get_export_options(self):
        """Get export configuration"""
        format_name = self.format_combo.currentText().lower()
        
        # Common options
        options = {
            'format': format_name,
            'file_naming': self.file_naming.currentText(),
            'row_limit': self.row_limit.value(),
            'folder_path': self.output_folder.text()
        }
        
        # Format-specific options
        if format_name == 'csv':
            options.update({
                'delimiter': self.csv_delimiter.text(),
                'encoding': self.csv_encoding.currentText()
            })
        elif format_name == 'excel':
            options.update({
                'sheet_name': self.excel_sheet_name.text(),
                'auto_fit': self.excel_autofit.isChecked()
            })
        elif format_name == 'json':
            options.update({
                'json_orient': self.json_orient.currentText(),
                'json_indent': self.json_indent.value()
            })
        
        return options

class TableInfoDialog(QDialog):
    """Dialog to display detailed table information"""
    def __init__(self, parent=None, table_info=None):
        super().__init__(parent)
        self.setWindowTitle("Table Information")
        self.setMinimumSize(800, 600)
        
        self.table_info = table_info or {}
        
        layout = QVBoxLayout(self)
        
        # Create tabs
        tabs = QTabWidget()
        
        # Columns tab
        columns_tab = QWidget()
        columns_layout = QVBoxLayout(columns_tab)
        
        columns_table = QTableWidget()
        columns_table.setColumnCount(7)
        columns_table.setHorizontalHeaderLabels([
            "Name", "Type", "Nullable", "Primary Key", 
            "Default", "Description", "Additional Info"
        ])
        
        # Add columns
        columns = self.table_info.get('columns', [])
        columns_table.setRowCount(len(columns))
        
        for i, col in enumerate(columns):
            columns_table.setItem(i, 0, QTableWidgetItem(col.get('name', '')))
            columns_table.setItem(i, 1, QTableWidgetItem(col.get('type_formatted', col.get('type', ''))))
            columns_table.setItem(i, 2, QTableWidgetItem("Yes" if col.get('nullable') else "No"))
            columns_table.setItem(i, 3, QTableWidgetItem("Yes" if col.get('primary_key') else "No"))
            columns_table.setItem(i, 4, QTableWidgetItem(str(col.get('default', ''))))
            columns_table.setItem(i, 5, QTableWidgetItem(str(col.get('description', ''))))
            
            # Additional info (length, precision, etc.)
            info = []
            if col.get('max_length') is not None:
                info.append(f"Length: {col.get('max_length')}")
            if col.get('precision') is not None:
                info.append(f"Precision: {col.get('precision')}")
            if col.get('scale') is not None:
                info.append(f"Scale: {col.get('scale')}")
                
            columns_table.setItem(i, 6, QTableWidgetItem(", ".join(info)))
        
        # Resize columns
        header = columns_table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        
        columns_layout.addWidget(columns_table)
        tabs.addTab(columns_tab, "Columns")
        
        # Indexes tab
        indexes_tab = QWidget()
        indexes_layout = QVBoxLayout(indexes_tab)
        
        indexes_table = QTableWidget()
        indexes_table.setColumnCount(4)
        indexes_table.setHorizontalHeaderLabels([
            "Name", "Type", "Unique", "Columns"
        ])
        
        # Add indexes
        indexes = self.table_info.get('indexes', [])
        indexes_table.setRowCount(len(indexes))
        
        for i, idx in enumerate(indexes):
            indexes_table.setItem(i, 0, QTableWidgetItem(idx.get('name', '')))
            indexes_table.setItem(i, 1, QTableWidgetItem(idx.get('type', '')))
            indexes_table.setItem(i, 2, QTableWidgetItem("Yes" if idx.get('unique') else "No"))
            indexes_table.setItem(i, 3, QTableWidgetItem(idx.get('columns', '')))
        
        # Resize columns
        header = indexes_table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        
        indexes_layout.addWidget(indexes_table)
        tabs.addTab(indexes_tab, "Indexes")
        
        # Foreign Keys tab
        fkeys_tab = QWidget()
        fkeys_layout = QVBoxLayout(fkeys_tab)
        
        fkeys_table = QTableWidget()
        fkeys_table.setColumnCount(4)
        fkeys_table.setHorizontalHeaderLabels([
            "Name", "Source Column", "Target Table", "Target Column"
        ])
        
        # Add foreign keys
        fkeys = self.table_info.get('foreign_keys', [])
        fkeys_table.setRowCount(len(fkeys))
        
        for i, fk in enumerate(fkeys):
            fkeys_table.setItem(i, 0, QTableWidgetItem(fk.get('name', '')))
            fkeys_table.setItem(i, 1, QTableWidgetItem(fk.get('source_column', '')))
            fkeys_table.setItem(i, 2, QTableWidgetItem(fk.get('target_table', '')))
            fkeys_table.setItem(i, 3, QTableWidgetItem(fk.get('target_column', '')))
        
        # Resize columns
        header = fkeys_table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.Stretch)
        
        fkeys_layout.addWidget(fkeys_table)
        tabs.addTab(fkeys_tab, "Foreign Keys")
        
        # Sample Data tab
        data_tab = QWidget()
        data_layout = QVBoxLayout(data_tab)
        
        data_table = QTableWidget()
        
        # Add sample data
        sample_data = self.table_info.get('sample_data', [])
        
        if sample_data:
            # Extract columns from first row
            columns = list(sample_data[0].keys())
            data_table.setColumnCount(len(columns))
            data_table.setHorizontalHeaderLabels(columns)
            
            # Add data rows
            data_table.setRowCount(len(sample_data))
            
            for i, row in enumerate(sample_data):
                for j, col in enumerate(columns):
                    value = row.get(col, '')
                    data_table.setItem(i, j, QTableWidgetItem(str(value)))
        
        # Resize columns
        header = data_table.horizontalHeader()
        header.setSectionResizeMode(QHeaderView.ResizeMode.ResizeToContents)
        
        data_layout.addWidget(data_table)
        tabs.addTab(data_tab, "Sample Data")
        
        layout.addWidget(tabs)
        
        # Buttons
        buttons = QDialogButtonBox(QDialogButtonBox.StandardButton.Close)
        buttons.rejected.connect(self.reject)
        layout.addWidget(buttons)

class QueryEditorDialog(QDialog):
    """SQL query editor dialog"""
    def __init__(self, parent=None):
        super().__init__(parent)
        self.setWindowTitle("SQL Query Editor")
        self.setMinimumSize(800, 600)
        
        layout = QVBoxLayout(self)
        
        # Query editor
        editor_group = QGroupBox("SQL Query")
        editor_layout = QVBoxLayout(editor_group)
        
        self.query_editor = QTextEdit()
        self.query_editor.setPlaceholderText("Enter SQL query here...")
        self.query_editor.setLineWrapMode(QTextEdit.LineWrapMode.NoWrap)
        
        # Set monospace font for editor
        font = QFont("Courier New", 11)
        self.query_editor.setFont(font)
        
        editor_layout.addWidget(self.query_editor)
        
        # Query history dropdown
        history_layout = QHBoxLayout()
        history_layout.addWidget(QLabel("Query History:"))
        
        self.history_combo = QComboBox()
        self.history_combo.setMaximumWidth(400)
        self.history_combo.currentIndexChanged.connect(self.load_query)
        history_layout.addWidget(self.history_combo)
        
        history_layout.addStretch()
        
        editor_layout.addLayout(history_layout)
        
        layout.addWidget(editor_group)
        
        # Buttons
        button_layout = QHBoxLayout()
        
        self.execute_button = QPushButton("Execute Query")
        button_layout.addWidget(self.execute_button)
        
        self.cancel_button = QPushButton("Cancel")
        button_layout.addWidget(self.cancel_button)
        
        button_layout.addStretch()
        
        self.close_button = QPushButton("Close")
        self.close_button.clicked.connect(self.reject)
        button_layout.addWidget(self.close_button)
        
        layout.addLayout(button_layout)
    
    def set_query_history(self, history):
        """Set the query history dropdown items"""
        self.history_combo.clear()
        self.history_combo.addItem("-- Select Previous Query --")
        
        for query in history:
            # Truncate long queries for display
            display = query[:50] + "..." if len(query) > 50 else query
            self.history_combo.addItem(display)
    
    def load_query(self, index):
        """Load a query from history"""
        if index <= 0:  # Ignore the "Select Query" item
            return
            
        # Get the full query text from user data
        query = self.history_combo.itemData(index, Qt.ItemDataRole.UserRole)
        if query:
            self.query_editor.setText(query)
    
    def get_query(self):
        """Get the current query text"""
        return self.query_editor.toPlainText().strip()

if USE_PYQT:
    class AllstateDBExporter(QMainWindow):
        def __init__(self):
            super().__init__()
            self.setWindowTitle("Allstate DB Exporter")
            self.setGeometry(100, 100, 600, 500)
            self.setStyleSheet(f"background-color: {ALLSTATE_WHITE};")

            central_widget = QWidget()
            self.setCentralWidget(central_widget)
            layout = QVBoxLayout(central_widget)

            # Server selection
            server_layout = QHBoxLayout()
            server_layout.addWidget(QLabel("Select Server:"))
            self.server_combo = QComboBox()
            self.server_combo.addItems(["C2SST131", "CRSSP001", "Custom Server"])
            self.server_combo.currentTextChanged.connect(self.on_server_select)
            server_layout.addWidget(self.server_combo)
            layout.addLayout(server_layout)

            # Custom server entry
            self.custom_server_entry = QLineEdit()
            self.custom_server_entry.setPlaceholderText("Enter custom server")
            self.custom_server_entry.setVisible(False)
            layout.addWidget(self.custom_server_entry)

            # Database name
            db_layout = QHBoxLayout()
            db_layout.addWidget(QLabel("Database Name:"))
            self.database_entry = QLineEdit()
            db_layout.addWidget(self.database_entry)
            layout.addLayout(db_layout)

            # Authentication method
            auth_layout = QHBoxLayout()
            auth_layout.addWidget(QLabel("Authentication:"))
            self.auth_combo = QComboBox()
            self.auth_combo.addItems(["Windows", "SQL Server"])
            self.auth_combo.currentTextChanged.connect(self.on_auth_select)
            auth_layout.addWidget(self.auth_combo)
            layout.addLayout(auth_layout)

            # Username and Password (initially hidden)
            self.username_layout = QHBoxLayout()
            self.username_layout.addWidget(QLabel("Username:"))
            self.username_entry = QLineEdit()
            self.username_layout.addWidget(self.username_entry)
            layout.addLayout(self.username_layout)

            self.password_layout = QHBoxLayout()
            self.password_layout.addWidget(QLabel("Password:"))
            self.password_entry = QLineEdit()
            self.password_entry.setEchoMode(QLineEdit.Password)
            self.password_layout.addWidget(self.password_entry)
            layout.addLayout(self.password_layout)

            self.username_layout.setVisible(False)
            self.password_layout.setVisible(False)

            # Table filters
            filter_layout = QHBoxLayout()
            filter_layout.addWidget(QLabel("Table Filters:"))
            self.filters_entry = QLineEdit()
            filter_layout.addWidget(self.filters_entry)
            layout.addLayout(filter_layout)

            # Connect button
            self.connect_button = QPushButton("Connect")
            self.connect_button.clicked.connect(self.connect_to_database)
            layout.addWidget(self.connect_button)

            # Table selection
            self.table_listbox = QListWidget()
            layout.addWidget(self.table_listbox)

            # Export options
            delimiter_layout = QHBoxLayout()
            delimiter_layout.addWidget(QLabel("Delimiter:"))
            self.delimiter_entry = QLineEdit()
            self.delimiter_entry.setText(",")
            delimiter_layout.addWidget(self.delimiter_entry)
            layout.addLayout(delimiter_layout)

            export_name_layout = QHBoxLayout()
            export_name_layout.addWidget(QLabel("Export Name:"))
            self.export_name_entry = QLineEdit()
            export_name_layout.addWidget(self.export_name_entry)
            layout.addLayout(export_name_layout)

            # Export button
            self.export_button = QPushButton("Export")
            self.export_button.clicked.connect(self.export_selected_table)
            layout.addWidget(self.export_button)

        def on_server_select(self, text):
            self.custom_server_entry.setVisible(text == "Custom Server")

        def on_auth_select(self, text):
            show_credentials = (text == "SQL Server")
            self.username_layout.setVisible(show_credentials)
            self.password_layout.setVisible(show_credentials)

        def connect_to_database(self):
            server = self.server_combo.currentText()
            if server == "Custom Server":
                server = self.custom_server_entry.text()
            database = self.database_entry.text()
            
            if not server or not database:
                QMessageBox.critical(self, "Error", "Please enter both server and database names.")
                return

            try:
                if platform.system() == "Windows":
                    if self.auth_combo.currentText() == "Windows":
                        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes'
                    else:
                        username = self.username_entry.text()
                        password = self.password_entry.text()
                        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
                else:  # macOS
                    if self.auth_combo.currentText() == "Windows":
                        QMessageBox.critical(self, "Error", "Windows Authentication is not supported on macOS. Please use SQL Server Authentication.")
                        return
                    else:
                        username = self.username_entry.text()
                        password = self.password_entry.text()
                        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'

                self.conn = pyodbc.connect(connection_string)
                filters = [f.strip() for f in self.filters_entry.text().split(',') if f.strip()]
                filtered_tables = get_filtered_tables(self.conn, filters)
                
                if not filtered_tables:
                    QMessageBox.information(self, "No Tables Found", "No tables found with the specified filters.")
                    return

                self.table_listbox.clear()
                self.table_listbox.addItems(filtered_tables)

                QMessageBox.information(self, "Connection Successful", "Connected to the database successfully.")
            except pyodbc.Error as e:
                QMessageBox.critical(self, "Connection Error", f"Failed to connect to the database: {str(e)}")

        def export_selected_table(self):
            if not hasattr(self, 'conn'):
                QMessageBox.critical(self, "Error", "Please connect to a database first.")
                return

            selected_items = self.table_listbox.selectedItems()
            if not selected_items:
                QMessageBox.critical(self, "Error", "Please select a table to export.")
                return

            table_name = selected_items[0].text()
            delimiter = self.delimiter_entry.text()
            export_name = self.export_name_entry.text()

            if not delimiter or not export_name:
                QMessageBox.critical(self, "Error", "Please enter both delimiter and export name.")
                return

            folder_location = QFileDialog.getExistingDirectory(self, "Select Export Folder")
            if not folder_location:
                return

            try:
                file_path = export_table_to_csv(self.conn, table_name, delimiter, export_name, folder_location)
                QMessageBox.information(self, "Export Successful", f'Table {table_name} exported successfully to {file_path}.')
            except Exception as e:
                QMessageBox.critical(self, "Export Error", f"Failed to export table: {str(e)}")

else:
    class AllstateDBExporter:
        def __init__(self, master):
            self.master = master
            self.master.title("Allstate DB Exporter")
            self.master.geometry("600x500")
            self.master.configure(bg=ALLSTATE_WHITE)

            self.style = ttk.Style()
            self.style.configure("TLabel", background=ALLSTATE_WHITE, foreground=ALLSTATE_BLUE)
            self.style.configure("TButton", background=ALLSTATE_BLUE, foreground=ALLSTATE_WHITE)
            self.style.configure("TEntry", fieldbackground=ALLSTATE_GRAY)
            self.style.configure("TCombobox", fieldbackground=ALLSTATE_GRAY)

            self.create_widgets()

        def create_widgets(self):
            # Server selection
            ttk.Label(self.master, text="Select Server:").grid(row=0, column=0, padx=10, pady=10, sticky="w")
            self.server_var = tk.StringVar()
            self.server_combo = ttk.Combobox(self.master, textvariable=self.server_var, values=["C2SST131", "CRSSP001", "Custom Server"])
            self.server_combo.grid(row=0, column=1, padx=10, pady=10, sticky="we")
            self.server_combo.bind("<<ComboboxSelected>>", self.on_server_select)

            self.custom_server_entry = ttk.Entry(self.master, state="disabled")
            self.custom_server_entry.grid(row=1, column=1, padx=10, pady=10, sticky="we")

            # Database name
            ttk.Label(self.master, text="Database Name:").grid(row=2, column=0, padx=10, pady=10, sticky="w")
            self.database_entry = ttk.Entry(self.master)
            self.database_entry.grid(row=2, column=1, padx=10, pady=10, sticky="we")

            # Authentication method
            ttk.Label(self.master, text="Authentication:").grid(row=3, column=0, padx=10, pady=10, sticky="w")
            self.auth_var = tk.StringVar(value="Windows")
            self.auth_combo = ttk.Combobox(self.master, textvariable=self.auth_var, values=["Windows", "SQL Server"])
            self.auth_combo.grid(row=3, column=1, padx=10, pady=10, sticky="we")
            self.auth_combo.bind("<<ComboboxSelected>>", self.on_auth_select)

            # Username and Password (initially hidden)
            self.username_label = ttk.Label(self.master, text="Username:")
            self.username_entry = ttk.Entry(self.master)
            self.password_label = ttk.Label(self.master, text="Password:")
            self.password_entry = ttk.Entry(self.master, show="*")

            # Table filters
            ttk.Label(self.master, text="Table Filters:").grid(row=6, column=0, padx=10, pady=10, sticky="w")
            self.filters_entry = ttk.Entry(self.master)
            self.filters_entry.grid(row=6, column=1, padx=10, pady=10, sticky="we")

            # Connect button
            self.connect_button = ttk.Button(self.master, text="Connect", command=self.connect_to_database)
            self.connect_button.grid(row=7, column=0, columnspan=2, pady=20)

            # Table selection
            self.table_listbox = tk.Listbox(self.master, selectmode=tk.SINGLE)
            self.table_listbox.grid(row=8, column=0, columnspan=2, padx=10, pady=10, sticky="nsew")

            # Export options
            ttk.Label(self.master, text="Delimiter:").grid(row=9, column=0, padx=10, pady=10, sticky="w")
            self.delimiter_entry = ttk.Entry(self.master)
            self.delimiter_entry.grid(row=9, column=1, padx=10, pady=10, sticky="we")
            self.delimiter_entry.insert(0, ",")

            ttk.Label(self.master, text="Export Name:").grid(row=10, column=0, padx=10, pady=10, sticky="w")
            self.export_name_entry.grid(row=10, column=1, padx=10, pady=10, sticky="we")

            # Export button
            self.export_button = ttk.Button(self.master, text="Export", command=self.export_selected_table)
            self.export_button.grid(row=11, column=0, columnspan=2, pady=20)

            self.master.columnconfigure(1, weight=1)
            self.master.rowconfigure(8, weight=1)

        def on_server_select(self, event):
            if self.server_var.get() == "Custom Server":
                self.custom_server_entry.config(state="normal")
            else:
                self.custom_server_entry.config(state="disabled")

        def on_auth_select(self, event):
            if self.auth_var.get() == "SQL Server":
                self.username_label.grid(row=4, column=0, padx=10, pady=10, sticky="w")
                self.username_entry.grid(row=4, column=1, padx=10, pady=10, sticky="we")
                self.password_label.grid(row=5, column=0, padx=10, pady=10, sticky="w")
                self.password_entry.grid(row=5, column=1, padx=10, pady=10, sticky="we")
            else:
                self.username_label.grid_remove()
                self.username_entry.grid_remove()
                self.password_label.grid_remove()
                self.password_entry.grid_remove()

        def connect_to_database(self):
            server = self.server_var.get()
            if server == "Custom Server":
                server = self.custom_server_entry.get()
            database = self.database_entry.get()
            
            if not server or not database:
                messagebox.showerror("Error", "Please enter both server and database names.")
                return

            try:
                if platform.system() == "Windows":
                    if self.auth_var.get() == "Windows":
                        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};Trusted_Connection=yes'
                    else:
                        username = self.username_entry.get()
                        password = self.password_entry.get()
                        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'
                else:  # macOS
                    if self.auth_var.get() == "Windows":
                        messagebox.showerror("Error", "Windows Authentication is not supported on macOS. Please use SQL Server Authentication.")
                        return
                    else:
                        username = self.username_entry.get()
                        password = self.password_entry.get()
                        connection_string = f'DRIVER={{ODBC Driver 17 for SQL Server}};SERVER={server};DATABASE={database};UID={username};PWD={password}'

                self.conn = pyodbc.connect(connection_string)
                filters = [f.strip() for f in self.filters_entry.get().split(',') if f.strip()]
                filtered_tables = get_filtered_tables(self.conn, filters)
                
                if not filtered_tables:
                    messagebox.showinfo("No Tables Found", "No tables found with the specified filters.")
                    return

                self.table_listbox.delete(0, tk.END)
                for table in filtered_tables:
                    self.table_listbox.insert(tk.END, table)

                messagebox.showinfo("Connection Successful", "Connected to the database successfully.")
            except pyodbc.Error as e:
                messagebox.showerror("Connection Error", f"Failed to connect to the database: {str(e)}")

        def export_selected_table(self):
            if not hasattr(self, 'conn'):
                messagebox.showerror("Error", "Please connect to a database first.")
                return

            selected_indices = self.table_listbox.curselection()
            if not selected_indices:
                messagebox.showerror("Error", "Please select a table to export.")
                return

            table_name = self.table_listbox.get(selected_indices[0])
            delimiter = self.delimiter_entry.get()
            export_name = self.export_name_entry.get()

            if not delimiter or not export_name:
                messagebox.showerror("Error", "Please enter both delimiter and export name.")
                return

            folder_location = filedialog.askdirectory(title="Select Export Folder")
            if not folder_location:
                return

            try:
                file_path = export_table_to_csv(self.conn, table_name, delimiter, export_name, folder_location)
                messagebox.showinfo("Export Successful", f'Table {table_name} exported successfully to {file_path}.')
            except Exception as e:
                messagebox.showerror("Export Error", f"Failed to export table: {str(e)}")

def main():
    logging.info("Starting the application")
    if USE_PYQT:
        logging.info("Using PyQt5 GUI")
        app = QApplication(sys.argv)
        window = AllstateDBExporter()
        window.show()
        sys.exit(app.exec_())
    else:
        logging.info("Using tkinter GUI")
        root = tk.Tk()
        app = AllstateDBExporter(root)
        root.mainloop()

if __name__ == "__main__":
    main()