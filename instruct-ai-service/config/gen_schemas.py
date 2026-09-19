"""
Structured-output JSON schemas for every generation call.

Gemini's json_object mode does NOT reliably escape quotes inside strings
(Java code like System.out.println("Hi") breaks the JSON), so all generation
uses grammar-constrained json_schema responses instead — output is guaranteed
valid JSON with properly escaped strings AND the exact field shape we expect.

Schemas are permissive about prose but strict about structure. Parsed with
json.loads(strict=False) downstream as belt-and-braces.
"""


def structured_format(name: str, schema: dict) -> dict:
    """Build the OpenAI-compatible response_format for Gemini structured output."""
    return {"type": "json_schema", "json_schema": {"name": name, "strict": True, "schema": schema}}


def _str_array(max_items: int) -> dict:
    return {"type": "array", "items": {"type": "string"}, "maxItems": max_items}


LANGUAGE_ENUM = {"type": "string", "enum": ["java", "python", "javascript", "cpp", "html"]}


def _obj(properties: dict, required: list) -> dict:
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


# ===== STAGE 2: SECTION CONTENT (one schema per section type) =====

SECTION_SCHEMAS = {
    "introduction": _obj({
        "content_type": {"type": "string"},
        "hook": {"type": "string"},
        "what_youll_learn": _str_array(6),
        "prerequisites": {"type": "string"},
        "estimated_time": {"type": "string"},
    }, ["content_type", "hook", "what_youll_learn"]),

    "concept": _obj({
        "content_type": {"type": "string"},
        "definition": {"type": "string"},
        "explanation": {"type": "string"},
        "why_it_matters": {"type": "string"},
        "real_world_example": {"type": "string"},
        "key_points": _str_array(6),
    }, ["content_type", "definition", "explanation", "why_it_matters", "key_points"]),

    "tutorial": _obj({
        "content_type": {"type": "string"},
        "steps": _str_array(12),
        "commands": _str_array(6),
        "warnings": _str_array(6),
        "links": _str_array(4),
    }, ["content_type", "steps"]),

    "example_programming": _obj({
        "content_type": {"type": "string"},
        "language": LANGUAGE_ENUM,
        "intro": {"type": "string"},
        "code": {"type": "string"},
        "explanation": {"type": "string"},
        "output": {"type": "string"},
        "key_concepts": _str_array(6),
    }, ["content_type", "language", "intro", "code", "explanation", "output"]),

    "example_general": _obj({
        "content_type": {"type": "string"},
        "intro": {"type": "string"},
        "example_description": {"type": "string"},
        "explanation": {"type": "string"},
        "key_elements": _str_array(6),
        "key_concepts": _str_array(6),
    }, ["content_type", "intro", "example_description", "key_elements"]),

    "practice_programming": _obj({
        "content_type": {"type": "string"},
        "language": LANGUAGE_ENUM,
        "challenge": {"type": "string"},
        "starter_code": {"type": "string"},
        "reference_solution": {"type": "string"},
        "expected_output": {"type": "string"},
        "test_cases": {
            "type": "array",
            "items": _obj({
                "input": {"type": "string"},
                "expected_output": {"type": "string"},
                "hidden": {"type": "boolean"},
            }, ["input", "expected_output", "hidden"]),
            "maxItems": 4,
        },
        "files": {
            "type": "array",
            "items": _obj({
                "name": {"type": "string"},
                "content": {"type": "string"},
            }, ["name", "content"]),
            "maxItems": 6,
        },
        "success_criteria": {"type": "string"},
    }, ["content_type", "language", "challenge", "starter_code",
        "expected_output"]),

    "practice_general": _obj({
        "content_type": {"type": "string"},
        "challenge": {"type": "string"},
        "guidelines": {"type": "string"},
        "hints": _str_array(4),
        "expected_outcome": {"type": "string"},
        "success_criteria": {"type": "string"},
    }, ["content_type", "challenge", "guidelines", "expected_outcome"]),

    "summary": _obj({
        "content_type": {"type": "string"},
        "key_takeaways": _str_array(6),
        "remember_this": {"type": "string"},
        "next_steps": {"type": "string"},
        "additional_resources": _str_array(4),
    }, ["content_type", "key_takeaways", "remember_this"]),
}


def section_format(section_type: str, is_programming: bool) -> dict:
    """response_format for a stage-2 section, picked by type and course kind."""
    if section_type == "example":
        key = "example_programming" if is_programming else "example_general"
    elif section_type == "practice":
        key = "practice_programming" if is_programming else "practice_general"
    else:
        key = section_type
    return structured_format("section_content", SECTION_SCHEMAS[key])


# ===== STAGE 1: LESSON OUTLINE =====

OUTLINE_FORMAT = structured_format("lesson_outline", _obj({
    "lesson_title": {"type": "string"},
    "estimated_duration": {"type": "string"},
    "sections": {
        "type": "array",
        "items": _obj({
            "title": {"type": "string"},
            "type": {"type": "string",
                     "enum": ["introduction", "concept", "tutorial", "example", "practice", "summary"]},
            "focus": {"type": "string"},
            "needs_code": {"type": "boolean"},
        }, ["title", "type", "focus", "needs_code"]),
        "maxItems": 6,
    },
}, ["lesson_title", "sections"]))


# ===== CURRICULUM STRUCTURE =====

CURRICULUM_FORMAT = structured_format("curriculum", _obj({
    "new_modules": {
        "type": "array",
        "items": _obj({
            "title": {"type": "string"},
            "lessons": {"type": "array", "items": _obj({"title": {"type": "string"}}, ["title"])},
            "quizzes": {"type": "array", "items": _obj({"title": {"type": "string"}}, ["title"])},
        }, ["title", "lessons", "quizzes"]),
        "maxItems": 8,
    },
}, ["new_modules"]))


# ===== QUIZ (grouped by type) =====

def _question(properties: dict, required: list) -> dict:
    return _obj(properties, required)

_MC_QUESTION = _question({
    "question_text": {"type": "string"},
    "type": {"type": "string"},
    "points": {"type": "integer"},
    "options": _str_array(6),
    "expected_output": {"type": "string"},
}, ["question_text", "type", "points", "options", "expected_output"])

_TF_QUESTION = _question({
    "question_text": {"type": "string"},
    "type": {"type": "string"},
    "points": {"type": "integer"},
    "options": {"type": "array", "items": {"type": "string"}, "minItems": 2, "maxItems": 2},
    "expected_output": {"type": "string", "enum": ["True", "False"]},
}, ["question_text", "type", "points", "options", "expected_output"])

_ID_QUESTION = _question({
    "question_text": {"type": "string"},
    "type": {"type": "string"},
    "points": {"type": "integer"},
    "expected_output": {"type": "string"},
}, ["question_text", "type", "points", "expected_output"])

_ENUM_QUESTION = _question({
    "question_text": {"type": "string"},
    "type": {"type": "string"},
    "points": {"type": "integer"},
    "options": _str_array(4),
    "expected_output": {"type": "string"},
}, ["question_text", "type", "points", "options", "expected_output"])

_CODING_QUESTION = _question({
    "question_text": {"type": "string"},
    "type": {"type": "string"},
    "language": LANGUAGE_ENUM,
    "points": {"type": "integer"},
    "boilerplate": {"type": "string"},
    "reference_solution": {"type": "string"},
    "expected_output": {"type": "string"},
    "test_cases": {
        "type": "array",
        "items": _obj({
            "input": {"type": "string"},
            "expected_output": {"type": "string"},
            "hidden": {"type": "boolean"},
        }, ["input", "expected_output", "hidden"]),
        "maxItems": 4,
    },
}, ["question_text", "type", "language", "points", "boilerplate",
    "reference_solution", "expected_output", "test_cases"])

QUIZ_FORMAT = structured_format("quiz", _obj({
    "multiple_choice": {"type": "array", "items": _MC_QUESTION},
    "true_false": {"type": "array", "items": _TF_QUESTION},
    "identification": {"type": "array", "items": _ID_QUESTION},
    "enumeration": {"type": "array", "items": _ENUM_QUESTION},
    "coding": {"type": "array", "items": _CODING_QUESTION},
}, ["multiple_choice", "true_false", "identification", "enumeration", "coding"]))


# ===== SMALL HELPERS (main.py endpoints) =====

DETECTION_FORMAT = structured_format("detection", _obj({
    "is_coding": {"type": "boolean"},
}, ["is_coding"]))

VERIFY_FORMAT = structured_format("verification", _obj({
    "passed": {"type": "boolean"},
    "reason": {"type": "string"},
}, ["passed"]))

BATCH_CHECK_FORMAT = structured_format("batch_check", _obj({
    "results": {
        "type": "array",
        "items": _obj({
            "question_num": {"type": "integer"},
            "is_correct": {"type": "boolean"},
        }, ["question_num", "is_correct"]),
    },
}, ["results"]))
