"""
Tarım ve Orman Bakanlığı - İç Denetim Başkanlığı
Toplantı Salonu Rezervasyon Sistemi - Backend API
"""

from fastapi import FastAPI, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date, time
import sqlite3
import hashlib
import secrets
import json
import os

# ─── App Setup ───────────────────────────────────────────────
app = FastAPI(title="Toplantı Salonu Rezervasyon Sistemi", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

DB_PATH = os.environ.get("DB_PATH", "/data/rezervasyon.db")

# ─── Database Setup ──────────────────────────────────────────

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS custom_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            field_name TEXT NOT NULL,
            field_type TEXT NOT NULL DEFAULT 'text',
            is_required INTEGER NOT NULL DEFAULT 0,
            placeholder TEXT DEFAULT '',
            description TEXT DEFAULT '',
            options TEXT DEFAULT '[]',
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS reservations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reservation_date DATE NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            custom_data TEXT DEFAULT '{}',
            created_by TEXT DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(reservation_date);
        CREATE INDEX IF NOT EXISTS idx_reservations_date_time ON reservations(reservation_date, start_time, end_time);
    """)

    # Default admin password: admin123 (should be changed on first login)
    cursor.execute("SELECT value FROM settings WHERE key = 'admin_password'")
    if not cursor.fetchone():
        admin_hash = hashlib.sha256("admin123".encode()).hexdigest()
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("admin_password", admin_hash))

    # Default user credentials
    cursor.execute("SELECT value FROM settings WHERE key = 'user_username'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("user_username", "denetci"))

    cursor.execute("SELECT value FROM settings WHERE key = 'user_password'")
    if not cursor.fetchone():
        user_hash = hashlib.sha256("denetim2024".encode()).hexdigest()
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("user_password", user_hash))

    # Default work hours
    cursor.execute("SELECT value FROM settings WHERE key = 'work_start'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("work_start", "09:00"))

    cursor.execute("SELECT value FROM settings WHERE key = 'work_end'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("work_end", "18:00"))

    cursor.execute("SELECT value FROM settings WHERE key = 'slot_duration'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("slot_duration", "30"))

    # Default custom fields
    cursor.execute("SELECT COUNT(*) as cnt FROM custom_fields")
    if cursor.fetchone()["cnt"] == 0:
        default_fields = [
            ("Denetçi Adı Soyadı", "text", 1, "Adınızı ve soyadınızı giriniz", "Rezervasyonu yapan denetçinin adı ve soyadı", "[]", 1),
            ("Toplantı Konusu", "text", 1, "Toplantının konusunu kısaca yazınız", "Toplantıda ele alınacak ana konu", "[]", 2),
            ("Katılacak Birim", "text", 0, "Örn: Mali Denetim Birimi", "Toplantıya katılacak birim veya birimlerin adı", "[]", 3),
            ("Katılımcı Sayısı", "number", 0, "Tahmini katılımcı sayısı", "Toplantıya katılması beklenen kişi sayısı", "[]", 4),
        ]
        for f in default_fields:
            cursor.execute(
                "INSERT INTO custom_fields (field_name, field_type, is_required, placeholder, description, options, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
                f
            )

    # JWT secret
    cursor.execute("SELECT value FROM settings WHERE key = 'jwt_secret'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO settings (key, value) VALUES (?, ?)", ("jwt_secret", secrets.token_hex(32)))

    conn.commit()
    conn.close()

init_db()

# ─── Pydantic Models ────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str

class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class UserCredentialUpdate(BaseModel):
    username: str
    password: str

class CustomFieldCreate(BaseModel):
    field_name: str
    field_type: str = "text"
    is_required: bool = False
    placeholder: str = ""
    description: str = ""
    options: List[str] = []
    sort_order: int = 0

class CustomFieldUpdate(BaseModel):
    field_name: Optional[str] = None
    field_type: Optional[str] = None
    is_required: Optional[bool] = None
    placeholder: Optional[str] = None
    description: Optional[str] = None
    options: Optional[List[str]] = None
    sort_order: Optional[int] = None

class ReservationCreate(BaseModel):
    reservation_date: str
    start_time: str
    end_time: str
    custom_data: dict = {}
    created_by: str = ""

class SettingsUpdate(BaseModel):
    work_start: Optional[str] = None
    work_end: Optional[str] = None
    slot_duration: Optional[int] = None

class ReorderFields(BaseModel):
    field_ids: List[int]

# ─── Auth Helpers ────────────────────────────────────────────

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def get_setting(key: str) -> Optional[str]:
    conn = get_db()
    row = conn.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else None

def verify_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Yetkilendirme gerekli")
    token = credentials.credentials
    admin_hash = get_setting("admin_password")
    if token != admin_hash:
        raise HTTPException(status_code=401, detail="Geçersiz admin token")
    return True

def verify_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if not credentials:
        raise HTTPException(status_code=401, detail="Yetkilendirme gerekli")
    token = credentials.credentials
    admin_hash = get_setting("admin_password")
    user_hash = get_setting("user_password")
    if token not in (admin_hash, user_hash):
        raise HTTPException(status_code=401, detail="Geçersiz token")
    return token == admin_hash

# ─── Auth Endpoints ──────────────────────────────────────────

@app.post("/api/auth/admin-login")
def admin_login(req: LoginRequest):
    admin_hash = get_setting("admin_password")
    if hash_password(req.password) != admin_hash:
        raise HTTPException(status_code=401, detail="Geçersiz admin şifresi")
    return {"token": admin_hash, "role": "admin"}

@app.post("/api/auth/user-login")
def user_login(req: LoginRequest):
    user_username = get_setting("user_username")
    user_hash = get_setting("user_password")
    if req.username != user_username or hash_password(req.password) != user_hash:
        raise HTTPException(status_code=401, detail="Geçersiz kullanıcı adı veya şifre")
    return {"token": user_hash, "role": "user"}

@app.post("/api/auth/change-admin-password")
def change_admin_password(req: PasswordChangeRequest, _=Depends(verify_admin)):
    admin_hash = get_setting("admin_password")
    if hash_password(req.current_password) != admin_hash:
        raise HTTPException(status_code=400, detail="Mevcut şifre yanlış")
    new_hash = hash_password(req.new_password)
    conn = get_db()
    conn.execute("UPDATE settings SET value = ? WHERE key = 'admin_password'", (new_hash,))
    conn.commit()
    conn.close()
    return {"message": "Admin şifresi güncellendi", "token": new_hash}

@app.post("/api/auth/update-user-credentials")
def update_user_credentials(req: UserCredentialUpdate, _=Depends(verify_admin)):
    conn = get_db()
    conn.execute("UPDATE settings SET value = ? WHERE key = 'user_username'", (req.username,))
    conn.execute("UPDATE settings SET value = ? WHERE key = 'user_password'", (hash_password(req.password),))
    conn.commit()
    conn.close()
    return {"message": "Kullanıcı bilgileri güncellendi"}

# ─── Settings Endpoints ──────────────────────────────────────

@app.get("/api/settings")
def get_settings(_=Depends(verify_user)):
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM settings WHERE key IN ('work_start', 'work_end', 'slot_duration', 'user_username')").fetchall()
    conn.close()
    settings = {row["key"]: row["value"] for row in rows}
    return settings

@app.put("/api/settings")
def update_settings(req: SettingsUpdate, _=Depends(verify_admin)):
    conn = get_db()
    if req.work_start:
        conn.execute("UPDATE settings SET value = ? WHERE key = 'work_start'", (req.work_start,))
    if req.work_end:
        conn.execute("UPDATE settings SET value = ? WHERE key = 'work_end'", (req.work_end,))
    if req.slot_duration:
        conn.execute("UPDATE settings SET value = ? WHERE key = 'slot_duration'", (str(req.slot_duration),))
    conn.commit()
    conn.close()
    return {"message": "Ayarlar güncellendi"}

# ─── Custom Fields Endpoints ─────────────────────────────────

@app.get("/api/fields")
def get_fields(_=Depends(verify_user)):
    conn = get_db()
    rows = conn.execute("SELECT * FROM custom_fields ORDER BY sort_order ASC").fetchall()
    conn.close()
    fields = []
    for row in rows:
        f = dict(row)
        f["options"] = json.loads(f["options"]) if f["options"] else []
        f["is_required"] = bool(f["is_required"])
        fields.append(f)
    return fields

@app.post("/api/fields")
def create_field(field: CustomFieldCreate, _=Depends(verify_admin)):
    conn = get_db()
    cursor = conn.execute(
        "INSERT INTO custom_fields (field_name, field_type, is_required, placeholder, description, options, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (field.field_name, field.field_type, int(field.is_required), field.placeholder, field.description, json.dumps(field.options), field.sort_order)
    )
    conn.commit()
    field_id = cursor.lastrowid
    conn.close()
    return {"id": field_id, "message": "Alan oluşturuldu"}

@app.put("/api/fields/{field_id}")
def update_field(field_id: int, field: CustomFieldUpdate, _=Depends(verify_admin)):
    conn = get_db()
    existing = conn.execute("SELECT * FROM custom_fields WHERE id = ?", (field_id,)).fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Alan bulunamadı")

    updates = {}
    if field.field_name is not None:
        updates["field_name"] = field.field_name
    if field.field_type is not None:
        updates["field_type"] = field.field_type
    if field.is_required is not None:
        updates["is_required"] = int(field.is_required)
    if field.placeholder is not None:
        updates["placeholder"] = field.placeholder
    if field.description is not None:
        updates["description"] = field.description
    if field.options is not None:
        updates["options"] = json.dumps(field.options)
    if field.sort_order is not None:
        updates["sort_order"] = field.sort_order

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = list(updates.values()) + [field_id]
        conn.execute(f"UPDATE custom_fields SET {set_clause} WHERE id = ?", values)
        conn.commit()

    conn.close()
    return {"message": "Alan güncellendi"}

@app.delete("/api/fields/{field_id}")
def delete_field(field_id: int, _=Depends(verify_admin)):
    conn = get_db()
    conn.execute("DELETE FROM custom_fields WHERE id = ?", (field_id,))
    conn.commit()
    conn.close()
    return {"message": "Alan silindi"}

@app.put("/api/fields/reorder")
def reorder_fields(req: ReorderFields, _=Depends(verify_admin)):
    conn = get_db()
    for idx, field_id in enumerate(req.field_ids):
        conn.execute("UPDATE custom_fields SET sort_order = ? WHERE id = ?", (idx, field_id))
    conn.commit()
    conn.close()
    return {"message": "Sıralama güncellendi"}

# ─── Reservation Endpoints ───────────────────────────────────

@app.get("/api/reservations")
def get_reservations(start_date: str = None, end_date: str = None, _is_admin: bool = Depends(verify_user)):
    conn = get_db()
    if start_date and end_date:
        rows = conn.execute(
            "SELECT * FROM reservations WHERE reservation_date BETWEEN ? AND ? ORDER BY reservation_date, start_time",
            (start_date, end_date)
        ).fetchall()
    elif start_date:
        rows = conn.execute(
            "SELECT * FROM reservations WHERE reservation_date = ? ORDER BY start_time",
            (start_date,)
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM reservations ORDER BY reservation_date DESC, start_time LIMIT 200"
        ).fetchall()
    conn.close()

    reservations = []
    for row in rows:
        r = dict(row)
        r["custom_data"] = json.loads(r["custom_data"]) if r["custom_data"] else {}
        reservations.append(r)
    return reservations

@app.post("/api/reservations")
def create_reservation(res: ReservationCreate, _=Depends(verify_user)):
    conn = get_db()

    # Check for overlapping reservations
    overlapping = conn.execute(
        """SELECT id FROM reservations
        WHERE reservation_date = ?
        AND start_time < ? AND end_time > ?""",
        (res.reservation_date, res.end_time, res.start_time)
    ).fetchone()

    if overlapping:
        conn.close()
        raise HTTPException(status_code=409, detail="Bu zaman diliminde zaten bir rezervasyon mevcut")

    cursor = conn.execute(
        "INSERT INTO reservations (reservation_date, start_time, end_time, custom_data, created_by) VALUES (?, ?, ?, ?, ?)",
        (res.reservation_date, res.start_time, res.end_time, json.dumps(res.custom_data), res.created_by)
    )
    conn.commit()
    res_id = cursor.lastrowid
    conn.close()
    return {"id": res_id, "message": "Rezervasyon oluşturuldu"}

@app.delete("/api/reservations/{res_id}")
def delete_reservation(res_id: int, _=Depends(verify_user)):
    conn = get_db()
    conn.execute("DELETE FROM reservations WHERE id = ?", (res_id,))
    conn.commit()
    conn.close()
    return {"message": "Rezervasyon iptal edildi"}

@app.put("/api/reservations/{res_id}")
def update_reservation(res_id: int, res: ReservationCreate, _=Depends(verify_admin)):
    conn = get_db()
    overlapping = conn.execute(
        """SELECT id FROM reservations
        WHERE reservation_date = ?
        AND start_time < ? AND end_time > ?
        AND id != ?""",
        (res.reservation_date, res.end_time, res.start_time, res_id)
    ).fetchone()
    if overlapping:
        conn.close()
        raise HTTPException(status_code=409, detail="Bu zaman diliminde zaten bir rezervasyon mevcut")

    conn.execute(
        "UPDATE reservations SET reservation_date=?, start_time=?, end_time=?, custom_data=?, created_by=? WHERE id=?",
        (res.reservation_date, res.start_time, res.end_time, json.dumps(res.custom_data), res.created_by, res_id)
    )
    conn.commit()
    conn.close()
    return {"message": "Rezervasyon güncellendi"}

# ─── Stats Endpoint ──────────────────────────────────────────

@app.get("/api/stats")
def get_stats(_=Depends(verify_admin)):
    conn = get_db()

    today = datetime.now().strftime("%Y-%m-%d")
    month_start = datetime.now().strftime("%Y-%m-01")

    today_count = conn.execute(
        "SELECT COUNT(*) as cnt FROM reservations WHERE reservation_date = ?", (today,)
    ).fetchone()["cnt"]

    month_count = conn.execute(
        "SELECT COUNT(*) as cnt FROM reservations WHERE reservation_date >= ?", (month_start,)
    ).fetchone()["cnt"]

    total_count = conn.execute("SELECT COUNT(*) as cnt FROM reservations").fetchone()["cnt"]

    # Busiest hours
    busy_hours = conn.execute(
        """SELECT start_time, COUNT(*) as cnt FROM reservations
        GROUP BY start_time ORDER BY cnt DESC LIMIT 5"""
    ).fetchall()

    # Current status
    now_time = datetime.now().strftime("%H:%M")
    current_res = conn.execute(
        """SELECT * FROM reservations
        WHERE reservation_date = ? AND start_time <= ? AND end_time > ?
        ORDER BY start_time LIMIT 1""",
        (today, now_time, now_time)
    ).fetchone()

    next_res = conn.execute(
        """SELECT * FROM reservations
        WHERE reservation_date = ? AND start_time > ?
        ORDER BY start_time LIMIT 1""",
        (today, now_time)
    ).fetchone()

    conn.close()

    current_status = None
    if current_res:
        current_status = {
            "status": "occupied",
            "end_time": current_res["end_time"],
            "custom_data": json.loads(current_res["custom_data"]) if current_res["custom_data"] else {}
        }
    else:
        current_status = {"status": "available"}

    next_reservation = None
    if next_res:
        next_reservation = {
            "start_time": next_res["start_time"],
            "end_time": next_res["end_time"],
            "custom_data": json.loads(next_res["custom_data"]) if next_res["custom_data"] else {}
        }

    return {
        "today_count": today_count,
        "month_count": month_count,
        "total_count": total_count,
        "busy_hours": [{"time": bh["start_time"], "count": bh["cnt"]} for bh in busy_hours],
        "current_status": current_status,
        "next_reservation": next_reservation,
    }

# ─── Room Status (public-ish, needs user auth) ──────────────

@app.get("/api/room-status")
def get_room_status(_=Depends(verify_user)):
    conn = get_db()
    today = datetime.now().strftime("%Y-%m-%d")
    now_time = datetime.now().strftime("%H:%M")

    current = conn.execute(
        """SELECT * FROM reservations
        WHERE reservation_date = ? AND start_time <= ? AND end_time > ?
        LIMIT 1""",
        (today, now_time, now_time)
    ).fetchone()

    next_res = conn.execute(
        """SELECT * FROM reservations
        WHERE reservation_date = ? AND start_time > ?
        ORDER BY start_time LIMIT 1""",
        (today, now_time)
    ).fetchone()

    conn.close()

    if current:
        return {
            "status": "occupied",
            "end_time": current["end_time"],
            "custom_data": json.loads(current["custom_data"]) if current["custom_data"] else {},
            "next_available": current["end_time"],
            "next_reservation": {
                "start_time": next_res["start_time"],
                "end_time": next_res["end_time"]
            } if next_res else None
        }
    else:
        return {
            "status": "available",
            "next_reservation": {
                "start_time": next_res["start_time"],
                "end_time": next_res["end_time"]
            } if next_res else None
        }

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}
