"""align.py — horodate les titres d'un résumé à partir de la transcription du cours.

Principe : chaque section du résumé (titre + texte jusqu'au titre suivant) est comparée aux
segments horodatés de transcript.md (`**[12.34s -> 15.67s]** texte`). On cherche, pour chaque
section, la fenêtre de transcription qui partage le plus de mots rares avec elle, sous la
contrainte que les sections se suivent dans l'ordre (programmation dynamique). Le marqueur
`[m:ss]` est ajouté en fin de titre ; les titres déjà horodatés sont conservés.

Usage de contrôle :
  python3 -I tools/align.py <resume-ok.md> <transcript.md>   # affiche titre, temps, extrait
"""
from __future__ import annotations

import math
import re
import sys
from pathlib import Path

TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
SEGMENT = re.compile(r"^\*\*\[(\d+(?:\.\d+)?)s -> (\d+(?:\.\d+)?)s\]\*\*\s*(.*)$")
HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*$")
HAS_MARKER = re.compile(r"\[\d{1,2}:\d{2}(?::\d{2})?\]\s*$")
WORD = re.compile(r"[ء-ي٠-٩]{3,}")
STOP = set("""الله على إلى من في عن هذا هذه ذلك تلك التي الذي الذين وقد قال كان كانت حتى لكن ثم كما
أن إن أو لا ما لم لن بين عند عليه عليها فيه فيها منه منها إنه أنه وهو وهي هو هي هم كل بعض
غير مثل أيضا أيضاً المحاضر الدرس الشيخ الأستاذ قوله يعني طبعا طيب
اولا ثانيا ثالثا رابعا خامسا سادسا سابعا ثامنا تاسعا عاشرا""".split())
SUFFIXES = ("ته", "ها", "ات", "ون", "ين", "ه")
PREFIXES = ("وال", "فال", "بال", "كال", "لل", "ال", "و", "ف", "ب", "ل", "ك")


def normalize_word(w: str) -> str:
    w = TASHKEEL.sub("", w)
    w = re.sub("[أإآٱ]", "ا", w).replace("ى", "ي").replace("ة", "ه")
    for p in PREFIXES:  # racine approximative : on retire un préfixe courant…
        if w.startswith(p) and len(w) - len(p) >= 3:
            w = w[len(p):]
            break
    for suf in SUFFIXES:  # … et un suffixe courant (ته / ها / ات / ون / ين / ه)
        if w.endswith(suf) and len(w) - len(suf) >= 3:
            w = w[: -len(suf)]
            break
    return w


def tokens(text: str) -> list[str]:
    plain = TASHKEEL.sub("", text)  # sinon chaque haraka coupe le mot
    return [t for t in (normalize_word(w) for w in WORD.findall(plain)) if len(t) >= 3 and t not in STOP]


def parse_transcript(text: str) -> list[tuple[float, float, list[str]]]:
    segments = []
    for line in text.splitlines():
        m = SEGMENT.match(line.strip())
        if m:
            segments.append((float(m.group(1)), float(m.group(2)), tokens(m.group(3))))
    return segments


def parse_sections(md: str) -> list[dict]:
    """Une section par titre : indice de ligne, titre, mots du titre et du corps."""
    lines = md.splitlines()
    sections: list[dict] = []
    for i, line in enumerate(lines):
        m = HEADING.match(line)
        if m:
            sections.append({"line": i, "level": len(m.group(1)), "title": m.group(2), "body": []})
        elif sections:
            sections[-1]["body"].append(line)
    for s in sections:
        s["words"] = tokens(s["title"]) * 2 + tokens(" ".join(s["body"]))  # le titre compte double
    return sections


def align(sections: list[dict], segments: list[tuple[float, float, list[str]]]) -> list[float | None]:
    """Instant de début (s) de chaque section, croissant ; None si la section est vide."""
    if not segments:
        return [None] * len(sections)
    total = segments[-1][1]
    df: dict[str, int] = {}
    for _, _, toks in segments:
        for t in set(toks):
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log(len(segments) / (1 + n)) + 0.1 for t, n in df.items()}

    scored = [i for i, s in enumerate(sections) if s["words"]]
    if not scored:
        return [None] * len(sections)
    total_words = sum(len(sections[i]["words"]) for i in scored) or 1
    n = len(segments)
    # Score de chaque section pour chaque fenêtre de départ t (fenêtre ~ durée estimée de la section).
    rows: list[list[float]] = []
    for i in scored:
        bag = set(sections[i]["words"])
        span = min(max(total * len(sections[i]["words"]) / total_words, 30.0), 300.0)
        row = [0.0] * n
        end = 0
        window: dict[str, int] = {}
        hits = 0.0
        for t in range(n):
            while end < n and segments[end][0] < segments[t][0] + span:
                for w in set(segments[end][2]):
                    if w in bag:
                        if window.get(w, 0) == 0:
                            hits += idf[w]
                        window[w] = window.get(w, 0) + 1
                end += 1
            row[t] = hits
            for w in set(segments[t][2]):
                if w in bag:
                    window[w] -= 1
                    if window[w] == 0:
                        hits -= idf[w]
        rows.append(row)

    # Programmation dynamique : départs strictement croissants, somme des scores maximale.
    k = len(rows)
    best = [[-1.0] * n for _ in range(k)]
    back = [[-1] * n for _ in range(k)]
    best[0] = rows[0][:]
    for i in range(1, k):
        run_max, run_arg = -1.0, -1
        for t in range(n):
            if t > 0 and best[i - 1][t - 1] > run_max:
                run_max, run_arg = best[i - 1][t - 1], t - 1
            if run_arg >= 0:
                best[i][t] = rows[i][t] + run_max
                back[i][t] = run_arg
    t = max(range(n), key=lambda x: best[k - 1][x])
    chosen = [0] * k
    for i in range(k - 1, -1, -1):
        chosen[i] = t
        t = back[i][t] if i else t
    starts: list[float | None] = [None] * len(sections)
    for i, seg in zip(scored, chosen):
        starts[i] = segments[seg][0]
    return starts


def fmt(seconds: float) -> str:
    s = max(0, int(seconds) - 2)  # deux secondes d'avance pour ne pas couper le début
    h, rest = divmod(s, 3600)
    m, sec = divmod(rest, 60)
    return f"[{h}:{m:02d}:{sec:02d}]" if h else f"[{m}:{sec:02d}]"


def match_chapters(sections: list[dict], chapters: list[dict], threshold: float = 0.2) -> list[float | None]:
    """Instant de chaque titre d'après les chapitres YouTube ({"seconds", "title"}) dont le
    titre ressemble le plus (mots communs pondérés par rareté), dans l'ordre (croissant au
    sens large : deux titres peuvent tomber dans le même chapitre). None si rien ne ressemble."""
    if not chapters:
        return [None] * len(sections)
    heads = [set(tokens(s["title"])) for s in sections]
    chaps = [set(tokens(c["title"])) for c in chapters]
    df: dict[str, int] = {}
    for bag in heads + chaps:
        for t in bag:
            df[t] = df.get(t, 0) + 1
    # Les mots présents dans trois titres ou plus (« السيرة », « النبوية »…) ne distinguent rien.
    heads = [{t for t in h if df[t] < 3} for h in heads]
    chaps = [{t for t in c if df[t] < 3} for c in chaps]
    idf = {t: math.log((len(heads) + len(chaps)) / n) + 0.1 for t, n in df.items()}
    rows = []
    for h in heads:
        total = sum(idf[t] for t in h) or 1.0
        rows.append([sum(idf[t] for t in h & c) / total if h & c else 0.0 for c in chaps])
    n, k = len(chaps), len(rows)
    best = [[0.0] * n for _ in range(k)]
    back = [[0] * n for _ in range(k)]
    best[0] = rows[0][:]
    for i in range(1, k):
        run_max, run_arg = -1.0, 0
        for c in range(n):
            if best[i - 1][c] > run_max:
                run_max, run_arg = best[i - 1][c], c
            best[i][c] = rows[i][c] + run_max
            back[i][c] = run_arg
    c = max(range(n), key=lambda x: best[k - 1][x])
    chosen = [0] * k
    for i in range(k - 1, -1, -1):
        chosen[i] = c
        c = back[i][c]
    return [float(chapters[c]["seconds"]) if rows[i][c] >= threshold else None for i, c in enumerate(chosen)]


def add_timestamps(md: str, transcript: str, chapters: list[dict] | None = None) -> str:
    """Résumé avec un marqueur [m:ss] en fin de chaque titre non encore horodaté.
    Priorité aux chapitres YouTube (plus précis) ; l'alignement sur la transcription sert
    aux titres sans chapitre correspondant, borné entre les chapitres voisins."""
    sections = parse_sections(md)
    segments = parse_transcript(transcript)
    if not sections or not (segments or chapters):
        return md
    starts = align(sections, segments) if segments else [None] * len(sections)
    if chapters:
        from_chapters = match_chapters(sections, chapters)
        for i, t in enumerate(from_chapters):
            if t is not None:
                starts[i] = t + 2  # fmt() retire deux secondes : on tombe pile sur le chapitre
        # titres sans chapitre : temps d'alignement borné par les chapitres voisins
        for i, t in enumerate(from_chapters):
            if t is not None or starts[i] is None:
                continue
            lo = max((from_chapters[j] for j in range(i) if from_chapters[j] is not None), default=0.0)
            hi = min((from_chapters[j] for j in range(i + 1, len(sections)) if from_chapters[j] is not None), default=float("inf"))
            starts[i] = min(max(starts[i], lo), hi)
    # Section sans texte (titre seul au-dessus de sous-titres) : même instant que la suivante.
    for i in range(len(sections) - 1, -1, -1):
        if starts[i] is None and i + 1 < len(sections):
            starts[i] = starts[i + 1]
    lines = md.splitlines()
    for s, start in zip(sections, starts):
        if start is not None and not HAS_MARKER.search(lines[s["line"]]):
            lines[s["line"]] = f"{lines[s['line']].rstrip()} {fmt(start)}"
    return "\n".join(lines) + ("\n" if md.endswith("\n") else "")


if __name__ == "__main__":
    md = Path(sys.argv[1]).read_text(encoding="utf-8")
    tr = Path(sys.argv[2]).read_text(encoding="utf-8")
    segs = parse_transcript(tr)
    secs = parse_sections(md)
    for s, start in zip(secs, align(secs, segs)):
        snippet = next((TASHKEEL.sub("", " ".join(t[2]))[:70] for t in segs if start is not None and t[0] >= start), "")
        print(f"{fmt(start) if start is not None else '[  --  ]':>10}  {'#' * s['level']} {s['title'][:45]}  ⇢  {snippet}")
