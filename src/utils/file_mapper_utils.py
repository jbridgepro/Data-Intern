import os
import json

def get_structure_data(path, recursive=True):
    try:
        def process_entry(entry_path):
            entry_name = os.path.basename(entry_path)
            is_dir = os.path.isdir(entry_path)
            
            result = {
                "name": entry_name,
                "type": "folder" if is_dir else "file"
            }
            
            if is_dir and recursive:
                try:
                    children = []
                    # sorted for consistent order
                    for child in sorted(os.listdir(entry_path)):
                        child_path = os.path.join(entry_path, child)
                        child_data = process_entry(child_path)
                        if child_data:
                            children.append(child_data)
                    
                    if children:
                        result["children"] = children
                except PermissionError:
                    pass # Skip if permission denied
            
            return result

        return process_entry(path)
    except Exception as e:
        print(f"Error getting structure: {e}")
        return None

def format_data(data, format_type):
    if format_type == 'json':
        return json.dumps(data, indent=2)
    elif format_type == 'txt':
        return format_to_txt(data)
    elif format_type == 'xml':
        return format_to_xml(data)
    elif format_type == 'mermaid':
        return format_to_mermaid(data)
    elif format_type == 'dot':
        return format_to_dot(data)
    return str(data)

def format_to_txt(data, indent=''):
    result = ''
    if isinstance(data, list):
        for item in data:
            result += format_to_txt(item, indent)
    else:
        icon = '📁' if data['type'] == 'folder' else '📄'
        result += f"{indent}{icon} {data['name']}\n"
        if 'children' in data:
            for child in data['children']:
                result += format_to_txt(child, indent + '  ')
    return result

def format_to_xml(data):
    def to_xml(item):
        if item['type'] == 'file':
            return f'<file name="{item["name"]}"/>'
        result = f'<folder name="{item["name"]}">'
        if 'children' in item:
            result += ''.join(to_xml(child) for child in item['children'])
        return result + '</folder>'
    
    content = ""
    if isinstance(data, list):
        content = "".join(to_xml(item) for item in data)
    else:
        content = to_xml(data)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<root>{content}</root>'

def format_to_mermaid(data):
    result = 'graph TD\n'
    id_counter = 0

    def process_item(item, parent_id=None):
        nonlocal id_counter
        current_id = f'id{id_counter}'
        id_counter += 1
        icon = '📁' if item['type'] == 'folder' else '📄'
        # Sanitize name for mermaid label
        safe_name = item["name"].replace('"', "'").replace('[', '(').replace(']', ')')
        result = f'    {current_id}["{icon} {safe_name}"]\n'
        if parent_id is not None:
            result += f'    {parent_id} --> {current_id}\n'
        if 'children' in item:
            for child in item['children']:
                result += process_item(child, current_id)
        return result

    if isinstance(data, list):
        for item in data:
            result += process_item(item)
    else:
        result += process_item(data)
    return result

def format_to_dot(data):
    result = 'digraph FolderStructure {\n'
    id_counter = 0

    def process_item(item, parent_id=None):
        nonlocal id_counter
        current_id = f'id{id_counter}'
        id_counter += 1
        shape = 'folder' if item['type'] == 'folder' else 'note'
        safe_name = item["name"].replace('"', '\\"')
        result = f'    {current_id} [label="{safe_name}" shape="{shape}"];\n'
        if parent_id is not None:
            result += f'    {parent_id} -> {current_id};\n'
        if 'children' in item:
            for child in item['children']:
                result += process_item(child, current_id)
        return result

    if isinstance(data, list):
        for item in data:
            result += process_item(item)
    else:
        result += process_item(data)
    return result + '}'
