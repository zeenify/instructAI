"""
Code formatter for generated code blocks
Formats code based on language for better readability
"""
import re


def detect_language(code: str) -> str:
    """
    Detect programming language from code

    Args:
        code: Code string

    Returns:
        Language identifier ('java', 'python', 'javascript', etc.)
    """
    # Check for Java
    if 'public class' in code or 'public static void main' in code or 'System.out.println' in code:
        return 'java'

    # Check for Python
    if code.strip().startswith('def ') or 'import ' in code or code.strip().startswith('@'):
        return 'python'

    # Check for JavaScript
    if 'function ' in code or 'const ' in code or 'let ' in code or 'console.log' in code:
        return 'javascript'

    # Check for PHP
    if code.strip().startswith('<?php') or '$' in code:
        return 'php'

    # Default
    return 'unknown'


def format_java_code(code: str) -> str:
    """Format Java code with proper indentation and spacing"""
    lines = code.split('\n')
    formatted = []
    indent_level = 0
    indent_str = '  '  # 2 spaces per level (will be adjusted to 4 later if needed)

    for line in lines:
        stripped = line.strip()

        if not stripped:
            formatted.append('')
            continue

        # Decrease indent before closing braces
        if stripped.startswith('}'):
            indent_level = max(0, indent_level - 1)

        # Add line with proper indentation
        formatted.append(indent_str * indent_level + stripped)

        # Increase indent after opening braces
        if stripped.endswith('{'):
            indent_level += 1

    return '\n'.join(formatted)


def format_python_code(code: str) -> str:
    """Format Python code with proper indentation and spacing"""
    lines = code.split('\n')
    formatted = []

    for line in lines:
        # Python indentation should be preserved, just remove excessive trailing spaces
        formatted.append(line.rstrip())

    # Remove excessive blank lines (keep max 1)
    result = []
    prev_blank = False
    for line in formatted:
        if not line.strip():
            if not prev_blank:
                result.append('')
                prev_blank = True
        else:
            result.append(line)
            prev_blank = False

    return '\n'.join(result)


def format_javascript_code(code: str) -> str:
    """Format JavaScript code with proper indentation"""
    lines = code.split('\n')
    formatted = []
    indent_level = 0
    indent_str = '  '  # 2 spaces for JS

    for line in lines:
        stripped = line.strip()

        if not stripped:
            formatted.append('')
            continue

        # Decrease indent for closing braces/brackets
        if stripped.startswith('}') or stripped.startswith(']') or stripped.startswith(')'):
            indent_level = max(0, indent_level - 1)

        # Add line with proper indentation
        formatted.append(indent_str * indent_level + stripped)

        # Increase indent for opening braces/brackets
        if stripped.endswith('{') or stripped.endswith('['):
            indent_level += 1

    return '\n'.join(formatted)


def format_code_block(code: str, language: str = None) -> str:
    """
    Format code block based on language

    Args:
        code: Raw code string
        language: Language identifier ('java', 'python', 'javascript', etc.)
                 If None, will attempt to detect

    Returns:
        Formatted code string
    """
    if not code or not code.strip():
        return code

    # Detect language if not provided
    if not language:
        language = detect_language(code)

    # Clean up excessive whitespace
    code = code.strip()

    # Format based on language
    if language == 'java':
        return format_java_code(code)
    elif language == 'python':
        return format_python_code(code)
    elif language == 'javascript':
        return format_javascript_code(code)
    else:
        # For unknown languages, just clean up
        lines = [line.rstrip() for line in code.split('\n')]
        return '\n'.join(lines)


def fix_json_escapes_in_code(code_str: str) -> str:
    """
    Fix JSON escape sequences in code strings
    Converts \\n to actual newlines in JSON context

    Args:
        code_str: Code string that might have escape sequences

    Returns:
        Code with proper line breaks instead of escape sequences
    """
    # If code is already using actual newlines, return as-is
    if '\n' in code_str and '\\n' not in code_str:
        return code_str

    # If using escape sequences, convert to actual newlines
    return code_str.replace('\\n', '\n').replace('\\t', '\t')


def indent_code(code: str, indent_level: int = 1, indent_str: str = '  ') -> str:
    """
    Add indentation to code block

    Args:
        code: Code to indent
        indent_level: Number of indentation levels to add
        indent_str: Indentation string (default: 2 spaces)

    Returns:
        Indented code
    """
    prefix = indent_str * indent_level
    lines = code.split('\n')
    return '\n'.join(prefix + line if line.strip() else '' for line in lines)
