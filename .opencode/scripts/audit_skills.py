#!/usr/bin/env python3
"""
Claude Skills 2.0 Audit Script
Analizza tutte le SKILL.md e riporta la compliance con lo standard 2.0
Usage: python3 .Claude/scripts/audit_skills.py
"""

import os
import re
import json
import sys
from pathlib import Path

yaml = None
try:
    import yaml as _yaml

    yaml = _yaml
except ImportError:
    pass

SKILLS_DIR = Path(__file__).parent.parent / "skill"

# Skills 2.0 frontmatter fields nuovi
FIELDS_2_0_NEW = {
    "version",
    "allowed-tools",
    "argument-hint",
    "disable-model-invocation",
    "user-invocable",
    "model",
    "context",
    "agent",
    "hooks",
}

# Core skills - upgrade priorità massima
CORE_SKILLS = {
    "brainstorming",
    "frontend-design",
    "verification-before-completion",
    "systematic-debugging",
    "writing-plans",
    "executing-plans",
    "subagent-driven-development",
    "dispatching-parallel-agents",
    "writing-skills",
    "nextjs",
    "tailwind",
    "shadcn",
    "payload",
    "next-best-practices",
    "vercel-react-best-practices",
    "ui-ux-pro-max",
    "web-design-guidelines",
    "using-superpowers",
    "requesting-code-review",
    "receiving-code-review",
}

# Skills da convertire in slash commands
SLASH_COMMAND_CANDIDATES = {
    "brainstorming": "descrivi cosa vuoi creare o progettare",
    "frontend-design": "nome componente e tipo di interfaccia",
    "writing-plans": "descrivi il task da pianificare",
    "systematic-debugging": "descrivi il bug o comportamento inatteso",
    "verification-before-completion": "cosa verificare prima di dichiarare done",
}


def parse_frontmatter_manual(content):
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if not match:
        return {}, content

    fm_text = match.group(1)
    fm = {}
    lines = fm_text.split("\n")
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if not stripped or stripped.startswith("#"):
            i += 1
            continue
        if ":" in stripped:
            key, _, value = stripped.partition(":")
            key = key.strip()
            value = value.strip().strip("\"'")
            if value in (">", "|", ">-", "|-"):
                collected = []
                i += 1
                while i < len(lines):
                    next_line = lines[i]
                    if next_line and not next_line[0].isspace():
                        break
                    collected.append(next_line.strip())
                    i += 1
                fm[key] = " ".join(s for s in collected if s)
                continue
            elif key:
                fm[key] = value
        i += 1

    return fm, content[match.end() :]


def parse_frontmatter(content):
    if yaml is not None:
        match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
        if not match:
            return {}, content
        try:
            fm = yaml.safe_load(match.group(1)) or {}  # type: ignore[union-attr]
            return fm, content[match.end() :]
        except Exception:
            pass
    return parse_frontmatter_manual(content)


def calculate_score(fm_keys, has_evals, has_scripts, issues_count, suggestions_count):
    score = 0
    if "version" in fm_keys:
        score += 10
    if "allowed-tools" in fm_keys:
        score += 15
    if "context" in fm_keys:
        score += 15
    if "user-invocable" in fm_keys:
        score += 10
    if "hooks" in fm_keys:
        score += 10
    if "argument-hint" in fm_keys:
        score += 5
    if has_evals:
        score += 20
    if has_scripts:
        score += 15
    # Penalità per problemi
    score -= issues_count * 8
    score -= suggestions_count * 2
    return max(0, score)


def check_skill(skill_dir, skill_name_override=None):
    skill_md = skill_dir / "SKILL.md"
    name = skill_name_override or skill_dir.name

    if not skill_md.exists():
        return {"name": name, "error": "No SKILL.md", "tier": "unknown", "score": 0}

    try:
        content = skill_md.read_text(encoding="utf-8")
    except Exception as e:
        return {
            "name": name,
            "error": f"Read error: {e}",
            "tier": "unknown",
            "score": 0,
        }

    fm, body = parse_frontmatter(content)

    if not fm:
        return {
            "name": name,
            "error": "Invalid/missing frontmatter",
            "tier": "domain",
            "score": 0,
        }

    issues = []
    suggestions = []

    content_no_backticks = re.sub(r"`[^`\n]+`", "", content)
    content_no_codeblocks = re.sub(r"```[\s\S]*?```", "", content_no_backticks)

    xml_matches = re.findall(r"<[A-Z][A-Z-]+>", content_no_codeblocks)
    if xml_matches:
        unique_tags = list(set(xml_matches))[:3]
        issues.append(
            f"XML tags presenti: {', '.join(unique_tags)} (Anthropic li sconsiglia in 2.0)"
        )

    # 2. Framing proibitivo (da sostituire con framing positivo)
    prohibitive = re.findall(r"\b(ALWAYS|NEVER|MUST NOT|DO NOT)\b", content)
    if len(prohibitive) > 5:
        issues.append(
            f"Framing proibitivo eccessivo ({len(prohibitive)}x) - preferire framing positivo in 2.0"
        )

    # 3. Description quality
    desc = fm.get("description", "") or ""
    if len(str(desc)) < 40:
        issues.append("Description troppo corta (<40 chars)")

    trigger_phrases = [
        "use when",
        "when user",
        "when the user",
        "for when",
        "trigger",
        "use this",
        "this skill",
        "when asking",
        "when you need",
    ]
    if not any(phrase in str(desc).lower() for phrase in trigger_phrases):
        issues.append("Description manca di trigger phrases esplicite")

    # 4. Campi 2.0 mancanti
    fm_keys = set(str(k) for k in fm.keys()) if fm else set()

    if "version" not in fm_keys:
        suggestions.append("Aggiungere version (es. '1.0.0')")

    if name in SLASH_COMMAND_CANDIDATES:
        if "user-invocable" not in fm_keys:
            suggestions.append(
                f"Candidata slash command - aggiungere user-invocable: true"
            )
        if "argument-hint" not in fm_keys:
            suggestions.append(
                f"Aggiungere argument-hint: '{SLASH_COMMAND_CANDIDATES[name]}'"
            )

    # 5. Struttura body
    has_examples = bool(re.search(r"##\s+(Examples?|Esempio)", body, re.IGNORECASE))
    has_troubleshooting = bool(
        re.search(
            r"##\s+(Troubleshooting|Common.{0,20}(Mistake|Issue|Error)|Error)",
            body,
            re.IGNORECASE,
        )
    )

    if not has_examples:
        suggestions.append("Aggiungere sezione ## Examples")
    if not has_troubleshooting:
        suggestions.append("Aggiungere sezione ## Troubleshooting")

    # 6. Directory structure
    has_scripts = (skill_dir / "scripts").exists()
    has_evals = (skill_dir / "evals").exists()
    has_references = (skill_dir / "references").exists()

    if not has_evals:
        suggestions.append("Aggiungere evals/ con trigger_evals.json e evals.json")

    # Tier classification
    tier = "core" if name in CORE_SKILLS else "domain"

    score = calculate_score(
        fm_keys, has_evals, has_scripts, len(issues), len(suggestions)
    )

    # Fields 2.0 presenti
    fields_2_0_present = [f for f in FIELDS_2_0_NEW if f in fm_keys]

    return {
        "name": name,
        "tier": tier,
        "score": score,
        "fields_1_0": [k for k in fm_keys if k not in FIELDS_2_0_NEW],
        "fields_2_0_present": fields_2_0_present,
        "missing_2_0_fields": [f for f in FIELDS_2_0_NEW if f not in fm_keys],
        "has_scripts": has_scripts,
        "has_evals": has_evals,
        "has_references": has_references,
        "issues": issues,
        "suggestions": suggestions,
        "slash_command_candidate": name in SLASH_COMMAND_CANDIDATES,
        "body_lines": len(body.split("\n")),
    }


def main():
    print("=" * 65)
    print("  CLAUDE SKILLS 2.0 AUDIT REPORT")
    print("=" * 65)

    if not SKILLS_DIR.exists():
        print(f"❌ Directory non trovata: {SKILLS_DIR}")
        sys.exit(1)

    skills = []

    # Scansione diretta
    for item in sorted(SKILLS_DIR.iterdir()):
        if item.name in (".DS_Store", "INDEX.md") or not item.is_dir():
            continue
        if item.name == "pixarts":
            # Scansione ricorsiva per pixarts/
            for sub in sorted(item.iterdir()):
                if sub.is_dir():
                    result = check_skill(sub, f"pixarts/{sub.name}")
                    skills.append(result)
        else:
            result = check_skill(item)
            skills.append(result)

    # Statistiche
    valid = [s for s in skills if "error" not in s]
    core = [s for s in valid if s.get("tier") == "core"]
    domain = [s for s in valid if s.get("tier") == "domain"]

    total = len(valid)
    with_version = sum(1 for s in valid if "version" in s.get("fields_2_0_present", []))
    with_evals = sum(1 for s in valid if s.get("has_evals"))
    with_scripts = sum(1 for s in valid if s.get("has_scripts"))
    with_any_2_0 = sum(1 for s in valid if s.get("fields_2_0_present"))
    avg_score = sum(s.get("score", 0) for s in valid) / total if total else 0
    slash_candidates = [s for s in valid if s.get("slash_command_candidate")]

    print(f"\n📊 SOMMARIO")
    print(f"  Skill totali analizzate:   {total}")
    print(f"  Core skills:               {len(core)}")
    print(f"  Domain skills:             {len(domain)}")
    print(f"  Con version field:         {with_version}/{total}")
    print(f"  Con evals/:                {with_evals}/{total}")
    print(f"  Con scripts/:              {with_scripts}/{total}")
    print(f"  Con almeno 1 campo 2.0:    {with_any_2_0}/{total}")
    print(f"  Candidati slash command:   {len(slash_candidates)}")
    print(f"  Score medio compliance:    {avg_score:.0f}/100")

    # Core skills report
    print(f"\n🔴 CORE SKILLS (priorità upgrade)")
    print(f"{'Nome':<40} {'Score':>5}  Problemi")
    print("-" * 65)
    for s in sorted(core, key=lambda x: x.get("score", 0)):
        name = s["name"]
        score = s.get("score", 0)
        issue_count = len(s.get("issues", []))
        sug_count = len(s.get("suggestions", []))
        print(
            f"  {name:<38} {score:>5}  {issue_count} issues, {sug_count} suggerimenti"
        )
        for issue in s.get("issues", []):
            print(f"    ⚠️  {issue}")

    # Domain skills con score 0
    zero_score = [s for s in domain if s.get("score", 0) == 0]
    print(f"\n🟡 DOMAIN SKILLS con score 0 ({len(zero_score)} skill)")
    for s in sorted(zero_score, key=lambda x: x["name"]):
        print(f"  {s['name']}")

    # Top issues
    print(f"\n📋 ISSUES PIÙ COMUNI")
    all_issues = []
    for s in valid:
        all_issues.extend(s.get("issues", []))
    from collections import Counter

    # Raggruppa per tipo
    xml_count = sum(1 for i in all_issues if "XML tags" in i)
    trigger_count = sum(1 for i in all_issues if "trigger" in i)
    desc_count = sum(1 for i in all_issues if "Description" in i)
    prohibitive_count = sum(1 for i in all_issues if "proibitivo" in i)
    print(f"  XML tags (da rimuovere):           {xml_count} skill")
    print(f"  Trigger phrases mancanti:          {trigger_count} skill")
    print(f"  Description troppo corta:          {desc_count} skill")
    print(f"  Framing proibitivo eccessivo:      {prohibitive_count} skill")

    # Skills senza nessun campo 2.0
    no_2_0 = [s for s in valid if not s.get("fields_2_0_present")]
    print(f"\n  Skill senza campi 2.0: {len(no_2_0)}/{total}")

    # Slash command candidates
    print(f"\n⚡ CANDIDATI SLASH COMMAND (user-invocable)")
    for s in slash_candidates:
        hint = SLASH_COMMAND_CANDIDATES.get(s["name"], "")
        ready = "✅" if "user-invocable" in s.get("fields_2_0_present", []) else "❌"
        print(f"  {ready} /{s['name']:<35} hint: '{hint}'")

    # Salva JSON completo
    output_path = SKILLS_DIR.parent / "skills_audit_report.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(skills, f, indent=2, ensure_ascii=False)

    print(f"\n✅ Report JSON salvato in: .Claude/skills_audit_report.json")
    print(f"\n🎯 RACCOMANDAZIONE: Upgrade Core skills prima (Fase 2),")
    print(f"   poi aggiungi evals/ a tutte (Fase 4),")
    print(f"   poi bulk upgrade domain skills (Fase 6).")
    print("=" * 65)

    return skills


if __name__ == "__main__":
    main()
