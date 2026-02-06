import psycopg2

def get_connection():
    return psycopg2.connect(
        dbname="jobs_db",
        user="postgres",
        password="rima@123",
        host="localhost",
        port="5432"
    )
    
