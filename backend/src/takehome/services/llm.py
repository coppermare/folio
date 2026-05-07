from __future__ import annotations

import re
from collections.abc import AsyncIterator

from pydantic_ai import Agent

from takehome.config import settings  # noqa: F401 — triggers ANTHROPIC_API_KEY export

agent = Agent(
    "anthropic:claude-haiku-4-5-20251001",
    system_prompt=(
        "You are a helpful legal document assistant for commercial real estate lawyers. "
        "You help lawyers review and understand documents during due diligence.\n\n"
        "ANSWERING:\n"
        "- Answer based on the document content provided.\n"
        "- If the answer is not in the document, say so clearly. Do not fabricate information.\n"
        "- Be concise and precise. Lawyers value accuracy over verbosity.\n"
        "- When referencing specific content, cite the section, clause, or page, and mention the document by its filename so it can be linked.\n\n"
        "FORMATTING RULES (strict):\n"
        "- Write in short, well-spaced paragraphs and bullet lists. Default to flowing prose; use bullets only when listing distinct items.\n"
        "- Use Markdown for emphasis (**bold**, *italic*) and short headings (## or ###) when sections truly help.\n"
        "- DO NOT use Markdown tables or any pipe-delimited (`|`) formatting. Never produce rows like `| col | col |`.\n"
        "- DO NOT use ASCII art, separators (---, ===), or decorative characters.\n"
        "- DO NOT prefix bullets with extra symbols beyond a single `-` or `•`.\n"
        "- Keep lines reasonably short and avoid trailing whitespace."
    ),
)


async def generate_title(user_message: str) -> str:
    """Generate a 3-5 word conversation title from the first user message."""
    result = await agent.run(
        f"Generate a concise 3-5 word title for a conversation that starts with: '{user_message}'. "
        "Return only the title, nothing else."
    )
    title = str(result.output).strip().strip('"').strip("'")
    # Truncate if too long
    if len(title) > 100:
        title = title[:97] + "..."
    return title


async def chat_with_document(
    user_message: str,
    document_sections: list[tuple[str, str]],
    conversation_history: list[dict[str, str]],
) -> AsyncIterator[str]:
    """Stream a response to the user's message, yielding text chunks.

    `document_sections` is a list of (filename, extracted_text) tuples. When
    multiple documents are provided, each is wrapped in a labelled <document>
    block so the model can cite by filename.
    """
    prompt_parts: list[str] = []

    if document_sections:
        prompt_parts.append(
            "The following documents are available for reference. "
            "When citing content, mention which document (by filename) it comes from.\n"
        )
        for filename, text in document_sections:
            prompt_parts.append(
                f'<document filename="{filename}">\n{text}\n</document>\n'
            )
    else:
        prompt_parts.append(
            "No document has been uploaded yet. If the user asks about a document, "
            "let them know they need to upload one first.\n"
        )

    # Add conversation history
    if conversation_history:
        prompt_parts.append("Previous conversation:\n")
        for msg in conversation_history:
            role = msg["role"]
            content = msg["content"]
            if role == "user":
                prompt_parts.append(f"User: {content}\n")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}\n")
        prompt_parts.append("\n")

    # Add the current user message
    prompt_parts.append(f"User: {user_message}")

    full_prompt = "\n".join(prompt_parts)

    async with agent.run_stream(full_prompt) as result:
        async for text in result.stream_text(delta=True):
            yield text


def count_sources_cited(response: str) -> int:
    """Count the number of references to document sections, clauses, pages, etc."""
    patterns = [
        r"section\s+\d+",
        r"clause\s+\d+",
        r"page\s+\d+",
        r"paragraph\s+\d+",
    ]
    count = 0
    for pattern in patterns:
        count += len(re.findall(pattern, response, re.IGNORECASE))
    return count
