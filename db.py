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

    # Hospitals & Emergency Healthcare Centers Table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS hospitals (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT NOT NULL,
            address TEXT NOT NULL,
            phone TEXT NOT NULL,
            lat REAL NOT NULL,
            lng REAL NOT NULL,
            rating REAL DEFAULT 4.8,
            icu_beds INTEGER DEFAULT 12,
            emergency_24x7 INTEGER DEFAULT 1,
            services TEXT
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

    # App Settings (key-value store for in-app configuration)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS app_settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT
        )
    ''')

    conn.commit()

    # Seed Initial Database Data if empty, or sync seed demo account hashes
    cursor.execute("SELECT COUNT(*) FROM users")
    if cursor.fetchone()[0] == 0:
        seed_initial_data(conn)
    else:
        sync_seed_accounts(conn)

    # Ensure Palghar Maharashtra pharmacies and hospitals are always initialized/updated
    ensure_palghar_data(conn)

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
    for m in MASTER_MEDICINES:
        cursor.execute('''
            INSERT INTO medicines (id, name, generic_name, barcode, category, mrp, dosage, symptoms, side_effects, prescription_required)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', m)

    # Seed Sample Orders
    order_id = "ORD-90812"
    qr_data = "PHARMA-ORD-90812|PAT:Rahul Sharma|FACILITY:Apollo Pharmacy - Palghar Station|AMT:61.00"
    cursor.execute('''
        INSERT INTO orders (order_id, patient_id, patient_name, patient_phone, patient_address, pharmacy_id, pharmacy_name, pharmacy_address, pharmacy_phone, total_amount, delivery_type, status, created_at, updated_at, qr_code_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (order_id, "USR-PAT-001", "Rahul Sharma", "+91 98201 99887", "Flat 402, Sunshine Heights, Downtown Central", "PH-001", "Apollo Pharmacy - Palghar Station", "Station Road, Palghar West", "+91 98201 12345", 61.00, "DELIVERY", "APPROVED", now_str, now_str, qr_data))

    cursor.execute('''
        INSERT INTO order_items (order_id, med_id, med_name, generic_name, quantity, unit_price, total_price)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (order_id, "MED-001", "Dolo 650", "Paracetamol 650mg", 2, 30.50, 61.00))

    # Seed Emergency Dispatches
    cursor.execute('''
        INSERT INTO emergency_dispatches (dispatch_id, patient_name, patient_phone, location_address, requested_med, pharmacy_id, pharmacy_name, distance, status, eta, rider_name, rider_phone, latitude, longitude, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', ("EMG-7701", "Amit Deshmukh", "+91 98200 11998", "Green Park Sector 3", "Cetirizine 10mg & Inhaler", "PH-001", "Apollo Pharmacy - Palghar Station", "0.8 km", "IN_TRANSIT", "8 Mins", "Vikram Singh (Rider #402)", "+91 98111 00998", 19.0775, 72.8790, now_str))

    # Seed Audit Logs
    cursor.execute('''
        INSERT INTO audit_logs (timestamp, event, user_id)
        VALUES (?, ?, ?)
    ''', (now_str, "SQLite Database System Initialized with persistent tables", "SYSTEM"))

    conn.commit()


# Comprehensive 32 Master Medicines covering all conditions and emergencies
MASTER_MEDICINES = [
    ("MED-001", "Dolo 650", "Paracetamol 650mg", "8901234567890", "Analgesic & Antipyretic", 30.50, "1 tablet 3x daily after food", "fever, body ache, headache", "Mild nausea if empty stomach", 0),
    ("MED-002", "Crocin 500", "Paracetamol 500mg", "8901234567891", "Analgesic", 18.00, "1 tablet every 6 hours", "fever, mild pain", "None reported", 0),
    ("MED-003", "Pantoprazole 40mg", "Pantoprazole Sodium", "8901234567892", "Gastrointestinal", 85.00, "1 tablet morning empty stomach", "acidity, heartburn, reflux", "Headache, flatulence", 0),
    ("MED-004", "Azithromycin 500mg", "Azithromycin Dihydrate", "8901234567893", "Antibiotic", 120.00, "1 tablet daily for 3-5 days", "bacterial infection, throat infection, cough", "Stomach upset, diarrhea", 1),
    ("MED-005", "Montair LC", "Montelukast 10mg + Levocetirizine 5mg", "8901234567894", "Anti-Allergic", 145.00, "1 tablet at bedtime", "allergy, sneezing, runny nose, asthma", "Drowsiness, dry mouth", 0),
    ("MED-006", "Metformin 500mg", "Metformin Hydrochloride SR", "8901234567895", "Anti-Diabetic", 42.00, "1 tablet twice daily with meals", "diabetes, high blood sugar", "Mild abdominal discomfort", 1),
    ("MED-007", "Telmisartan 40mg", "Telmisartan 40mg", "8901234567896", "Cardiovascular", 95.00, "1 tablet daily morning", "hypertension, high blood pressure", "Dizziness", 1),
    ("MED-008", "ORS Electrolyte Powder", "Oral Rehydration Salts WHO", "8901234567897", "Rehydration", 22.00, "Dissolve 1 sachet in 1L clean water", "dehydration, diarrhea, vomiting", "None", 0),
    ("MED-009", "Amoxicillin 500mg", "Amoxicillin Trihydrate", "8901234567898", "Antibiotic", 75.00, "1 capsule 3x daily", "bacterial infection, dental infection, fever", "Rash, diarrhea", 1),
    ("MED-010", "Insulin Glargine Pen", "Insulin Glargine 100 IU/ml", "8901234567899", "Diabetes Care", 680.00, "10 units subcutaneous at bedtime", "type 1 diabetes, severe type 2 diabetes", "Hypoglycemia risk", 1),
    ("MED-011", "Combiflam", "Ibuprofen 400mg + Paracetamol 325mg", "8901234567801", "Analgesic & Anti-inflammatory", 45.00, "1 tablet twice daily after meals", "body pain, headache, dental pain, fever", "Mild heartburn", 0),
    ("MED-012", "Augmentin 625 Duo", "Amoxicillin 500mg + Clavulanic Acid 125mg", "8901234567802", "Antibiotic", 185.00, "1 tablet twice daily with food", "respiratory infection, ear infection, skin infection", "Mild diarrhea", 1),
    ("MED-013", "Cetirizine 10mg", "Cetirizine Hydrochloride", "8901234567803", "Anti-Allergic", 25.00, "1 tablet once daily at bedtime", "cold, runny nose, allergic rhinitis, hives", "Drowsiness", 0),
    ("MED-014", "Asthalin Inhaler", "Salbutamol 100mcg", "8901234567804", "Respiratory Care", 145.00, "1-2 puffs as needed for acute shortness of breath", "asthma, wheezing, bronchospasm, breathing difficulty", "Tremor, palpitations", 1),
    ("MED-015", "Budecort 200 Inhaler", "Budesonide 200mcg", "8901234567805", "Respiratory Care", 295.00, "1 puff twice daily maintenance", "chronic asthma, COPD, bronchial swelling", "Oral thrush if not rinsed", 1),
    ("MED-016", "Pan-D", "Pantoprazole 40mg + Domperidone 30mg SR", "8901234567806", "Gastrointestinal", 135.00, "1 capsule morning 30 mins before food", "severe acidity, acid reflux, nausea, gas", "Dry mouth, headache", 0),
    ("MED-017", "Digene Gel Mint 200ml", "Magnesium & Aluminium Hydroxide + Simethicone", "8901234567807", "Antacid", 155.00, "2 teaspoons after food and at bedtime", "heartburn, acidity, indigestion, stomach burning", "Constipation or laxative effect", 0),
    ("MED-018", "Amlodipine 5mg", "Amlodipine Besylate", "8901234567808", "Cardiovascular", 38.00, "1 tablet daily once", "hypertension, high blood pressure, angina", "Ankle swelling", 1),
    ("MED-019", "Atorvastatin 20mg", "Atorvastatin Calcium", "8901234567809", "Cardiovascular", 115.00, "1 tablet at bedtime", "high cholesterol, heart attack prevention, CAD", "Muscle pain", 1),
    ("MED-020", "Normal Saline IV Infusion 500ml", "Sodium Chloride 0.9% w/v", "8901234567810", "Emergency & Critical Care", 52.00, "Intravenous infusion as prescribed by physician", "severe dehydration, fluid resuscitation, shock, hypovolemia", "Hypernatremia if overused", 1),
    ("MED-021", "Dextrose 5% IV Infusion 500ml", "Dextrose Monohydrate 5% w/v", "8901234567811", "Emergency & Critical Care", 56.00, "Slow IV infusion as directed", "hypoglycemia, fluid loss, post-operative nutrition", "Hyperglycemia", 1),
    ("MED-022", "Ringer Lactate Infusion 500ml", "Sodium Lactate Compound (RL)", "8901234567812", "Emergency & Critical Care", 65.00, "IV infusion for acute trauma fluid loss", "trauma, acute blood loss, burn injuries, severe dehydration", "Fluid overload", 1),
    ("MED-023", "Ceftriaxone 1g Injection", "Ceftriaxone Sodium IV/IM", "8901234567813", "Critical Care Antibiotic", 78.00, "1g IV slowly after reconstitution", "severe bacterial infection, typhoid, pneumonia, sepsis, post-op infection", "Injection site pain", 1),
    ("MED-024", "Diclofenac 75mg Injection", "Diclofenac Sodium 75mg/ml", "8901234567814", "Emergency Analgesic", 32.00, "Deep intramuscular injection as directed", "acute severe pain, renal colic, trauma pain, acute arthritis", "Local pain at injection site", 1),
    ("MED-025", "Ondansetron 4mg Injection", "Ondansetron Hydrochloride 2mg/ml (2ml)", "8901234567815", "Antiemetic & Emergency Care", 28.00, "Slow IV/IM injection over 2-3 minutes", "acute vomiting, nausea, gastroenteritis, post-surgical emesis", "Headache, warmth", 1),
    ("MED-026", "Tramadol 50mg Injection", "Tramadol Hydrochloride 50mg/ml", "8901234567816", "Emergency Pain Relief", 48.00, "Slow IV injection as prescribed", "post-operative pain, traumatic fractures, severe acute pain", "Dizziness, drowsiness, nausea", 1),
    ("MED-027", "Adrenaline 1mg Injection", "Epinephrine 1mg/ml (1:1000)", "8901234567817", "Life-Saving Emergency", 65.00, "0.5mg IM/SC injection under medical supervision", "anaphylaxis, severe allergic shock, cardiac arrest, acute asthma", "Tachycardia, anxiety", 1),
    ("MED-028", "Betadine 10% Solution 100ml", "Povidone Iodine 10% w/v", "8901234567818", "First Aid & Antiseptic", 110.00, "Apply topically with sterile cotton gauze", "wounds, cuts, burns, surgical prep, antiseptic cleaning", "Mild skin irritation", 0),
    ("MED-029", "Benadryl Cough Syrup 100ml", "Diphenhydramine + Ammonium Chloride", "8901234567819", "Cough & Cold", 115.00, "5-10ml 3 times daily after food", "dry cough, throat irritation, allergic cough", "Drowsiness", 0),
    ("MED-030", "Zincovit Multivitamin Tablets", "Multivitamin + Multimineral + Grape Seed", "8901234567820", "Immunity & Supplements", 110.00, "1 tablet daily after food", "weakness, vitamin deficiency, convalescence, immunity support", "Mild gastric fullness", 0),
    ("MED-031", "Limcee 500mg Chewable", "Ascorbic Acid (Vitamin C 500mg)", "8901234567821", "Immunity Booster", 24.00, "1 tablet to be chewed once daily", "immunity boosting, scurvy, skin repair, fatigue", "None", 0),
    ("MED-032", "Meftal-Spas", "Mefenamic Acid 250mg + Dicyclomine 10mg", "8901234567822", "Antispasmodic & Pain Relief", 52.00, "1 tablet as needed with meal", "menstrual pain, abdominal colic, stomach cramps", "Dry mouth, dizziness", 0)
]


def ensure_palghar_data(conn):
    """Ensures Palghar, Maharashtra pharmacies, hospitals, and rich medicine datasets are initialized or updated"""
    cursor = conn.cursor()

    # 1. Upsert all 32 Master Medicines so they are always present in the database
    for m in MASTER_MEDICINES:
        cursor.execute("SELECT id FROM medicines WHERE id = ?", (m[0],))
        if cursor.fetchone():
            cursor.execute('''
                UPDATE medicines 
                SET name = ?, generic_name = ?, barcode = ?, category = ?, mrp = ?, dosage = ?, symptoms = ?, side_effects = ?, prescription_required = ?
                WHERE id = ?
            ''', (m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9], m[0]))
        else:
            cursor.execute('''
                INSERT INTO medicines (id, name, generic_name, barcode, category, mrp, dosage, symptoms, side_effects, prescription_required)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', m)

    # 2. Seed/Update Palghar Medical Stores (Pharmacies)
    palghar_pharmacies = [
        ("PH-001", "USR-PHARM-001", "Apollo Pharmacy - Palghar Station", "DL-2024-AP8819", "Station Road, Palghar West, Maharashtra - 401404", "+91 98201 12345", 19.6975, 72.7678, 4.9, 1, "APPROVED", 1),
        ("PH-002", "USR-PHARM-002", "Sanjivani Medical & General Stores", "DL-2024-HP4412", "Kacheri Road, Near Post Office, Palghar, Maharashtra - 401404", "+91 98202 23456", 19.6982, 72.7710, 4.8, 1, "APPROVED", 1),
        ("PH-003", "", "Mahavir Chemist & Druggist", "DL-2024-WM9931", "Near ST Bus Stand, Palghar East, Maharashtra - 401404", "+91 98203 34567", 19.6955, 72.7745, 4.7, 1, "APPROVED", 1),
        ("PH-004", "", "Lifeline 24x7 Medicos", "DL-2024-CF1029", "Manor Road, Opposite District Court, Palghar, Maharashtra - 401404", "+91 98204 45678", 19.7010, 72.7730, 4.9, 1, "APPROVED", 1),
        ("PH-005", "", "Wellness Pharmacy & Surgicals", "DL-2024-LH7741", "Shirgaon Naka, Palghar West, Maharashtra - 401404", "+91 98205 56789", 19.6920, 72.7620, 4.6, 1, "APPROVED", 1)
    ]
    for p in palghar_pharmacies:
        cursor.execute("SELECT id FROM pharmacies WHERE id = ?", (p[0],))
        if cursor.fetchone():
            cursor.execute('''
                UPDATE pharmacies 
                SET name = ?, license = ?, address = ?, phone = ?, lat = ?, lng = ?, rating = ?, is_open = ?, status = ?, emergency_delivery = ?
                WHERE id = ?
            ''', (p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10], p[11], p[0]))
        else:
            cursor.execute('''
                INSERT INTO pharmacies (id, user_id, name, license, address, phone, lat, lng, rating, is_open, status, emergency_delivery)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', p)

    # 3. Seed/Update Palghar Hospitals
    palghar_hospitals = [
        ("HOSP-001", "Palghar District Civil Hospital", "District Civil Hospital & 24/7 Trauma", "Opp. Collector Office, Palghar West, Maharashtra - 401404", "+91 2525 252244", 19.7040, 72.7750, 4.7, 24, 1, "24/7 Trauma, ICU, Blood Bank, Emergency OT, Oxygen Supply"),
        ("HOSP-002", "Shraddha Hospital & Critical Care", "Multi-Specialty & ICU Center", "Station Road, Palghar West, Maharashtra - 401404", "+91 2525 253100", 19.6990, 72.7660, 4.8, 16, 1, "ICU, Emergency Surgery, Cardiac Care, Ventilators"),
        ("HOSP-003", "Dr. M. L. Dhawale Memorial Hospital", "Rural Health & Charitable Hospital", "Rural Health Campus, Palghar East, Maharashtra - 401404", "+91 2525 256932", 19.6890, 72.7810, 4.9, 20, 1, "Emergency Ward, Multispecialty, Diagnostic Imaging, Dialysis"),
        ("HOSP-004", "Ved Multispeciality Hospital & Trauma", "Super Specialty & Emergency Care", "Manor Road, Palghar, Maharashtra - 401404", "+91 2525 254888", 19.7025, 72.7715, 4.6, 14, 1, "24/7 Emergency, Ventilators, Ambulance Dispatch"),
        ("HOSP-005", "Philia Hospital & Maternity Home", "Maternity & Emergency Clinic", "Kelve Road Junction, Palghar West, Maharashtra - 401404", "+91 2525 251020", 19.6935, 72.7685, 4.7, 8, 1, "Emergency Care, Pediatric ICU, 24/7 In-House Pharmacy")
    ]
    for h in palghar_hospitals:
        cursor.execute("SELECT id FROM hospitals WHERE id = ?", (h[0],))
        if cursor.fetchone():
            cursor.execute('''
                UPDATE hospitals 
                SET name = ?, type = ?, address = ?, phone = ?, lat = ?, lng = ?, rating = ?, icu_beds = ?, emergency_24x7 = ?, services = ?
                WHERE id = ?
            ''', (h[1], h[2], h[3], h[4], h[5], h[6], h[7], h[8], h[9], h[10], h[0]))
        else:
            cursor.execute('''
                INSERT INTO hospitals (id, name, type, address, phone, lat, lng, rating, icu_beds, emergency_24x7, services)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', h)

    # 4. Inventory datasets for EACH Pharmacy & Medical Store
    pharmacy_inventories = {
        "PH-001": [
            ("MED-001", 140, "BAT-AP-01", "2028-12-31", 30.50),
            ("MED-002", 120, "BAT-AP-02", "2028-06-30", 18.00),
            ("MED-003", 95,  "BAT-AP-03", "2027-11-15", 85.00),
            ("MED-004", 65,  "BAT-AP-04", "2027-10-20", 120.00),
            ("MED-005", 80,  "BAT-AP-05", "2028-04-10", 145.00),
            ("MED-006", 110, "BAT-AP-06", "2027-12-01", 42.00),
            ("MED-007", 75,  "BAT-AP-07", "2028-03-20", 95.00),
            ("MED-008", 200, "BAT-AP-08", "2028-06-30", 22.00),
            ("MED-009", 90,  "BAT-AP-09", "2027-09-15", 75.00),
            ("MED-010", 25,  "BAT-AP-10", "2027-08-30", 680.00),
            ("MED-011", 130, "BAT-AP-11", "2028-05-15", 45.00),
            ("MED-012", 50,  "BAT-AP-12", "2027-11-30", 185.00),
            ("MED-013", 160, "BAT-AP-13", "2028-08-10", 25.00),
            ("MED-014", 45,  "BAT-AP-14", "2028-01-20", 145.00),
            ("MED-015", 35,  "BAT-AP-15", "2027-12-15", 295.00),
            ("MED-016", 85,  "BAT-AP-16", "2028-04-30", 135.00),
            ("MED-017", 90,  "BAT-AP-17", "2028-07-15", 155.00),
            ("MED-018", 100, "BAT-AP-18", "2028-02-28", 38.00),
            ("MED-019", 60,  "BAT-AP-19", "2027-10-31", 115.00),
            ("MED-028", 70,  "BAT-AP-20", "2028-09-30", 110.00),
            ("MED-029", 85,  "BAT-AP-21", "2028-03-15", 115.00),
            ("MED-030", 140, "BAT-AP-22", "2028-11-20", 110.00),
            ("MED-031", 190, "BAT-AP-23", "2028-10-10", 24.00),
            ("MED-032", 80,  "BAT-AP-24", "2028-05-25", 52.00)
        ],
        "PH-002": [
            ("MED-001", 115, "BAT-SJ-01", "2028-11-30", 30.50),
            ("MED-002", 140, "BAT-SJ-02", "2028-05-15", 18.00),
            ("MED-003", 80,  "BAT-SJ-03", "2027-10-25", 85.00),
            ("MED-004", 55,  "BAT-SJ-04", "2027-09-10", 120.00),
            ("MED-005", 90,  "BAT-SJ-05", "2028-03-15", 145.00),
            ("MED-006", 95,  "BAT-SJ-06", "2027-11-15", 42.00),
            ("MED-007", 60,  "BAT-SJ-07", "2028-01-30", 95.00),
            ("MED-008", 180, "BAT-SJ-08", "2028-07-20", 22.00),
            ("MED-009", 85,  "BAT-SJ-09", "2027-12-10", 75.00),
            ("MED-011", 110, "BAT-SJ-10", "2028-04-20", 45.00),
            ("MED-012", 45,  "BAT-SJ-11", "2027-10-15", 185.00),
            ("MED-013", 150, "BAT-SJ-12", "2028-09-01", 25.00),
            ("MED-014", 40,  "BAT-SJ-13", "2028-02-15", 145.00),
            ("MED-016", 75,  "BAT-SJ-14", "2028-06-10", 135.00),
            ("MED-017", 85,  "BAT-SJ-15", "2028-08-05", 155.00),
            ("MED-024", 50,  "BAT-SJ-16", "2028-03-30", 32.00),
            ("MED-028", 65,  "BAT-SJ-17", "2028-06-15", 110.00),
            ("MED-029", 95,  "BAT-SJ-18", "2028-04-12", 115.00),
            ("MED-030", 120, "BAT-SJ-19", "2028-10-25", 110.00),
            ("MED-031", 175, "BAT-SJ-20", "2028-11-15", 24.00),
            ("MED-032", 90,  "BAT-SJ-21", "2028-04-18", 52.00)
        ],
        "PH-003": [
            ("MED-001", 130, "BAT-MH-01", "2028-12-15", 30.50),
            ("MED-002", 100, "BAT-MH-02", "2028-07-20", 18.00),
            ("MED-003", 70,  "BAT-MH-03", "2027-12-05", 85.00),
            ("MED-004", 40,  "BAT-MH-04", "2027-11-10", 120.00),
            ("MED-005", 65,  "BAT-MH-05", "2028-02-25", 145.00),
            ("MED-006", 140, "BAT-MH-06", "2028-05-10", 42.00),
            ("MED-007", 110, "BAT-MH-07", "2028-04-15", 95.00),
            ("MED-008", 150, "BAT-MH-08", "2028-08-30", 22.00),
            ("MED-010", 20,  "BAT-MH-09", "2027-09-20", 680.00),
            ("MED-011", 95,  "BAT-MH-10", "2028-03-10", 45.00),
            ("MED-013", 125, "BAT-MH-11", "2028-08-15", 25.00),
            ("MED-014", 55,  "BAT-MH-12", "2028-03-05", 145.00),
            ("MED-015", 40,  "BAT-MH-13", "2028-01-15", 295.00),
            ("MED-016", 60,  "BAT-MH-14", "2028-05-20", 135.00),
            ("MED-018", 120, "BAT-MH-15", "2028-04-30", 38.00),
            ("MED-019", 90,  "BAT-MH-16", "2028-02-20", 115.00),
            ("MED-029", 70,  "BAT-MH-17", "2028-05-18", 115.00),
            ("MED-030", 105, "BAT-MH-18", "2028-09-10", 110.00),
            ("MED-031", 160, "BAT-MH-19", "2028-12-01", 24.00),
            ("MED-032", 70,  "BAT-MH-20", "2028-06-15", 52.00)
        ],
        "PH-004": [
            ("MED-001", 160, "BAT-LL-01", "2028-12-31", 30.50),
            ("MED-002", 130, "BAT-LL-02", "2028-08-15", 18.00),
            ("MED-003", 90,  "BAT-LL-03", "2028-01-20", 85.00),
            ("MED-004", 70,  "BAT-LL-04", "2027-11-20", 120.00),
            ("MED-005", 85,  "BAT-LL-05", "2028-05-12", 145.00),
            ("MED-008", 220, "BAT-LL-06", "2028-09-30", 22.00),
            ("MED-009", 95,  "BAT-LL-07", "2028-02-10", 75.00),
            ("MED-011", 140, "BAT-LL-08", "2028-06-15", 45.00),
            ("MED-012", 60,  "BAT-LL-09", "2027-12-10", 185.00),
            ("MED-013", 170, "BAT-LL-10", "2028-10-15", 25.00),
            ("MED-014", 65,  "BAT-LL-11", "2028-04-10", 145.00),
            ("MED-015", 45,  "BAT-LL-12", "2028-02-18", 295.00),
            ("MED-016", 80,  "BAT-LL-13", "2028-07-25", 135.00),
            ("MED-020", 50,  "BAT-LL-14", "2028-12-31", 52.00),
            ("MED-024", 60,  "BAT-LL-15", "2028-05-20", 32.00),
            ("MED-025", 55,  "BAT-LL-16", "2028-04-15", 28.00),
            ("MED-027", 30,  "BAT-LL-17", "2028-03-31", 65.00),
            ("MED-028", 90,  "BAT-LL-18", "2028-08-20", 110.00),
            ("MED-029", 110, "BAT-LL-19", "2028-06-05", 115.00),
            ("MED-030", 130, "BAT-LL-20", "2028-11-15", 110.00),
            ("MED-031", 200, "BAT-LL-21", "2028-12-20", 24.00),
            ("MED-032", 95,  "BAT-LL-22", "2028-07-10", 52.00)
        ],
        "PH-005": [
            ("MED-001", 125, "BAT-WP-01", "2028-11-20", 30.50),
            ("MED-002", 90,  "BAT-WP-02", "2028-06-10", 18.00),
            ("MED-003", 75,  "BAT-WP-03", "2027-11-30", 85.00),
            ("MED-004", 50,  "BAT-WP-04", "2027-10-15", 120.00),
            ("MED-005", 70,  "BAT-WP-05", "2028-03-25", 145.00),
            ("MED-007", 80,  "BAT-WP-06", "2028-04-10", 95.00),
            ("MED-008", 160, "BAT-WP-07", "2028-08-15", 22.00),
            ("MED-009", 75,  "BAT-WP-08", "2027-12-20", 75.00),
            ("MED-011", 105, "BAT-WP-09", "2028-05-18", 45.00),
            ("MED-013", 130, "BAT-WP-10", "2028-09-10", 25.00),
            ("MED-014", 50,  "BAT-WP-11", "2028-03-12", 145.00),
            ("MED-015", 35,  "BAT-WP-12", "2028-01-20", 295.00),
            ("MED-017", 95,  "BAT-WP-13", "2028-07-30", 155.00),
            ("MED-018", 85,  "BAT-WP-14", "2028-05-05", 38.00),
            ("MED-019", 75,  "BAT-WP-15", "2028-03-15", 115.00),
            ("MED-020", 40,  "BAT-WP-16", "2028-10-31", 52.00),
            ("MED-028", 120, "BAT-WP-17", "2028-09-25", 110.00),
            ("MED-029", 80,  "BAT-WP-18", "2028-04-20", 115.00),
            ("MED-030", 110, "BAT-WP-19", "2028-10-18", 110.00),
            ("MED-031", 180, "BAT-WP-20", "2028-11-30", 24.00),
            ("MED-032", 85,  "BAT-WP-21", "2028-06-25", 52.00)
        ]
    }

    # 5. Inventory datasets for EACH Hospital & Trauma Center
    hospital_inventories = {
        "HOSP-001": [
            ("MED-001", 220, "BAT-CVH-01", "2028-12-31", 30.50),
            ("MED-002", 180, "BAT-CVH-02", "2028-08-30", 18.00),
            ("MED-004", 95,  "BAT-CVH-03", "2028-02-15", 120.00),
            ("MED-008", 300, "BAT-CVH-04", "2028-10-20", 22.00),
            ("MED-009", 140, "BAT-CVH-05", "2028-04-10", 75.00),
            ("MED-011", 170, "BAT-CVH-06", "2028-07-15", 45.00),
            ("MED-012", 85,  "BAT-CVH-07", "2027-12-30", 185.00),
            ("MED-014", 75,  "BAT-CVH-08", "2028-05-10", 145.00),
            ("MED-016", 110, "BAT-CVH-09", "2028-06-20", 135.00),
            ("MED-020", 150, "BAT-CVH-10", "2028-12-31", 52.00),
            ("MED-021", 120, "BAT-CVH-11", "2028-11-30", 56.00),
            ("MED-022", 140, "BAT-CVH-12", "2028-12-15", 65.00),
            ("MED-023", 110, "BAT-CVH-13", "2028-09-30", 78.00),
            ("MED-024", 130, "BAT-CVH-14", "2028-06-15", 32.00),
            ("MED-025", 125, "BAT-CVH-15", "2028-05-20", 28.00),
            ("MED-026", 80,  "BAT-CVH-16", "2028-04-10", 48.00),
            ("MED-027", 65,  "BAT-CVH-17", "2028-03-31", 65.00),
            ("MED-028", 160, "BAT-CVH-18", "2028-10-15", 110.00),
            ("MED-030", 150, "BAT-CVH-19", "2028-11-20", 110.00),
            ("MED-031", 250, "BAT-CVH-20", "2028-12-25", 24.00),
            ("MED-032", 110, "BAT-CVH-21", "2028-07-30", 52.00)
        ],
        "HOSP-002": [
            ("MED-001", 150, "BAT-SHR-01", "2028-12-15", 30.50),
            ("MED-003", 95,  "BAT-SHR-02", "2028-03-20", 85.00),
            ("MED-006", 120, "BAT-SHR-03", "2028-04-15", 42.00),
            ("MED-007", 100, "BAT-SHR-04", "2028-06-10", 95.00),
            ("MED-010", 35,  "BAT-SHR-05", "2027-10-30", 680.00),
            ("MED-012", 70,  "BAT-SHR-06", "2028-01-25", 185.00),
            ("MED-014", 60,  "BAT-SHR-07", "2028-04-20", 145.00),
            ("MED-015", 45,  "BAT-SHR-08", "2028-02-15", 295.00),
            ("MED-018", 110, "BAT-SHR-09", "2028-05-15", 38.00),
            ("MED-019", 95,  "BAT-SHR-10", "2028-03-30", 115.00),
            ("MED-020", 110, "BAT-SHR-11", "2028-12-31", 52.00),
            ("MED-021", 90,  "BAT-SHR-12", "2028-10-25", 56.00),
            ("MED-022", 100, "BAT-SHR-13", "2028-11-20", 65.00),
            ("MED-023", 95,  "BAT-SHR-14", "2028-08-15", 78.00),
            ("MED-024", 85,  "BAT-SHR-15", "2028-06-10", 32.00),
            ("MED-025", 90,  "BAT-SHR-16", "2028-05-25", 28.00),
            ("MED-026", 75,  "BAT-SHR-17", "2028-03-15", 48.00),
            ("MED-027", 50,  "BAT-SHR-18", "2028-02-28", 65.00),
            ("MED-028", 100, "BAT-SHR-19", "2028-09-10", 110.00),
            ("MED-030", 110, "BAT-SHR-20", "2028-11-10", 110.00),
            ("MED-032", 80,  "BAT-SHR-21", "2028-07-15", 52.00)
        ],
        "HOSP-003": [
            ("MED-001", 190, "BAT-MLD-01", "2028-11-30", 30.50),
            ("MED-002", 160, "BAT-MLD-02", "2028-06-25", 18.00),
            ("MED-003", 85,  "BAT-MLD-03", "2028-01-15", 85.00),
            ("MED-004", 65,  "BAT-MLD-04", "2027-12-10", 120.00),
            ("MED-005", 80,  "BAT-MLD-05", "2028-04-18", 145.00),
            ("MED-006", 110, "BAT-MLD-06", "2028-03-25", 42.00),
            ("MED-007", 85,  "BAT-MLD-07", "2028-05-15", 95.00),
            ("MED-008", 250, "BAT-MLD-08", "2028-09-15", 22.00),
            ("MED-009", 115, "BAT-MLD-09", "2028-02-20", 75.00),
            ("MED-011", 135, "BAT-MLD-10", "2028-06-10", 45.00),
            ("MED-013", 140, "BAT-MLD-11", "2028-08-25", 25.00),
            ("MED-014", 55,  "BAT-MLD-12", "2028-03-10", 145.00),
            ("MED-016", 75,  "BAT-MLD-13", "2028-07-12", 135.00),
            ("MED-020", 95,  "BAT-MLD-14", "2028-12-15", 52.00),
            ("MED-021", 80,  "BAT-MLD-15", "2028-11-10", 56.00),
            ("MED-024", 75,  "BAT-MLD-16", "2028-05-30", 32.00),
            ("MED-025", 70,  "BAT-MLD-17", "2028-04-20", 28.00),
            ("MED-028", 110, "BAT-MLD-18", "2028-08-20", 110.00),
            ("MED-029", 95,  "BAT-MLD-19", "2028-05-05", 115.00),
            ("MED-030", 140, "BAT-MLD-20", "2028-10-30", 110.00),
            ("MED-031", 220, "BAT-MLD-21", "2028-12-10", 24.00),
            ("MED-032", 90,  "BAT-MLD-22", "2028-06-20", 52.00)
        ],
        "HOSP-004": [
            ("MED-001", 175, "BAT-VED-01", "2028-12-31", 30.50),
            ("MED-002", 140, "BAT-VED-02", "2028-07-15", 18.00),
            ("MED-004", 75,  "BAT-VED-03", "2028-01-30", 120.00),
            ("MED-008", 240, "BAT-VED-04", "2028-10-10", 22.00),
            ("MED-011", 150, "BAT-VED-05", "2028-06-20", 45.00),
            ("MED-012", 70,  "BAT-VED-06", "2027-11-25", 185.00),
            ("MED-014", 65,  "BAT-VED-07", "2028-04-15", 145.00),
            ("MED-016", 85,  "BAT-VED-08", "2028-07-10", 135.00),
            ("MED-020", 130, "BAT-VED-09", "2028-12-31", 52.00),
            ("MED-021", 100, "BAT-VED-10", "2028-11-20", 56.00),
            ("MED-022", 120, "BAT-VED-11", "2028-12-15", 65.00),
            ("MED-023", 90,  "BAT-VED-12", "2028-08-30", 78.00),
            ("MED-024", 110, "BAT-VED-13", "2028-06-25", 32.00),
            ("MED-025", 95,  "BAT-VED-14", "2028-05-15", 28.00),
            ("MED-026", 70,  "BAT-VED-15", "2028-04-10", 48.00),
            ("MED-027", 55,  "BAT-VED-16", "2028-03-25", 65.00),
            ("MED-028", 140, "BAT-VED-17", "2028-09-30", 110.00),
            ("MED-030", 120, "BAT-VED-18", "2028-11-15", 110.00),
            ("MED-031", 200, "BAT-VED-19", "2028-12-20", 24.00),
            ("MED-032", 85,  "BAT-VED-20", "2028-07-20", 52.00)
        ],
        "HOSP-005": [
            ("MED-001", 160, "BAT-PHI-01", "2028-11-20", 30.50),
            ("MED-002", 150, "BAT-PHI-02", "2028-07-25", 18.00),
            ("MED-003", 75,  "BAT-PHI-03", "2028-02-15", 85.00),
            ("MED-004", 60,  "BAT-PHI-04", "2027-12-10", 120.00),
            ("MED-005", 85,  "BAT-PHI-05", "2028-04-20", 145.00),
            ("MED-008", 220, "BAT-PHI-06", "2028-08-30", 22.00),
            ("MED-009", 100, "BAT-PHI-07", "2028-03-15", 75.00),
            ("MED-011", 120, "BAT-PHI-08", "2028-05-25", 45.00),
            ("MED-012", 65,  "BAT-PHI-09", "2027-11-18", 185.00),
            ("MED-013", 140, "BAT-PHI-10", "2028-09-10", 25.00),
            ("MED-016", 70,  "BAT-PHI-11", "2028-06-15", 135.00),
            ("MED-020", 85,  "BAT-PHI-12", "2028-12-20", 52.00),
            ("MED-021", 75,  "BAT-PHI-13", "2028-10-30", 56.00),
            ("MED-024", 65,  "BAT-PHI-14", "2028-05-10", 32.00),
            ("MED-025", 85,  "BAT-PHI-15", "2028-04-25", 28.00),
            ("MED-028", 95,  "BAT-PHI-16", "2028-09-15", 110.00),
            ("MED-029", 110, "BAT-PHI-17", "2028-06-10", 115.00),
            ("MED-030", 130, "BAT-PHI-18", "2028-11-25", 110.00),
            ("MED-031", 210, "BAT-PHI-19", "2028-12-15", 24.00),
            ("MED-032", 115, "BAT-PHI-20", "2028-08-05", 52.00)
        ]
    }

    # Upsert all pharmacy inventories
    for p_id, items in pharmacy_inventories.items():
        for med_id, stock, batch, exp, mrp in items:
            cursor.execute("SELECT id FROM inventory WHERE pharmacy_id = ? AND med_id = ?", (p_id, med_id))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                    UPDATE inventory 
                    SET stock = ?, batch = ?, expiry = ?, mrp = ?
                    WHERE id = ?
                """, (stock, batch, exp, mrp, row[0]))
            else:
                cursor.execute("""
                    INSERT INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (p_id, med_id, stock, batch, exp, mrp))

    # Upsert all hospital inventories
    for h_id, items in hospital_inventories.items():
        for med_id, stock, batch, exp, mrp in items:
            cursor.execute("SELECT id FROM inventory WHERE pharmacy_id = ? AND med_id = ?", (h_id, med_id))
            row = cursor.fetchone()
            if row:
                cursor.execute("""
                    UPDATE inventory 
                    SET stock = ?, batch = ?, expiry = ?, mrp = ?
                    WHERE id = ?
                """, (stock, batch, exp, mrp, row[0]))
            else:
                cursor.execute("""
                    INSERT INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (h_id, med_id, stock, batch, exp, mrp))

    # Also ensure any other registered pharmacy in the database has at least 15 medicines
    cursor.execute("SELECT id FROM pharmacies WHERE id NOT IN ('PH-001','PH-002','PH-003','PH-004','PH-005')")
    other_pharmacies = cursor.fetchall()
    for (other_pid,) in other_pharmacies:
        cursor.execute("SELECT COUNT(*) FROM inventory WHERE pharmacy_id = ?", (other_pid,))
        if cursor.fetchone()[0] < 10:
            for idx, m in enumerate(MASTER_MEDICINES[:18]):
                cursor.execute("""
                    INSERT OR IGNORE INTO inventory (pharmacy_id, med_id, stock, batch, expiry, mrp)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (other_pid, m[0], random.randint(50, 110), f"BAT-{other_pid[:6]}-{idx+1:02d}", "2028-12-31", m[5]))

    conn.commit()


if __name__ == "__main__":
    init_db()
    print("Database initialized successfully with complete medicines catalog and inventory for all pharmacies & hospitals.")

