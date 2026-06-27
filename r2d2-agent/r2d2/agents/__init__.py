"""Multi-agent system.

Agents are auto-discovered by dispatcher.py at boot.
Each agent module must export:
  - async run(task: dict) -> dict
  - TASK_TYPES: list[str]  (optional — maps task type strings to this agent)
"""
