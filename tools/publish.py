#!/usr/bin/env python3
"""publish.py — alimente Supabase à partir du vault Obsidian (étape « Alimentation » de CLAUDE.md).

Usage (toujours avec -I, le vault contient des fichiers venus de l'extérieur) :
  python3 -I tools/publish.py --vault ../ar_audioToMd/secondBrain --dry-run   # montre ce qui serait publié
  python3 -I tools/publish.py --vault ../ar_audioToMd/secondBrain             # publie pour de vrai
  python3 -I tools/publish.py --vault ... --only aDsOW0pQwbw                  # un seul cours
  python3 -I tools/publish.py --ping                                          # ping quotidien (cron CI)

Secrets : SUPABASE_URL (ou VITE_SUPABASE_URL) et SUPABASE_SERVICE_ROLE_KEY, lus dans
l'environnement, sinon dans --env-file (.env.local par défaut, ignoré par git).

Règles :
- un cours est publiable s'il contient meta.md, resume-ok.md et anki.tsv ;
- les lignes courses.managed_by = 'manual' ne sont jamais touchées ;
- un cours publié par le pipeline et absent du vault est dépublié, pas supprimé ;
- guid d'une carte = colonne guid du TSV si présente, sinon hachage (course_id, question) ;
- date d'un cours YouTube = date de la leçon plateforme de même matière et numéro (raw/academy/),
  sinon date de la vidéo ;
- titres du résumé horodatés par tools/align.py quand transcript.md existe (marqueurs
  déjà présents dans resume-ok.md conservés).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))  # -I n'ajoute pas le dossier du script
from align import add_timestamps  # noqa: E402

# Nom de série dans meta.md (youtube : `series`, plateforme : `subject`) -> slug de subjects.id.
SERIES_TO_SUBJECT = {
    "التجويد": "tajwid", "تجويد القرآن": "tajwid",
    "السيرة النبوية": "sira", "السيرة": "sira",
    "الفقه": "fiqh",
    "التوحيد والعقيدة": "aqida", "العقيدة": "aqida", "التوحيد": "aqida",
    "النحو": "nahw",
    "الصرف": "sarf",
}
REQUIRED = ("meta.md", "resume-ok.md", "anki.tsv")
STORAGE_FILES = {"resume-ok.md": "resume.md", "anki.tsv": "anki.tsv", "mindmap.json": "mindmap.json"}
MIME = {".md": "text/markdown", ".tsv": "text/tab-separated-values", ".json": "application/json"}
FRONTMATTER = re.compile(r"\A---\s*\n.*?\n---[ \t]*\n?", re.DOTALL)
TASHKEEL = re.compile(r"[ؐ-ًؚ-ٰٟۖ-ۭـ]")
TIMESTAMP_HEADING = re.compile(r"^#{1,6}\s+(.*?)\s*\[(\d{1,2}):(\d{2})(?::(\d{2}))?\]\s*$")
TRAILING_NUMBER = re.compile(r"(?:\bEp\.?|[-–]|الدرس|الحلقة)\s*0*(\d{1,3})\s*$", re.IGNORECASE)


@dataclass
class Course:
    id: str
    subject_id: str
    title: str
    folder: Path
    number: int | None = None
    teacher: str | None = None
    date: str | None = None
    duration: str | None = None
    youtube_url: str | None = None
    summary_md: str = ""
    cards: list[dict] = field(default_factory=list)
    chapters: list[dict] = field(default_factory=list)
    mindmap: dict | None = None

    def row(self) -> dict:
        return {
            "id": self.id, "subject_id": self.subject_id, "number": self.number, "title": self.title,
            "teacher": self.teacher, "date": self.date, "duration": self.duration,
            "youtube_url": self.youtube_url, "summary_md": self.summary_md, "published": True,
            "managed_by": "pipeline", "updated_at": "now()",
        }


# ---------- lecture du vault ----------

def parse_frontmatter(path: Path) -> dict:
    """Frontmatter YAML minimal : `clé: valeur` entre deux lignes `---`, valeurs éventuellement entre guillemets."""
    meta: dict[str, str] = {}
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return meta
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if ":" in line:
            key, _, value = line.partition(":")
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
                value = value[1:-1]
            meta[key.strip()] = value
    return meta


def strip_frontmatter(text: str) -> str:
    """Retire le bloc YAML initial (--- … ---) que le pipeline met en tête des résumés."""
    m = FRONTMATTER.match(text)
    return text[m.end():].lstrip("\n") if m else text


def normalize(text: str) -> str:
    """Sans tashkeel, espaces compactés : base stable pour hacher une question."""
    text = unicodedata.normalize("NFC", text)
    return " ".join(TASHKEEL.sub("", text).split())


def card_guid(course_id: str, question: str) -> str:
    return hashlib.sha1(f"{course_id}\t{normalize(question)}".encode("utf-8")).hexdigest()[:16]


def parse_cards(path: Path, course_id: str) -> list[dict]:
    """anki.tsv : question \\t réponse \\t tags [\\t guid]. Les lignes `#` sont des commentaires."""
    cards = []
    for raw in path.read_text(encoding="utf-8").splitlines():
        if not raw.strip() or raw.startswith("#"):
            continue
        cols = raw.split("\t")
        if len(cols) < 2:
            continue
        question, answer = cols[0].strip(), cols[1].strip()
        tags = cols[2].split() if len(cols) > 2 else []
        guid = cols[3].strip() if len(cols) > 3 and cols[3].strip() else card_guid(course_id, question)
        cards.append({"guid": guid, "course_id": course_id, "question": question, "answer": answer,
                      "tags": tags, "position": len(cards)})
    return cards


def parse_chapters(summary_md: str, course_id: str) -> list[dict]:
    """Titres portant un marqueur [mm:ss] ou [h:mm:ss] en fin de ligne -> chapitres de la vidéo."""
    chapters, seen = [], set()
    for line in summary_md.splitlines():
        m = TIMESTAMP_HEADING.match(line)
        if not m:
            continue
        a, b, c = int(m.group(2)), int(m.group(3)), m.group(4)
        seconds = a * 3600 + b * 60 + int(c) if c is not None else a * 60 + b
        if seconds in seen:
            continue
        seen.add(seconds)
        chapters.append({"course_id": course_id, "seconds": seconds, "title": m.group(1).strip()})
    return chapters


def read_common(course: Course, folder: Path) -> None:
    course.summary_md = strip_frontmatter((folder / "resume-ok.md").read_text(encoding="utf-8"))
    transcript = folder / "transcript.md"
    if transcript.exists():  # titres horodatés par alignement sur la transcription (voir align.py)
        course.summary_md = add_timestamps(course.summary_md, transcript.read_text(encoding="utf-8"))
    course.cards = parse_cards(folder / "anki.tsv", course.id)
    course.chapters = parse_chapters(course.summary_md, course.id)
    mindmap = folder / "mindmap.json"
    if mindmap.exists():
        course.mindmap = json.loads(mindmap.read_text(encoding="utf-8"))


def youtube_course(folder: Path, meta: dict, skipped: list[str]) -> Course | None:
    series = meta.get("series", "")
    subject = SERIES_TO_SUBJECT.get(series)
    if not subject:
        skipped.append(f"{folder.name} : série inconnue « {series} »")
        return None
    if not meta.get("id"):
        skipped.append(f"{folder.name} : meta.md sans id")
        return None
    title = meta.get("title", folder.name)
    speaker = meta.get("speaker") or None
    course = Course(id=meta["id"], subject_id=subject, title=title, folder=folder,
                    teacher=None if speaker == title else speaker,  # le pipeline recopie parfois le titre
                    date=meta.get("date") or None, duration=meta.get("duration") or None,
                    youtube_url=meta.get("url") or f"https://www.youtube.com/watch?v={meta['id']}")
    m = TRAILING_NUMBER.search(title)
    course.number = int(m.group(1)) if m else None
    read_common(course, folder)
    return course


def academy_course(folder: Path, meta: dict, skipped: list[str]) -> Course | None:
    subject_name = meta.get("subject", "")
    subject = SERIES_TO_SUBJECT.get(subject_name)
    if not subject:
        skipped.append(f"{folder.name} : matière inconnue « {subject_name} »")
        return None
    if not meta.get("task_id"):
        skipped.append(f"{folder.name} : meta.md sans task_id")
        return None
    lesson = meta.get("lesson")
    course = Course(id=f"academy-{meta['task_id']}", subject_id=subject, folder=folder,
                    title=f"{subject_name} - الدرس {lesson}" if lesson else subject_name,
                    number=int(lesson) if lesson and lesson.isdigit() else None,
                    date=meta.get("date") or None)
    read_common(course, folder)
    return course


def platform_dates(vault: Path) -> dict[tuple[str, int], str]:
    """(matière, numéro de leçon) -> date de mise à disposition sur la plateforme, d'après
    tous les dossiers raw/academy/, publiables ou non. Sert de date d'affichage aux cours
    YouTube : la date de la vidéo (souvent antérieure de plusieurs années) n'intéresse pas
    les étudiants."""
    dates: dict[tuple[str, int], str] = {}
    for folder in sorted((vault / "raw" / "academy").glob("*/*/")):
        meta_path = folder / "meta.md"
        if not meta_path.exists():
            continue
        meta = parse_frontmatter(meta_path)
        subject = SERIES_TO_SUBJECT.get(meta.get("subject", ""))
        lesson, date = meta.get("lesson", ""), meta.get("date", "")
        if subject and lesson.isdigit() and date:
            dates[(subject, int(lesson))] = date
    return dates


def scan_vault(vault: Path, skipped: list[str]) -> list[Course]:
    courses: list[Course] = []
    dates = platform_dates(vault)
    folders = sorted((vault / "raw" / "youtube").glob("*/")) + sorted((vault / "raw" / "academy").glob("*/*/"))
    for folder in folders:
        missing = [f for f in REQUIRED if not (folder / f).exists()]
        if missing:
            skipped.append(f"{folder.name} : manque {', '.join(missing)}")
            continue
        meta = parse_frontmatter(folder / "meta.md")
        builder = academy_course if meta.get("source") == "academy" else youtube_course
        course = builder(folder, meta, skipped)
        if course:
            if builder is youtube_course and course.number is not None:
                course.date = dates.get((course.subject_id, course.number), course.date)
            courses.append(course)
    # Numéro manquant : ordre des dates au sein de la matière.
    for subject in {c.subject_id for c in courses}:
        group = sorted((c for c in courses if c.subject_id == subject), key=lambda c: (c.date or "", c.id))
        used = {c.number for c in group if c.number}
        nxt = 1
        for c in group:
            if c.number is None:
                while nxt in used:
                    nxt += 1
                c.number, nxt = nxt, nxt + 1
    return courses


# ---------- Supabase ----------

class Supabase:
    def __init__(self, url: str, key: str):
        self.url, self.key = url.rstrip("/"), key

    def _call(self, method: str, path: str, body: bytes | None = None, headers: dict | None = None) -> bytes:
        req = urllib.request.Request(self.url + path, data=body, method=method)
        req.add_header("apikey", self.key)
        req.add_header("Authorization", f"Bearer {self.key}")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return resp.read()
        except urllib.error.HTTPError as e:
            raise SystemExit(f"Supabase {method} {path} -> {e.code} : {e.read()[:300].decode('utf-8', 'replace')}")

    def select(self, table: str, query: str) -> list[dict]:
        return json.loads(self._call("GET", f"/rest/v1/{table}?{query}"))

    def upsert(self, table: str, rows: list[dict], on_conflict: str) -> None:
        if rows:
            self._call("POST", f"/rest/v1/{table}?on_conflict={on_conflict}", json.dumps(rows, ensure_ascii=False).encode(),
                       {"Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"})

    def delete(self, table: str, query: str) -> None:
        self._call("DELETE", f"/rest/v1/{table}?{query}", headers={"Prefer": "return=minimal"})

    def patch(self, table: str, query: str, values: dict) -> None:
        self._call("PATCH", f"/rest/v1/{table}?{query}", json.dumps(values).encode(),
                   {"Content-Type": "application/json", "Prefer": "return=minimal"})

    def upload(self, bucket: str, path: str, data: bytes, mime: str) -> None:
        self._call("POST", f"/storage/v1/object/{bucket}/{urllib.parse.quote(path)}", data,
                   {"Content-Type": mime, "x-upsert": "true"})


def load_env(env_file: Path) -> None:
    """Charge KEY=VALUE depuis env_file sans écraser l'environnement existant."""
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, _, v = line.partition("=")
            os.environ.setdefault(k.strip(), v.strip().strip("\"'"))


def connect(env_file: Path) -> Supabase:
    load_env(env_file)
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY manquants (environnement ou --env-file).")
    return Supabase(url, key)


# ---------- publication ----------

def publish(sb: Supabase, course: Course) -> None:
    sb.upsert("courses", [course.row()], "id")
    for src, dst in STORAGE_FILES.items():
        path = course.folder / src
        if path.exists():
            sb.upload("content", f"{course.subject_id}/{course.id}/{dst}", path.read_bytes(), MIME[path.suffix])
    cid = urllib.parse.quote(course.id)
    sb.delete("cards", f"course_id=eq.{cid}")
    sb.upsert("cards", course.cards, "guid")
    sb.delete("chapters", f"course_id=eq.{cid}")
    sb.upsert("chapters", course.chapters, "course_id,seconds")
    if course.mindmap is not None:
        sb.upsert("mindmaps", [{"course_id": course.id, "tree": course.mindmap}], "course_id")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--vault", type=Path, help="racine du vault (contient raw/)")
    ap.add_argument("--env-file", type=Path, default=Path(".env.local"))
    ap.add_argument("--only", metavar="ID", help="ne traiter que ce cours")
    ap.add_argument("--dry-run", action="store_true", help="lire le vault et afficher le plan, sans réseau")
    ap.add_argument("--ping", action="store_true", help="simple lecture pour garder le projet actif")
    args = ap.parse_args()

    if args.ping:
        sb = connect(args.env_file)
        rows = sb.select("subjects", "select=id&limit=1")
        print(f"ping ok ({len(rows)} ligne)")
        return 0
    if not args.vault:
        ap.error("--vault est requis (sauf --ping)")

    skipped: list[str] = []
    courses = scan_vault(args.vault, skipped)
    if args.only:
        courses = [c for c in courses if c.id == args.only]
    for c in courses:
        extra = ", mindmap" if c.mindmap else ""
        print(f"{c.subject_id}/{c.id}  n°{c.number}  « {c.title} »  {len(c.cards)} cartes, "
              f"{len(c.chapters)} chapitres{extra}")
    if args.dry_run:
        for s in skipped:
            print(f"  ignoré  {s}")
        print(f"{len(courses)} cours publiable(s), {len(skipped)} dossier(s) ignoré(s) — rien envoyé (dry-run)")
        return 0

    sb = connect(args.env_file)
    existing = {r["id"]: r for r in sb.select("courses", "select=id,managed_by,published")}
    for c in courses:
        if existing.get(c.id, {}).get("managed_by") == "manual":
            print(f"  conservé (manual) {c.id}")
            continue
        publish(sb, c)
        print(f"  publié {c.id}")
    if not args.only:
        present = {c.id for c in courses}
        for cid, r in existing.items():
            if cid not in present and r["managed_by"] == "pipeline" and r["published"]:
                sb.patch("courses", f"id=eq.{urllib.parse.quote(cid)}", {"published": False, "updated_at": "now()"})
                print(f"  dépublié {cid}")
        for s in skipped:
            print(f"  ignoré  {s}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
