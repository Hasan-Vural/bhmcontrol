import sqlite3
import os
from datetime import datetime
from src.config import DATA_RAW

# Define DB Path next to raw data
DB_PATH = os.path.join(DATA_RAW, "company_memory.db")

def get_db_connection():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    # Create the WorkOrders table if it doesn't exist
    conn.execute('''
        CREATE TABLE IF NOT EXISTS WorkOrders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            hata_kodu TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            isg_checks TEXT,
            ekipman TEXT,
            author TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # In case the table already exists from earlier, add the missing columns safely
    try:
        conn.execute('ALTER TABLE WorkOrders ADD COLUMN hata_kodu TEXT NOT NULL DEFAULT "BİLİNMİYOR";')
        conn.execute('ALTER TABLE WorkOrders ADD COLUMN ekipman TEXT DEFAULT "Bilinmiyor";')
    except sqlite3.OperationalError:
        pass # Column might already exist
        
    conn.commit()
    conn.close()

def create_work_order(hata_kodu, title, description, isg_checks, ekipman, author):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO WorkOrders (hata_kodu, title, description, isg_checks, ekipman, author)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (hata_kodu, title, description, isg_checks, ekipman, author))
    conn.commit()
    order_id = cursor.lastrowid
    conn.close()
    return order_id

def get_pending_work_orders():
    conn = get_db_connection()
    orders = conn.execute("SELECT * FROM WorkOrders WHERE status = 'pending'").fetchall()
    conn.close()
    return [dict(ix) for ix in orders]

def approve_work_order(order_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    # Check if exists
    order = cursor.execute("SELECT * FROM WorkOrders WHERE id = ?", (order_id,)).fetchone()
    if not order:
        conn.close()
        return None
        
    # Update status
    cursor.execute("UPDATE WorkOrders SET status = 'approved' WHERE id = ?", (order_id,))
    conn.commit()
    conn.close()
    
    return dict(order)

# Initialize table on import
init_db()
