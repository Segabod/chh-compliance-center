"""
CHH Group – NAICOM Regulatory Scraper (Standalone)
===================================================
Scrapes NAICOM for regulatory updates and stores in SQLite.
"""

import requests
from bs4 import BeautifulSoup
import sqlite3, hashlib, json, logging
from datetime import datetime, date
from dataclasses import dataclass, asdict
from typing import List, Optional
from database import get_conn, DB_PATH

logger = logging.getLogger(__name__)

NAICOM_SOURCES = [
    {"name": "Circulars",      "url": "https://naicom.gov.ng/circulars/",     "category": "Circular"},
    {"name": "Press Releases", "url": "https://naicom.gov.ng/press-release/", "category": "Press Release"},
    {"name": "Guidelines",     "url": "https://naicom.gov.ng/guidelines/",    "category": "Guideline"},
    {"name": "Notices",        "url": "https://naicom.gov.ng/notices/",       "category": "Notice"},
]

CATEGORY_KEYWORDS = {
    "Capital Adequacy":    ["capital", "paid-up", "solvency", "recapitaliz"],
    "Market Conduct":      ["market conduct", "agent", "broker", "microinsurance", "commission"],
    "AML/CFT":             ["anti-money laundering", "aml", "cft", "kyc"],
    "Pricing":             ["premium", "tariff", "rate", "pricing", "tpii", "motor third"],
    "Reporting":           ["ifrs", "return", "statutory", "financial report", "quarterly"],
    "Consumer Protection": ["consumer", "claims settlement", "complaint", "policyholder"],
}

URGENCY_KEYWORDS = {
    "critical": ["immediate", "urgent", "revocation", "sanction", "penalty", "cease"],
    "high":     ["mandatory", "deadline", "required", "must comply", "circular", "directive"],
    "medium":   ["guideline", "recommended", "amend", "update", "notice"],
    "low":      ["information", "awareness", "workshop", "seminar"],
}

DEPT_KEYWORDS = {
    "Finance":          ["capital", "premium", "solvency", "ifrs", "tariff", "return"],
    "Underwriting":     ["underwriting", "policy", "pricing", "rate"],
    "IT & Technology":  ["data", "portal", "digital", "system", "technology", "cyber"],
    "Legal/Compliance": ["compliance", "aml", "kyc", "regulation", "circular", "penalty"],
    "Claims":           ["claims", "settlement", "payout"],
    "Operations":       ["agent", "broker", "distribution", "customer"],
}


@dataclass
class RegulatoryItem:
    item_hash: str
    title: str
    url: str
    source_category: str
    compliance_category: str
    urgency: str
    date_published: str
    date_scraped: str
    deadline: Optional[str]
    summary: str
    affected_depts: str
    gap_detected: bool
    gap_note: str
    status: str


def classify(title: str, summary: str = "") -> dict:
    text = f"{title} {summary}".lower()
    category = "General"
    for cat, kws in CATEGORY_KEYWORDS.items():
        if any(k in text for k in kws):
            category = cat
            break
    urgency = "low"
    for lvl in ["critical", "high", "medium", "low"]:
        if any(k in text for k in URGENCY_KEYWORDS[lvl]):
            urgency = lvl
            break
    depts = [d for d, kws in DEPT_KEYWORDS.items() if any(k in text for k in kws)]
    return {"compliance_category": category, "urgency": urgency, "affected_depts": depts or ["Legal/Compliance"]}


class NaicomScraper:
    HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

    def _fetch(self, url):
        try:
            r = self.session.get(url, timeout=20)
            r.raise_for_status()
            return BeautifulSoup(r.text, "html.parser")
        except Exception as e:
            logger.error(f"Fetch error {url}: {e}")
            return None

    def _parse(self, soup, source_category):
        items = []
        for sel in ["article.post a", ".entry-title a", "h2.entry-title a", ".post-title a"]:
            found = soup.select(sel)
            if found:
                for link in found[:15]:
                    t = link.get_text(strip=True)
                    if len(t) > 10:
                        items.append({"title": t, "url": link.get("href",""), "source_category": source_category})
                break
        if not items:
            for link in soup.find_all("a", href=lambda h: h and (".pdf" in h.lower() or "naicom" in h.lower()))[:10]:
                t = link.get_text(strip=True)
                if len(t) > 10:
                    items.append({"title": t, "url": link.get("href",""), "source_category": source_category})
        return items

    def _item_exists(self, conn, item_hash):
        return conn.execute("SELECT 1 FROM regulatory_items WHERE item_hash=?", (item_hash,)).fetchone() is not None

    def run(self):
        conn = get_conn()
        total, new_count, errors, new_items_list = 0, 0, [], []

        for src in NAICOM_SOURCES:
            soup = self._fetch(src["url"])
            if not soup:
                errors.append(src["url"])
                continue
            parsed = self._parse(soup, src["category"])
            total += len(parsed)

            for raw in parsed:
                h = hashlib.md5(f"{raw['title']}{raw['url']}".encode()).hexdigest()
                if self._item_exists(conn, h):
                    continue
                clf = classify(raw["title"])
                item = RegulatoryItem(
                    item_hash=h, title=raw["title"], url=raw["url"],
                    source_category=raw["source_category"],
                    compliance_category=clf["compliance_category"],
                    urgency=clf["urgency"],
                    date_published=date.today().isoformat(),
                    date_scraped=datetime.now().isoformat(),
                    deadline=None,
                    summary=f"New {src['category']} from NAICOM: {raw['title']}",
                    affected_depts=json.dumps(clf["affected_depts"]),
                    gap_detected=clf["urgency"] in ("critical","high"),
                    gap_note="Auto-flagged: high-urgency item needs compliance review." if clf["urgency"] in ("critical","high") else "",
                    status="action_required" if clf["urgency"]=="critical" else "in_review" if clf["urgency"]=="high" else "compliant"
                )
                row = asdict(item)
                row["gap_detected"] = int(row["gap_detected"])
                conn.execute("""
                    INSERT INTO regulatory_items VALUES
                    (:item_hash,:title,:url,:source_category,:compliance_category,
                     :urgency,:date_published,:date_scraped,:deadline,:summary,
                     :affected_depts,:gap_detected,:gap_note,:status)
                """, row)
                new_count += 1
                new_items_list.append(item)
                logger.info(f"NEW [{item.urgency.upper()}] {item.title[:70]}")

        conn.execute("INSERT INTO scrape_log(run_at,items_found,new_items,errors) VALUES(?,?,?,?)",
                     (datetime.now().isoformat(), total, new_count, "; ".join(errors)))
        conn.commit()
        conn.close()
        logger.info(f"Scrape complete. Found: {total} | New: {new_count}")
        return {"total_found": total, "new_items": new_count, "new_items_list": new_items_list, "errors": errors}
