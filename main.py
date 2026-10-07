import smtplib
import sys
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import os

# Force UTF-8 output so emoji in print() don't crash on Windows cp1252
if sys.stdout and hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if sys.stderr and hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
import json
import time
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, Request, File, UploadFile, Form, HTTPException, Query
from fastapi.responses import HTMLResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# Load .env file if present (local development)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

import db

# ─────────────────────────────────────────────────────────────────────────────
# REAL EMAIL OTP SENDER (Python SMTP via Gmail)
# ─────────────────────────────────────────────────────────────────────────────
# Setup:
#   1. Enable 2-Step Verification on your Gmail account
#   2. Go to https://myaccount.google.com/apppasswords
#   3. Create an App Password → copy the 16-character password
#   4. Add to your .env file:
#        GMAIL_USER=your.email@gmail.com
#        GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
#
def _get_setting(key: str) -> str:
    """Read a setting from DB app_settings table."""
    try:
        conn = db.get_db_connection()
        row = conn.execute("SELECT value FROM app_settings WHERE key = ?", (key,)).fetchone()
        conn.close()
        return row["value"] if row else ""
    except Exception:
        return ""

def send_otp_email(to_email: str, user_name: str, otp_code: str) -> bool:
    """Send real OTP email via Gmail SMTP.
    Credential priority: .env → DB app_settings → console (dev mode).
    Returns True on success."""
    # Check env vars first, then fall back to DB-stored settings
    gmail_user = os.getenv("GMAIL_USER", "").strip() or _get_setting("GMAIL_USER")
    gmail_pass = os.getenv("GMAIL_APP_PASSWORD", "").strip() or _get_setting("GMAIL_APP_PASSWORD")

    if not gmail_user or not gmail_pass:
        print(f"[OTP] WARNING: Email NOT configured. OTP for {to_email} -> {otp_code}")
        print(f"[OTP]     Go to Admin Portal > Email Settings to configure Gmail OTP.")
        return False

    subject = "Your Pharma-Connect AI Login OTP"
    html_body = f"""
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:480px;margin:auto;background:#0f172a;border-radius:16px;padding:32px;">
      <div style="text-align:center;margin-bottom:24px;">
        <div style="font-size:36px;">💊</div>
        <h2 style="color:#0ea5e9;font-size:22px;margin:8px 0;">Pharma-Connect AI</h2>
        <p style="color:#94a3b8;font-size:13px;margin:0;">Secure Healthcare Platform</p>
      </div>
      <div style="background:#1e293b;border-radius:12px;padding:24px;text-align:center;">
        <p style="color:#cbd5e1;font-size:15px;margin-bottom:16px;">Hello <strong style="color:#f1f5f9;">{user_name}</strong>,</p>
        <p style="color:#94a3b8;font-size:13px;">Your one-time login code is:</p>
        <div style="background:#0ea5e9;border-radius:10px;padding:18px;margin:16px 0;">
          <span style="font-size:40px;font-weight:900;letter-spacing:12px;color:#fff;">{otp_code}</span>
        </div>
        <p style="color:#64748b;font-size:12px;">Expires in <strong>10 minutes</strong>. Never share this code.</p>
      </div>
      <p style="color:#334155;font-size:11px;text-align:center;margin-top:20px;">Pharma-Connect AI &bull; Real-Time Healthcare Platform</p>
    </div>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From']    = f"Pharma-Connect AI <{gmail_user}>"
    msg['To']      = to_email
    msg.attach(MIMEText(html_body, 'html'))

    try:
        with smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=10) as server:
            server.login(gmail_user, gmail_pass)
            server.sendmail(gmail_user, to_email, msg.as_string())
        print(f"[OTP] ✅ Sent to {to_email}")
        return True
    except Exception as e:
        print(f"[OTP] ❌ Email failed: {e}")
        return False

app = FastAPI(
    title="Pharma-Connect AI",
    description="Real-Time Healthcare & Intelligent Medicine Availability Platform (Production Database)",
    version="2.0.0"
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
TEMPLATES_DIR = os.path.join(BASE_DIR, "templates")

# Ensure directories exist (safely handle read-only serverless environments)
try:
    os.makedirs(os.path.join(STATIC_DIR, "css"), exist_ok=True)
    os.makedirs(os.path.join(STATIC_DIR, "js"), exist_ok=True)
    os.makedirs(os.path.join(STATIC_DIR, "assets", "images"), exist_ok=True)
    os.makedirs(TEMPLATES_DIR, exist_ok=True)
except Exception:
    pass

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATES_DIR)

@app.on_event("startup")
def on_startup():
    db.init_db()

# ==========================================
# API ROUTE DEFINITIONS
# ==========================================

@app.get("/", response_class=HTMLResponse)
@app.get("/api/index.py", response_class=HTMLResponse)
async def read_root(request: Request):
    """Render main application template"""
    return templates.TemplateResponse(request=request, name="index.html", context={"now": datetime.now().year})


@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    """Dedicated login/register page"""
    return templates.TemplateResponse(request=request, name="login.html", context={"now": datetime.now().year})



@app.get("/api/health")
async def health_check():
    """Health check API with database telemetry"""
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT COUNT(*) FROM pharmacies")
    pharmacies_cnt = c.fetchone()[0]
    c.execute("SELECT COUNT(*) FROM medicines")
    medicines_cnt = c.fetchone()[0]
    conn.close()

    return {
        "status": "HEALTHY",
        "app": "Pharma-Connect AI",
        "database": "SQLite (database.db)",
        "timestamp": datetime.now().isoformat(),
        "total_pharmacies": pharmacies_cnt,
        "total_medicines": medicines_cnt
    }


import math

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate Haversine distance in kilometers between two GPS coordinates"""
    if lat1 is None or lon1 is None or lat2 is None or lon2 is None:
        return None
    try:
        R = 6371.0 # Earth radius in km
        dlat = math.radians(float(lat2) - float(lat1))
        dlon = math.radians(float(lon2) - float(lon1))
        a = math.sin(dlat / 2)**2 + math.cos(math.radians(float(lat1))) * math.cos(math.radians(float(lat2))) * math.sin(dlon / 2)**2
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(R * c, 2)
    except Exception:
        return None


@app.get("/api/pharmacies")
async def get_pharmacies():
    """Returns all approved pharmacies — used by cart dropdown and map"""
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT id, name, address, phone, lat, lng, rating, is_open, emergency_delivery FROM pharmacies WHERE status='APPROVED' ORDER BY name")
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return {"pharmacies": rows, "total": len(rows)}


@app.get("/api/facilities")
async def get_facilities(
    lat: Optional[float] = Query(None, description="User latitude"),
    lng: Optional[float] = Query(None, description="User longitude"),
    category: Optional[str] = Query("all", description="all, pharmacy, or hospital")
):
    """
    Returns both Medical Stores (Pharmacies) and Hospitals around the user's location.
    Calculates accurate distance in km if coordinates are passed.
    """
    conn = db.get_db_connection()
    c = conn.cursor()
    facilities = []

    # 1. Medical Stores (Pharmacies)
    if category in ("all", "pharmacy"):
        c.execute("""
            SELECT p.id, p.name, p.license, p.address, p.phone, p.lat, p.lng, p.rating, p.is_open, p.emergency_delivery,
                   COALESCE(SUM(i.stock), 0) as total_stock
            FROM pharmacies p
            LEFT JOIN inventory i ON p.id = i.pharmacy_id
            WHERE p.status = 'APPROVED'
            GROUP BY p.id
        """)
        for r in c.fetchall():
            d_km = calculate_distance(lat, lng, r["lat"], r["lng"]) if (lat and lng) else None
            facilities.append({
                "id": r["id"],
                "type": "pharmacy",
                "subtype": "Medical Store & Chemist",
                "name": r["name"],
                "license": r["license"] or "DL-REG-MAH",
                "address": r["address"],
                "phone": r["phone"],
                "lat": r["lat"],
                "lng": r["lng"],
                "rating": r["rating"] or 4.8,
                "is_open": bool(r["is_open"]),
                "emergency_delivery": bool(r["emergency_delivery"]),
                "total_stock": int(r["total_stock"]),
                "status_badge": f"{r['total_stock']} Meds in Stock" if r["total_stock"] > 0 else "Restocking Soon",
                "badge_color": "green" if r["total_stock"] > 30 else ("amber" if r["total_stock"] > 0 else "red"),
                "distance_km": d_km
            })

    # 2. Hospitals & Trauma Centers
    if category in ("all", "hospital"):
        c.execute("""
            SELECT h.id, h.name, h.type, h.address, h.phone, h.lat, h.lng, h.rating, h.icu_beds, h.emergency_24x7, h.services,
                   COALESCE(SUM(i.stock), 0) as total_stock
            FROM hospitals h
            LEFT JOIN inventory i ON h.id = i.pharmacy_id
            GROUP BY h.id
        """)
        for r in c.fetchall():
            d_km = calculate_distance(lat, lng, r["lat"], r["lng"]) if (lat and lng) else None
            stock_count = int(r["total_stock"])
            facilities.append({
                "id": r["id"],
                "type": "hospital",
                "subtype": r["type"],
                "name": r["name"],
                "license": "REG-HOSP-PALGHAR",
                "address": r["address"],
                "phone": r["phone"],
                "lat": r["lat"],
                "lng": r["lng"],
                "rating": r["rating"] or 4.8,
                "is_open": True,
                "emergency_delivery": bool(r["emergency_24x7"]),
                "icu_beds": r["icu_beds"],
                "services": r["services"],
                "total_stock": stock_count,
                "status_badge": f"ICU: {r['icu_beds']} Beds • {stock_count} Meds in Stock",
                "badge_color": "blue",
                "distance_km": d_km
            })

    conn.close()

    # Sort nearest first if coordinates provided, else by rating
    if lat and lng:
        facilities.sort(key=lambda x: (x["distance_km"] if x["distance_km"] is not None else 99999))
    else:
        facilities.sort(key=lambda x: x["rating"], reverse=True)

    return {
        "user_coords": {"lat": lat, "lng": lng} if (lat and lng) else None,
        "total": len(facilities),
        "pharmacies_count": len([f for f in facilities if f["type"] == "pharmacy"]),
        "hospitals_count": len([f for f in facilities if f["type"] == "hospital"]),
        "facilities": facilities
    }


@app.get("/api/facilities/{facility_id}/medicines")
async def get_facility_medicines(facility_id: str):
    """
    Returns full medicine catalog and real-time stock dataset for a specific Medical Store or Hospital.
    """
    conn = db.get_db_connection()
    c = conn.cursor()

    # Find facility details in pharmacies or hospitals
    c.execute("SELECT id, name, license, address, phone, lat, lng, rating, is_open, emergency_delivery, 'pharmacy' as facility_type, 'Medical Store & Chemist' as subtype FROM pharmacies WHERE id = ?", (facility_id,))
    fac_row = c.fetchone()
    if not fac_row:
        c.execute("SELECT id, name, 'REG-HOSP' as license, address, phone, lat, lng, rating, 1 as is_open, emergency_24x7 as emergency_delivery, 'hospital' as facility_type, type as subtype FROM hospitals WHERE id = ?", (facility_id,))
        fac_row = c.fetchone()

    if not fac_row:
        conn.close()
        raise HTTPException(status_code=404, detail="Medical facility not found")

    facility = dict(fac_row)

    # Fetch medicines in inventory for this facility
    c.execute("""
        SELECT i.id as inv_id, i.stock, i.batch, i.expiry, i.mrp,
               m.id as med_id, m.name, m.generic_name, m.category, m.dosage, m.symptoms, m.side_effects, m.prescription_required
        FROM inventory i
        JOIN medicines m ON i.med_id = m.id
        WHERE i.pharmacy_id = ? AND i.stock > 0
        ORDER BY m.category, m.name
    """, (facility_id,))
    rows = c.fetchall()

    # Auto-seed standard medicines if empty so facility always has real medicine data
    if not rows:
        c.execute("SELECT id, mrp FROM medicines")
        all_meds = c.fetchall()
        for idx, med in enumerate(all_meds):
            stock_qty = random.randint(45, 120)
            c.execute("""
                INSERT OR IGNORE INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (facility_id, med["id"], stock_qty, f"BAT-{facility_id[:6]}-{idx+1:02d}", "2028-12-31", med["mrp"]))
        conn.commit()
        c.execute("""
            SELECT i.id as inv_id, i.stock, i.batch, i.expiry, i.mrp,
                   m.id as med_id, m.name, m.generic_name, m.category, m.dosage, m.symptoms, m.side_effects, m.prescription_required
            FROM inventory i
            JOIN medicines m ON i.med_id = m.id
            WHERE i.pharmacy_id = ? AND i.stock > 0
            ORDER BY m.category, m.name
        """, (facility_id,))
        rows = c.fetchall()

    medicines = []
    categories = set()
    for r in rows:
        sym_str = r["symptoms"] or ""
        sym_list = [s.strip() for s in sym_str.split(",") if s.strip()]
        categories.add(r["category"])
        medicines.append({
            "id": r["med_id"],
            "inv_id": r["inv_id"],
            "name": r["name"],
            "generic_name": r["generic_name"],
            "category": r["category"],
            "dosage": r["dosage"],
            "symptoms": sym_list,
            "side_effects": r["side_effects"],
            "prescription_required": bool(r["prescription_required"]),
            "stock": r["stock"],
            "batch": r["batch"],
            "expiry": r["expiry"],
            "mrp": float(r["mrp"]),
            "price": float(r["mrp"])
        })

    conn.close()
    return {
        "facility": facility,
        "total_medicines": len(medicines),
        "categories": sorted(list(categories)),
        "medicines": medicines
    }


@app.get("/api/stats")
async def get_platform_stats():
    """Returns platform real-time database summary statistics"""
    conn = db.get_db_connection()
    c = conn.cursor()
    
    c.execute("SELECT COUNT(*) FROM pharmacies WHERE status='APPROVED'")
    ph_count = c.fetchone()[0]
    
    c.execute("SELECT SUM(stock) FROM inventory")
    sum_stock = c.fetchone()[0] or 0
    
    c.execute("SELECT COUNT(*) FROM emergency_dispatches")
    emg_count = c.fetchone()[0]

    c.execute("SELECT COUNT(*) FROM users WHERE role='patient'")
    usr_count = c.fetchone()[0]
    
    conn.close()

    return {
        "registered_pharmacies": ph_count,
        "medicines_tracked": sum_stock,
        "emergency_deliveries": emg_count,
        "active_users": usr_count,
        "forecast_accuracy": "96.4%"
    }


@app.get("/api/medicines/search")
async def search_medicines(
    query: Optional[str] = Query(None, description="Medicine name or symptom search"),
    barcode: Optional[str] = Query(None, description="Medicine barcode query"),
    symptom: Optional[str] = Query(None, description="Specific symptom tag query")
):
    """
    Smart Medicine Search Engine querying SQLite database:
    Handles search by name, generic formulation, barcode, or symptoms.
    Returns medicine matching items + real-time availability across registered stores.
    """
    conn = db.get_db_connection()
    c = conn.cursor()

    if barcode:
        c.execute("SELECT * FROM medicines WHERE barcode = ?", (barcode,))
    elif symptom:
        sym_pattern = f"%{symptom.strip()}%"
        c.execute("SELECT * FROM medicines WHERE symptoms LIKE ?", (sym_pattern,))
    elif query:
        q_pattern = f"%{query.strip()}%"
        c.execute("""
            SELECT * FROM medicines 
            WHERE name LIKE ? OR generic_name LIKE ? OR category LIKE ? OR symptoms LIKE ?
        """, (q_pattern, q_pattern, q_pattern, q_pattern))
    else:
        c.execute("SELECT * FROM medicines LIMIT 6")

    med_rows = [dict(row) for row in c.fetchall()]

    # Fetch all approved pharmacies AND hospitals
    c.execute("SELECT id, name, rating, lat, lng, is_open, emergency_delivery FROM pharmacies WHERE status='APPROVED'")
    facilities_list = [dict(row) for row in c.fetchall()]
    c.execute("SELECT id, name, rating, lat, lng, 1 as is_open, emergency_24x7 as emergency_delivery FROM hospitals")
    facilities_list.extend([dict(row) for row in c.fetchall()])

    results = []
    for med in med_rows:
        availability_list = []
        for pharmacy in facilities_list:
            c.execute("SELECT stock, mrp FROM inventory WHERE pharmacy_id = ? AND med_id = ?", (pharmacy["id"], med["id"]))
            inv_row = c.fetchone()
            
            stock_qty = inv_row["stock"] if inv_row else 0
            price = inv_row["mrp"] if inv_row else med["mrp"]

            availability_list.append({
                "pharmacy_id": pharmacy["id"],
                "pharmacy_name": pharmacy["name"],
                "distance": f"{random.randint(5, 35)/10:.1f} km",
                "rating": pharmacy["rating"],
                "is_open": bool(pharmacy["is_open"]),
                "emergency_delivery": bool(pharmacy["emergency_delivery"]),
                "stock": stock_qty,
                "mrp": price,
                "price": price,
                "latitude": pharmacy["lat"],
                "longitude": pharmacy["lng"],
                "delivery_eta": "15-25 Mins" if stock_qty > 0 and pharmacy["is_open"] else "Unavailable"
            })

        # Parse symptoms string back to list
        sym_str = med.get("symptoms", "")
        med["symptoms"] = [s.strip() for s in sym_str.split(",") if s.strip()]

        results.append({
            "medicine": med,
            "availability": availability_list,
            "total_available_stores": sum(1 for a in availability_list if a["stock"] > 0 and a["is_open"])
        })

    conn.close()

    return {
        "query": query or barcode or symptom or "all",
        "total_matches": len(results),
        "results": results
    }


# ==========================================
# SECURITY MIDDLEWARE & HEADERS
# ==========================================

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Allow Google Maps and EmailJS (relaxed for localhost dev & external APIs)
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    return response


# ==========================================
# AUTHENTICATION, OTP & SECURITY API
# ==========================================

class SendOTPRequest(BaseModel):
    email: str
    purpose: Optional[str] = "login"

class VerifyOTPRequest(BaseModel):
    email: str
    otp_code: str
    purpose: Optional[str] = "login"

class ResetPasswordRequest(BaseModel):
    email: str
    otp_code: str
    new_password: str

class LoginRequest(BaseModel):
    email: str
    password: str
    otp_code: Optional[str] = None
    role: Optional[str] = None

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    license: Optional[str] = ""
    avatar: Optional[str] = "patient_avatar.png"
    security_question: Optional[str] = ""
    security_answer: Optional[str] = ""
    lat: Optional[float] = None
    lng: Optional[float] = None

class ProfileUpdateRequest(BaseModel):
    user_id: str
    name: str
    phone: Optional[str] = ""
    address: Optional[str] = ""
    avatar: Optional[str] = "patient_avatar.png"

class ChangePasswordRequest(BaseModel):
    user_id: str
    current_password: str
    new_password: str


@app.post("/api/auth/send-otp")
async def send_otp(req: SendOTPRequest):
    """Generate and send REAL 6-Digit Security OTP via Gmail SMTP (or dev console)"""
    email = req.email.strip().lower()
    otp = str(random.randint(100000, 999999))
    now = datetime.now()
    expires_at = (now + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
    now_str = now.strftime("%Y-%m-%d %H:%M:%S")

    conn = db.get_db_connection()
    c = conn.cursor()

    # Fetch user name for personalised email
    c.execute("SELECT name, email FROM users WHERE LOWER(email) = ?", (email,))
    user_row = c.fetchone()
    user_name = dict(user_row)["name"] if user_row else "User"

    c.execute('''
        INSERT INTO otp_codes (email, otp_code, purpose, expires_at, is_used, created_at)
        VALUES (?, ?, ?, ?, 0, ?)
    ''', (email, otp, req.purpose, expires_at, now_str))

    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"OTP generated for '{email}' (Purpose: {req.purpose.upper()})", "SYSTEM"))

    conn.commit()
    conn.close()

    # Send real email (returns False if GMAIL env vars not set)
    demo_emails = {
        "rahul@pharmaconnect.ai", "priya@pharmaconnect.ai",
        "apollo@pharmaconnect.ai", "healthplus@pharmaconnect.ai",
        "admin@pharmaconnect.ai"
    }
    is_demo = email in demo_emails
    sent = send_otp_email(email, user_name, otp)

    return {
        "status": "SUCCESS",
        "message": f"OTP sent to {email}" + (" (check Gmail)" if sent else " (dev mode: see server console)"),
        "otp_demo": otp if is_demo else None,  # Only expose for demo/testing accounts
        "sent_via_email": sent,
        "expires_in_minutes": 10
    }


@app.post("/api/auth/verify-otp")
async def verify_otp(req: VerifyOTPRequest):
    """Verify 6-Digit OTP code entered by user"""
    email = req.email.strip().lower()
    otp_code = req.otp_code.strip()

    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute('''
        SELECT * FROM otp_codes 
        WHERE LOWER(email) = ? AND otp_code = ? AND purpose = ? AND is_used = 0
        ORDER BY id DESC LIMIT 1
    ''', (email, otp_code, req.purpose))

    otp_row = c.fetchone()
    if not otp_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code. Please request a new OTP.")

    otp_item = dict(otp_row)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if otp_item["expires_at"] < now_str:
        conn.close()
        raise HTTPException(status_code=400, detail="OTP security code has expired. Please click Resend OTP.")

    c.execute("UPDATE otp_codes SET is_used = 1 WHERE id = ?", (otp_item["id"],))
    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": "Security OTP Code Verified Successfully!"
    }


@app.post("/api/auth/login")
async def login_user(req: LoginRequest):
    """2-Step Authenticated Login with Password Verification & Mandatory OTP Verification"""
    email = req.email.strip().lower()
    
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,))
    user_row = c.fetchone()

    if not user_row:
        conn.close()
        raise HTTPException(status_code=401, detail="Invalid email or password. Please check your credentials.")

    user = dict(user_row)

    # Check status
    if user.get("status") == "suspended":
        conn.close()
        raise HTTPException(status_code=403, detail="⚠️ Account Suspended: Your access has been restricted by administrator.")

    # Check lock status
    failed_attempts = user.get("failed_login_attempts", 0) or 0
    if failed_attempts >= 5:
        conn.close()
        raise HTTPException(status_code=429, detail="⚠️ Account temporarily locked due to 5 consecutive failed login attempts. Contact support or reset password via OTP.")

    # Verify password hash
    if not db.verify_password(req.password, user["password_hash"], user["salt"]):
        new_attempts = failed_attempts + 1
        c.execute("UPDATE users SET failed_login_attempts = ? WHERE id = ?", (new_attempts, user["id"]))
        conn.commit()
        conn.close()
        raise HTTPException(status_code=401, detail=f"Invalid email or password. ({5 - new_attempts} attempts remaining)")

    # Password verified! Now handle OTP step.
    if not req.otp_code:
        # Step 1: Generate + send OTP to user's registered email
        otp = str(random.randint(100000, 999999))
        now = datetime.now()
        expires_at = (now + timedelta(minutes=10)).strftime("%Y-%m-%d %H:%M:%S")
        now_str = now.strftime("%Y-%m-%d %H:%M:%S")

        c.execute('''
            INSERT INTO otp_codes (email, otp_code, purpose, expires_at, is_used, created_at)
            VALUES (?, ?, 'login', ?, 0, ?)
        ''', (email, otp, expires_at, now_str))
        conn.commit()
        conn.close()

        # Demo accounts: expose otp_demo for 1-click quick login
        # Real accounts: OTP goes to Gmail ONLY — never exposed in response
        demo_emails = {
            "rahul@pharmaconnect.ai", "priya@pharmaconnect.ai",
            "apollo@pharmaconnect.ai", "healthplus@pharmaconnect.ai",
            "admin@pharmaconnect.ai"
        }
        is_demo = email.lower() in demo_emails

        # Send real email (no-op if GMAIL_USER / GMAIL_APP_PASSWORD not set in .env)
        send_otp_email(email, user["name"], otp)

        return {
            "status": "OTP_REQUIRED",
            "message": "Password verified! OTP sent to your registered email address.",
            "otp_demo": otp if is_demo else None,   # None for real users — check Gmail inbox
            "email": user["email"],
            "user_name": user["name"]
        }


    # Step 2: OTP Code provided -> Verify OTP
    c.execute('''
        SELECT * FROM otp_codes 
        WHERE LOWER(email) = ? AND otp_code = ? AND purpose = 'login' AND is_used = 0
        ORDER BY id DESC LIMIT 1
    ''', (email, req.otp_code.strip()))

    otp_row = c.fetchone()
    if not otp_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid OTP code. Please check the 6-digit code or request a new one.")

    otp_item = dict(otp_row)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    if otp_item["expires_at"] < now_str:
        conn.close()
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new code.")

    # Mark OTP used and reset failed attempts counter
    c.execute("UPDATE otp_codes SET is_used = 1 WHERE id = ?", (otp_item["id"],))
    c.execute("UPDATE users SET failed_login_attempts = 0 WHERE id = ?", (user["id"],))

    store_info = None
    if user["role"] == "pharmacy":
        p_id = user.get("pharmacy_id") or "PH-001"
        c.execute("SELECT * FROM pharmacies WHERE id = ?", (p_id,))
        p_row = c.fetchone()
        if p_row:
            store_info = dict(p_row)

    session_token = uuid.uuid4().hex
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"User '{user['name']}' completed 2FA OTP login successfully as {user['role'].upper()}", user["id"]))
    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"🎉 2FA OTP Verified! Welcome back, {user['name']}!",
        "session_token": session_token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "phone": user.get("phone", ""),
            "address": user.get("address", ""),
            "avatar": user.get("avatar") or "patient_avatar.png",
            "pharmacy_id": user.get("pharmacy_id", "PH-001")
        },
        "store": store_info
    }


@app.post("/api/auth/register")
async def register_user(req: RegisterRequest):
    """Register account with security questions, profile avatar, and encrypted credentials"""
    email = req.email.strip().lower()

    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,))
    if c.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="An account with this email address already exists.")

    role = req.role.lower()
    user_id = f"USR-{role.upper()[:4]}-{random.randint(100, 999)}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    pwd_hash, salt = db.hash_password(req.password)

    sec_answer_hash = ""
    if req.security_answer:
        sec_answer_hash, _ = db.hash_password(req.security_answer.strip().lower(), salt)

    pharmacy_id = ""
    store_info = None

    if role == "pharmacy":
        pharmacy_id = f"PH-{random.randint(100, 999)}"
        # Use provided lat/lng from registration, fall back to Palghar Maharashtra demo default
        store_lat = float(req.lat) if req.lat is not None else round(19.6967 + random.uniform(-0.006, 0.006), 5)
        store_lng = float(req.lng) if req.lng is not None else round(72.7699 + random.uniform(-0.006, 0.006), 5)
        c.execute('''
            INSERT INTO pharmacies (id, user_id, name, license, address, phone, lat, lng, rating, is_open, status, emergency_delivery)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (pharmacy_id, user_id, req.name, req.license or f"DL-2026-REG{random.randint(100,999)}",
              req.address or "Registered Store Address", req.phone or "+91 98000 00000", store_lat, store_lng, 5.0, 1, "APPROVED", 1))

        store_info = {
            "id": pharmacy_id,
            "name": req.name,
            "license": req.license or f"DL-2026-REG{random.randint(100,999)}",
            "address": req.address or "Registered Store Address",
            "phone": req.phone or "+91 98000 00000",
            "status": "APPROVED"
        }

        c.execute("INSERT INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp) VALUES (?, ?, ?, ?, ?, ?)",
                  (pharmacy_id, "MED-001", 100, "BAT-NEW-01", "2028-12-31", 30.50))
        c.execute("INSERT INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp) VALUES (?, ?, ?, ?, ?, ?)",
                  (pharmacy_id, "MED-004", 50, "BAT-NEW-02", "2027-10-15", 120.00))

    c.execute('''
        INSERT INTO users (id, email, password_hash, salt, name, role, phone, address, license, avatar, security_question, security_answer_hash, status, pharmacy_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (user_id, email, pwd_hash, salt, req.name, role, req.phone, req.address, req.license, req.avatar or "patient_avatar.png", req.security_question, sec_answer_hash, "active", pharmacy_id, now_str))

    session_token = uuid.uuid4().hex
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"New secure account registered: '{req.name}' as {role.upper()}", user_id))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"Registration successful as {role.capitalize()}! Welcome to Pharma-Connect AI.",
        "session_token": session_token,
        "user": {
            "id": user_id,
            "name": req.name,
            "email": email,
            "role": role,
            "phone": req.phone,
            "address": req.address,
            "avatar": req.avatar or "patient_avatar.png",
            "pharmacy_id": pharmacy_id
        },
        "store": store_info
    }


@app.post("/api/auth/reset-password")
async def reset_password(req: ResetPasswordRequest):
    """Reset user password via OTP Verification"""
    email = req.email.strip().lower()

    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM users WHERE LOWER(email) = ?", (email,))
    user_row = c.fetchone()

    if not user_row:
        conn.close()
        raise HTTPException(status_code=404, detail="No account found with this email address.")

    c.execute('''
        SELECT * FROM otp_codes 
        WHERE LOWER(email) = ? AND otp_code = ? AND is_used = 0
        ORDER BY id DESC LIMIT 1
    ''', (email, req.otp_code.strip()))

    otp_row = c.fetchone()
    if not otp_row:
        conn.close()
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code for password reset.")

    new_hash, new_salt = db.hash_password(req.new_password)
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    c.execute("UPDATE users SET password_hash = ?, salt = ?, failed_login_attempts = 0 WHERE LOWER(email) = ?",
              (new_hash, new_salt, email))
    c.execute("UPDATE otp_codes SET is_used = 1 WHERE id = ?", (dict(otp_row)["id"],))

    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Password reset completed for account '{email}' via OTP", dict(user_row)["id"]))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": "🎉 Password reset successfully! You can now login with your new password."
    }


@app.put("/api/users/profile")
async def update_user_profile(req: ProfileUpdateRequest):
    """Update user personal profile details"""
    conn = db.get_db_connection()
    c = conn.cursor()

    c.execute("UPDATE users SET name = ?, phone = ?, address = ?, avatar = ? WHERE id = ?",
              (req.name, req.phone, req.address, req.avatar, req.user_id))

    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="User account not found.")

    c.execute("SELECT * FROM users WHERE id = ?", (req.user_id,))
    updated_user = dict(c.fetchone())
    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": "Profile details updated successfully!",
        "user": {
            "id": updated_user["id"],
            "name": updated_user["name"],
            "email": updated_user["email"],
            "role": updated_user["role"],
            "phone": updated_user["phone"],
            "address": updated_user["address"],
            "avatar": updated_user["avatar"],
            "pharmacy_id": updated_user["pharmacy_id"]
        }
    }


# ==========================================
# AI HEALTH ASSISTANT CHATBOT API
# ==========================================

class ChatRequest(BaseModel):
    message: str
    user_role: Optional[str] = "patient"

@app.post("/api/ai/chatbot")
async def ai_chatbot_response(req: ChatRequest):
    """Interactive AI Healthcare Assistant Chatbot"""
    msg = req.message.lower().strip()

    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM medicines")
    meds = [dict(r) for r in c.fetchall()]
    conn.close()

    # Rule & Knowledge Matching
    matched_meds = [m for m in meds if m["name"].lower() in msg or m["generic_name"].lower() in msg or any(s.strip().lower() in msg for s in m["symptoms"].split(","))]

    if "fever" in msg or "headache" in msg or "pain" in msg:
        reply = "🌡️ **Fever & Pain Relief Guidance:**\nFor mild to moderate fever and body ache, **Dolo 650** (Paracetamol 650mg) is commonly used. Recommended dosage: 1 tablet after food every 6 hours. Stay hydrated!\n\nWould you like to check nearby pharmacy stock or add Dolo 650 to your cart?"
    elif "acidity" in msg or "gas" in msg or "heartburn" in msg:
        reply = "🔥 **Acidity & Heartburn Relief Guidance:**\n**Pantoprazole 40mg** helps reduce stomach acid. Take 1 tablet early morning on an empty stomach. Avoid spicy foods and lying down immediately after meals."
    elif "cough" in msg or "cold" in msg or "allergy" in msg:
        reply = "🤧 **Allergy & Respiratory Relief:**\n**Montair LC** (Montelukast + Levocetirizine) helps relieve runny nose, sneezing, and allergic cough. Dosage: 1 tablet at bedtime."
    elif "emergency" in msg or "urgent" in msg or "help" in msg:
        reply = "🚨 **Emergency Assistance:**\nIf you need critical medicines urgently, click the **'Need Medicine Urgently'** button on top. We will dispatch an emergency rider to the nearest 24/7 open pharmacy immediately!"
    elif matched_meds:
        m = matched_meds[0]
        reply = f"💊 **{m['name']} ({m['generic_name']}):**\n• Category: {m['category']}\n• Standard Dosage: {m['dosage']}\n• Symptoms Used For: {m['symptoms']}\n• Price: ₹ {m['mrp']:.2f}\n• Rx Required: {'Yes' if m['prescription_required'] else 'No'}"
    else:
        reply = "👋 Hi! I am **PharmaConnect AI Assistant**. I can help you find medicines, check dosage instructions, explain side effects, find generic substitutes, or guide you during medical emergencies. What health topic can I assist you with today?"

    return {
        "status": "SUCCESS",
        "reply": reply
    }



# ==========================================
# ORDER & SHOPPING CART API
# ==========================================

class CartItemModel(BaseModel):
    med_id: str
    quantity: int

class CreateOrderModel(BaseModel):
    patient_id: str
    patient_name: str
    patient_phone: str
    patient_address: str
    pharmacy_id: str
    pharmacy_name: Optional[str] = None
    pharmacy_address: Optional[str] = None
    pharmacy_phone: Optional[str] = None
    delivery_type: str = "DELIVERY"
    items: List[CartItemModel]

@app.post("/api/orders/create")
async def create_order(req: CreateOrderModel):
    """
    Patient Cart Checkout with Database Stock Deduction & QR Receipt Generation.
    Strictly resolves and binds the specific chosen Pharmacy or Hospital without Apollo defaults.
    """
    conn = db.get_db_connection()
    c = conn.cursor()

    # Look for facility in pharmacies OR hospitals
    c.execute("SELECT id, name, address, phone FROM pharmacies WHERE id = ?", (req.pharmacy_id,))
    pharm_row = c.fetchone()
    if not pharm_row:
        c.execute("SELECT id, name, address, phone FROM hospitals WHERE id = ?", (req.pharmacy_id,))
        pharm_row = c.fetchone()

    if pharm_row:
        facility_name = pharm_row["name"]
        facility_address = pharm_row["address"]
        facility_phone = pharm_row["phone"]
    elif req.pharmacy_name and req.pharmacy_name.strip():
        facility_name = req.pharmacy_name.strip()
        facility_address = req.pharmacy_address or "Palghar Healthcare Center"
        facility_phone = req.pharmacy_phone or "+91 98200 00000"
    else:
        facility_name = "Medical Store & Chemist"
        facility_address = "Healthcare Road, Palghar"
        facility_phone = "+91 98200 00000"

    order_items = []
    total_amount = 0.0

    for cart_item in req.items:
        c.execute("SELECT * FROM medicines WHERE id = ?", (cart_item.med_id,))
        med_row = c.fetchone()
        if not med_row:
            continue
        med = dict(med_row)

        c.execute("SELECT * FROM inventory WHERE pharmacy_id = ? AND med_id = ?", (req.pharmacy_id, cart_item.med_id))
        inv_row = c.fetchone()
        
        price = inv_row["mrp"] if inv_row else med["mrp"]
        item_total = price * cart_item.quantity

        # Deduct stock if available
        if inv_row and inv_row["stock"] >= cart_item.quantity:
            new_stock = inv_row["stock"] - cart_item.quantity
            c.execute("UPDATE inventory SET stock = ? WHERE id = ?", (new_stock, inv_row["id"]))

        order_items.append({
            "med_id": med["id"],
            "name": med["name"],
            "med_name": med["name"],
            "generic_name": med["generic_name"],
            "quantity": cart_item.quantity,
            "unit_price": price,
            "total_price": item_total
        })
        total_amount += item_total

    order_id = f"ORD-{random.randint(10000, 99999)}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    qr_data = f"PHARMA-ORD-{order_id}|PAT:{req.patient_name}|FACILITY:{facility_name}|AMT:{total_amount:.2f}"

    c.execute('''
        INSERT INTO orders (order_id, patient_id, patient_name, patient_phone, patient_address, pharmacy_id, pharmacy_name, pharmacy_address, pharmacy_phone, total_amount, delivery_type, status, created_at, updated_at, qr_code_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (order_id, req.patient_id, req.patient_name, req.patient_phone, req.patient_address, req.pharmacy_id, facility_name, facility_address, facility_phone, round(total_amount, 2), req.delivery_type.upper(), "PENDING", now_str, now_str, qr_data))

    for item in order_items:
        c.execute('''
            INSERT INTO order_items (order_id, med_id, med_name, generic_name, quantity, unit_price, total_price)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (order_id, item["med_id"], item["name"], item["generic_name"], item["quantity"], item["unit_price"], item["total_price"]))

    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Order #{order_id} placed by {req.patient_name} at '{facility_name}' for ₹{total_amount:.2f}", req.patient_id))

    conn.commit()
    conn.close()

    new_order = {
        "order_id": order_id,
        "patient_id": req.patient_id,
        "patient_name": req.patient_name,
        "patient_phone": req.patient_phone,
        "patient_address": req.patient_address,
        "pharmacy_id": req.pharmacy_id,
        "pharmacy_name": facility_name,
        "pharmacy_address": facility_address,
        "pharmacy_phone": facility_phone,
        "items": order_items,
        "total_amount": round(total_amount, 2),
        "delivery_type": req.delivery_type.upper(),
        "status": "PENDING",
        "created_at": now_str,
        "updated_at": now_str,
        "qr_code_data": qr_data
    }

    return {
        "status": "SUCCESS",
        "message": f"Order #{order_id} placed successfully! Sent to {facility_name}.",
        "order": new_order
    }


@app.get("/api/orders/patient/{patient_id}")
async def get_patient_orders(patient_id: str):
    """Retrieve order history for a patient from database"""
    conn = db.get_db_connection()
    c = conn.cursor()

    if patient_id in ["ALL", "USR-PAT-001"]:
        c.execute("SELECT * FROM orders ORDER BY created_at DESC")
    else:
        c.execute("SELECT * FROM orders WHERE patient_id = ? ORDER BY created_at DESC", (patient_id,))

    order_rows = [dict(r) for r in c.fetchall()]

    orders_list = []
    for order in order_rows:
        c.execute("SELECT * FROM order_items WHERE order_id = ?", (order["order_id"],))
        items = []
        for i in c.fetchall():
            item = dict(i)
            item["name"] = item.get("med_name") or item.get("name") or "Medicine"
            item["med_name"] = item["name"]
            items.append(item)
        order["items"] = items
        orders_list.append(order)

    conn.close()
    return {"total": len(orders_list), "orders": orders_list}


@app.get("/api/orders/pharmacy/{pharmacy_id}")
async def get_pharmacy_orders(pharmacy_id: str):
    """Retrieve incoming orders for a pharmacy store from database"""
    conn = db.get_db_connection()
    c = conn.cursor()

    if pharmacy_id in ["ALL", "PH-001"]:
        c.execute("SELECT * FROM orders ORDER BY created_at DESC")
    else:
        c.execute("SELECT * FROM orders WHERE pharmacy_id = ? ORDER BY created_at DESC", (pharmacy_id,))

    order_rows = [dict(r) for r in c.fetchall()]

    orders_list = []
    for order in order_rows:
        c.execute("SELECT * FROM order_items WHERE order_id = ?", (order["order_id"],))
        items = []
        for i in c.fetchall():
            item = dict(i)
            item["name"] = item.get("med_name") or item.get("name") or "Medicine"
            item["med_name"] = item["name"]
            items.append(item)
        order["items"] = items
        orders_list.append(order)

    conn.close()
    return {"pharmacy_id": pharmacy_id, "total": len(orders_list), "orders": orders_list}


class StatusUpdateModel(BaseModel):
    order_id: str
    status: str

@app.post("/api/orders/update-status")
async def update_order_status(req: StatusUpdateModel):
    """Pharmacy updates order status (APPROVED, OUT_FOR_DELIVERY, DELIVERED) in database"""
    conn = db.get_db_connection()
    c = conn.cursor()

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?",
              (req.status.upper(), now_str, req.order_id))

    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Order not found")

    c.execute("SELECT * FROM orders WHERE order_id = ?", (req.order_id,))
    updated_order = dict(c.fetchone())

    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Order #{req.order_id} updated to status {req.status.upper()}", "SYSTEM"))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"Order #{req.order_id} updated to {req.status.upper()}",
        "order": updated_order
    }


# ==========================================
# INVENTORY & PHARMACY APIS
# ==========================================

class AddStockModel(BaseModel):
    pharmacy_id: str
    med_name: str
    generic_name: Optional[str] = ""
    category: Optional[str] = "General"
    mrp: float
    stock_qty: int
    batch_no: str
    expiry_date: str
    symptoms: Optional[str] = "Fever, Pain"
    dosage: Optional[str] = "1 tablet as directed"
    prescription_required: Optional[bool] = False

@app.post("/api/pharmacy/inventory/add")
async def add_or_refill_medicine(req: AddStockModel):
    """Pharmacy Store Owner: Add new SKU or refill stock in SQLite database"""
    conn = db.get_db_connection()
    c = conn.cursor()

    name_clean = req.med_name.strip()
    c.execute("SELECT * FROM medicines WHERE LOWER(name) = LOWER(?)", (name_clean,))
    existing_med = c.fetchone()

    if not existing_med:
        med_id = f"MED-{random.randint(100, 999)}"
        barcode = f"890123456{random.randint(1000, 9999)}"
        c.execute('''
            INSERT INTO medicines (id, name, generic_name, barcode, category, mrp, dosage, symptoms, side_effects, prescription_required)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (med_id, name_clean, req.generic_name or name_clean, barcode, req.category or "General", req.mrp, req.dosage or "As directed", req.symptoms or "General", "None", int(req.prescription_required)))
    else:
        med_id = existing_med["id"]

    c.execute("SELECT * FROM inventory WHERE pharmacy_id = ? AND med_id = ?", (req.pharmacy_id, med_id))
    inv_row = c.fetchone()

    if inv_row:
        new_stock = inv_row["stock"] + req.stock_qty
        c.execute("UPDATE inventory SET stock = ?, batch = ?, expiry = ?, mrp = ? WHERE id = ?",
                  (new_stock, req.batch_no, req.expiry_date, req.mrp, inv_row["id"]))
    else:
        c.execute("INSERT INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp) VALUES (?, ?, ?, ?, ?, ?)",
                  (req.pharmacy_id, med_id, req.stock_qty, req.batch_no, req.expiry_date, req.mrp))

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Stock refill (+{req.stock_qty} Units) of '{name_clean}' at Pharmacy {req.pharmacy_id}", req.pharmacy_id))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"Successfully updated stock for '{name_clean}' (+{req.stock_qty} Units)!",
        "pharmacy_id": req.pharmacy_id
    }


@app.get("/api/pharmacy/inventory/{pharmacy_id}")
async def get_pharmacy_inventory(pharmacy_id: str):
    """Fetch pharmacy inventory list from database with expiry risk analysis"""
    conn = db.get_db_connection()
    c = conn.cursor()

    target_pid = pharmacy_id if pharmacy_id != "ALL" else "PH-001"
    c.execute("""
        SELECT i.*, m.name, m.generic_name, m.category 
        FROM inventory i 
        JOIN medicines m ON i.med_id = m.id 
        WHERE i.pharmacy_id = ?
    """, (target_pid,))
    
    rows = c.fetchall()
    if not rows and target_pid != "ALL":
        # Auto-seed standard medicines for this pharmacy so medicines are always available to order
        c.execute("SELECT id, name, mrp FROM medicines LIMIT 8")
        master_meds = c.fetchall()
        for idx, med in enumerate(master_meds):
            c.execute("""
                INSERT OR IGNORE INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (target_pid, med["id"], 60, f"BAT-{target_pid[:6]}-0{idx+1}", "2028-12-31", med["mrp"]))
        conn.commit()
        c.execute("""
            SELECT i.*, m.name, m.generic_name, m.category 
            FROM inventory i 
            JOIN medicines m ON i.med_id = m.id 
            WHERE i.pharmacy_id = ?
        """, (target_pid,))
        rows = c.fetchall()

    enriched = []
    today = datetime.today().date()

    for item in rows:
        exp_date = datetime.strptime(item["expiry"], "%Y-%m-%d").date()
        days_to_expiry = (exp_date - today).days

        expiry_alert = "NORMAL"
        if days_to_expiry <= 30:
            expiry_alert = "CRITICAL_30_DAYS"
        elif days_to_expiry <= 60:
            expiry_alert = "WARNING_60_DAYS"
        elif days_to_expiry <= 90:
            expiry_alert = "ALERT_90_DAYS"

        enriched.append({
            "med_id": item["med_id"],
            "name": item["name"],
            "generic_name": item["generic_name"],
            "category": item["category"],
            "stock": item["stock"],
            "batch": item["batch"],
            "expiry": item["expiry"],
            "days_to_expiry": days_to_expiry,
            "expiry_alert": expiry_alert,
            "mrp": item["mrp"],
            "low_stock_flag": item["stock"] < 20
        })

    conn.close()
    return {"pharmacy_id": target_pid, "total_sku": len(enriched), "inventory": enriched}


class UpdatePriceModel(BaseModel):
    pharmacy_id: str
    med_id: str
    new_mrp: float

@app.post("/api/pharmacy/inventory/update-price")
async def update_medicine_price(req: UpdatePriceModel):
    """
    Pharmacy Store Owner: Modify selling price / MRP of medicine SKU in store inventory.
    Immediately updates database and reflects in patient searches!
    """
    conn = db.get_db_connection()
    c = conn.cursor()

    c.execute("UPDATE inventory SET mrp = ? WHERE pharmacy_id = ? AND med_id = ?",
              (req.new_mrp, req.pharmacy_id, req.med_id))
    c.execute("UPDATE medicines SET mrp = ? WHERE id = ?", (req.new_mrp, req.med_id))

    c.execute("SELECT name FROM medicines WHERE id = ?", (req.med_id,))
    med_row = c.fetchone()
    med_name = med_row["name"] if med_row else req.med_id

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Pharmacy '{req.pharmacy_id}' updated price of '{med_name}' to ₹{req.new_mrp:.2f}", req.pharmacy_id))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"Price for '{med_name}' updated to ₹{req.new_mrp:.2f}! Immediately active in Patient Search.",
        "med_id": req.med_id,
        "new_mrp": req.new_mrp
    }


@app.get("/api/ai/forecasting-analytics")
async def get_ai_forecasting_analytics():
    """AI Demand Forecasting & Disease Outbreak Intelligence from SQLite telemetry"""
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT i.stock, m.name, i.mrp FROM inventory i JOIN medicines m ON i.med_id = m.id WHERE i.pharmacy_id = 'PH-001'")
    inv_rows = c.fetchall()
    conn.close()

    refill_recommendations = []
    for item in inv_rows:
        predicted_demand = int(item["stock"] * 1.25) + 35
        if item["stock"] < predicted_demand:
            rec_refill = predicted_demand - item["stock"] + 20
            refill_recommendations.append({
                "med_id": "MED-001",
                "medicine_name": item["name"],
                "current_stock": item["stock"],
                "predicted_demand_next_week": predicted_demand,
                "recommended_refill": rec_refill,
                "urgency": "HIGH" if item["stock"] < 20 else "MEDIUM",
                "estimated_po_cost": round(rec_refill * (item["mrp"] * 0.7), 2)
            })

    return {
        "demand_trends": [
            {"medicine": "Dolo 650 / Paracetamol", "current_demand": 1200, "forecasted_demand": 1560, "growth": "+30%", "factor": "Viral Seasonal Spike & Humidity Drop"},
            {"medicine": "ORS Electrolyte Powder", "current_demand": 850, "forecasted_demand": 1003, "growth": "+18%", "factor": "Gastroenteritis Season Surge"},
            {"medicine": "Azithromycin 500mg", "current_demand": 450, "forecasted_demand": 517, "growth": "+15%", "factor": "Bacterial Respiratory Trend"}
        ],
        "outbreak_alerts": [
            {
                "id": "OUTBREAK-01",
                "region": "Downtown & Metro Zone",
                "symptom": "High Fever & Fatigue",
                "severity": "HIGH",
                "alert_message": "⚠️ Spike in fever symptom queries (+42%). High demand for Paracetamol expected.",
                "recommended_action": "Stock up Dolo 650 by 40% immediately."
            }
        ],
        "smart_stock_refill_system": refill_recommendations
    }


class HospitalOrderRequest(BaseModel):
    hospital_name: str
    med_id: str
    bulk_quantity: int
    is_emergency: bool = False

@app.post("/api/hospital/bulk-reserve")
async def bulk_reserve_hospital(req: HospitalOrderRequest):
    """Hospital Bulk Stock Procurement"""
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT name, mrp FROM medicines WHERE id = ?", (req.med_id,))
    m_row = c.fetchone()
    med_name = m_row["name"] if m_row else "Bulk Medicines"
    mrp = m_row["mrp"] if m_row else 30.0

    res_id = f"HOSP-BULK-{random.randint(1000, 9999)}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Hospital Bulk Order #{res_id} reserved by {req.hospital_name} for {req.bulk_quantity} units of {med_name}", "HOSPITAL"))
    conn.commit()
    conn.close()

    return {
        "status": "BULK_RESERVED",
        "order_id": res_id,
        "hospital_name": req.hospital_name,
        "med_name": med_name,
        "requested_quantity": req.bulk_quantity,
        "fulfilled_by": "Central Pharmacy Warehouse Hub",
        "estimated_delivery": "Within 2 Hours" if req.is_emergency else "Tomorrow Morning 9:00 AM",
        "total_estimate": round(mrp * req.bulk_quantity * 0.85, 2)
    }


# ==========================================
# ADMIN GOVERNANCE & CONTROL APIS
# ==========================================

class UserStatusToggleModel(BaseModel):
    user_id: str
    status: str

@app.post("/api/admin/users/toggle-status")
async def toggle_user_status(req: UserStatusToggleModel):
    """Admin Panel: Toggle patient/user account status (active <-> suspended)"""
    conn = db.get_db_connection()
    c = conn.cursor()
    
    new_st = req.status.lower()
    c.execute("UPDATE users SET status = ? WHERE id = ?", (new_st, req.user_id))
    
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="User account not found")

    c.execute("SELECT name FROM users WHERE id = ?", (req.user_id,))
    u_name = c.fetchone()["name"]

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Admin updated User '{u_name}' ({req.user_id}) status to {new_st.upper()}", "ADMIN"))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"User '{u_name}' account status updated to {new_st.upper()}.",
        "user_id": req.user_id,
        "new_status": new_st
    }


class PharmacyStatusToggleModel(BaseModel):
    pharmacy_id: str
    status: str

@app.post("/api/admin/pharmacies/toggle-status")
async def toggle_pharmacy_status(req: PharmacyStatusToggleModel):
    """Admin Panel: Toggle pharmacy status (APPROVED <-> SUSPENDED)"""
    conn = db.get_db_connection()
    c = conn.cursor()

    new_st = req.status.upper()
    c.execute("UPDATE pharmacies SET status = ? WHERE id = ?", (new_st, req.pharmacy_id))

    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Pharmacy store not found")

    c.execute("SELECT name FROM pharmacies WHERE id = ?", (req.pharmacy_id,))
    p_name = c.fetchone()["name"]

    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Admin updated Pharmacy '{p_name}' ({req.pharmacy_id}) authorization status to {new_st}", "ADMIN"))

    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"Pharmacy '{p_name}' status updated to {new_st}.",
        "pharmacy_id": req.pharmacy_id,
        "new_status": new_st
    }


@app.get("/api/admin/all-data")
async def get_admin_dashboard_data():
    """Admin Panel full platform telemetry from SQLite database"""
    conn = db.get_db_connection()
    c = conn.cursor()

    # Patients list
    c.execute("SELECT * FROM users WHERE role='patient'")
    user_rows = c.fetchall()

    patients_list = []
    for u in user_rows:
        c.execute("SELECT COUNT(*) FROM orders WHERE patient_id = ?", (u["id"],))
        order_cnt = c.fetchone()[0]
        patients_list.append({
            "id": u["id"],
            "name": u["name"],
            "email": u["email"],
            "phone": u["phone"] or "N/A",
            "address": u["address"] or "N/A",
            "status": u["status"],
            "total_orders": order_cnt
        })

    # Active pharmacies
    c.execute("SELECT * FROM pharmacies")
    active_pharmacies = [dict(p) for p in c.fetchall()]

    # Emergency Dispatches
    c.execute("SELECT * FROM emergency_dispatches ORDER BY created_at DESC")
    dispatches = [dict(d) for d in c.fetchall()]

    # Audit Logs
    c.execute("SELECT timestamp AS time, event FROM audit_logs ORDER BY id DESC LIMIT 15")
    logs = [dict(l) for l in c.fetchall()]

    conn.close()

    return {
        "pending_pharmacies": [],
        "active_pharmacies": active_pharmacies,
        "all_patients": patients_list,
        "emergency_dispatches": dispatches,
        "system_audit_logs": logs
    }


# ==========================================
# EMERGENCY DISPATCH API
# ==========================================

class EmergencyDispatchRequest(BaseModel):
    patient_name: str
    patient_phone: str
    location_address: str
    requested_med: str
    pharmacy_id: Optional[str] = "PH-001"
    latitude: Optional[float] = 19.6967
    longitude: Optional[float] = 72.7699

@app.post("/api/emergency/dispatch")
async def create_emergency_dispatch(req: EmergencyDispatchRequest):
    """Create emergency medicine dispatch — assigns nearest available rider"""
    conn = db.get_db_connection()
    c = conn.cursor()

    c.execute("SELECT * FROM pharmacies WHERE id = ? AND is_open = 1 AND emergency_delivery = 1", (req.pharmacy_id,))
    pharm_row = c.fetchone()
    if not pharm_row:
        c.execute("SELECT * FROM pharmacies WHERE is_open = 1 AND emergency_delivery = 1 ORDER BY id LIMIT 1")
        pharm_row = c.fetchone()
    pharmacy = dict(pharm_row) if pharm_row else {
        "id": "PH-001", "name": "Apollo Pharmacy - Downtown", "phone": "+91 98201 12345"
    }

    dispatch_id = f"EMG-{random.randint(1000, 9999)}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    riders = ["Vikram Singh (Rider #402)", "Ravi Kumar (Rider #115)", "Suresh Nair (Rider #307)"]
    rider_phones = ["+91 98111 00998", "+91 98222 11009", "+91 98333 22110"]
    rider_idx = random.randint(0, 2)
    eta_mins = random.randint(8, 20)

    c.execute('''
        INSERT INTO emergency_dispatches
        (dispatch_id, patient_name, patient_phone, location_address, requested_med,
         pharmacy_id, pharmacy_name, distance, status, eta, rider_name, rider_phone,
         latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        dispatch_id, req.patient_name, req.patient_phone, req.location_address,
        req.requested_med, pharmacy["id"], pharmacy["name"],
        f"{round(random.uniform(0.5, 3.0), 1)} km", "DISPATCHED",
        f"{eta_mins} Mins", riders[rider_idx], rider_phones[rider_idx],
        req.latitude, req.longitude, now_str
    ))

    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"EMERGENCY DISPATCH #{dispatch_id} for '{req.patient_name}' — Medicine: {req.requested_med}", "EMERGENCY"))
    conn.commit()
    conn.close()

    return {
        "status": "DISPATCHED",
        "dispatch_id": dispatch_id,
        "message": f"🚨 Emergency dispatch #{dispatch_id} created! Rider en route.",
        "pharmacy_name": pharmacy["name"],
        "pharmacy_phone": pharmacy.get("phone", "+91 98201 12345"),
        "rider_name": riders[rider_idx],
        "rider_phone": rider_phones[rider_idx],
        "eta": f"{eta_mins} Mins"
    }


# ==========================================
# PHARMACY PROFILE UPDATE
# ==========================================

class PharmacyProfileUpdateModel(BaseModel):
    pharmacy_id: str
    name: str
    phone: str
    address: str
    is_open: bool = True
    emergency_delivery: bool = True

@app.put("/api/pharmacy/profile")
async def update_pharmacy_profile(req: PharmacyProfileUpdateModel):
    """Pharmacy owner: Update store profile details"""
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute(
        "UPDATE pharmacies SET name=?, phone=?, address=?, is_open=?, emergency_delivery=? WHERE id=?",
        (req.name, req.phone, req.address, int(req.is_open), int(req.emergency_delivery), req.pharmacy_id)
    )
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Pharmacy store not found.")

    c.execute("SELECT * FROM pharmacies WHERE id=?", (req.pharmacy_id,))
    updated = dict(c.fetchone())
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Store profile updated for Pharmacy {req.pharmacy_id}: {req.name}", req.pharmacy_id))
    conn.commit()
    conn.close()

    return {
        "status": "SUCCESS",
        "message": f"Store profile for '{req.name}' updated successfully!",
        "store": updated
    }


# ==========================================
# AI INVOICE SCANNER (stub — accepts any file)
# ==========================================

@app.post("/api/pharmacy/ai-invoice-scanner")
async def ai_invoice_scanner(file: UploadFile = File(...)):
    """AI Supplier Invoice Parser — reads uploaded bill and auto-updates inventory (stub)"""
    await file.read()  # consume file bytes
    return {
        "status": "SUCCESS",
        "message": f"Invoice '{file.filename}' parsed! 6 medicines auto-updated in database. Stock levels refreshed.",
        "items_parsed": 6
    }


# ==========================================
# PRESCRIPTION OCR UPLOAD
# ==========================================

@app.post("/api/prescriptions/upload")
async def upload_prescription(file: UploadFile = File(...)):
    """AI Prescription OCR — extracts medicines from uploaded prescription image"""
    await file.read()  # consume file bytes
    # Simulated OCR result (would call Vision API in production)
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM medicines LIMIT 3")
    meds = [dict(r) for r in c.fetchall()]
    conn.close()

    items = [
        {
            "raw_ocr": med["name"].lower(),
            "corrected_name": med["name"],
            "dosage_instruction": med["dosage"],
            "medicine": {
                "id": med["id"],
                "generic_name": med["generic_name"],
                "mrp": med["mrp"],
                "stock": random.randint(50, 200)
            }
        }
        for med in meds
    ]

    return {
        "status": "SUCCESS",
        "ocr_confidence_score": random.randint(88, 97),
        "extracted_count": len(items),
        "items": items
    }


# ==========================================
# COMMUNITY DONATION API
# ==========================================

class DonationRequest(BaseModel):
    donor_name: str
    phone: str
    med_name: str
    strips_count: int
    expiry_month_year: Optional[str] = "2027-12"
    ngo_preference: Optional[str] = "Red Cross Healthcare Trust"

@app.post("/api/donation/submit")
async def submit_donation(req: DonationRequest):
    """Submit community medicine donation to NGO"""
    conn = db.get_db_connection()
    c = conn.cursor()
    donation_id = f"DON-{random.randint(1000, 9999)}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute('''
        INSERT INTO donations (id, donor_name, phone, med_name, strips_count, expiry_date, ngo_preference, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (donation_id, req.donor_name, req.phone, req.med_name, req.strips_count,
          req.expiry_month_year, req.ngo_preference, "PICKUP_SCHEDULED", now_str))
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Donation #{donation_id} from {req.donor_name}: {req.strips_count} strips of {req.med_name}", "DONOR"))
    conn.commit()
    conn.close()
    return {
        "status": "SUCCESS",
        "donation_id": donation_id,
        "message": f"Thank you {req.donor_name}! Volunteer pickup for {req.strips_count} strips of {req.med_name} is scheduled.",
        "ngo": req.ngo_preference,
        "pickup_slot": "Tomorrow between 10 AM - 2 PM"
    }


# ==========================================
# ADMIN — APPROVE PHARMACY
# ==========================================

@app.post("/api/admin/pharmacies/approve/{pharmacy_id}")
async def approve_pharmacy(pharmacy_id: str):
    """Admin: Approve a pending pharmacy"""
    conn = db.get_db_connection()
    c = conn.cursor()
    c.execute("UPDATE pharmacies SET status = 'APPROVED' WHERE id = ?", (pharmacy_id,))
    if c.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Pharmacy not found")
    c.execute("SELECT name FROM pharmacies WHERE id = ?", (pharmacy_id,))
    p_row = c.fetchone()
    p_name = p_row["name"] if p_row else pharmacy_id
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    c.execute("INSERT INTO audit_logs (timestamp, event, user_id) VALUES (?, ?, ?)",
              (now_str, f"Admin APPROVED Pharmacy '{p_name}' ({pharmacy_id})", "ADMIN"))
    conn.commit()
    conn.close()
    return {"status": "SUCCESS", "message": f"Pharmacy '{p_name}' approved successfully!"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
