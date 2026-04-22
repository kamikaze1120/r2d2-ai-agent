"""R2D2 — Local-first AI agent core.

Modular architecture:
  - llm.py        : Ollama client (dynamic model switching)
  - memory.py     : Short-term (session) + long-term (JSON) memory
  - tools.py      : Pluggable tool framework (file, shell, web, etc.)
  - planner.py    : Task decomposition
  - executor.py   : Agent loop (plan -> tool call -> observe -> next)
  - server.py     : FastAPI HTTP API exposed on localhost:8000
"""
__version__ = "0.1.0"
