import requests
import base64

image_path = "ChatGPT Image Sep 13, 2026, 01_44_35 PM.png"

with open(image_path, "rb") as f:
    image_base64 = base64.b64encode(f.read()).decode("utf-8")

prompt = """
Analyze this industrial equipment image.

Identify:
1. What type of equipment you see.
2. The major visible components.
3. Any visible signs of damage, overheating, blockage, or other problems.

Only describe what you can actually see in the image.
"""

response = requests.post(
    "http://localhost:11434/api/generate",
    json={
        "model": "qwen2.5vl:7b",
        "prompt": prompt,
        "images": [image_base64],
        "stream": False
    }
)

print("\nAI VISION ANALYSIS:\n")
print(response.json()["response"])
