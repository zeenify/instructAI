"""
File extraction utilities for PDF, DOCX, and text files
"""
import pdfplumber
from docx import Document
from fastapi import UploadFile


def extract_text(file: UploadFile) -> str:
    """
    Extract text content from uploaded files (PDF, DOCX, TXT)

    Args:
        file: FastAPI UploadFile object

    Returns:
        Extracted text content as string
    """
    content = ""

    if file.filename.endswith('.pdf'):
        with pdfplumber.open(file.file) as pdf:
            content = "".join(page.extract_text() for page in pdf.pages)
    elif file.filename.endswith('.docx'):
        doc = Document(file.file)
        content = "".join(p.text for p in doc.paragraphs)
    else:
        # Assume plain text
        content = file.file.read().decode("utf-8")

    return content


def detect_programming_content(text: str) -> bool:
    """
    Detect if curriculum text contains programming content using keyword analysis.
    Quick heuristic check before making AI call.

    Args:
        text: Curriculum text to analyze

    Returns:
        Boolean indicating if programming content is detected
    """
    if not text:
        return False

    text_lower = text.lower()

    # Programming keywords to look for
    programming_keywords = [
        'code', 'java', 'python', 'javascript', 'c++', 'c#', 'php', 'ruby', 'golang',
        'variable', 'function', 'class', 'loop', 'array', 'object', 'algorithm',
        'programming', 'coding', 'compile', 'syntax', 'method', 'interface',
        'library', 'framework', 'sql', 'database', 'api', 'rest', 'git',
        'developer', 'software', 'debug', 'exception', 'catch', 'throw',
        'lambda', 'recursion', 'inheritance', 'polymorphism', 'encapsulation',
        'html', 'css', 'react', 'vue', 'angular', 'node', 'express',
        'docker', 'kubernetes', 'devops', 'aws', 'azure', 'gcp'
    ]

    # Count keyword matches
    keyword_matches = sum(1 for keyword in programming_keywords if keyword in text_lower)

    # If more than 3 keywords found, likely programming content
    return keyword_matches >= 3
