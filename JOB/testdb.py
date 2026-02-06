from db import get_connection

try:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT 1;")
    print("✅ Database connected successfully")
    conn.close()
except Exception as e:
    print("❌ Database connection failed")
    print(e)
