"""Token extractor — estimates token usage and cost from trajectory data.

Provides rough estimates based on content length when precise API usage data
is not available. Will be extended to parse real token counts from agent output
when that data becomes available in trajectory logs.
"""

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Approximate chars-per-token ratio (conservative estimate for English text + code)
_CHARS_PER_TOKEN = 4


@dataclass
class TokenSnapshot:
    """Token usage snapshot for a single run."""

    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_tokens: int = 0
    cache_creation_tokens: int = 0
    total_cost_usd: float = 0.0


class TokenExtractor:
    """Extracts or estimates token usage from trajectory events.

    Pricing is per 1M tokens. When real token data is unavailable,
    estimates are generated from content character counts.
    """

    # Pricing per 1M tokens (USD)
    PRICING: dict[str, dict[str, float]] = {
        "claude-sonnet-4-6": {"input": 3.0, "output": 15.0, "cache_read": 0.3},
        "claude-sonnet-4-5": {"input": 3.0, "output": 15.0, "cache_read": 0.3},
        "claude-opus-4-6": {"input": 15.0, "output": 75.0, "cache_read": 1.5},
        "claude-opus-4-5": {"input": 15.0, "output": 75.0, "cache_read": 1.5},
        "claude-haiku-3-5": {"input": 0.8, "output": 4.0, "cache_read": 0.08},
    }

    # Default pricing for unknown models
    _DEFAULT_PRICING: dict[str, float] = {"input": 3.0, "output": 15.0, "cache_read": 0.3}

    def estimate_from_trajectory(
        self, events: list[dict], model: str
    ) -> TokenSnapshot:
        """Estimate token usage based on trajectory content lengths.

        This provides a rough estimate by:
        1. Counting characters in user_message and tool_call content -> input tokens
        2. Counting characters in agent_message content -> output tokens
        3. Applying model-specific pricing

        Args:
            events: Raw trajectory event dicts (from JSONL).
            model: Model identifier for pricing lookup.

        Returns:
            TokenSnapshot with estimated token counts and cost.
        """
        input_chars = 0
        output_chars = 0

        for event in events:
            event_type = event.get("type", "")
            content_len = self._get_content_length(event)

            if event_type in ("user_message", "tool_call"):
                input_chars += content_len
            elif event_type == "agent_message":
                output_chars += content_len

        input_tokens = input_chars // _CHARS_PER_TOKEN
        output_tokens = output_chars // _CHARS_PER_TOKEN

        # Calculate cost
        pricing = self.PRICING.get(model, self._DEFAULT_PRICING)
        cost = (
            (input_tokens / 1_000_000) * pricing["input"]
            + (output_tokens / 1_000_000) * pricing["output"]
        )

        return TokenSnapshot(
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cache_read_tokens=0,  # Cannot estimate without API data
            cache_creation_tokens=0,
            total_cost_usd=round(cost, 6),
        )

    def _get_content_length(self, event: dict) -> int:
        """Get the total character length of content in an event."""
        # Direct text field
        text = event.get("text", "")
        if text:
            return len(text)

        # Nested content array (tool_call format)
        content_list = event.get("content", [])
        if isinstance(content_list, list):
            total = 0
            for item in content_list:
                if isinstance(item, dict):
                    inner = item.get("content", item)
                    if isinstance(inner, dict):
                        total += len(inner.get("text", ""))
                    elif isinstance(inner, str):
                        total += len(inner)
            return total

        return 0
