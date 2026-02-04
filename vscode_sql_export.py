import vscode
import json

def get_database_info():
    # In a real scenario, you might want to get this information from a configuration file or user input
    return {
        "database": "YourDatabaseName",
        "schema": "dbo",
        "table": "YourTableName"
    }

def create_sql_query(info):
    return f"SELECT * FROM [{info['database']}].[{info['schema']}].[{info['table']}]"

def open_new_sql_editor(query):
    # Create a new untitled document
    new_document = vscode.workspace.openTextDocument({"language": "sql", "content": query})
    
    # Show the new document in the editor
    vscode.window.showTextDocument(new_document)

def main():
    # Get database information
    db_info = get_database_info()
    
    # Create SQL query
    sql_query = create_sql_query(db_info)
    
    # Open new SQL editor with the query
    open_new_sql_editor(sql_query)

# This line is necessary for VS Code extensions
activate = lambda context: main()