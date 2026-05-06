"""
Debug logging utilities for Groq API requests and responses
"""
import json
from datetime import datetime


def print_separator(title: str = ""):
    """Print a visual separator with optional title"""
    print("\n" + "=" * 80)
    if title:
        print(f" {title}")
        print("=" * 80)


def log_api_request(endpoint: str, messages: list, model: str, **kwargs):
    """
    Log Groq API request details

    Args:
        endpoint: API endpoint name
        messages: List of chat messages
        model: Model name
        **kwargs: Additional API parameters
    """
    print_separator(f">> GROQ API REQUEST - {endpoint}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Model: {model}")
    print(f"\nMessages:")

    for i, msg in enumerate(messages, 1):
        role = msg.get("role", "unknown")
        content = msg.get("content", "")

        # Truncate very long content for readability
        if len(content) > 1000:
            content_preview = content[:500] + "\n... [TRUNCATED] ...\n" + content[-500:]
        else:
            content_preview = content

        print(f"\n  Message {i} [{role.upper()}]:")
        print(f"  {'-' * 70}")
        print(f"  {content_preview}")

    if kwargs:
        print(f"\nAdditional Parameters:")
        for key, value in kwargs.items():
            print(f"  - {key}: {value}")

    print("=" * 80 + "\n")


def log_api_response(endpoint: str, response_content: str, streaming: bool = False):
    """
    Log Groq API response details

    Args:
        endpoint: API endpoint name
        response_content: Raw response content
        streaming: Whether this is a streaming response
    """
    print_separator(f"<< GROQ API RESPONSE - {endpoint}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Streaming: {streaming}")

    # Try to pretty-print JSON
    try:
        parsed = json.loads(response_content)
        formatted = json.dumps(parsed, indent=2)

        # Truncate if too long
        if len(formatted) > 2000:
            lines = formatted.split('\n')
            preview = '\n'.join(lines[:30]) + "\n... [TRUNCATED] ...\n" + '\n'.join(lines[-30:])
        else:
            preview = formatted

        print(f"\nResponse Content:")
        print(preview)
    except json.JSONDecodeError:
        # Not JSON, show raw
        if len(response_content) > 2000:
            preview = response_content[:1000] + "\n... [TRUNCATED] ...\n" + response_content[-1000:]
        else:
            preview = response_content
        print(f"\nResponse Content (Raw):")
        print(preview)

    print("=" * 80 + "\n")


def log_error(endpoint: str, error: Exception):
    """
    Log API error details

    Args:
        endpoint: API endpoint name
        error: Exception object
    """
    print_separator(f"!! ERROR - {endpoint}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Error Type: {type(error).__name__}")
    print(f"Error Message: {str(error)}")
    print("=" * 80 + "\n")
