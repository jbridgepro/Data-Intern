/\*\*

- File path: src/features/sql-export-wizard/README.md
-
- SQL Export Wizard Feature Documentation
-
- A comprehensive database import/export tool with query capabilities
  \*/

# SQL Export Wizard

Enterprise-grade SQL Server connection manager with intuitive UI for importing, exporting, querying, and managing database data with multiple format support and advanced transformation capabilities.

## Features

### Connection Management

- Support for multiple database types:
  - Microsoft SQL Server (Primary)
  - Azure SQL Database
  - MySQL/MariaDB
  - PostgreSQL
  - SQLite
- Multiple authentication methods:
  - Windows Authentication (Integrated Security)
  - SQL Server Authentication (Username/Password)
  - Azure Active Directory
  - Connection Strings (Advanced)
- Connection testing and validation
- Saved connections management
- Connection encryption for stored passwords

### Database Explorer

- Tree view of database structure
- Browse databases, schemas, tables, views, stored procedures, and functions
- Table metadata display (row counts, sizes)
- Search functionality
- Context menus for quick actions

### Export Mode

- Export entire tables or custom queries
- Multiple export formats:
  - CSV (Comma Separated Values)
  - Excel (.xlsx)
  - JSON (Array or Line-delimited)
  - XML
  - SQL INSERT Statements
  - Parquet (Apache Parquet)
- Format-specific options (delimiters, encoding, formatting)
- Column selection
- Row filtering and limits
- Batch export support
- Preview functionality

### Import Mode

- File-based data import
- Automatic column mapping
- Manual column mapping editor
- Data type conversion
- Validation rules
- Error handling options
- Batch import with transactions
- Create new tables or append to existing

### Query Mode

- SQL editor with syntax highlighting
- Query execution
- Results grid with pagination
- Sortable and filterable columns
- Export query results
- Query history and favorites

## File Structure

```
sql-export-wizard/
├── components/
│   ├── ConnectionManager.tsx       # Connection selection and management
│   ├── ConnectionDialog.tsx        # Create/edit connection dialog
│   ├── SavedConnectionsDialog.tsx  # Manage saved connections
│   ├── DatabaseExplorer.tsx        # Database structure tree view
│   ├── ExportPanel.tsx             # Export configuration panel
│   ├── ImportPanel.tsx             # Import configuration panel
│   ├── QueryPanel.tsx              # SQL query editor and execution
│   └── ResultsGrid.tsx             # Data grid for displaying results
├── utils/
│   ├── databaseConnection.ts       # Connection string building and validation
│   └── storage.ts                  # Local storage management
├── types.ts                        # TypeScript type definitions
├── SQLExportWizard.tsx             # Main component
└── README.md                       # This file
```

## Usage

1. **Connect to Database**
   - Click "New Connection" or select from saved connections
   - Configure server details and authentication
   - Test connection before saving

2. **Explore Database**
   - Browse database structure in the left panel
   - Click on tables/views to select them for operations

3. **Export Data**
   - Select "Export" mode
   - Choose source (table or custom query)
   - Select export format and configure options
   - Set destination folder and filename
   - Click "Export"

4. **Import Data**
   - Select "Import" mode
   - Choose source file
   - Configure file format settings
   - Map columns to database columns
   - Set destination table
   - Click "Import"

5. **Execute Queries**
   - Select "Query" mode
   - Write SQL query in the editor
   - Click "Execute" to run query
   - View results in the results grid

## Data Storage

All user data is stored in browser localStorage:

- Connections: `sql-export-wizard-connections`
- Templates: `sql-export-wizard-templates`
- Queries: `sql-export-wizard-queries`
- Schedules: `sql-export-wizard-schedules`
- Settings: `sql-export-wizard-settings`

## Backend Integration

**Note:** This is a frontend implementation. For production use, you'll need to:

1. Create backend API endpoints for:
   - Database connection testing
   - Query execution
   - Data export/import
   - Database schema discovery

2. Install database drivers:
   - For SQL Server: `pyodbc`, `pymssql`, or `sqlalchemy`
   - For MySQL: `mysql-connector-python` or `pymysql`
   - For PostgreSQL: `psycopg2`
   - For SQLite: Built-in with Python

3. Implement security:
   - Encrypt passwords at rest
   - Use secure connection strings
   - Validate user permissions
   - Sanitize SQL queries

## Future Enhancements

- [ ] Progress panels with real-time updates
- [ ] Settings panel for preferences
- [ ] Template management UI
- [ ] Scheduled exports
- [ ] Visual query builder
- [ ] Data transformation pipeline
- [ ] Compare & sync functionality
- [ ] Advanced validation rules editor

## Notes

- Passwords are currently base64 encoded (not secure) - implement proper encryption for production
- Connection testing is simulated - implement actual database connection in backend
- Database schema discovery is mocked - implement actual schema queries
- Export/Import operations are stubbed - implement actual file operations in backend
