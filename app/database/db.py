"""
Database connection utilities.

This module centralizes database connection logic so that other parts of
the application can import a single `get_connection` helper.
"""

import psycopg2


def get_connection():
    """
    Return a new PostgreSQL connection.

    NOTE: These credentials are currently hard-coded because this mirrors
    the existing project behavior. For production use, you should move
    them into environment variables or a secure configuration store.
    """
    return psycopg2.connect(
        dbname="jobs_db",
        user="postgres",
        password="202211217nour",
        host="localhost",
        port="5432",
    )

