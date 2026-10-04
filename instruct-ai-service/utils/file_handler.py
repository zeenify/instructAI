"""
File extraction utilities for PDF, DOCX, PPTX, and text files
"""
import pdfplumber
from docx import Document
from fastapi import UploadFile
from pptx import Presentation


def extract_text(file: UploadFile) -> str:
    """
    Extract text content from uploaded files (PDF, DOCX, PPTX, TXT)

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
    elif file.filename.endswith('.pptx'):
        content = _extract_pptx(file.file)
    else:
        # Assume plain text
        content = file.file.read().decode("utf-8")

    return content


def _extract_pptx(stream) -> str:
    """Slide text in reading order: title + body shapes per slide, joined
    with blank lines so slide boundaries stay visible to the model."""
    try:
        presentation = Presentation(stream)
    except Exception:
        return ""
    slides = []
    for slide in presentation.slides:
        parts = []
        for shape in slide.shapes:
            if not shape.has_text_frame:
                continue
            shape_text = "\n".join(
                paragraph.text for paragraph in shape.text_frame.paragraphs
                if paragraph.text and paragraph.text.strip()
            )
            if shape_text.strip():
                parts.append(shape_text.strip())
        if parts:
            slides.append("\n".join(parts))
    return "\n\n".join(slides)


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
