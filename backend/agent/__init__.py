"""
Agentic AI Package for KAVAAI Sovereign.
=========================================
Autonomous multi-step planning, model routing, self-healing code repair, and execution.
"""

from backend.agent.router import (
    classify_task,
    route_task,
    invoke_local_model,
    check_local_model_availability,
    get_routing_history,
    MODEL_TEXT_REASONING,
    MODEL_MULTIMODAL_VISION,
    MODEL_CODE_CALCULATION,
    MODEL_CODE_MATH,
    _CONFIG,
    DEFAULT_ROLES
)
from backend.agent.orchestrator import (
    AgentState,
    AgentOrchestrator,
    orchestrator
)

__all__ = [
    "classify_task",
    "route_task",
    "invoke_local_model",
    "check_local_model_availability",
    "get_routing_history",
    "MODEL_TEXT_REASONING",
    "MODEL_MULTIMODAL_VISION",
    "MODEL_CODE_CALCULATION",
    "MODEL_CODE_MATH",
    "_CONFIG",
    "DEFAULT_ROLES",
    "AgentState",
    "AgentOrchestrator",
    "orchestrator"
]
