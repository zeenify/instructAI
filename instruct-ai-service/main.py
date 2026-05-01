import os
import json
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
import pdfplumber
from docx import Document
from dotenv import load_dotenv
from pydantic import BaseModel, Field
from typing import List, Optional

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# --- DEFINE STRICT EXPECTED SCHEMAS ---
class Lesson(BaseModel):
    title: str = "Untitled Lesson"

class Quiz(BaseModel):
    title: str = "Untitled Quiz"

class Module(BaseModel):
    title: str = "Untitled Module"
    lessons: List[Lesson] = Field(default_factory=list)
    quizzes: List[Quiz] = Field(default_factory=list)

class CurriculumResponse(BaseModel):
    new_modules: List[Module] = Field(default_factory=list)

def extract_text(file: UploadFile):
    content = ""
    if file.filename.endswith('.pdf'):
        with pdfplumber.open(file.file) as pdf:
            content = "".join(page.extract_text() for page in pdf.pages)
    elif file.filename.endswith('.docx'):
        doc = Document(file.file)
        content = "".join(p.text for p in doc.paragraphs)
    else:
        content = file.file.read().decode("utf-8")
    return content

@app.post("/ai/generate-curriculum")
async def generate_curriculum(
    prompt: str = Form(...), 
    file: UploadFile = File(None)
):
    context_text = ""
    if file:
        context_text = f"Context from uploaded file: {extract_text(file)[:4000]}"
    
    system_prompt = """
    Act as a Professional Teacher. 
    Analyze the provided prompt and document to create a structured educational timeline.
    You MUST output valid JSON following this EXACT schema:
    {
        "new_modules":[
            {
                "title": "Module Name",
                "lessons": [{"title": "Lesson Name"}],
                "quizzes":[{"title": "Quiz Name"}]
            }
        ]
    }
    Never deviate from these key names.
    """

    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": f"{context_text}\n\nUser Command: {prompt}"}
            ],
            model="llama-3.3-70b-versatile",
            response_format={"type": "json_object"}
        )

        # 1. Get raw string
        raw_output = chat_completion.choices[0].message.content
        
        # 2. Parse JSON
        parsed_json = json.loads(raw_output)

        # 3. FORCE into Pydantic Schema (This filters out hallucinations and fixes missing keys)
        safe_curriculum = CurriculumResponse(**parsed_json)
        
        # 4. Return guaranteed safe dictionary
        return safe_curriculum.dict()

    except Exception as e:
        print(f"AI Generation Error: {e}")
        # If the AI completely fails, return an empty structured schema instead of a 500 error!
        return {"new_modules":[]}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)