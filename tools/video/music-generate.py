#!/usr/bin/env python3
"""
Music Generator con Google Lyria 3.
Uso: python3 music-generate.py --prompt "<prompt>" [opzioni]

Modelli disponibili:
  lyria-3-pro-preview   (default, tracce complete)
  lyria-3-clip-preview  (clip brevi)
"""

import argparse
import os
import struct
import sys
from datetime import datetime
from pathlib import Path

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

LYRIA_MODEL = "lyria-3-pro-preview"


def save_wav(audio_data: bytes, out_path: Path, sample_rate: int = 44100, channels: int = 2, sample_width: int = 2):
    """Salva i dati audio PCM raw come file WAV."""
    data_size = len(audio_data)
    riff_chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        riff_chunk_size,
        b"WAVE",
        b"fmt ",
        16,
        1,               # PCM format
        channels,
        sample_rate,
        sample_rate * channels * sample_width,
        channels * sample_width,
        sample_width * 8,
        b"data",
        data_size,
    )

    with open(out_path, "wb") as f:
        f.write(header)
        f.write(audio_data)


def generate_music(
    prompt: str,
    duration: int = 30,
    output_name: str = None,
):
    client = genai.Client(api_key=API_KEY)

    print(f"Modello: {LYRIA_MODEL}")
    print(f"Prompt: {prompt}")
    print(f"Durata richiesta: {duration}s\n")

    if output_name:
        out_path = OUTPUT_DIR / output_name
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = OUTPUT_DIR / f"music_{ts}.wav"

    if out_path.suffix not in (".wav", ".mp3"):
        out_path = out_path.with_suffix(".wav")

    try:
        response = client.models.generate_content(
            model=LYRIA_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_modalities=["AUDIO"],
            ),
        )

        audio_data = response.candidates[0].content.parts[0].inline_data.data

        save_wav(audio_data, out_path)

        size_kb = out_path.stat().st_size / 1024
        print(f"Musica salvata: {out_path} ({size_kb:.1f} KB)")
        return str(out_path)

    except Exception as e:
        err = str(e).lower()

        if any(kw in err for kw in ["not found", "404", "model", "permission", "access"]):
            print("\n[ACCESSO NON DISPONIBILE]")
            print(f"Il modello '{LYRIA_MODEL}' non e' accessibile con la tua API key.")
            print("")
            print("Lyria (Google DeepMind) e' in preview limitata con accesso su richiesta.")
            print("Per richiedere l'accesso:")
            print("  https://deepmind.google/technologies/lyria/")
            print("")
            print("Errore originale:")
            print(f"  {e}")
        else:
            print(f"\nErrore durante la generazione: {e}")

        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Genera musica con Google Lyria 3")
    parser.add_argument("--prompt", required=True, help="Descrizione della musica da generare")
    parser.add_argument(
        "--model",
        default="lyria-3-pro-preview",
        choices=["lyria-3-pro-preview", "lyria-3-clip-preview"],
        help="Modello Lyria (default: lyria-3-pro-preview)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=30,
        help="Durata desiderata in secondi (default: 30)",
    )
    parser.add_argument("--output", default=None, help="Nome file output (default: auto con timestamp)")

    args = parser.parse_args()

    generate_music(
        prompt=args.prompt,
        duration=args.duration,
        output_name=args.output,
    )


if __name__ == "__main__":
    main()
