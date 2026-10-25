"""
Media Fetcher - Fetch real images and videos from Pexels and YouTube
"""
import os
import random
import re
import requests
from googleapiclient.discovery import build
from utils.logger import log_error


def fetch_pexels_image(keywords: str, orientation: str = "landscape") -> str:
    """
    Fetch image URL from Pexels API

    Args:
        keywords: Search keywords (e.g., "programming java code")
        orientation: Image orientation (landscape, portrait, square)

    Returns:
        Image URL or placeholder URL if API fails
    """
    api_key = os.getenv("PEXELS_API_KEY")

    if not api_key:
        print("[WARN] PEXELS_API_KEY not set - using placeholder")
        # Return a generic programming placeholder
        return "https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?w=800"

    try:
        headers = {"Authorization": api_key}
        params = {
            "query": keywords,
            "orientation": orientation,
            "per_page": 5,  # Get top 5 results for variety
            "size": "large"
        }

        response = requests.get(
            "https://api.pexels.com/v1/search",
            headers=headers,
            params=params,
            timeout=10
        )

        if response.status_code == 200:
            data = response.json()
            if data.get("photos") and len(data["photos"]) > 0:
                # Randomly pick from top 5 results to avoid duplicates
                photo = random.choice(data["photos"])
                image_url = photo["src"]["large"]
                print(f"[Pexels] Found image for '{keywords}': Photo ID {photo['id']}")
                return image_url

        print(f"[Pexels] No results for '{keywords}', using fallback")
        # Fallback to generic programming image
        return "https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?w=800"

    except Exception as e:
        log_error("pexels-fetch", e)
        return "https://images.pexels.com/photos/577585/pexels-photo-577585.jpeg?w=800"


def _clean_video_description(description: str) -> str:
    """One flat line of a video's real description: no URLs, no line breaks,
    capped at 180 chars. Empty beats fabricated text."""
    text = re.sub(r"https?://\S+", "", str(description or ""))
    text = " ".join(text.split())
    return text[:180].rstrip()


# Filler words that appear in almost every educational video title and every
# lesson title. A video only earns its embed when its title matches a
# DISTINCTIVE topic word (logo, packaging, flowchart, swing…) — matching on
# filler like "design tutorial" is how off-topic videos used to slip in, and
# how every lesson ended up with a video it didn't need.
_GENERIC_TITLE_WORDS = {
    "tutorial", "guide", "how", "the", "and", "or", "for", "with", "your",
    "lesson", "course", "class", "video", "part", "chapter", "episode",
    "introduction", "intro", "basics", "basic", "beginner", "beginners",
    "fundamental", "fundamentals", "essential", "essentials", "complete",
    "learn", "learning", "creating", "create", "making", "make", "practice",
    "design", "designs", "designer", "designers", "graphic", "graphics",
    "visual", "media", "principles", "principle", "elements", "element",
    "software", "tool", "tools", "tips", "tricks", "free", "new", "best",
    "easy", "simple", "quick", "understanding", "overview", "explained",
    "about", "using", "what",
}


def _is_video_relevant(video_title: str, keywords: str) -> bool:
    """
    Check if video title is actually relevant to the search keywords.
    Rejects videos that are completely off-topic.

    Args:
        video_title: YouTube video title
        keywords: Original search keywords

    Returns:
        True if relevant, False if irrelevant
    """
    title_lower = video_title.lower()
    keywords_lower = keywords.lower()

    # Distinctive topic words — the anchor a title must match. When the
    # keywords carry nothing distinctive (a fully generic lesson title),
    # fall back to any main keyword rather than blocking videos outright.
    distinctive = [w for w in keywords_lower.split()
                   if len(w) > 3 and w not in _GENERIC_TITLE_WORDS]
    if not distinctive:
        distinctive = [w for w in keywords_lower.split() if len(w) > 3]
    if not any(w in title_lower for w in distinctive):
        return False

    # Lectures in other languages match English keywords fine on YouTube, but
    # they are useless to English-medium classes — reject them outright
    # ("relevanceLanguage=en" only biases the search, it does not filter).
    other_language_markers = [
        "in hindi", "hindi", "urdu", "bangla", "bengali", "tamil", "telugu",
        "kannada", "malayalam", "punjabi", "marathi", "gujarati", "arabic",
        "chinese", "mandarin", "russian", "bahasa",
    ]
    if any(marker in title_lower for marker in other_language_markers):
        return False

    # Reject videos about completely different topics (blacklist)
    off_topic_keywords = [
        "sql", "database", "mysql", "postgresql",  # Not Java
        "javascript", "node.js", "react", "vue",  # Not if searching for Python/Java
        "c++", "rust", "go", "kotlin",  # Different languages
        "forex", "trading", "crypto", "stocks",  # Finance
        "music", "gaming", "sports", "cooking"  # Completely different domains
    ]

    # If searching for Java, reject JavaScript, Python, etc. results
    if any(topic in title_lower for topic in off_topic_keywords):
        # But allow if they're explicitly mentioned in search
        if not any(topic in keywords_lower for topic in off_topic_keywords):
            return False

    return True


def fetch_youtube_video(keywords: str) -> dict:
    """
    Fetch YouTube video from YouTube Data API with relevance checking.

    Args:
        keywords: Search keywords (e.g., "java installation tutorial")

    Returns:
        Dictionary with url and title, or suggestion if API fails
    """
    api_key = os.getenv("YOUTUBE_API_KEY")

    if not api_key:
        print("[WARN] YOUTUBE_API_KEY not set - using suggestion")
        return {
            "url": "",
            "title": f"Suggested: Search '{keywords}' on YouTube",
            "description": "Teacher should find and add YouTube URL"
        }

    try:
        youtube = build("youtube", "v3", developerKey=api_key)

        # Search for videos - get top 8 so the language/subject filters have
        # candidates to fall through to
        search_response = youtube.search().list(
            q=keywords,
            part="id,snippet",
            maxResults=8,
            type="video",
            videoDuration="medium",  # 4-20 minutes
            relevanceLanguage="en",
            safeSearch="strict",
            order="relevance"  # Most relevant first
        ).execute()

        if search_response.get("items"):
            # Find first relevant video
            for video in search_response["items"]:
                video_title = video["snippet"]["title"]

                # Check if this video is actually relevant
                if _is_video_relevant(video_title, keywords):
                    video_id = video["id"]["videoId"]
                    video_url = f"https://www.youtube.com/watch?v={video_id}"
                    print(f"[YouTube] Found relevant video for '{keywords}': {video_title}")
                    return {
                        "url": video_url,
                        "title": video_title,
                        # The video's real description (trimmed) — never a
                        # fabricated "Tutorial video about …" line
                        "description": _clean_video_description(video["snippet"].get("description", ""))
                    }

            # No relevant video found in top 5
            print(f"[YouTube] No relevant video in top results for '{keywords}', using suggestion")
            return {
                "url": "",
                "title": f"Suggested: Search '{keywords}' on YouTube",
                "description": "Teacher should find and add YouTube URL"
            }
        else:
            print(f"[YouTube] No results for '{keywords}', using suggestion")
            return {
                "url": "",
                "title": f"Suggested: Search '{keywords}' on YouTube",
                "description": "Teacher should find and add YouTube URL"
            }

    except Exception as e:
        log_error("youtube-fetch", e)
        return {
            "url": "",
            "title": f"Suggested: Search '{keywords}' on YouTube",
            "description": "Teacher should find and add YouTube URL"
        }


def generate_image_keywords(lesson_title: str, section_title: str, module_title: str = "") -> str:
    """
    Generate relevant keywords for image search

    Args:
        lesson_title: Main lesson title
        section_title: Section title
        module_title: Module title (contains language/subject context)

    Returns:
        Space-separated keywords
    """
    # Extract primary subject/language from module
    combined = f"{module_title} {section_title}".lower()

    # Remove common filler words
    stop_words = ["the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by",
                  "introduction", "understanding", "learning", "practice", "tutorial", "guide", "basics"]

    words = [w for w in combined.split() if w not in stop_words and len(w) > 2]

    # Remove duplicates while preserving order
    seen = set()
    unique_words = []
    for word in words:
        if word not in seen:
            seen.add(word)
            unique_words.append(word)

    # Use section-specific keywords for variety
    keywords = " ".join(unique_words[:3]) if unique_words else "education"

    # Detect subject type and add appropriate context keyword
    programming_langs = ["java", "python", "javascript", "cpp", "csharp", "ruby", "php", "go", "rust", "swift"]
    design_subjects = ["design", "graphic", "ui", "ux", "color", "typography", "layout"]

    is_programming = any(lang in keywords.lower() for lang in programming_langs)
    is_design = any(subj in keywords.lower() for subj in design_subjects)

    # Add context keyword if not already present
    if is_programming and "code" not in keywords and "programming" not in keywords:
        keywords += " code"
    elif is_design and "design" not in keywords:
        keywords += " design"
    elif not is_programming and not is_design:
        # Generic educational content
        keywords += " education"

    return keywords


def generate_video_keywords(lesson_title: str, section_title: str, module_title: str = "") -> str:
    """
    Generate relevant keywords for video search

    Args:
        lesson_title: Main lesson title
        section_title: Section title
        module_title: Module title (contains language/subject context)

    Returns:
        Search keywords for YouTube
    """
    # Combine all context and add "tutorial"
    keywords = f"{module_title} {lesson_title} {section_title} tutorial".lower()

    # Clean up filler words
    keywords = keywords.replace("introduction to", "")
    keywords = keywords.replace("introduction", "")
    keywords = keywords.replace("understanding", "")
    keywords = keywords.replace("practice with", "")

    return keywords.strip()
