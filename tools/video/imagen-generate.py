#!/usr/bin/env python3
"""
Imagen 4 Image Generator — Google AI Studio API.
Uso: python3 imagen-generate.py --prompt "<prompt>" [opzioni]

Modelli disponibili:
  imagen-4.0-generate-001        (default, alta qualità)
  imagen-4.0-fast-generate-001   (fast, più economico)
  imagen-4.0-ultra-generate-001  (massima qualità)
"""

import argparse
import os
import sys
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv(Path(__file__).parent / ".env")

API_KEY = os.getenv("GOOGLE_AI_STUDIO_API_KEY")
if not API_KEY:
    print("Errore: GOOGLE_AI_STUDIO_API_KEY non trovata nel file .env")
    sys.exit(1)

OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def generate_images(
    prompt: str,
    model: str,
    aspect_ratio: str,
    count: int,
    output_name: str | None,
):
    client = genai.Client(api_key=API_KEY)

    print(f"Modello:      {model}")
    print(f"Prompt: {prompt}")
    print(f"Aspect ratio: {aspect_ratio} | Immagini: {count}\n")

    config = types.GenerateImagesConfig(
        number_of_images=count,
        aspect_ratio=aspect_ratio,
    )

    response = client.models.generate_images(
        model=model,
        prompt=prompt,
        config=config,
    )

    if not response.generated_images:
        print("Errore: nessuna immagine generata. Possibile blocco safety filter.")
        sys.exit(1)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    saved = []

    for i, img in enumerate(response.generated_images):
        if output_name and count == 1:
            name = output_name if output_name.endswith(".png") else output_name + ".png"
            out_path = OUTPUT_DIR / name
        elif output_name:
            stem = output_name.removesuffix(".png")
            out_path = OUTPUT_DIR / f"{stem}_{i + 1}.png"
        else:
            suffix = f"_{i + 1}" if count > 1 else ""
            out_path = OUTPUT_DIR / f"imagen_{ts}{suffix}.png"

        out_path.write_bytes(img.image.image_bytes)
        print(f"Salvata: {out_path}")
        saved.append(str(out_path))

    print(f"\n{len(saved)} immagine/i salvata/e in {OUTPUT_DIR}")
    return saved


def main():
    parser = argparse.ArgumentParser(description="Genera immagini con Google Imagen 4")
    parser.add_argument("--prompt", required=True, help="Prompt descrittivo")
    parser.add_argument(
        "--model",
        default="imagen-4.0-generate-001",
        choices=[
            "imagen-4.0-generate-001",
            "imagen-4.0-fast-generate-001",
            "imagen-4.0-ultra-generate-001",
        ],
        help="Modello Imagen (default: imagen-4.0-generate-001)",
    )
    parser.add_argument(
        "--aspect-ratio",
        default="16:9",
        choices=["1:1", "9:16", "4:3", "3:4", "16:9"],
        help="Aspect ratio (default: 16:9)",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=1,
        choices=[1, 2, 3, 4],
        help="Numero di immagini da generare (1-4, default: 1)",
    )
    parser.add_argument("--output", default=None, help="Nome file output (default: auto con timestamp)")

    args = parser.parse_args()

    generate_images(
        prompt=args.prompt,
        model=args.model,
        aspect_ratio=args.aspect_ratio,
        count=args.count,
        output_name=args.output,
    )


if __name__ == "__main__":
    main()
