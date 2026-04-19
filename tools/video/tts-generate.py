#!/usr/bin/env python3
"""
Text-to-Speech con Gemini 2.5 Flash TTS.
Uso: python3 tts-generate.py --text "<testo>" [opzioni]
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

AVAILABLE_VOICES = ["Aoede", "Charon", "Fenrir", "Kore", "Puck"]


def save_wav(audio_data: bytes, out_path: Path, sample_rate: int = 24000, channels: int = 1, sample_width: int = 2):
    """Salva i dati audio PCM raw come file WAV."""
    num_samples = len(audio_data) // sample_width
    data_size = len(audio_data)
    riff_chunk_size = 36 + data_size

    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF",
        riff_chunk_size,
        b"WAVE",
        b"fmt ",
        16,              # chunk size per fmt PCM
        1,               # PCM format
        channels,
        sample_rate,
        sample_rate * channels * sample_width,  # byte rate
        channels * sample_width,                # block align
        sample_width * 8,                       # bits per sample
        b"data",
        data_size,
    )

    with open(out_path, "wb") as f:
        f.write(header)
        f.write(audio_data)


def generate_speech(
    text: str,
    voice: str = "Aoede",
    output_name: str = None,
):
    client = genai.Client(api_key=API_KEY)

    print(f"Modello: gemini-2.5-flash-preview-tts")
    print(f"Voce: {voice}")
    print(f"Testo: {text[:80]}{'...' if len(text) > 80 else ''}\n")

    response = client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents=text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                )
            ),
        ),
    )

    audio_data = response.candidates[0].content.parts[0].inline_data.data

    if output_name:
        out_path = OUTPUT_DIR / output_name
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = OUTPUT_DIR / f"tts_{voice.lower()}_{ts}.wav"

    # Assicura estensione .wav
    if out_path.suffix != ".wav":
        out_path = out_path.with_suffix(".wav")

    save_wav(audio_data, out_path)

    size_kb = out_path.stat().st_size / 1024
    print(f"Audio salvato: {out_path} ({size_kb:.1f} KB)")
    return str(out_path)


def main():
    parser = argparse.ArgumentParser(description="Genera audio TTS con Gemini 2.5 Flash")
    parser.add_argument("--text", required=True, help="Testo da sintetizzare")
    parser.add_argument(
        "--voice",
        default="Aoede",
        choices=AVAILABLE_VOICES,
        help=f"Voce da usare (default: Aoede). Disponibili: {', '.join(AVAILABLE_VOICES)}",
    )
    parser.add_argument("--output", default=None, help="Nome file output (default: auto con timestamp)")

    args = parser.parse_args()

    generate_speech(
        text=args.text,
        voice=args.voice,
        output_name=args.output,
    )


if __name__ == "__main__":
    main()
