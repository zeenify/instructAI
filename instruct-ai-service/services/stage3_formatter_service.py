"""
Stage 3: Block Formatter Service
Converts Stage 2 content into lesson blocks with real media
"""
import uuid
import re
from utils.media_fetcher import (
    fetch_pexels_image,
    fetch_youtube_video,
    generate_image_keywords,
    generate_video_keywords
)
from utils.code_formatter import format_code_block, fix_json_escapes_in_code


def convert_markdown_to_html(text: str) -> str:
    """
    Convert markdown formatting to HTML tags

    Args:
        text: Text with markdown formatting

    Returns:
        Text with HTML formatting tags
    """
    if not text:
        return ""

    # **bold** → <b>bold</b>
    text = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', text)
    # *italic* → <i>italic</i>
    text = re.sub(r'\*(.+?)\*', r'<i>\1</i>', text)
    # __underline__ → <u>underline</u>
    text = re.sub(r'__(.+?)__', r'<u>\1</u>', text)

    return text


def format_paragraphs(text: str) -> str:
    """
    Convert plain text with newlines into properly formatted HTML paragraphs

    Args:
        text: Raw text that may contain multiple paragraphs separated by \n\n

    Returns:
        HTML with proper <p> tags for each paragraph
    """
    if not text:
        return ""

    # Split by double newlines (paragraph breaks)
    paragraphs = re.split(r'\n\s*\n', text.strip())

    # Wrap each paragraph in <p> tags and convert markdown formatting
    formatted = "".join([f"<p>{convert_markdown_to_html(p.strip())}</p>" for p in paragraphs if p.strip()])

    return formatted


def format_section_to_blocks(
    section_content: dict,
    lesson_title: str,
    module_title: str = "",
    include_images: bool = True,
    include_videos: bool = True,
    banned_video_titles: set = None
) -> list:
    """
    Convert a section's content into lesson blocks

    Args:
        section_content: Content from Stage 2
        lesson_title: Lesson title for media keywords
        include_images: Whether to include image blocks
        include_videos: Whether to include video blocks
        banned_video_titles: Set of video titles to avoid (from previous lessons)

    Returns:
        List of lesson blocks
    """
    if banned_video_titles is None:
        banned_video_titles = set()
    blocks = []
    section_title = section_content.get("section_title", "")
    content_type = section_content.get("content_type", "")

    # Always start with section heading
    blocks.append({
        "id": str(uuid.uuid4()),
        "type": "h1",
        "data": {"text": section_title}
    })

    # Format based on content type
    if content_type == "introduction":
        # Hook paragraph
        if section_content.get("hook"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": format_paragraphs(section_content['hook'])}
            })

        # What you'll learn (bullet list)
        if section_content.get("what_youll_learn"):
            what_youll_learn = section_content["what_youll_learn"]
            # Ensure it's a list
            if isinstance(what_youll_learn, str):
                what_youll_learn = [what_youll_learn]
            items = "".join([f"<li>{convert_markdown_to_html(str(item))}</li>" for item in what_youll_learn])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>What You'll Learn:</strong></p><ul>{items}</ul>"}
            })

    elif content_type == "tutorial":
        # Steps as numbered list
        if section_content.get("steps"):
            steps = section_content["steps"]
            # Ensure it's a list
            if isinstance(steps, str):
                steps = [steps]
            items = "".join([f"<li>{convert_markdown_to_html(str(step))}</li>" for step in steps])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<ol>{items}</ol>"}
            })

        # Commands as code block
        if section_content.get("commands"):
            commands = section_content["commands"]
            # Ensure it's a list
            if isinstance(commands, str):
                commands = [commands]
            commands = "\n".join([str(c) for c in commands])
            # Format the commands
            formatted_commands = format_code_block(commands)

            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "code",
                "data": {
                    "mode": "playground",
                    "code": formatted_commands,
                    "expected": ""
                }
            })

        # Warnings
        if section_content.get("warnings"):
            warnings = section_content["warnings"]
            # Ensure it's a list
            if isinstance(warnings, str):
                warnings = [warnings]
            items = "".join([f"<li>{convert_markdown_to_html(str(warning))}</li>" for warning in warnings])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>⚠️ Common Mistakes:</strong></p><ul>{items}</ul>"}
            })

    elif content_type == "concept":
        # Definition
        if section_content.get("definition"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Definition:</strong> {convert_markdown_to_html(section_content['definition'])}</p>"}
            })

        # Explanation
        if section_content.get("explanation"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": format_paragraphs(section_content['explanation'])}
            })

        # Key points
        if section_content.get("key_points"):
            key_points = section_content["key_points"]
            # Ensure it's a list (sometimes AI returns string)
            if isinstance(key_points, str):
                key_points = [key_points]
            items = "".join([f"<li>{convert_markdown_to_html(str(point))}</li>" for point in key_points])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Key Points:</strong></p><ul>{items}</ul>"}
            })

    elif content_type == "example":
        # Intro
        if section_content.get("intro"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": format_paragraphs(section_content['intro'])}
            })

        # Code example (programming courses)
        if section_content.get("code"):
            raw_code = section_content["code"]
            # Fix JSON escape sequences and format
            raw_code = fix_json_escapes_in_code(raw_code)
            formatted_code = format_code_block(raw_code)

            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "code",
                "data": {
                    "mode": "playground",
                    "code": formatted_code,
                    "expected": fix_json_escapes_in_code(section_content.get("output", ""))
                }
            })

        # Visual example description (non-programming courses)
        if section_content.get("example_description"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Example:</strong></p>{format_paragraphs(section_content['example_description'])}"}
            })

        # Key elements (non-programming)
        if section_content.get("key_elements"):
            key_elements = section_content["key_elements"]
            # Ensure it's a list
            if isinstance(key_elements, str):
                key_elements = [key_elements]
            items = "".join([f"<li>{convert_markdown_to_html(str(elem))}</li>" for elem in key_elements])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Key Elements:</strong></p><ul>{items}</ul>"}
            })

        # Explanation
        if section_content.get("explanation"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": format_paragraphs(section_content['explanation'])}
            })

    elif content_type == "practice":
        # Challenge description
        if section_content.get("challenge"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Challenge:</strong> {section_content['challenge']}</p>"}
            })

        # Guidelines (non-programming)
        if section_content.get("guidelines"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Guidelines:</strong></p><p>{convert_markdown_to_html(section_content['guidelines'])}</p>"}
            })

        # Starter code (programming)
        if section_content.get("starter_code"):
            starter_code = section_content["starter_code"]
            # Fix JSON escape sequences and format
            starter_code = fix_json_escapes_in_code(starter_code)
            formatted_starter = format_code_block(starter_code)

            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "code",
                "data": {
                    "mode": "challenge",
                    "code": formatted_starter,
                    "expected": fix_json_escapes_in_code(section_content.get("expected_output", ""))
                }
            })

        # Expected outcome (non-programming) or expected output (programming)
        if section_content.get("expected_outcome"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Expected Outcome:</strong> {section_content['expected_outcome']}</p>"}
            })

        # Hints
        if section_content.get("hints"):
            hints = section_content["hints"]
            # Ensure it's a list
            if isinstance(hints, str):
                hints = [hints]
            items = "".join([f"<li>{str(hint)}</li>" for hint in hints])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>💡 Hints:</strong></p><ul>{items}</ul>"}
            })

    elif content_type == "summary":
        # Key takeaways
        if section_content.get("key_takeaways"):
            key_takeaways = section_content["key_takeaways"]
            # Ensure it's a list
            if isinstance(key_takeaways, str):
                key_takeaways = [key_takeaways]
            items = "".join([f"<li>{convert_markdown_to_html(str(takeaway))}</li>" for takeaway in key_takeaways])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>Key Takeaways:</strong></p><ul>{items}</ul>"}
            })

        # Remember this (highlight box)
        if section_content.get("remember_this"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>🎯 Remember This:</strong> {convert_markdown_to_html(section_content['remember_this'])}</p>"}
            })

    # Add video if requested (for concept/tutorial sections)
    # Images removed entirely - they were repetitive and not relevant to topics
    if include_videos and content_type in ["concept", "tutorial"]:
        keywords = generate_video_keywords(lesson_title, section_title, module_title)
        video_data = fetch_youtube_video(keywords)

        # Check if video is relevant and not already used
        video_url = video_data.get('url', '')
        video_title = video_data.get('title', '')

        # Only add video if:
        # 1. We got a real URL (not a "Suggested: Search YouTube" placeholder)
        # 2. Video title is not already used in this lesson
        # 3. Video title is not used in previous lessons (banned)
        if video_url and video_url.startswith('https://www.youtube.com/watch?v='):
            title_lower = video_title.lower().strip()
            if title_lower not in {v.lower().strip() for v in banned_video_titles}:
                blocks.append({
                    "id": str(uuid.uuid4()),
                    "type": "video",
                    "data": video_data
                })
                print(f"[VIDEO] Added video for {section_title}: {video_title}")
            else:
                print(f"[VIDEO-SKIP] Video already used in previous lesson: {video_title}")
        else:
            # No relevant video found, skip (don't add placeholder)
            print(f"[VIDEO-SKIP] No relevant video found for {section_title}")

    # Add links from section content
    if section_content.get("links"):
        for link in section_content["links"]:
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "link",
                "data": {
                    "url": link,
                    "title": "Additional Resource"
                }
            })

    return blocks


def format_all_sections_to_lesson(
    section_contents: list,
    lesson_title: str,
    module_title: str = "",
    include_images: bool = True,
    include_videos: bool = True,
    previous_lesson_videos: list = None
) -> dict:
    """
    Convert all section contents into a complete lesson

    Args:
        section_contents: List of section contents from Stage 2
        lesson_title: Lesson title
        module_title: Module title (for media context)
        include_images: Deprecated - images are no longer added (removed due to repetitive/irrelevant content)
        include_videos: Whether to include videos (only if relevant and not already used)
        previous_lesson_videos: List of lesson summaries from earlier lessons (contains video titles to avoid)

    Returns:
        Complete lesson with blocks
    """
    all_blocks = []
    used_video_titles = set()   # Track video titles used in this lesson

    # Collect video titles from previous lessons to avoid (cross-lesson deduplication)
    banned_video_titles = set()
    if previous_lesson_videos:
        for prev_lesson in previous_lesson_videos:
            videos = prev_lesson.get('videos_used', [])
            if videos:
                banned_video_titles.update(videos)

    for idx, section_content in enumerate(section_contents):
        # Always include videos if requested (let format_section_to_blocks decide relevance)
        # Images are never included (removed entirely)
        section_blocks = format_section_to_blocks(
            section_content=section_content,
            lesson_title=lesson_title,
            module_title=module_title,
            include_images=False,  # Images removed entirely
            include_videos=include_videos,
            banned_video_titles=banned_video_titles  # Pass banned videos from previous lessons
        )

        # Track videos to avoid duplicates within this lesson
        for block in section_blocks:
            if block['type'] == 'video':
                video_title = block['data'].get('title', '')
                if video_title.lower().strip() not in {v.lower().strip() for v in used_video_titles}:
                    used_video_titles.add(video_title)
                    all_blocks.append(block)
                else:
                    print(f"[VIDEO-SKIP] Duplicate video in lesson: {video_title}")
            else:
                all_blocks.append(block)

    # Collect video titles used in this lesson for deduplication in next lesson
    videos_used = [b["data"].get("title", "") for b in all_blocks if b["type"] == "video"]

    return {
        "lesson_title": lesson_title,
        "blocks": all_blocks,
        "block_count": len(all_blocks),
        "has_code": any(b["type"] == "code" for b in all_blocks),
        "has_images": False,  # Images removed entirely
        "has_videos": any(b["type"] == "video" for b in all_blocks),
        "videos_used": videos_used  # Track videos for next lesson deduplication
    }
