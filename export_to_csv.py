import os
import csv
import pyodbc
from tkinter import messagebox, Tk
import tkinter.filedialog as filedialog

def export_to_csv(db_name, table_name, file_path, delimiter, custom_query=None):
    try:
        # Connect to the database
        conn_str = (
            r'DRIVER={ODBC Driver 17 for SQL Server};'
            r'SERVER=C2SST131;'
            r'DATABASE=' + db_name + ';'
            r'Trusted_Connection=yes;'
        )
        conn = pyodbc.connect(conn_str)
        cursor = conn.cursor()

        # Construct SQL query
        if custom_query:
            sql_query = custom_query
        else:
            sql_query = f"SELECT * FROM {db_name}.dbo.{table_name}"

        # Execute query
        cursor.execute(sql_query)

        # Get column names
        columns = [column[0] for column in cursor.description]

        # Write to CSV
        with open(file_path, 'w', newline='') as csvfile:
            csv_writer = csv.writer(csvfile, delimiter=delimiter)
            csv_writer.writerow(columns)  # Write header
            csv_writer.writerows(cursor)  # Write data

        conn.close()
        return True
    except Exception as e:
        messagebox.showerror("Error", f"An error occurred: {str(e)}")
        return False

def create_unique_filename(file_path, file_name):
    full_path = os.path.join(file_path, file_name)
    base_name, extension = os.path.splitext(file_name)
    counter = 1

    while os.path.exists(full_path):
        user_response = messagebox.askyesnocancel("File Exists", f"File '{full_path}' already exists. Do you want to replace it?")
        
        if user_response is True:  # Yes
            return full_path
        elif user_response is False:  # No
            full_path = os.path.join(file_path, f"{base_name}_{counter}{extension}")
            counter += 1
        else:  # Cancel
            return None

    return full_path

def main():
    # Initialize Tk root (but hide the main window)
    root = Tk()
    root.withdraw()

    # Get input from user (you may want to create a GUI for this in a real application)
    db_name = input("Enter database name: ")
    table_name = input("Enter table name: ")
    file_path = filedialog.askdirectory(title="Select directory for CSV export")
    delimiter = input("Enter delimiter (press Enter for comma): ") or ","
    custom_file_name = input("Enter custom file name (press Enter for default): ")
    custom_query = input("Enter custom SQL query (press Enter for default): ")

    if not file_path:
        messagebox.showerror("Error", "Invalid folder path. Please enter a valid path.")
        return

    # Create file name
    file_name = f"{custom_file_name or table_name}.csv"
    full_path = create_unique_filename(file_path, file_name)

    if full_path is None:
        return  # User cancelled the operation

    # Export to CSV
    if export_to_csv(db_name, table_name, full_path, delimiter, custom_query):
        messagebox.showinfo("Success", "Export completed successfully.")
    else:
        messagebox.showerror("Error", "Export failed.")

if __name__ == "__main__":
    main()