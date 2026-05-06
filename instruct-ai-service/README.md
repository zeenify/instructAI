# InstructAI Service v2.0.0 - Modular Architecture

Refactored AI service with modular structure and comprehensive debug logging.

## 📁 Project Structure

```
instruct-ai-service/
├── main.py                          # FastAPI app entry point
├── schemas.py                       # Pydantic models for validation
├── prompts/
│   ├── curriculum_prompts.py        # Curriculum generation prompts
│   └── content_prompts.py          # Lesson/quiz content prompts
├── services/
│   ├── curriculum_service.py        # Curriculum generation logic
│   └── content_service.py          # Content generation logic
└── utils/
    ├── file_handler.py             # File extraction (PDF, DOCX, TXT)
    └── logger.py                   # Debug logging utilities
```

## 🚀 Running the Service

```bash
# Install dependencies
pip install -r requirements.txt

# Set environment variables
export GROQ_API_KEY=your_api_key_here

# Start server
python main.py
```

Server runs on `http://localhost:8001`

## 🔍 Debug Logging

The service now includes comprehensive debug logging for all Groq API interactions:

### What Gets Logged

1. **API Requests**
   - Endpoint name
   - Timestamp
   - Model used
   - Complete message payload (system + user prompts)
   - Additional parameters (temperature, response format, etc.)

2. **API Responses**
   - Endpoint name
   - Timestamp
   - Streaming status
   - Full JSON response (pretty-printed)
   - Automatic truncation for large responses

3. **Errors**
   - Endpoint where error occurred
   - Error type
   - Error message
   - Timestamp

### Example Log Output

```
================================================================================
 🚀 GROQ API REQUEST - generate-curriculum-stream
================================================================================
⏰ Timestamp: 2026-05-04 15:30:45
🤖 Model: llama-3.3-70b-versatile

📝 Messages:
  Message 1 [SYSTEM]:
  ----------------------------------------------------------------------
  Act as a Professional Curriculum Designer...

  Message 2 [USER]:
  ----------------------------------------------------------------------
  Base curriculum document:
  Java Programming Fundamentals...

⚙️  Additional Parameters:
  - response_format: {'type': 'json_object'}
  - stream: True
================================================================================

================================================================================
 ✅ GROQ API RESPONSE - generate-curriculum-stream
================================================================================
⏰ Timestamp: 2026-05-04 15:30:52
🌊 Streaming: True

📦 Response Content:
{
  "new_modules": [
    {
      "title": "Introduction to Java",
      "lessons": [...],
      "quizzes": [...]
    }
  ]
}
================================================================================
```

## 📡 API Endpoints

### 1. Health Check
```
GET /
```

### 2. Curriculum Generation (Streaming)
```
POST /ai/generate-curriculum-stream
```
**Parameters:**
- `prompt` (required): User instructions
- `file` (optional): Curriculum file upload
- `curriculum_text` (optional): Base curriculum text
- `difficulty`: beginner | intermediate | advanced
- `module_count`: e.g., "3-5"
- `lessons_per_module`: e.g., "3-5"
- `include_quiz`: "true" | "false"
- `include_coding`: "true" | "false"
- `pacing`: fast | standard | slow

**Returns:** Server-sent events with curriculum generation progress

### 3. Curriculum Generation (Legacy)
```
POST /ai/generate-curriculum
```
Non-streaming version for backwards compatibility.

### 4. Content Generation (Streaming)
```
POST /ai/generate-content-stream
```
**Parameters:**
- `curriculum_structure` (required): JSON string of modules with IDs
- `curriculum_text` (optional): Base curriculum context
- `difficulty`: beginner | intermediate | advanced
- `content_depth`: minimal | standard | comprehensive
- `code_examples_per_lesson`: e.g., "3-4"
- `writing_style`: formal | conversational | technical
- `questions_per_quiz`: e.g., "10"
- `question_type_mix`: all_multiple_choice | mixed | coding_focused
- `points_per_question`: integer (default: 5)
- `include_images`: "true" | "false"
- `include_videos`: "true" | "false"

**Returns:** Server-sent events with lesson and quiz generation progress

## 🛠️ Debugging Tips

1. **Check Groq API request/response logs** in the terminal to see exactly what's being sent and received
2. **Verify prompt parameters** are being passed correctly
3. **Inspect JSON responses** for unexpected structure or missing fields
4. **Monitor streaming events** to track generation progress

## 🔧 Adding New Features

### Adding a new prompt parameter:

1. Add parameter to endpoint in `main.py`
2. Update prompt builder function in `prompts/`
3. Pass parameter through service layer

### Adding a new generation type:

1. Create schema in `schemas.py`
2. Add prompt templates in `prompts/`
3. Implement service logic in `services/`
4. Add endpoint in `main.py`

## 📝 Environment Variables

```bash
# Required
GROQ_API_KEY=your_groq_api_key

# Optional (for production)
PORT=8001
HOST=0.0.0.0
```

## 🐛 Known Issues to Fix

See `BUGS_TO_FIX.md` in the project root for the current bug list.
