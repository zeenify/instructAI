<?php

namespace App\Http\Controllers\Student;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ReviewerController extends Controller
{
    public function generate(Request $request)
    {
        $request->validate([
            'lesson_content' => 'required|string',
            'lesson_title' => 'nullable|string|max:255',
            'reviewer_types' => 'nullable|array',
            'reviewer_types.*' => 'string|in:flashcards,cloze,practice,summary',
            'counts' => 'nullable|array',
            'difficulty' => 'nullable|string|in:easy,medium,hard',
        ]);

        set_time_limit(0);

        $apiKey = env('GEMINI_API_KEY');
        if (! $apiKey) {
            return response()->json(['error' => 'Server Gemini key not configured'], 500);
        }

        $lessonContent = $request->lesson_content;
        $lessonTitle = $request->input('lesson_title', '');
        $reviewerTypes = $request->input('reviewer_types', ['flashcards', 'cloze', 'practice', 'summary']);
        $counts = $request->input('counts', []);
        $result = [];

        foreach ($reviewerTypes as $rtype) {
            $prompt = self::PROMPTS[$rtype] ?? '';
            $count = $counts[$rtype] ?? self::DEFAULT_COUNTS[$rtype] ?? 5;
            $filled = str_replace(
                ['{title}', '{content}', '{count}', '{difficulty}'],
                [$lessonTitle, $lessonContent, (string) $count, $request->input('difficulty', 'medium')],
                $prompt
            );

            try {
                $response = Http::timeout(60)->post(
                    'https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent?key='.$apiKey,
                    [
                        'contents' => [
                            ['parts' => [['text' => $filled]]],
                        ],
                        'systemInstruction' => [
                            'parts' => [['text' => 'You are a world-class study material creator. Return ONLY valid JSON. No markdown, no code fences, no explanations.

NOISE NOTICE: The lesson content may have been extracted from documents, slides, or OCR and can contain noise — page headers/footers, page numbers, presenter or author names, dates, IDs/registration numbers, signature lines, template/slide-deck text (e.g. "Thank you", "Course outline", institution names), and OCR typos. IGNORE all such non-study content. Base your materials ONLY on actual educational content. Correct minor OCR typos using context; skip fragments that are unreadable or clearly administrative/metadata.']],
                        ],
                    ]
                );

                if (! $response->successful()) {
                    $result[$rtype] = ['error' => 'Gemini error '.$response->status()];

                    continue;
                }

                $body = $response->json();
                $text = $body['candidates'][0]['content']['parts'][0]['text'] ?? '';

                if (empty($text)) {
                    $result[$rtype] = ['error' => 'Empty response'];

                    continue;
                }

                $items = $this->parseResponse($text, $rtype);
                if (empty($items)) {
                    $result[$rtype] = ['error' => 'Failed to parse response'];

                    continue;
                }

                $result[$rtype] = $items;
            } catch (\Exception $e) {
                $result[$rtype] = ['error' => $e->getMessage()];
            }
        }

        return response()->json($result);
    }

    private function parseResponse(string $text, string $rtype): array
    {
        $cleaned = trim($text);
        $cleaned = preg_replace('/^```(?:json)?\s*/i', '', $cleaned);
        $cleaned = preg_replace('/\s*```$/', '', $cleaned);
        $cleaned = trim($cleaned);

        $data = json_decode($cleaned, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            return [];
        }

        if ($rtype === 'summary') {
            $sections = $data['sections'] ?? null;

            return is_array($sections) ? $sections : [];
        }

        return is_array($data) ? $data : [];
    }

    public function transformTts(Request $request)
    {
        $request->validate([
            'sections' => 'required|array|min:1|max:50',
            'sections.*.title' => 'required|string|max:255',
            'sections.*.points' => 'required|array|max:50',
            'sections.*.points.*' => 'required|string|max:500',
            'character_name' => 'required|string|max:100',
            'persona_hint' => 'nullable|string|max:300',
        ]);

        set_time_limit(0);

        $apiKey = env('GEMINI_API_KEY');
        if (! $apiKey) {
            return response()->json(['error' => 'Server Gemini key not configured'], 500);
        }

        $sections = json_encode($request->sections, JSON_UNESCAPED_UNICODE);
        $filled = str_replace(
            ['{sections}', '{character_name}', '{persona_hint}'],
            [$sections, $request->character_name, $request->input('persona_hint', '')],
            self::PROMPTS['transform_tts']
        );

        try {
            $response = Http::timeout(90)->post(
                'https://generativelanguage.googleapis.com/v1/models/gemini-3.5-flash-lite:generateContent?key='.$apiKey,
                [
                    'contents' => [
                        ['parts' => [['text' => $filled]]],
                    ],
                    'systemInstruction' => [
                        'parts' => [['text' => 'You are a voice narration writer. Return ONLY valid JSON. No markdown, no code fences, no explanations.']],
                    ],
                ]
            );

            if (! $response->successful()) {
                return response()->json(['error' => 'Gemini error '.$response->status()], 502);
            }

            $text = $response->json()['candidates'][0]['content']['parts'][0]['text'] ?? '';
            if (empty($text)) {
                return response()->json(['error' => 'Empty response'], 502);
            }

            $cleaned = trim($text);
            $cleaned = preg_replace('/^```(?:json)?\s*/i', '', $cleaned);
            $cleaned = preg_replace('/\s*```$/', '', $cleaned);
            $cleaned = trim($cleaned);

            $data = json_decode($cleaned, true);
            $paragraphs = $data['paragraphs'] ?? null;

            if (! is_array($paragraphs) || empty($paragraphs)) {
                return response()->json(['error' => 'Failed to parse response'], 502);
            }

            $paragraphs = array_values(array_filter(array_map(
                fn ($p) => is_string($p) ? trim($p) : '',
                $paragraphs
            ), fn ($p) => $p !== ''));

            if (empty($paragraphs)) {
                return response()->json(['error' => 'Empty paragraphs'], 502);
            }

            return response()->json(['paragraphs' => $paragraphs]);
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 500);
        }
    }

    public function extractText(Request $request)
    {
        $request->validate([
            'file' => 'required|file|mimes:pdf,docx,txt|max:51200',
        ]);

        try {
            $file = $request->file('file');
            $aiServiceUrl = env('AI_SERVICE_URL', 'http://localhost:8001');

            $response = Http::timeout(60)
                ->attach('file', file_get_contents($file->getPathname()), $file->getClientOriginalName())
                ->post($aiServiceUrl.'/ai/extract-text');

            if (! $response->successful()) {
                return response()->json(['error' => 'Extraction service error'], 500);
            }

            return $response->json();
        } catch (\Exception $e) {
            \Log::error('Text extraction error: '.$e->getMessage());

            return response()->json(['error' => 'Failed to extract text: '.$e->getMessage()], 500);
        }
    }

    private const PROMPTS = [
        'flashcards' => 'You are a world-class study material creator. Generate high-quality flashcards from the given lesson content.

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and base flashcards ONLY on the actual educational material.

RULES:
- Each flashcard must test ONE specific concept
- Front: clear, specific question that tests understanding
- Back: CONCISE short answer (1-5 words when possible) — ideal for phone screens
- For definitions: answer can be the term itself or a very short phrase
- For processes: answer should be the key output, not a full sentence
- Focus on: key concepts, definitions, relationships, comparisons, important details
- NEVER include ambiguous questions or yes/no questions
- ALWAYS ensure the answer is factually accurate based SOLELY on the given content

DIFFICULTY: {difficulty}
- easy: focus on core definitions and the most important facts
- medium: balanced mix of definitions, relationships, and important details
- hard: emphasize nuance, edge cases, comparisons, and deeper understanding

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} flashcards. Return ONLY a valid JSON array:
[{"front": "Question text here?", "back": "Short answer here."}]',

        'cloze' => 'You are a world-class study material creator. Generate fill-in-the-blank exercises from the given lesson content.

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and base cloze items ONLY on the actual educational material.

RULES:
- Identify KEY TERMS and IMPORTANT CONCEPTS
- Each blank should be a single important word or short phrase (1-3 words)
- The surrounding text must provide enough context to infer the answer
- Vary the position of the blank

DIFFICULTY: {difficulty}
- easy: blanks on the most prominent terms only
- medium: mix of prominent terms and supporting concepts
- hard: blanks on less obvious terms requiring deeper context

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} cloze items. Return ONLY a valid JSON array:
[{"before": "Text before blank...", "blank": "correctAnswer", "after": "...text after blank."}]',

        'practice' => 'You are a world-class assessment creator. Generate practice questions from the given lesson content.

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and base questions ONLY on the actual educational material.

QUESTION TYPES (MUST INCLUDE AT LEAST ONE OF EACH):
- "multiple_choice" (4 options, one correct)
- "true_false" (always provide options: ["True", "False"])

RULES:
- YOU MUST INCLUDE BOTH TYPES: multiple_choice and true_false
- EVERY question MUST include an "options" field. For true_false: ["True", "False"].
- Multiple choice distractors should be COMMON MISCONCEPTIONS
- True/false should test understanding of nuances
- Each question must be answerable based SOLELY on the given content

DIFFICULTY: {difficulty}
- easy: straightforward recall of key facts and definitions
- medium: mix of recall, application, and nuanced true/false statements
- hard: require deeper understanding, application, and subtle distinctions

Lesson title: {title}
Lesson content:
{content}

Generate exactly {count} questions. YOU MUST distribute across both types (multiple_choice, true_false). Return ONLY a valid JSON array:
[{"type": "multiple_choice", "question": "?", "options": ["A) opt1", "B) opt2", "C) opt3", "D) opt4"], "correct_answer": "A) opt1", "explanation": "..."}]',

        'summary' => 'You are a world-class study material creator. Create a comprehensive yet scannable summary for mobile review.

NOISE NOTICE: The content may contain extraction noise — headers, footers, page numbers, presenter/author names, dates, IDs, signature lines, template/slide-deck text, and OCR typos. IGNORE all non-study content and summarize ONLY the actual educational material.

RULES:
- Organize into 4-8 logical sections covering ALL major topics
- Each section: 5-8 bullet points covering every key concept
- Bullet points should be 10-25 words each — concise but complete
- Cover: core concepts, definitions, relationships, processes, important examples
- Use simple, direct language
- Make it thorough enough that reading the summary replaces reading the full lesson
- Prioritize completeness over brevity — include everything important

Lesson title: {title}
Lesson content:
{content}

Return ONLY a valid JSON object:
{"sections": [{"title": "Section Heading", "points": ["Key point 1", "Key point 2", "Key point 3", "Key point 4", "Key point 5"]}]}',

        'transform_tts' => 'You are a voice narration writer. Convert the bulleted study guide below into flowing paragraphs designed to be READ ALOUD by a text-to-speech engine.

RULES:
- Rewrite the bullets into natural, flowing prose paragraphs — NO bullets, NO lists, NO markdown, NO emojis, NO special symbols
- Each paragraph: 2-4 sentences. Split the guide into one paragraph per topic cluster (aim for 10-16 paragraphs max for a full guide)
- Use complete sentences with smooth transitions between ideas
- Keep the educational content ACCURATE and COMPLETE — the listener must not lose any key fact from the bullets
- Spell out numbers, abbreviations, and symbols so they are pronounced correctly (e.g. "3.14" -> "three point one four", "&" -> "and", "%" -> "percent")
- Use short, punchy sentences with natural pause points (commas, periods) so TTS sounds natural
- Keep technical terms and proper nouns as-is
- TONE: Deliver the whole guide IN CHARACTER as {character_name}. {persona_hint}
  - The persona affects WORD CHOICE, energy, and attitude ONLY — never invent facts, never joke away content
  - If the character is "System" or "Kokoro" (or the hint is empty): use a clear, neutral, warm instructional tone

Bulleted study guide:
{sections}

Return ONLY a valid JSON object:
{"paragraphs": ["Paragraph one...", "Paragraph two..."]}',
    ];

    private const DEFAULT_COUNTS = [
        'flashcards' => 10,
        'cloze' => 5,
        'practice' => 5,
        'summary' => 1,
    ];
}
