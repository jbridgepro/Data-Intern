# Allstate DB Exporter Pro

A powerful database export and documentation tool designed for SQL Server, with full SSMS 2022 compatibility.

![Allstate DB Exporter Pro](Folder_icon.png)

## Features

### Enhanced in v2.0.0
- Full compatibility with SSMS 2022 and new ODBC Drivers
- Database documentation generation in multiple formats
- Enhanced data type detection and conversion
- Advanced search and filtering for database objects
- Multi-format export (CSV, Excel, JSON, HTML, SQL)
- Table relationship visualization
- Query history and management
- Database schema analysis and reporting
- Batch export capabilities for multiple tables
- Connection profile management
- Full support for Windows Authentication and SQL Authentication
- Support for PyQt6/PyQt5 for a modern interface

### Core Functionality
- Connect to SQL Server databases (local or remote)
- Browse and search tables, views, stored procedures
- Export data with highly customizable options
- Run custom SQL queries and export results
- Analyze database structure and relationships
- Generate comprehensive database documentation

## System Requirements

- Windows 10/11 or macOS 10.15+
- Microsoft ODBC Driver for SQL Server (Driver 17 or 18 recommended)
- Python 3.8 or later

## Installation

### Prerequisites
The following Python packages are required:
```
pip install pyodbc pandas sqlalchemy openpyxl xlsxwriter
pip install PyQt6  # or PyQt5 as a fallback
```

### SQL Server ODBC Drivers
For connectivity to SQL Server, you need the Microsoft ODBC Driver installed:
- Windows: [Download Microsoft ODBC Driver](https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server)
- macOS: [Install ODBC Driver on macOS](https://learn.microsoft.com/en-us/sql/connect/odbc/linux-mac/install-microsoft-odbc-driver-sql-server-macos)

### Running the Application
To run the application with all dependencies and environment variables set correctly:
```
python run_allstate_db_exporter.py
```

This launcher script will:
1. Check for required dependencies
2. Find the correct Qt plugins path
3. Set necessary environment variables
4. Launch the main application with the appropriate Python interpreter

## Usage Guide

### Connecting to a Database
1. Select or enter your SQL Server instance name
2. Enter the database name
3. Choose authentication method
4. For SQL Server authentication, enter username and password
5. Click "Connect"

### Exporting Data
1. Browse and select tables, views or stored procedure results
2. Choose export format (CSV, Excel, JSON, HTML, SQL)
3. Configure format-specific options
4. Select output location
5. Click "Export"

### Running Custom Queries
1. Open the Query Editor from the Tools menu
2. Enter your SQL query
3. Click "Execute" to run the query
4. View results in the result grid
5. Export results if needed

### Generating Documentation
1. Select a database
2. Choose Documentation from the Tools menu
3. Select output format (HTML, JSON, Markdown)
4. Configure documentation options
5. Generate documentation

## Features by Task

### Data Export
- CSV export with custom delimiters and encoding
- Excel export with formatting and auto-column width
- JSON export with multiple structure options
- SQL scripts with CREATE TABLE and INSERT statements
- HTML table exports for web use
- Parquet format support for big data applications

### Database Analysis
- Table relationship mapping
- Schema visualization
- Database size and growth analysis
- Index usage statistics
- Foreign key dependency tracking
- Column data distribution analysis

### Documentation
- Comprehensive HTML documentation with search and navigation
- Interactive schema diagrams
- Table and column details with constraints
- Stored procedure and function documentation
- Data dictionary generation

## License
© 2025 Allstate. All rights reserved.

## Support
For support, please contact the IT department or file an issue in the internal issue tracker.

---

*Allstate DB Exporter Pro v2.0.0 is an internal tool designed specifically for Allstate database environments.*