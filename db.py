import os
import sqlite3
import hashlib
import uuid
import random
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_DB = os.path.join(BASE_DIR, "database.db")

# In Vercel serverless environment, root directory is read-only. Use /tmp directory.
if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    DB_FILE = "/tmp/database.db"
    if os.path.exists(DEFAULT_DB) and not os.path.exists(DB_FILE):
        try:
            import shutil
            shutil.copy2(DEFAULT_DB, DB_FILE)
        except Exception:
            pass
else:
    DB_FILE = DEFAULT_DB

def get_db_connection():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    return conn

def hash_password(password: str, salt: str = None):
    if not salt:
        salt = uuid.uuid4().hex
    pwd_hash = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        120000
    ).hex()
    return pwd_hash, salt

def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    pwd_hash, _ = hash_password(password, salt)
    if pwd_hash == stored_hash:
        return True
    # Fallback legacy SHA256 check
    try:
        legacy_hash = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
        if legacy_hash == stored_hash:
            return True
    except Exception:
        pass
    return False


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            salt TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            phone TEXT,
            address TEXT,
            license TEXT,
            avatar TEXT DEFAULT 'patient_avatar.png',
            security_question TEXT,
            security_answer_hash TEXT,
            failed_login_attempts INTEGER DEFAULT 0,
            locked_until TEXT,
            status TEXT DEFAULT 'active',
            pharmacy_id TEXT,
            created_at TEXT
        )
    ''')

    # Add missing columns for legacy database files if any
    existing_cols = [r[1] for r in cursor.execute("PRAGMA table_info(users)").fetchall()]
    if "avatar" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN avatar TEXT DEFAULT 'patient_avatar.png'")
    if "security_question" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN security_question TEXT")
    if "security_answer_hash" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN security_answer_hash TEXT")
    if "failed_login_attempts" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0")
    if "locked_until" not in existing_cols:
        cursor.execute("ALTER TABLE users ADD COLUMN locked_until TEXT")

    # OTP Verification Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS otp_codes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            otp_code TEXT NOT NULL,
            purpose TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            is_used INTEGER DEFAULT 0,
            created_at TEXT NOT NULL
        )
    ''')

    # 2. Pharmacies Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pharmacies (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            name TEXT NOT NULL,
            license TEXT NOT NULL,
            address TEXT NOT NULL,
            phone TEXT NOT NULL,
            lat REAL,
            lng REAL,
            rating REAL DEFAULT 4.8,
            is_open INTEGER DEFAULT 1,
            status TEXT DEFAULT 'APPROVED',
            emergency_delivery INTEGER DEFAULT 1
        )
    ''')

    # 3. Medicines Master Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS medicines (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            generic_name TEXT NOT NULL,
            barcode TEXT UNIQUE,
            category TEXT NOT NULL,
            mrp REAL NOT NULL,
            dosage TEXT,
            symptoms TEXT,
            side_effects TEXT,
            prescription_required INTEGER DEFAULT 0
        )
    ''')

    # 4. Pharmacy Inventory Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pharmacy_id TEXT NOT NULL,
            med_id TEXT NOT NULL,
            stock INTEGER NOT NULL DEFAULT 0,
            batch TEXT NOT NULL,
            expiry TEXT NOT NULL,
            mrp REAL NOT NULL,
            FOREIGN KEY (pharmacy_id) REFERENCES pharmacies (id),
            FOREIGN KEY (med_id) REFERENCES medicines (id)
        )
    ''')

    # 5. Orders Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS orders (
            order_id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            patient_name TEXT NOT NULL,
            patient_phone TEXT NOT NULL,
            patient_address TEXT NOT NULL,
            pharmacy_id TEXT NOT NULL,
            pharmacy_name TEXT NOT NULL,
            pharmacy_address TEXT,
            pharmacy_phone TEXT,
            total_amount REAL NOT NULL,
            delivery_type TEXT DEFAULT 'DELIVERY',
            status TEXT DEFAULT 'PENDING',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            qr_code_data TEXT
        )
    ''')

    # 6. Order Items Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id TEXT NOT NULL,
            med_id TEXT NOT NULL,
            med_name TEXT NOT NULL,
            generic_name TEXT,
            quantity INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            total_price REAL NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders (order_id)
        )
    ''')

    # 7. Emergency Dispatches Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS emergency_dispatches (
            dispatch_id TEXT PRIMARY KEY,
            patient_name TEXT NOT NULL,
            patient_phone TEXT NOT NULL,
            location_address TEXT NOT NULL,
            requested_med TEXT NOT NULL,
            pharmacy_id TEXT NOT NULL,
            pharmacy_name TEXT NOT NULL,
            distance TEXT,
            status TEXT DEFAULT 'DISPATCHED',
            eta TEXT,
            rider_name TEXT,
            rider_phone TEXT,
            latitude REAL,
            longitude REAL,
            created_at TEXT NOT NULL
        )
    ''')

    # 8. Reminders Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS reminders (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            med_name TEXT NOT NULL,
            patient_label TEXT NOT NULL,
            reminder_time TEXT NOT NULL,
            dosage TEXT,
            active INTEGER DEFAULT 1
        )
    ''')

    # 9. Family Profiles Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS family_profiles (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL,
            name TEXT NOT NULL,
            relation TEXT NOT NULL,
            age INTEGER,
            blood_group TEXT,
            allergies TEXT
        )
    ''')

    # 10. Community Donations Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS donations (
            id TEXT PRIMARY KEY,
            donor_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            med_name TEXT NOT NULL,
            strips_count INTEGER NOT NULL,
            expiry_date TEXT NOT NULL,
            ngo_preference TEXT NOT NULL,
            status TEXT DEFAULT 'PICKUP_SCHEDULED',
            created_at TEXT NOT NULL
        )
    ''')

    # 11. Audit Logs Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event TEXT NOT NULL,
            user_id TEXT
        )
    ''')

    conn.commit()

    # Seed Initial Database Data if empty, or sync seed demo account hashes
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        seed_initial_data(conn)
    else:
        sync_seed_accounts(conn)

    conn.close()


def sync_seed_accounts(conn):
    cursor = conn.cursor()
    users_data = [
        ("USR-PAT-001", "rahul@pharmaconnect.ai", "PatientPass@123", "Rahul Sharma", "patient", "+91 98201 99887", "Flat 402, Sunshine Heights, Downtown Central", "", "active", ""),
        ("USR-PAT-002", "priya@pharmaconnect.ai", "PatientPass@123", "Priya Patel", "patient", "+91 98334 11223", "701 Lake View Towers, Powai", "", "active", ""),
        ("USR-PHARM-001", "apollo@pharmaconnect.ai", "PharmaPass@123", "Apollo Pharmacy (Downtown)", "pharmacy", "+91 98201 12345", "101 Healthcare Blvd, Downtown Central", "DL-2024-AP8819", "active", "PH-001"),
        ("USR-PHARM-002", "healthplus@pharmaconnect.ai", "PharmaPass@123", "HealthPlus Chemist", "pharmacy", "+91 98202 23456", "45 Metro Station Rd, Sector 4", "DL-2024-HP4412", "active", "PH-002"),
        ("USR-ADMIN-001", "admin@pharmaconnect.ai", "AdminPass@123", "Platform Administrator", "admin", "+91 1800 742762", "Central Admin Office", "ADM-001", "active", "")
    ]

    for uid, email, raw_pwd, name, role, phone, addr, lic, status, p_id in users_data:
        pwd_hash, salt = hash_password(raw_pwd)
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?", (email.lower(),))
        row = cursor.fetchone()
        if row:
            cursor.execute('''
                UPDATE users SET password_hash = ?, salt = ?, failed_login_attempts = 0, status = 'active'
                WHERE LOWER(email) = ?
            ''', (pwd_hash, salt, email.lower()))
        else:
            now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            cursor.execute('''
                INSERT INTO users (id, email, password_hash, salt, name, role, phone, address, license, status, pharmacy_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (uid, email, pwd_hash, salt, name, role, phone, addr, lic, status, p_id, now_str))

    conn.commit()



def seed_initial_data(conn):
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Seed Accounts
    users_data = [
        ("USR-PAT-001", "rahul@pharmaconnect.ai", "PatientPass@123", "Rahul Sharma", "patient", "+91 98201 99887", "Flat 402, Sunshine Heights, Downtown Central", "", "active", ""),
        ("USR-PAT-002", "priya@pharmaconnect.ai", "PatientPass@123", "Priya Patel", "patient", "+91 98334 11223", "701 Lake View Towers, Powai", "", "active", ""),
        ("USR-PHARM-001", "apollo@pharmaconnect.ai", "PharmaPass@123", "Apollo Pharmacy (Downtown)", "pharmacy", "+91 98201 12345", "101 Healthcare Blvd, Downtown Central", "DL-2024-AP8819", "active", "PH-001"),
        ("USR-PHARM-002", "healthplus@pharmaconnect.ai", "PharmaPass@123", "HealthPlus Chemist", "pharmacy", "+91 98202 23456", "45 Metro Station Rd, Sector 4", "DL-2024-HP4412", "active", "PH-002"),
        ("USR-ADMIN-001", "admin@pharmaconnect.ai", "AdminPass@123", "Platform Administrator", "admin", "+91 1800 742762", "Central Admin Office", "ADM-001", "active", "")
    ]

    for uid, email, raw_pwd, name, role, phone, addr, lic, status, p_id in users_data:
        pwd_hash, salt = hash_password(raw_pwd)
        cursor.execute('''
            INSERT INTO users (id, email, password_hash, salt, name, role, phone, address, license, status, pharmacy_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (uid, email, pwd_hash, salt, name, role, phone, addr, lic, status, p_id, now_str))

    # Seed Pharmacies
    pharmacies_data = [
        ("PH-001", "USR-PHARM-001", "Apollo Pharmacy - Downtown", "DL-2024-AP8819", "101 Healthcare Blvd, Downtown Central", "+91 98201 12345", 19.0760, 72.8777, 4.8, 1, "APPROVED", 1),
        ("PH-002", "USR-PHARM-002", "HealthPlus Chemist - Metro Hub", "DL-2024-HP4412", "45 Metro Station Rd, Sector 4", "+91 98202 23456", 19.0820, 72.8820, 4.6, 1, "APPROVED", 1),
        ("PH-003", "", "Wellness Medicos - Green Park", "DL-2024-WM9931", "78 Green Park Extension", "+91 98203 34567", 19.0680, 72.8650, 4.9, 1, "APPROVED", 1),
        ("PH-004", "", "CareFirst Pharmacy - Station Rd", "DL-2024-CF1029", "12 Station Road, Near Flyover", "+91 98204 45678", 19.0910, 72.8900, 4.5, 0, "APPROVED", 0),
        ("PH-005", "", "Lifeline Healthcare - City Center", "DL-2024-LH7741", "88 City Center Mall Arcade", "+91 98205 56789", 19.0550, 72.8500, 4.7, 1, "APPROVED", 1)
    ]

    for p in pharmacies_data:
        cursor.execute('''
            INSERT INTO pharmacies (id, user_id, name, license, address, phone, lat, lng, rating, is_open, status, emergency_delivery)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', p)

    # Seed Medicines Master Database (Real Pharmaceutical Formulations)
    medicines_data = [
        ("MED-001", "Dolo 650", "Paracetamol 650mg", "8901234567890", "Analgesic & Antipyretic", 30.50, "1 tablet 3x daily after food", "fever, body ache, headache", "Mild nausea if empty stomach", 0),
        ("MED-002", "Crocin 500", "Paracetamol 500mg", "8901234567891", "Analgesic", 18.00, "1 tablet every 6 hours", "fever, mild pain", "None reported", 0),
        ("MED-003", "Pantoprazole 40mg", "Pantoprazole Sodium", "8901234567892", "Gastrointestinal", 85.00, "1 tablet morning empty stomach", "acidity, heartburn, reflux", "Headache, flatulence", 0),
        ("MED-004", "Azithromycin 500mg", "Azithromycin Dihydrate", "8901234567893", "Antibiotic", 120.00, "1 tablet daily for 3-5 days", "bacterial infection, throat infection, cough", "Stomach upset, diarrhea", 1),
        ("MED-005", "Montair LC", "Montelukast 10mg + Levocetirizine 5mg", "8901234567894", "Anti-Allergic", 145.00, "1 tablet at bedtime", "allergy, sneezing, runny nose, asthma", "Drowsiness, dry mouth", 0),
        ("MED-006", "Metformin 500mg", "Metformin Hydrochloride SR", "8901234567895", "Anti-Diabetic", 42.00, "1 tablet twice daily with meals", "diabetes, high blood sugar", "Mild abdominal discomfort", 1),
        ("MED-007", "Telmisartan 40mg", "Telmisartan 40mg", "8901234567896", "Cardiovascular", 95.00, "1 tablet daily morning", "hypertension, high blood pressure", "Dizziness", 1),
        ("MED-008", "ORS Electrolyte Powder", "Oral Rehydration Salts", "8901234567897", "Rehydration", 22.00, "Dissolve 1 sachet in 1L clean water", "dehydration, diarrhea, vomiting", "None", 0),
        ("MED-009", "Amoxicillin 500mg", "Amoxicillin Trihydrate", "8901234567898", "Antibiotic", 75.00, "1 capsule 3x daily", "bacterial infection, fever", "Rash, diarrhea", 1),
        ("MED-010", "Insulin Glargine Pen", "Insulin Glargine 100 IU/ml", "8901234567899", "Diabetes Care", 680.00, "10 units subcutaneous at bedtime", "type 1 diabetes, severe type 2 diabetes", "Hypoglycemia risk", 1)
    ]

    for m in medicines_data:
        cursor.execute('''
            INSERT INTO medicines (id, name, generic_name, barcode, category, mrp, dosage, symptoms, side_effects, prescription_required)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', m)

    # Seed Store Inventories
    inventory_data = [
        ("PH-001", "MED-001", 140, "BAT-DL-991", "2028-12-31", 30.50),
        ("PH-001", "MED-003", 65, "BAT-PT-402", "2027-11-15", 85.00),
        ("PH-001", "MED-004", 45, "BAT-AZ-109", "2027-10-20", 120.00),
        ("PH-001", "MED-005", 80, "BAT-MT-881", "2028-04-10", 145.00),
        ("PH-001", "MED-008", 200, "BAT-ORS-02", "2028-06-30", 22.00),
        ("PH-001", "MED-010", 18, "BAT-INS-55", "2027-08-30", 680.00),
        ("PH-002", "MED-001", 90, "BAT-HP-101", "2028-09-30", 30.50),
        ("PH-002", "MED-002", 120, "BAT-HP-102", "2028-05-15", 18.00),
        ("PH-002", "MED-006", 110, "BAT-HP-103", "2027-12-01", 42.00),
        ("PH-003", "MED-001", 210, "BAT-WM-001", "2028-11-30", 30.50)
    ]

    for inv in inventory_data:
        cursor.execute('''
            INSERT INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', inv)

    # Seed Sample Orders
    order_id = "ORD-90812"
    qr_data = "PHARMA-ORD-90812|PAT:Rahul Sharma|PHARM:Apollo Pharmacy|AMT:61.00"
    cursor.execute('''
        INSERT INTO orders (order_id, patient_id, patient_name, patient_phone, patient_address, pharmacy_id, pharmacy_name, pharmacy_address, pharmacy_phone, total_amount, delivery_type, status, created_at, updated_at, qr_code_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (order_id, "USR-PAT-001", "Rahul Sharma", "+91 98201 99887", "Flat 402, Sunshine Heights, Downtown Central", "PH-001", "Apollo Pharmacy - Downtown", "101 Healthcare Blvd, Downtown Central", "+91 98201 12345", 61.00, "DELIVERY", "APPROVED", now_str, now_str, qr_data))

    cursor.execute('''
        INSERT INTO order_items (order_id, med_id, med_name, generic_name, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (order_id, "MED-001", "Dolo 650", "Paracetamol 650mg", 2, 30.50, 61.00))

    # Seed Emergency Dispatches
    cursor.execute('''
        INSERT INTO emergency_dispatches (dispatch_id, patient_name, patient_phone, location_address, requested_med, pharmacy_id, pharmacy_name, distance, status, eta, rider_name, rider_phone, latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', ("EMG-7701", "Amit Deshmukh", "+91 98200 11998", "Green Park Sector 3", "Cetirizine 10mg & Inhaler", "PH-001", "Apollo Pharmacy - Downtown", "0.8 km", "IN_TRANSIT", "8 Mins", "Vikram Singh (Rider #402)", "+91 98111 00998", 19.0775, 72.8790, now_str))

    # Seed Audit Logs
    cursor.execute('''
        INSERT INTO audit_logs (timestamp, event, user_id)
        VALUES (?, ?, ?)
    ''', (now_str, "SQLite Database System Initialized with persistent tables", "SYSTEM"))

    conn.commit()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully.")
