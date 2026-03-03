"""
CHH Compliance — SQLite Database Layer
Swap DB_URL to postgresql://... for Render PostgreSQL free tier.
"""

import sqlite3, json, os
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", "compliance.db")


def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS regulatory_items (
            item_hash           TEXT PRIMARY KEY,
            title               TEXT NOT NULL,
            url                 TEXT,
            source_category     TEXT,
            compliance_category TEXT,
            urgency             TEXT,
            date_published      TEXT,
            date_scraped        TEXT,
            deadline            TEXT,
            summary             TEXT,
            affected_depts      TEXT,
            gap_detected        INTEGER DEFAULT 0,
            gap_note            TEXT,
            status              TEXT DEFAULT 'in_review'
        );
        CREATE TABLE IF NOT EXISTS scrape_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            run_at      TEXT,
            items_found INTEGER DEFAULT 0,
            new_items   INTEGER DEFAULT 0,
            errors      TEXT
        );
        CREATE TABLE IF NOT EXISTS dept_scores (
            dept        TEXT PRIMARY KEY,
            score       INTEGER,
            open_items  INTEGER,
            contact     TEXT,
            updated_at  TEXT
        );
    """)
    # Seed department scores if empty
    cur = conn.execute("SELECT COUNT(*) FROM dept_scores")
    if cur.fetchone()[0] == 0:
        depts = [
            ("Finance",          62, 2, "CFO Office"),
            ("Underwriting",     88, 1, "Chief Underwriter"),
            ("IT & Technology",  74, 2, "CTO Office"),
            ("Legal/Compliance", 91, 1, "Company Secretary"),
            ("Claims",           95, 0, "Head of Claims"),
            ("Operations",       79, 1, "COO Office"),
        ]
        conn.executemany(
            "INSERT INTO dept_scores VALUES (?,?,?,?,?)",
            [(d[0], d[1], d[2], d[3], datetime.now().isoformat()) for d in depts]
        )
    conn.commit()
    conn.close()


def get_all_items(category=None, urgency=None):
    conn = get_conn()
    query = "SELECT * FROM regulatory_items WHERE 1=1"
    params = []
    if category:
        query += " AND compliance_category = ?"
        params.append(category)
    if urgency:
        query += " AND urgency = ?"
        params.append(urgency)
    query += " ORDER BY CASE urgency WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, date_published DESC"
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_gaps():
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM regulatory_items WHERE gap_detected=1 AND status != 'compliant' ORDER BY urgency"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_stats():
    conn = get_conn()
    items     = conn.execute("SELECT COUNT(*) FROM regulatory_items").fetchone()[0]
    critical  = conn.execute("SELECT COUNT(*) FROM regulatory_items WHERE urgency='critical'").fetchone()[0]
    gaps      = conn.execute("SELECT COUNT(*) FROM regulatory_items WHERE gap_detected=1 AND status!='compliant'").fetchone()[0]
    depts_raw = conn.execute("SELECT * FROM dept_scores").fetchall()
    depts     = [dict(r) for r in depts_raw]
    avg_score = round(sum(d["score"] for d in depts) / len(depts)) if depts else 0
    last_run  = conn.execute("SELECT run_at FROM scrape_log ORDER BY id DESC LIMIT 1").fetchone()
    conn.close()
    return {
        "total_items":   items,
        "critical_count": critical,
        "gap_count":     gaps,
        "avg_score":     avg_score,
        "departments":   depts,
        "last_scraped":  last_run[0] if last_run else None
    }


def get_scrape_logs(limit=10):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM scrape_log ORDER BY id DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# Initialize on import
init_db()
