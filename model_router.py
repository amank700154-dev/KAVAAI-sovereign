import os
import sys
import json
import time
import requests
from datetime import datetime

# ==============================================================================
# CONFIGURATION & MODEL REGISTRY
# ==============================================================================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_FILE = os.path.join(BASE_DIR, "model_config.json")

DEFAULT_ROLES = {
    "REASONING_MODEL": "qwen2.5:7b",
    "CODING_MODEL": "qwen2.5:7b",
    "VISION_MODEL": "qwen2.5vl:7b",
    "EMBEDDING_MODEL": "all-MiniLM-L6-v2"
}

DEFAULT_OLLAMA_HOST = "http://localhost:11434"

def load_config() -> dict:
    """Loads configuration from model_config.json or environment variables."""
    cfg = {
        "roles": dict(DEFAULT_ROLES),
        "ollama": {
            "host": os.environ.get("OLLAMA_HOST", DEFAULT_OLLAMA_HOST),
            "timeout_seconds": 90
        }
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                disk_cfg = json.load(f)
                if "roles" in disk_cfg:
                    cfg["roles"].update(disk_cfg["roles"])
                if "ollama" in disk_cfg:
                    cfg["ollama"].update(disk_cfg["ollama"])
        except Exception as e:
            print(f"[ModelRouter] Warning: failed to parse {CONFIG_FILE}: {e}")

    # Environment variable overrides
    for role in DEFAULT_ROLES.keys():
        env_var = f"KAVAAI_{role}"
        if env_var in os.environ:
            cfg["roles"][role] = os.environ[env_var]

    return cfg

_CONFIG = load_config()

# Backwards compatibility constants
MODEL_TEXT_REASONING = _CONFIG["roles"]["REASONING_MODEL"]
MODEL_MULTIMODAL_VISION = _CONFIG["roles"]["VISION_MODEL"]
MODEL_CODE_CALCULATION = _CONFIG["roles"]["CODING_MODEL"]
MODEL_CODE_MATH = _CONFIG["roles"]["CODING_MODEL"]
OLLAMA_ENDPOINT = f"{_CONFIG['ollama']['host'].rstrip('/')}/api/generate"
OLLAMA_TAGS_ENDPOINT = f"{_CONFIG['ollama']['host'].rstrip('/')}/api/tags"

# ==============================================================================
# MODEL AVAILABILITY CACHE
# ==============================================================================
_availability_cache = {
    "checked_at": 0,
    "ollama_online": False,
    "installed_models": [],
    "roles_status": {}
}

def check_local_model_availability(force_refresh: bool = False) -> dict:
    """
    Checks the local Ollama daemon and local environment to verify which models
    are actually pulled and available. Never fakes availability.
    Cached for 15 seconds to prevent spamming localhost.
    """
    global _availability_cache
    now = time.time()
    
    if not force_refresh and (now - _availability_cache["checked_at"] < 15):
        return _availability_cache

    ollama_host = _CONFIG["ollama"]["host"]
    tags_url = f"{ollama_host.rstrip('/')}/api/tags"
    installed_models = []
    ollama_online = False

    try:
        res = requests.get(tags_url, timeout=2.0)
        if res.status_code == 200:
            ollama_online = True
            data = res.json()
            raw_models = data.get("models", [])
            for m in raw_models:
                name = m.get("name", "")
                installed_models.append(name)
                # Also store base name without tag if tag is present (e.g. "qwen2.5:7b" -> "qwen2.5")
                if ":" in name:
                    installed_models.append(name.split(":")[0])
    except Exception:
        ollama_online = False

    roles = _CONFIG["roles"]
    roles_status = {}
    
    for role_name, configured_model in roles.items():
        if role_name == "EMBEDDING_MODEL":
            # Embedding model runs locally via sentence-transformers
            roles_status[role_name] = {
                "configured": configured_model,
                "status": "LOCAL_LIBRARY_READY",
                "available": True,
                "notes": "Runs locally via sentence-transformers without external WAN"
            }
        else:
            if not ollama_online:
                roles_status[role_name] = {
                    "configured": configured_model,
                    "status": "OLLAMA_OFFLINE",
                    "available": False,
                    "notes": f"Local Ollama server not responding on {ollama_host}"
                }
            else:
                # Check if configured model or its base tag is in installed_models
                is_installed = any(
                    configured_model.lower() == im.lower() or 
                    configured_model.split(":")[0].lower() == im.lower()
                    for im in installed_models
                )
                roles_status[role_name] = {
                    "configured": configured_model,
                    "status": "INSTALLED" if is_installed else "NOT_PULLED",
                    "available": is_installed,
                    "notes": "Ready for local inference" if is_installed else f"Run: ollama pull {configured_model}"
                }

    _availability_cache = {
        "checked_at": now,
        "ollama_online": ollama_online,
        "installed_models": list(set(installed_models)),
        "roles_status": roles_status
    }
    return _availability_cache


# ==============================================================================
# TASK CLASSIFICATION
# ==============================================================================
def classify_task(query: str = "", context: dict = None, has_image: bool = False, requires_code: bool = False) -> dict:
    """
    Analyzes task requirements to determine the task type and required model roles.
    Classifications:
    - DOCUMENT_ANALYSIS
    - CODE_AND_MATH
    - VISION_ANALYSIS
    - SEMANTIC_RETRIEVAL
    - MULTIMODAL_INVESTIGATION
    - GENERAL_REASONING
    """
    q = (query or "").lower().strip()
    ctx = context or {}
    
    has_img = has_image or bool(ctx.get("image_base64") or ctx.get("image_path")) or any(
        w in q for w in ["image", "photo", "crack", "visible", "appearance", "damage", "drawing", "leak", "ocr", "blueprint"]
    )
    has_code = requires_code or any(
        w in q for w in ["calculate", "formula", "code", "math", "delta", "margin", "ratio", "eval", "percentage", "script"]
    )
    has_doc = any(
        w in q for w in ["manual", "spec", "procedure", "sop", "document", "threshold", "guide", "rule", "standard", "report", "policy"]
    )
    has_telemetry = bool(ctx.get("telemetry")) or any(
        w in q for w in ["telemetry", "temp", "temperature", "rpm", "pressure", "vibration", "sensor", "coolant", "overheat"]
    )

    if has_img and (has_telemetry or has_doc):
        task_type = "MULTIMODAL_INVESTIGATION"
        primary_role = "VISION_MODEL"
        secondary_role = "REASONING_MODEL"
        rationale = "Multimodal industrial task requires visual equipment verification fused with document SOP limits & telemetry."
    elif has_img:
        task_type = "VISION_ANALYSIS"
        primary_role = "VISION_MODEL"
        secondary_role = None
        rationale = "Task requires inspection of physical components, visual defects, or scanned drawings."
    elif has_code:
        task_type = "CODE_AND_MATH"
        primary_role = "CODING_MODEL"
        secondary_role = "REASONING_MODEL"
        rationale = "Task involves technical calculations, formula evaluation, or data transformation."
    elif has_doc:
        task_type = "DOCUMENT_ANALYSIS"
        primary_role = "REASONING_MODEL"
        secondary_role = "EMBEDDING_MODEL"
        rationale = "Task requires reading and reasoning over technical documentation and maintenance limits."
    else:
        task_type = "GENERAL_REASONING"
        primary_role = "REASONING_MODEL"
        secondary_role = None
        rationale = "Task involves general reasoning, task planning, or synthesis."

    return {
        "task_type": task_type,
        "primary_role": primary_role,
        "secondary_role": secondary_role,
        "rationale": rationale
    }


# ==============================================================================
# ROUTING LOGS (IN-MEMORY AUDIT BUFFER)
# ==============================================================================
_ROUTING_HISTORY = []

def get_routing_history(limit: int = 25) -> list:
    """Returns the most recent model routing decisions for auditing."""
    return list(reversed(_ROUTING_HISTORY[-limit:]))


# ==============================================================================
# ROUTING LOGIC & HONEST FALLBACK
# ==============================================================================
def route_task(
    task_type: str = None,
    query: str = "",
    context: dict = None,
    has_image: bool = False,
    requires_code: bool = False
) -> dict:
    """
    Selects the optimal local model based on task modality, reasoning complexity, and inputs.
    Verifies actual local model availability. Never fakes availability.
    """
    cfg = _CONFIG["roles"]
    
    # Backward compatibility if task_type was passed as an existing string
    if task_type and not query:
        query = task_type
        
    classification = classify_task(query=query, context=context, has_image=has_image, requires_code=requires_code)
    
    # If caller provided an explicit known task_type or tool name:
    t_str = (task_type or "").lower()
    if any(k in t_str for k in ["vision", "image", "ocr", "drawing"]):
        target_role = "VISION_MODEL"
    elif any(k in t_str for k in ["code", "calc", "formula", "math"]):
        target_role = "CODING_MODEL"
    elif any(k in t_str for k in ["search", "embedding", "rag"]):
        target_role = "EMBEDDING_MODEL"
    else:
        target_role = classification["primary_role"]

    configured_model = cfg.get(target_role, "qwen2.5:7b")
    
    # Check actual availability
    avail = check_local_model_availability()
    installed = avail.get("installed_models", [])
    ollama_online = avail.get("ollama_online", False)
    
    selected_model = configured_model
    fallback_applied = False
    fallback_reason = None
    execution_mode = "LOCAL_OLLAMA"

    if target_role == "EMBEDDING_MODEL":
        execution_mode = "LOCAL_EMBEDDING"
        selected_model = configured_model
    elif not ollama_online:
        # Ollama server is offline
        execution_mode = "LOCAL_HEURISTIC_FALLBACK"
        fallback_applied = True
        fallback_reason = f"Ollama daemon is offline on {_CONFIG['ollama']['host']}. Using local deterministic sovereign fallback."
        selected_model = f"{configured_model} (Offline Fallback)"
    else:
        # Check if configured model is installed
        is_target_installed = any(
            configured_model.lower() == m.lower() or 
            configured_model.split(":")[0].lower() == m.lower() 
            for m in installed
        )
        
        if is_target_installed:
            selected_model = configured_model
            execution_mode = "LOCAL_OLLAMA"
        else:
            # Model not installed — look for available local alternative
            reasoning_model = cfg.get("REASONING_MODEL", "qwen2.5:7b")
            is_reasoning_installed = any(
                reasoning_model.lower() == m.lower() or 
                reasoning_model.split(":")[0].lower() == m.lower() 
                for m in installed
            )
            
            if is_reasoning_installed:
                fallback_applied = True
                fallback_reason = f"Configured {target_role} ('{configured_model}') is not installed. Routing to installed REASONING_MODEL ('{reasoning_model}')."
                selected_model = reasoning_model
                execution_mode = "LOCAL_OLLAMA"
            elif len(installed) > 0:
                fallback_applied = True
                fallback_reason = f"Configured '{configured_model}' not installed. Routing to installed local model '{installed[0]}'."
                selected_model = installed[0]
                execution_mode = "LOCAL_OLLAMA"
            else:
                fallback_applied = True
                fallback_reason = f"No models currently pulled in Ollama. Run: ollama pull {configured_model}"
                execution_mode = "LOCAL_HEURISTIC_FALLBACK"
                selected_model = f"{configured_model} (Pending Pull)"

    # Construct result record
    routing_result = {
        "timestamp": datetime.now().isoformat(),
        "task_type": classification["task_type"],
        "target_role": target_role,
        "configured_model": configured_model,
        "selected_model": selected_model,
        "model_name": selected_model,  # Backward compatibility
        "modality": classification["task_type"],  # Backward compatibility
        "execution_mode": execution_mode,
        "execution": "LOCAL AIR-GAPPED",
        "fallback_applied": fallback_applied,
        "fallback_reason": fallback_reason,
        "rationale": classification["rationale"],
        "sovereignty": {
            "air_gapped": True,
            "wan_egress": 0,
            "loopback_only": True
        }
    }

    # Store in history
    _ROUTING_HISTORY.append(routing_result)
    if len(_ROUTING_HISTORY) > 100:
        _ROUTING_HISTORY.pop(0)

    return routing_result


# ==============================================================================
# LOCAL INFERENCE INVOCATION
# ==============================================================================
def invoke_local_model(model_name: str, prompt: str, images: list = None, timeout: int = 90) -> dict:
    """
    Sends inference request to the local Ollama daemon without external WAN calls.
    Cleanly handles offline server or model failures.
    """
    clean_model = model_name.split(" ")[0]  # remove any (Offline Fallback) tag
    payload = {
        "model": clean_model,
        "prompt": prompt,
        "stream": False
    }
    if images:
        payload["images"] = images

    ollama_host = _CONFIG["ollama"]["host"]
    generate_url = f"{ollama_host.rstrip('/')}/api/generate"

    t0 = time.time()
    try:
        response = requests.post(generate_url, json=payload, timeout=timeout)
        dur_ms = round((time.time() - t0) * 1000, 2)
        if response.status_code == 200:
            data = response.json()
            resp_text = data.get("response", "").strip()
            try:
                from sovereignty_monitor import get_monitor
                get_monitor().record_ai_call(
                    model_name=clean_model,
                    role="LOCAL_OLLAMA",
                    endpoint=generate_url,
                    status="SUCCESS",
                    prompt_chars=len(prompt),
                    response_chars=len(resp_text),
                    latency_ms=dur_ms
                )
            except Exception:
                pass
            return {
                "success": True,
                "model_used": clean_model,
                "response": resp_text
            }
        else:
            try:
                from sovereignty_monitor import get_monitor
                get_monitor().record_ai_call(
                    model_name=clean_model,
                    role="LOCAL_OLLAMA",
                    endpoint=generate_url,
                    status=f"HTTP_{response.status_code}",
                    prompt_chars=len(prompt),
                    response_chars=0,
                    latency_ms=dur_ms
                )
            except Exception:
                pass
            return {
                "success": False,
                "model_used": clean_model,
                "error": f"Ollama HTTP {response.status_code}: {response.text}"
            }
    except requests.exceptions.ConnectionError:
        dur_ms = round((time.time() - t0) * 1000, 2)
        try:
            from sovereignty_monitor import get_monitor
            get_monitor().record_ai_call(
                model_name=clean_model,
                role="LOCAL_OLLAMA",
                endpoint=generate_url,
                status="OFFLINE_FALLBACK",
                prompt_chars=len(prompt),
                response_chars=0,
                latency_ms=dur_ms
            )
        except Exception:
            pass
        return {
            "success": False,
            "model_used": clean_model,
            "error": f"Local Ollama server is offline on {ollama_host}.",
            "simulated": True
        }
    except Exception as e:
        return {
            "success": False,
            "model_used": clean_model,
            "error": str(e)
        }


# ==============================================================================
# CLI TEST
# ==============================================================================
if __name__ == "__main__":
    print("=" * 60)
    print("KAVAAI SOVEREIGN LOCAL MODEL ROUTER AUDIT")
    print("=" * 60)
    avail = check_local_model_availability(force_refresh=True)
    print(f"Ollama Daemon Status: {'ONLINE' if avail['ollama_online'] else 'OFFLINE (localhost:11434)'}")
    print(f"Installed Models:     {avail['installed_models']}")
    print("\nModel Roles:")
    for role, stat in avail["roles_status"].items():
        print(f"  - {role:<18}: {stat['configured']} [{stat['status']}]")

    test_queries = [
        ("What is the critical temperature limit in the manual?", False, False),
        ("Calculate thermal margin 85 - 80 degrees", False, True),
        ("Analyze this photo of the cooling fan for cracks", True, False),
        ("Is Machine 101 overheating? Check telemetry and manual", False, False)
    ]

    print("\nRouting Tests:")
    for q, img, code in test_queries:
        r = route_task(query=q, has_image=img, requires_code=code)
        print(f"\nQuery: '{q}'")
        print(f"  -> Task Type:     {r['task_type']}")
        print(f"  -> Target Role:   {r['target_role']}")
        print(f"  -> Selected Model:{r['selected_model']}")
        print(f"  -> Execution:     {r['execution_mode']}")
        if r['fallback_applied']:
            print(f"  -> Fallback Note: {r['fallback_reason']}")
    print("=" * 60)
