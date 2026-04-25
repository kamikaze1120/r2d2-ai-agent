"""Multi-agent system. Each agent has a deterministic run(task) -> result.

The LLM is used for content generation and high-level strategy only;
workflow control is hardcoded in the dispatcher.
"""
from . import (  # noqa: F401
    research_agent,
    product_agent,
    listing_agent,
    upload_agent,
    marketing_agent,
    strategy_agent,
)
from .dispatcher import dispatch, AGENTS  # noqa: F401
