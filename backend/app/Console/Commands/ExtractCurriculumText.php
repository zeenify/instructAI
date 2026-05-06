<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Course;
use GuzzleHttp\Client;
use PhpOffice\PhpWord\IOFactory;
use Smalot\PdfParser\Parser;

class ExtractCurriculumText extends Command
{
    protected $signature = 'curriculum:extract {course_id?}';
    protected $description = 'Extract text from curriculum files';

    public function handle()
    {
        $courseId = $this->argument('course_id');

        $query = Course::whereNotNull('curriculum_file_url');

        if ($courseId) {
            $query->where('id', $courseId);
        }

        $courses = $query->get();

        if ($courses->isEmpty()) {
            $this->error('No courses with curriculum files found');
            return 1;
        }

        foreach ($courses as $course) {
            $this->info("Processing Course #{$course->id}: {$course->title}");
            $this->info("File URL: {$course->curriculum_file_url}");

            try {
                $text = $this->extractFromUrl($course->curriculum_file_url);

                if (empty($text)) {
                    $this->warn("  No text extracted (file might be empty or unsupported format)");
                    continue;
                }

                $course->curriculum_text = $text;
                $course->save();

                $length = strlen($text);
                $this->info("  ✓ Extracted {$length} characters");
                $this->info("  Preview: " . substr($text, 0, 100) . "...");
                $this->newLine();

            } catch (\Exception $e) {
                $this->error("  ✗ Error: " . $e->getMessage());
                $this->newLine();
            }
        }

        $this->info('Done!');
        return 0;
    }

    private function extractFromUrl($url)
    {
        // Download file
        $client = new Client();
        $response = $client->get($url);
        $content = $response->getBody()->getContents();

        // Save to temp file
        $extension = pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION);
        $tempFile = tempnam(sys_get_temp_dir(), 'curriculum_') . '.' . $extension;
        file_put_contents($tempFile, $content);

        $text = '';

        try {
            if ($extension === 'pdf') {
                $parser = new Parser();
                $pdf = $parser->parseFile($tempFile);
                $text = $pdf->getText();
            } elseif (in_array($extension, ['doc', 'docx'])) {
                $phpWord = IOFactory::load($tempFile);
                foreach ($phpWord->getSections() as $section) {
                    foreach ($section->getElements() as $element) {
                        if (method_exists($element, 'getText')) {
                            $text .= $element->getText() . "\n";
                        } elseif (method_exists($element, 'getElements')) {
                            foreach ($element->getElements() as $subElement) {
                                if (method_exists($subElement, 'getText')) {
                                    $text .= $subElement->getText();
                                }
                            }
                            $text .= "\n";
                        }
                    }
                }
            } elseif ($extension === 'txt') {
                $text = $content;
            }
        } finally {
            @unlink($tempFile);
        }

        return trim($text);
    }
}
