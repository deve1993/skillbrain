#!/usr/bin/env python3
"""
Kling Text-to-Video Generator — Genera video da testo con Kling AI API.
Uso: python3 kling-t2v.py --prompt "<prompt>" [opzioni]
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

import jwt
import requests
from dotenv import load_dotenv

# Carica API keys dal .env
load_dotenv(Path(__file__).parent / ".env")

ACCESS_KEY = os.getenv("KLING_ACCESS_KEY")
SECRET_KEY = os.getenv("KLING_SECRET_KEY")

if not ACCESS_KEY or not SECRET_KEY:
    print("Errore: KLING_ACCESS_KEY o KLING_SECRET_KEY non trovate nel file .env")
    sys.exit(1)

API_BASE = "https://api.klingai.com"
OUTPUT_DIR = Path(__file__).parent / "output"
OUTPUT_DIR.mkdir(exist_ok=True)


def generate_jwt_token() -> str:
    """Genera un JWT token per autenticazione Kling API."""
    now = int(time.time())
    payload = {
        "iss": ACCESS_KEY,
        "iat": now,
        "nbf": now - 5,
        "exp": now + 1800,  # 30 minuti
    }
    headers = {
        "alg": "HS256",
        "typ": "JWT",
    }
    token = jwt.encode(payload, SECRET_KEY, algorithm="HS256", headers=headers)
    return token


def get_headers() -> dict:
    """Headers con JWT token."""
    token = generate_jwt_token()
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def create_video_task(
    prompt: str,
    model: str = "kling-v2-6",
    mode: str = "pro",
    duration: int = 10,
    aspect_ratio: str = "16:9",
    negative_prompt: Optional[str] = None,
    cfg_scale: float = 0.5,
    enable_audio: bool = False,
) -> str:
    """Crea un task di generazione video da testo."""

    body = {
        "model_name": model,
        "mode": mode,
        "duration": str(duration),
        "aspect_ratio": aspect_ratio,
        "prompt": prompt,
        "cfg_scale": cfg_scale,
    }

    if negative_prompt:
        body["negative_prompt"] = negative_prompt

    if enable_audio:
        body["enable_audio"] = True

    print(f"Modello: {model} | Modo: {mode} | Durata: {duration}s | Aspect: {aspect_ratio} | CFG: {cfg_scale}")
    if enable_audio:
        print("Audio nativo: abilitato")
    print(f"Prompt: {prompt}\n")

    resp = requests.post(
        f"{API_BASE}/v1/videos/text2video",
        headers=get_headers(),
        json=body,
        timeout=60,
    )

    if resp.status_code != 200:
        print(f"Errore API ({resp.status_code}): {resp.text}")
        sys.exit(1)

    result = resp.json()
    if result.get("code") != 0:
        print(f"Errore Kling: {result.get('message', 'Errore sconosciuto')}")
        sys.exit(1)

    task_id = result["data"]["task_id"]
    print(f"Task creato: {task_id}")
    return task_id


def poll_task(task_id: str, max_wait: int = 600) -> dict:
    """Polling fino al completamento del task."""
    elapsed = 0
    interval = 15

    while elapsed < max_wait:
        resp = requests.get(
            f"{API_BASE}/v1/videos/text2video/{task_id}",
            headers=get_headers(),
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"Errore polling ({resp.status_code}): {resp.text}")
            time.sleep(interval)
            elapsed += interval
            continue

        result = resp.json()
        data = result.get("data", {})
        status = data.get("task_status", "unknown")

        if status == "succeed":
            print(f"\nGenerazione completata! ({elapsed}s)")
            return data
        elif status == "failed":
            msg = data.get("task_status_msg", "Errore sconosciuto")
            print(f"\nGenerazione fallita: {msg}")
            sys.exit(1)
        else:
            print(f"  In corso... ({elapsed}s) - stato: {status}")
            time.sleep(interval)
            elapsed += interval

    print(f"\nTimeout dopo {max_wait}s")
    sys.exit(1)


def download_video(video_url: str, output_path: Path):
    """Scarica il video dall'URL."""
    print(f"Download video...")
    resp = requests.get(video_url, stream=True, timeout=120)
    resp.raise_for_status()

    with open(output_path, "wb") as f:
        for chunk in resp.iter_content(chunk_size=8192):
            f.write(chunk)

    size_mb = output_path.stat().st_size / (1024 * 1024)
    print(f"Video salvato: {output_path} ({size_mb:.1f} MB)")


def generate_video(
    prompt: str,
    model: str = "kling-v2-6",
    mode: str = "pro",
    duration: int = 10,
    aspect_ratio: str = "16:9",
    output_name: Optional[str] = None,
    negative_prompt: Optional[str] = None,
    cfg_scale: float = 0.5,
    enable_audio: bool = False,
):
    # Crea task
    task_id = create_video_task(
        prompt=prompt,
        model=model,
        mode=mode,
        duration=duration,
        aspect_ratio=aspect_ratio,
        negative_prompt=negative_prompt,
        cfg_scale=cfg_scale,
        enable_audio=enable_audio,
    )

    # Polling
    task_data = poll_task(task_id)

    # Scarica video
    videos = task_data.get("task_result", {}).get("videos", [])
    if not videos:
        print("Errore: nessun video nel risultato")
        sys.exit(1)

    video_url = videos[0].get("url")
    if not video_url:
        print("Errore: URL video mancante")
        sys.exit(1)

    if output_name:
        out_path = OUTPUT_DIR / output_name
    else:
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = OUTPUT_DIR / f"kling_t2v_{ts}.mp4"

    if out_path.suffix != ".mp4":
        out_path = out_path.with_suffix(".mp4")

    download_video(video_url, out_path)
    return str(out_path)


def main():
    parser = argparse.ArgumentParser(description="Genera video da testo con Kling AI")
    parser.add_argument("--prompt", required=True, help="Prompt descrittivo per il video")
    parser.add_argument(
        "--model",
        default="kling-v2-6",
        choices=["kling-v2-6", "kling-v3"],
        help="Modello da usare (default: kling-v2-6)",
    )
    parser.add_argument(
        "--mode",
        default="pro",
        choices=["std", "pro"],
        help="Modalità (default: pro)",
    )
    parser.add_argument(
        "--duration",
        type=int,
        default=10,
        choices=[5, 10],
        help="Durata in secondi (default: 10)",
    )
    parser.add_argument(
        "--aspect-ratio",
        default="16:9",
        help="Aspect ratio (default: 16:9)",
    )
    parser.add_argument(
        "--negative-prompt",
        default=None,
        help="Elementi da evitare nel video",
    )
    parser.add_argument(
        "--cfg-scale",
        type=float,
        default=0.5,
        help="Aderenza al prompt 0-1 (default: 0.5)",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Nome file output (default: auto)",
    )
    parser.add_argument(
        "--audio",
        action="store_true",
        help="Abilita audio nativo (solo kling-v2-6+ in modalita pro)",
    )

    args = parser.parse_args()

    generate_video(
        prompt=args.prompt,
        model=args.model,
        mode=args.mode,
        duration=args.duration,
        aspect_ratio=args.aspect_ratio,
        output_name=args.output,
        negative_prompt=args.negative_prompt,
        cfg_scale=args.cfg_scale,
        enable_audio=args.audio,
    )


if __name__ == "__main__":
    main()
