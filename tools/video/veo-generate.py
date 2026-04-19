#!/usr/bin/env python3
"""
Veo 3.1 Video Generator — Image-to-Video con Google AI Studio API.
Uso: python3 veo-generate.py --image <path> --prompt "<prompt>" [opzioni]
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from google import genai
from google.genai import types

# Carica API key dal .env
load_dotenv(Path(__file__).parent / ".env")

API_KEY = os.getenv("GOOGLE_AI_STUDIO_API_KEY")
if not API_KEY:
    print("Errore: GOOGLE_AI_STUDIO_API_KEY non trovata nel file .env")
    sys.exit(1)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def load_image(path: str) -> types.Image:
    """Carica un'immagine da file locale."""
    img_path = Path(path)
    if not img_path.exists():
        print(f"Errore: immagine non trovata: {path}")
        sys.exit(1)

    mime_map = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }
    mime = mime_map.get(img_path.suffix.lower(), "image/jpeg")
    data = img_path.read_bytes()
    return types.Image(image_bytes=data, mime_type=mime)


def save_metadata(out_path: Path, model: str, prompt: str, settings: dict, duration_seconds: int):
    """Salva un file .json accanto al video con i metadati della generazione."""
    meta = {
        "timestamp": datetime.now().isoformat(),
        "model": model,
        "prompt": prompt,
        "settings": settings,
        "output_file": out_path.name,
        "duration_seconds": duration_seconds,
    }
    json_path = out_path.with_suffix(".json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2, ensure_ascii=False)
    print(f"Metadati salvati: {json_path}")


def generate_video(
    image_path: str,
    prompt: str,
    resolution: str = "4k",
    output_name: Optional[str] = None,
    ref_images: Optional[List[str]] = None,
    last_frame_path: Optional[str] = None,
):
    client = genai.Client(api_key=API_KEY)

    # Immagine principale (primo frame) — opzionale
    image = None
    if image_path:
        image = load_image(image_path)
        print(f"Immagine caricata: {image_path}")

    # Configurazione
    config_kwargs = {"resolution": resolution}

    # Reference images per consistenza soggetto
    if ref_images:
        refs = []
        for ref_path in ref_images:
            ref_img = load_image(ref_path)
            refs.append(
                types.VideoGenerationReferenceImage(
                    image=ref_img, reference_type="asset"
                )
            )
        config_kwargs["reference_images"] = refs
        print(f"Reference images caricate: {len(refs)}")

    # Last frame (interpolazione primo-ultimo frame)
    if last_frame_path:
        config_kwargs["last_frame"] = load_image(last_frame_path)
        print(f"Last frame caricato: {last_frame_path}")

    config = types.GenerateVideosConfig(**config_kwargs)

    print(f"\nInvio a Veo 3.1 (risoluzione: {resolution})...")
    print(f"Prompt: {prompt}\n")

    # Genera
    gen_kwargs = {
        "model": "veo-3.1-generate-preview",
        "prompt": prompt,
        "config": config,
    }
    if image:
        gen_kwargs["image"] = image

    operation = client.models.generate_videos(**gen_kwargs)

    # Polling
    elapsed = 0
    while not operation.done:
        print(f"  Generazione in corso... ({elapsed}s)")
        time.sleep(10)
        elapsed += 10
        operation = client.operations.get(operation)

    # Controlla errori
    if not operation.response or not operation.response.generated_videos:
        print("Errore: nessun video generato. Possibile blocco safety filter.")
        sys.exit(1)

    # Scarica e salva
    video = operation.response.generated_videos[0]
    client.files.download(file=video.video)

    if output_name:
        out_path = OUTPUT_DIR / output_name
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        stem = Path(image_path).stem
        out_path = OUTPUT_DIR / f"veo_{stem}_{ts}.mp4"

    # Assicura estensione .mp4
    if out_path.suffix != ".mp4":
        out_path = out_path.with_suffix(".mp4")

    video.video.save(str(out_path))
    print(f"\nVideo salvato: {out_path}")
    print(f"Durata generazione: {elapsed}s")

    save_metadata(
        out_path=out_path,
        model="veo-3.1-generate-preview",
        prompt=prompt,
        settings={
            "resolution": resolution,
            "image_path": image_path,
            "ref_images": ref_images,
            "last_frame_path": last_frame_path,
        },
        duration_seconds=elapsed,
    )

    return str(out_path)


def main():
    parser = argparse.ArgumentParser(description="Genera video con Veo 3.1")
    parser.add_argument("--image", required=False, default=None, help="Immagine di partenza (primo frame)")
    parser.add_argument("--prompt", required=True, help="Prompt descrittivo per il video")
    parser.add_argument("--resolution", default="4k", choices=["720p", "1080p", "4k"], help="Risoluzione (default: 4k)")
    parser.add_argument("--output", default=None, help="Nome file output (default: auto)")
    parser.add_argument("--ref", action="append", default=[], help="Immagini di riferimento (max 3, ripetibile)")
    parser.add_argument("--last-frame", default=None, help="Immagine ultimo frame (interpolazione)")

    args = parser.parse_args()

    if len(args.ref) > 3:
        print("Errore: massimo 3 reference images.")
        sys.exit(1)

    generate_video(
        image_path=args.image,
        prompt=args.prompt,
        resolution=args.resolution,
        output_name=args.output,
        ref_images=args.ref if args.ref else None,
        last_frame_path=args.last_frame,
    )


if __name__ == "__main__":
    main()
