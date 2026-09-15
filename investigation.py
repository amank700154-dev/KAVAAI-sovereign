import sys
import json
import os
from agent_orchestrator import orchestrator

def run_investigation():
    raw_input = sys.stdin.read().strip()
    context = {}
    question = "Is Machine 101 overheating?"
    
    if raw_input:
        try:
            data = json.loads(raw_input)
            if isinstance(data, dict):
                question = data.get("question", question)
                context = data
            else:
                question = str(data)
        except Exception:
            question = raw_input

    # Ensure sample image if none provided
    if "image_path" not in context:
        context["image_path"] = "ChatGPT Image Sep 13, 2026, 01_44_35 PM.png"

    # Execute through AgentOrchestrator with verbose structured audit logging
    result = orchestrator.execute(
        user_request=question,
        context=context,
        generate_deliverables=True,
        verbose=True
    )

    decision = result.get("decision", "BOTH")
    report = result.get("answer", "")
    
    # Backward compatible outputs expected by legacy backend/CLI
    print(f"\nAgent decision: {decision}")
    print("\n### Investigation Report")
    print(report)
    print("\n------------------------------------------")
    print("Evidence-based investigation complete.")
    print("==========================================")
    
    # Print deliverables audit summary
    deliverables = result.get("deliverables", [])
    if deliverables:
        print("\nDELIVERABLE ARTIFACTS GENERATED:")
        for d in deliverables:
            print(f" - [{d.get('type')}] {d.get('filename')}: {d.get('file_path')}")
            
    # Output machine-parseable orchestrator payload marker
    print("\n__KAVAAI_ORCHESTRATOR_PAYLOAD_START__")
    print(json.dumps(result))
    print("__KAVAAI_ORCHESTRATOR_PAYLOAD_END__")

if __name__ == "__main__":
    run_investigation()
