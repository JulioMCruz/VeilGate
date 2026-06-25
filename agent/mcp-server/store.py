"""
VeilGate local store — commitments + payment history.

SQLite. Amounts are NEVER stored (privacy by design).
"""

import sqlite3
import os


def init_store(path: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    conn = sqlite3.connect(path)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS payments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nullifier_hash TEXT NOT NULL,
            tx_hash TEXT NOT NULL,
            url TEXT,
            created_at INTEGER NOT NULL
        )
    """)
    conn.execute("""
        CREATE INDEX IF NOT EXISTS idx_payments_nullifier
        ON payments(nullifier_hash)
    """)
    conn.commit()
    conn.close()


def record_payment(path: str, nullifier_hash: str, tx_hash: str, url: str = ""):
    import time
    conn = sqlite3.connect(path)
    conn.execute(
        "INSERT INTO payments (nullifier_hash, tx_hash, url, created_at) VALUES (?, ?, ?, ?)",
        (nullifier_hash, tx_hash, url, int(time.time())),
    )
    conn.commit()
    conn.close()


def get_history(path: str, limit: int = 10) -> list:
    if not os.path.exists(path):
        return []
    conn = sqlite3.connect(path)
    rows = conn.execute(
        "SELECT id, nullifier_hash, tx_hash, url, created_at FROM payments "
        "ORDER BY id DESC LIMIT ?",
        (limit,),
    ).fetchall()
    conn.close()
    return [
        {
            "id": r[0],
            "nullifier_hash": r[1],
            "tx_hash": r[2],
            "url": r[3],
            "created_at": r[4],
        }
        for r in rows
    ]