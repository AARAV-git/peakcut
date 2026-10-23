"""Sample frames from a video and embed them with CLIP. Heavy deps are imported lazily.

Needs: pip install -e '.[features]'  (torch, transformers, pillow, opencv-python-headless).
Not exercised in the build sandbox (no torch / model download); tests inject a fake extractor.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np


class ClipExtractor:
    def __init__(self, model_name: str = "openai/clip-vit-base-patch32", sample_fps: float = 2.0,
                 batch_size: int = 32, device: str | None = None):
        import torch
        from transformers import CLIPModel, CLIPProcessor

        self.sample_fps, self.batch_size = sample_fps, batch_size
        self.device = device or ("cuda" if torch.cuda.is_available() else "cpu")
        self.model = CLIPModel.from_pretrained(model_name).to(self.device).eval()
        self.processor = CLIPProcessor.from_pretrained(model_name)

    def sample_frames(self, path: str | Path):
        """Returns (list of RGB uint8 frames, duration_sec, native_fps, n_frames)."""
        import cv2

        cap = cv2.VideoCapture(str(path))
        if not cap.isOpened():
            raise ValueError(f"Cannot open video: {path}")
        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        step = max(1, int(round(fps / self.sample_fps)))
        frames = []
        for idx in range(0, n, step):
            cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
            ok, bgr = cap.read()
            if not ok:
                break
            frames.append(cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB))
        cap.release()
        if not frames:
            raise ValueError(f"No frames decoded from: {path}")
        return frames, n / fps, fps, n

    def extract(self, path: str | Path) -> tuple[np.ndarray, float, float]:
        """Returns (features (T, D) float32, duration_sec, fps)."""
        import torch
        from PIL import Image

        frames, duration, fps, _ = self.sample_frames(path)
        out = []
        with torch.no_grad():
            for i in range(0, len(frames), self.batch_size):
                imgs = [Image.fromarray(f) for f in frames[i : i + self.batch_size]]
                inputs = self.processor(images=imgs, return_tensors="pt").to(self.device)
                emb = self.model.get_image_features(**inputs)
                out.append(torch.nn.functional.normalize(emb, dim=-1).cpu().numpy())
        return np.concatenate(out).astype(np.float32), duration, fps
