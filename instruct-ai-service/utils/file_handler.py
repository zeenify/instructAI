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
