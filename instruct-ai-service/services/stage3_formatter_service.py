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

    # Wrap each paragraph in <p> tags
    formatted = "".join([f"<p>{p.strip()}</p>" for p in paragraphs if p.strip()])

    return formatted


def format_section_to_blocks(
    section_content: dict,
    lesson_title: str,
    module_title: str = "",
    include_images: bool = True,
    include_videos: bool = True
) -> list:
    """
    Convert a section's content into lesson blocks

    Args:
        section_content: Content from Stage 2
        lesson_title: Lesson title for media keywords
        include_images: Whether to include image blocks
        include_videos: Whether to include video blocks

    Returns:
        List of lesson blocks
    """
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
            items = "".join([f"<li>{item}</li>" for item in section_content["what_youll_learn"]])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>What You'll Learn:</strong></p><ul>{items}</ul>"}
            })

    elif content_type == "tutorial":
        # Steps as numbered list
        if section_content.get("steps"):
            items = "".join([f"<li>{step}</li>" for step in section_content["steps"]])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<ol>{items}</ol>"}
            })

        # Commands as code block
        if section_content.get("commands"):
            commands = "\n".join(section_content["commands"])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "code",
                "data": {
                    "mode": "playground",
                    "code": commands,
                    "expected": ""
                }
            })

        # Warnings
        if section_content.get("warnings"):
            items = "".join([f"<li>{warning}</li>" for warning in section_content["warnings"]])
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
                "data": {"text": f"<p><strong>Definition:</strong> {section_content['definition']}</p>"}
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
            items = "".join([f"<li>{point}</li>" for point in section_content["key_points"]])
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
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "code",
                "data": {
                    "mode": "playground",
                    "code": section_content["code"],
                    "expected": section_content.get("output", "")
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
            items = "".join([f"<li>{elem}</li>" for elem in section_content["key_elements"]])
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
                "data": {"text": f"<p><strong>Guidelines:</strong></p><p>{section_content['guidelines']}</p>"}
            })

        # Starter code (programming)
        if section_content.get("starter_code"):
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "code",
                "data": {
                    "mode": "challenge",
                    "code": section_content["starter_code"],
                    "expected": section_content.get("expected_output", "")
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
            items = "".join([f"<li>{hint}</li>" for hint in section_content["hints"]])
            blocks.append({
                "id": str(uuid.uuid4()),
                "type": "text",
                "data": {"text": f"<p><strong>💡 Hints:</strong></p><ul>{items}</ul>"}
            })

    elif content_type == "summary":
        # Key takeaways
        if section_content.get("key_takeaways"):
            items = "".join([f"<li>{takeaway}</li>" for takeaway in section_content["key_takeaways"]])
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
                "data": {"text": f"<p><strong>🎯 Remember This:</strong> {section_content['remember_this']}</p>"}
            })

    # Add image if requested (for concept/tutorial/example sections)
    if include_images and content_type in ["concept", "tutorial", "example"]:
        keywords = generate_image_keywords(lesson_title, section_title, module_title)
        image_url = fetch_pexels_image(keywords)
        blocks.append({
            "id": str(uuid.uuid4()),
            "type": "image",
            "data": {
                "url": image_url,
                "caption": section_title
            }
        })

    # Add video if requested (for concept/tutorial sections)
    if include_videos and content_type in ["concept", "tutorial"]:
        keywords = generate_video_keywords(lesson_title, section_title, module_title)
        video_data = fetch_youtube_video(keywords)
        blocks.append({
            "id": str(uuid.uuid4()),
            "type": "video",
            "data": video_data
        })

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
    include_videos: bool = True
) -> dict:
    """
    Convert all section contents into a complete lesson

    Args:
        section_contents: List of section contents from Stage 2
        lesson_title: Lesson title
        module_title: Module title (for media context)
        include_images: Whether to include images
        include_videos: Whether to include videos

    Returns:
        Complete lesson with blocks
    """
    all_blocks = []
    used_image_urls = set()  # Track used images to avoid duplicates
    used_video_ids = set()   # Track used videos to avoid duplicates

    # Smart media distribution: limit to 2-3 images and 1-2 videos per lesson
    # Prioritize concept and tutorial sections for media
    media_eligible_sections = [
        (idx, s) for idx, s in enumerate(section_contents)
        if s.get('content_type') in ['concept', 'tutorial', 'example']
    ]

    # Allow up to 3 unique images and 2 unique videos
    images_added = 0
    videos_added = 0
    max_images = 3
    max_videos = 2

    for idx, section_content in enumerate(section_contents):
        # Determine if this section should get media
        is_eligible = idx in [i for i, _ in media_eligible_sections]
        add_image = include_images and is_eligible and images_added < max_images
        add_video = include_videos and is_eligible and videos_added < max_videos

        section_blocks = format_section_to_blocks(
            section_content=section_content,
            lesson_title=lesson_title,
            module_title=module_title,
            include_images=add_image,
            include_videos=add_video
        )

        # Track added media and remove duplicates
        for block in section_blocks:
            if block['type'] == 'image':
                url = block['data']['url']
                if url in used_image_urls:
                    continue  # Skip duplicate image
                used_image_urls.add(url)
                images_added += 1
                all_blocks.append(block)
            elif block['type'] == 'video':
                url = block['data'].get('url', '')
                video_id = url.split('v=')[-1] if 'v=' in url else url
                if video_id in used_video_ids:
                    continue  # Skip duplicate video
                used_video_ids.add(video_id)
                videos_added += 1
                all_blocks.append(block)
            else:
                all_blocks.append(block)

    return {
        "lesson_title": lesson_title,
        "blocks": all_blocks,
        "block_count": len(all_blocks),
        "has_code": any(b["type"] == "code" for b in all_blocks),
        "has_images": any(b["type"] == "image" for b in all_blocks),
        "has_videos": any(b["type"] == "video" for b in all_blocks)
    }
