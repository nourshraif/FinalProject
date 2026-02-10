import psycopg2

def get_connection():
    return psycopg2.connect(
        dbname="jobs_db",
        user="postgres",
        password="202211217nour",
        host="localhost",
        port="5432"
    )
    
