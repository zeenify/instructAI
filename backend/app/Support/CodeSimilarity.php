<?php

namespace App\Support;

/**
 * Cheap, deterministic code-similarity estimation for classroom plagiarism
 * flags. Token Jaccard over a normalized form of the code (comments stripped,
 * strings collapsed, case-folded) — same idea, different names scores high;
 * genuinely different logic scores low. Not forensic evidence — a flag for
 * the teacher to look at.
 */
class CodeSimilarity
{
    public static function normalize(string $code): string
    {
        // Line comments (// and #), then block comments
        $code = preg_replace('/\/\/[^\n]*/', ' ', $code);
        $code = preg_replace('/(^|\s)#[^\n]*/', ' ', $code);
        $code = preg_replace('/\/\*.*?\*\//s', ' ', $code);

        // Collapse string literals so variable content can't game the tokens
        $code = preg_replace('/"(?:[^"\\\\]|\\\\.)*"/', ' STR ', $code);
        $code = preg_replace("/'(?:[^'\\\\]|\\\\.)*'/", ' STR ', $code);

        $code = strtolower($code);

        return $code;
    }

    /** @return string[] */
    public static function tokens(string $code): array
    {
        $normalized = self::normalize($code);
        $tokens = preg_split('/[^a-z0-9_]+/', $normalized, -1, PREG_SPLIT_NO_EMPTY);

        return array_values(array_filter($tokens, fn ($t) => mb_strlen($t) >= 2));
    }

    /**
     * Jaccard similarity of the token multisets, 0..1.
     */
    public static function similarity(string $codeA, string $codeB): float
    {
        $tokensA = self::tokens($codeA);
        $tokensB = self::tokens($codeB);

        if ($tokensA === [] && $tokensB === []) {
            return 0.0;
        }

        $countsA = array_count_values($tokensA);
        $countsB = array_count_values($tokensB);

        $intersection = 0;
        foreach ($countsA as $token => $countA) {
            if (isset($countsB[$token])) {
                $intersection += min($countA, $countsB[$token]);
            }
        }
        $union = array_sum($countsA) + array_sum($countsB) - $intersection;

        return $union > 0 ? round($intersection / $union, 4) : 0.0;
    }
}
