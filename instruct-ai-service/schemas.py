"""
Pydantic schemas for curriculum and content generation
"""
from pydantic import BaseModel, Field
from typing import List, Optional


# ===== CURRICULUM GENERATION SCHEMAS =====
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


# ===== CONTENT GENERATION SCHEMAS =====
class LessonBlock(BaseModel):
    id: str
    type: str  # h1, text, code, image, video, link
    data: dict


class LessonContent(BaseModel):
    lesson_id: int
    lesson_title: str
    blocks: List[LessonBlock] = Field(default_factory=list)


class QuizQuestion(BaseModel):
    question_text: str
    type: str  # multiple_choice, true_false, identification, enumeration, coding
    points: int = 5
    options: Optional[List[str]] = None
    expected_output: Optional[str] = None
    boilerplate: Optional[str] = None


class QuizContent(BaseModel):
    quiz_id: int
    quiz_title: str
    questions: List[QuizQuestion] = Field(default_factory=list)


class ContentGenerationResponse(BaseModel):
    lessons: List[LessonContent] = Field(default_factory=list)
    quizzes: List[QuizContent] = Field(default_factory=list)
