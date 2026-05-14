"""Trajectory parser — extracts structured events and skill usage from ACP trajectory logs.

Parses BenchFlow ACP trajectory JSONL files to detect skill usage patterns:
- Explicit skill activation via the Skill tool
- Reading SKILL.md via terminal (cat) or Read tool
- Agent reasoning that references skill section headers
"""

import json
import logging
import re
from dataclasses import dataclass, field
from pathlib import Path

logger = logging.getLogger(__name__)

# Patterns that indicate reading a skill file via terminal
_SKILL_FILE_PATTERNS = [
    re.compile(r"SKILL\.md", re.IGNORECASE),
    re.compile(r"cat\s+.*SKILL", re.IGNORECASE),
    re.compile(r"\.claude/skills/", re.IGNORECASE),
    re.compile(r"skills/.*\.md", re.IGNORECASE),
]

# Pattern to extract markdown ## headers from skill content
_HEADER_RE = re.compile(r"^##\s+(.+)$", re.MULTILINE)


@dataclass
class TrajectoryEvent:
    """A single parsed event from the trajectory log."""

    step: int
    type: str  # "user_message", "tool_call", "agent_message"
    kind: str  # "execute", "read", "write", "other", ""
    title: str  # "Terminal", "Skill", "Read", "Write", ""
    content: str  # The text content (truncated for storage)
    is_skill_related: bool  # True if this event involves skill access
    duration_ms: int | None = None
    timestamp: str | None = None


@dataclass
class SkillUsageAnalysis:
    """Summary of how the agent interacted with the skill during a run."""

    skill_read: bool = False
    read_at_step: int | None = None
    read_method: str | None = None  # "Skill tool", "cat SKILL.md", "Read SKILL.md"
    sections_accessed: list[str] = field(default_factory=list)
    skill_mentions_in_reasoning: list[dict] = field(default_factory=list)  # [{step, quote}]
    time_to_first_read_sec: float | None = None


class TrajectoryParser:
    """Parses raw ACP trajectory events into structured data with skill usage analysis.

    Args:
        skill_content: The SKILL.md content, used to match section headers
            in agent reasoning. If None, section matching is skipped.
    """

    # Maximum content length stored per event (to avoid DB bloat)
    MAX_CONTENT_LENGTH = 4000

    def __init__(self, skill_content: str | None = None):
        self.skill_content = skill_content
        self._section_headers: list[str] = []
        if skill_content:
            self._section_headers = _HEADER_RE.findall(skill_content)

    def parse(self, raw_events: list[dict]) -> tuple[list[TrajectoryEvent], SkillUsageAnalysis]:
        """Parse raw JSONL events into structured trajectory + skill usage.

        Args:
            raw_events: List of dicts, each representing one JSONL line from
                the ACP trajectory file.

        Returns:
            Tuple of (list of TrajectoryEvent, SkillUsageAnalysis).
        """
        events: list[TrajectoryEvent] = []
        analysis = SkillUsageAnalysis()

        for step, raw in enumerate(raw_events):
            event = self._parse_event(step, raw)
            events.append(event)

            # Track skill usage
            if event.is_skill_related:
                self._update_skill_analysis(event, analysis)

        # Post-processing: check agent reasoning for section header mentions
        if self._section_headers:
            self._find_section_references(events, analysis)

        return events, analysis

    def parse_from_file(self, path: str) -> tuple[list[TrajectoryEvent], SkillUsageAnalysis]:
        """Parse from a .jsonl file path.

        Args:
            path: Absolute or relative path to the trajectory JSONL file.

        Returns:
            Tuple of (list of TrajectoryEvent, SkillUsageAnalysis).

        Raises:
            FileNotFoundError: If the file does not exist.
            json.JSONDecodeError: If a line is not valid JSON.
        """
        file_path = Path(path)
        if not file_path.exists():
            raise FileNotFoundError(f"Trajectory file not found: {path}")

        raw_events = []
        text = file_path.read_text(encoding="utf-8")
        for line in text.strip().split("\n"):
            line = line.strip()
            if line:
                raw_events.append(json.loads(line))

        return self.parse(raw_events)

    def _parse_event(self, step: int, raw: dict) -> TrajectoryEvent:
        """Parse a single raw event dict into a TrajectoryEvent."""
        event_type = raw.get("type", "")
        kind = raw.get("kind", "")
        title = raw.get("title", "")
        timestamp = raw.get("timestamp")
        duration_ms = raw.get("duration_ms")

        # Extract text content from the event
        content = self._extract_content(raw)

        # Determine if this event is skill-related
        is_skill_related = self._is_skill_related(event_type, kind, title, content)

        return TrajectoryEvent(
            step=step,
            type=event_type,
            kind=kind,
            title=title,
            content=content[: self.MAX_CONTENT_LENGTH],
            is_skill_related=is_skill_related,
            duration_ms=duration_ms,
            timestamp=timestamp,
        )

    def _extract_content(self, raw: dict) -> str:
        """Extract the text content from a raw event.

        Handles different event structures:
        - user_message / agent_message: raw["text"]
        - tool_call: content nested in raw["content"][*]["content"]["text"]
        """
        # Direct text field (user_message, agent_message)
        if "text" in raw:
            return raw["text"] or ""

        # Tool call content (nested structure)
        content_list = raw.get("content", [])
        if isinstance(content_list, list):
            parts = []
            for item in content_list:
                if isinstance(item, dict):
                    # Handle {"type": "content", "content": {"type": "text", "text": "..."}}
                    inner = item.get("content", item)
                    if isinstance(inner, dict):
                        text = inner.get("text", "")
                        if text:
                            parts.append(text)
                    elif isinstance(inner, str):
                        parts.append(inner)
            return "\n".join(parts)

        return ""

    def _is_skill_related(
        self, event_type: str, kind: str, title: str, content: str
    ) -> bool:
        """Determine if an event involves skill access.

        Detection heuristics (ordered by signal strength):
        1. title == "Skill" -> explicit skill activation (strongest)
        2. kind == "execute" and content matches skill file patterns -> terminal cat
        3. kind == "read" and content matches skill path patterns -> Read tool on skill
        4. type == "agent_message" and content mentions skill keywords -> reasoning
        """
        # Heuristic 1: Explicit Skill tool invocation
        if title == "Skill":
            return True

        # Heuristic 2: Terminal command accessing skill files
        if kind == "execute" and content:
            for pattern in _SKILL_FILE_PATTERNS:
                if pattern.search(content):
                    return True

        # Heuristic 3: Read tool on skill file
        if kind == "read" and content:
            for pattern in _SKILL_FILE_PATTERNS:
                if pattern.search(content):
                    return True

        # Heuristic 4: Agent reasoning about skills (weaker signal)
        if event_type == "agent_message" and content:
            # Check if the agent mentions skill section headers
            for header in self._section_headers:
                if header.lower() in content.lower():
                    return True

        return False

    def _update_skill_analysis(
        self, event: TrajectoryEvent, analysis: SkillUsageAnalysis
    ) -> None:
        """Update the skill usage analysis based on a skill-related event."""
        # Only record the first skill read
        if not analysis.skill_read:
            read_method = self._determine_read_method(event)
            if read_method:
                analysis.skill_read = True
                analysis.read_at_step = event.step
                analysis.read_method = read_method

        # Track mentions in agent reasoning
        if event.type == "agent_message":
            # Extract a short quote (first 200 chars of the relevant portion)
            quote = event.content[:200]
            analysis.skill_mentions_in_reasoning.append(
                {"step": event.step, "quote": quote}
            )

    def _determine_read_method(self, event: TrajectoryEvent) -> str | None:
        """Determine the method used to read the skill, or None if not a read event."""
        if event.title == "Skill":
            return "Skill tool"

        if event.kind == "execute":
            if re.search(r"cat\s+.*SKILL", event.content, re.IGNORECASE):
                return "cat SKILL.md"
            if any(p.search(event.content) for p in _SKILL_FILE_PATTERNS):
                return "terminal SKILL.md"

        if event.kind == "read":
            if any(p.search(event.content) for p in _SKILL_FILE_PATTERNS):
                return "Read SKILL.md"

        return None

    def _find_section_references(
        self, events: list[TrajectoryEvent], analysis: SkillUsageAnalysis
    ) -> None:
        """Find which skill sections the agent references in its reasoning."""
        sections_found: set[str] = set()

        for event in events:
            if event.type != "agent_message":
                continue
            content_lower = event.content.lower()
            for header in self._section_headers:
                if header.lower() in content_lower:
                    sections_found.add(header)

        analysis.sections_accessed = sorted(sections_found)
