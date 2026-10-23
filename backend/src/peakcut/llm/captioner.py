"""Caption sampled frames with BLIP. Lazy heavy imports; not exercised in the build sandbox."""
from __future__ import annotations

import json
from pathlib import Path


class BlipCaptioner:
    def __init__(self, model_name: str = "Salesforce/blip-image-captioning-base", device: str | None = None):
        import torch
        from transformers import BlipForConditionalGeneration, BlipProcessor

        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.processor = BlipProcessor.from_pretrained(model_name)
        self.model = BlipForConditionalGeneration.from_pretrained(model_name).to(self.device).eval()

    def caption(self, frames) -> list[str]:
        import torch
        from PIL import Image

        out = []
        with torch.no_grad():
            for f in frames:
                inputs = self.processor(images=Image.fromarray(f), return_tensors="pt").to(self.device)
                ids = self.model.generate(**inputs, max_new_tokens=30)
                out.append(self.processor.decode(ids[0], skip_special_tokens=True))
        return out


def save_captions(path: str | Path, captions: list[str]) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    Path(path).write_text(json.dumps(captions))


def load_captions(path: str | Path) -> list[str] | None:
    p = Path(path)
    return json.loads(p.read_text()) if p.exists() else None
