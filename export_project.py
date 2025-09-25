import os
import pyperclip

# --- CONFIGURATION ---
# ---------------------
# This script will scan all files starting from the directory where it is run.
# You can customize its behavior by modifying the lists below.

# Directories to completely exclude from the export.
# Ideal for ignoring virtual environments, git history, IDE settings, etc.
EXCLUDE_DIRS = {
    '.git',
    'venv',
    '.venv',
    '__pycache__',
    '.vscode',
    '.idea',
    'node_modules',
    'dist',
    'build',
    'result'
}

# Specific files to exclude from the export.
# The script will automatically exclude itself.
EXCLUDE_FILES = {
    '.DS_Store',
    '.gitignore'
}

# File extensions to exclude.
# Useful for skipping compiled files, images, or other non-text assets.
EXCLUDE_EXTENSIONS = {
    '.pyc',
    '.pyo',
    '.pyd',
    '.so',
    '.dll',
    '.exe',
    # Common image formats
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.svg',
    # Common document formats
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    # Font files
    '.ttf', '.woff', '.woff2',
    # Archives
    '.zip', '.tar', '.gz', '.rar'
}


# ---------------------
# --- END OF CONFIGURATION ---


def is_binary(filepath):
    """
    Checks if a file is likely binary by reading a chunk of its content.
    Binary files often contain null bytes, which are invalid in most text encodings.

    :param filepath: The path to the file.
    :return: True if the file seems binary, False otherwise.
    """
    try:
        with open(filepath, 'rb') as f:
            chunk = f.read(1024)  # Read the first 1KB
            return b'\0' in chunk
    except Exception:
        return True  # If we can't read it, treat it as binary/unwanted


def create_export_string():
    """
    Traverses the project directory, reads the content of all relevant files,
    and formats them into a single string with professional separators.

    :return: A single string containing all concatenated file contents.
    """
    project_root = os.getcwd()
    output_parts = []

    # Automatically exclude the script itself
    script_name = os.path.basename(__file__)
    EXCLUDE_FILES.add(script_name)

    # Use os.walk to recursively traverse the directory tree
    for dirpath, dirnames, filenames in os.walk(project_root, topdown=True):
        # Modify dirnames in-place to prevent os.walk from descending into excluded directories
        dirnames[:] = [d for d in dirnames if d not in EXCLUDE_DIRS]

        for filename in sorted(filenames):
            # Apply file-level exclusion rules
            if filename in EXCLUDE_FILES:
                continue
            if os.path.splitext(filename)[1].lower() in EXCLUDE_EXTENSIONS:
                continue

            filepath = os.path.join(dirpath, filename)

            # Final check for binary content
            if is_binary(filepath):
                continue

            # Get a clean, relative path for the header
            relative_path = os.path.relpath(filepath, project_root)
            # Use forward slashes for cross-platform consistency
            relative_path_for_header = relative_path.replace(os.sep, '/')

            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()

                # Define a clear and professional separator for the LLM
                header = f"--- FILE: {relative_path_for_header} ---"

                # Assemble the block for this file
                file_block = [
                    header,
                    "",  # Adds a blank line for readability
                    content,
                    "\n"  # Adds trailing newlines for separation
                ]
                output_parts.append("\n".join(file_block))

            except Exception as e:
                print(f"Skipping file {filepath} due to read error: {e}")

    # Join all file blocks with two newlines for extra spacing
    return "\n\n".join(output_parts)


if __name__ == "__main__":
    print("🚀 Starting project export...")
    final_string = create_export_string()

    if not final_string.strip():
        print("⚠️ No files were found to export based on the current configuration.")
    else:
        try:
            pyperclip.copy(final_string)
            print("✅ Success! Project source code has been formatted and copied to the clipboard.")
            print("You can now paste it into the LLM for analysis.")
        except pyperclip.PyperclipException:
            print("❌ Error: Could not access the system clipboard.")
            print(
                "This can happen when running in an environment without a graphical interface (e.g., a server SSH session).")

            output_filename = "_project_export_for_llm.txt"
            try:
                with open(output_filename, 'w', encoding='utf-8') as f:
                    f.write(final_string)
                print(f"📄 As a fallback, the output has been saved to the file: {output_filename}")
            except Exception as e:
                print(f"🔥 Critical Error: Could not even write to fallback file. Error: {e}")