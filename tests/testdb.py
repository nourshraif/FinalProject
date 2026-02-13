from app.database.db import get_connection

try:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    print("[OK] Database connected successfully")
    conn.close()
except Exception as e:
    print("[ERROR] Database connection failed")
    print(e)

