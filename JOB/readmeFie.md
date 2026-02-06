Job Scraper & Database Inserter

This project scrapes job listings from Python.org and We Work Remotely, and inserts them into a PostgreSQL database. It is designed for educational or academic purposes, but can be extended for multiple websites.

Features

Scrape Python.org jobs (static HTML)

Scrape We Work Remotely jobs (static HTML)

Insert job data into PostgreSQL: job_title, company, location, job_url, and source

Avoid duplicates using ON CONFLICT on job_url

Optional: extendable for other static sites

Project Structure
project/
│
├─ db.py                   # PostgreSQL connection helper
├─ pythonorg_scraper.py     # Scraper for Python.org jobs
├─ weworkremotely_scraper.py # Scraper for We Work Remotely jobs
├─ requirements.txt        # Python dependencies
└─ README.md               # Project documentation

Prerequisites

Python 3.10+

PostgreSQL installed and running

PostgreSQL database and jobs table created

Example jobs table:
CREATE TABLE jobs (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50),
    job_title VARCHAR(255),
    company VARCHAR(255),
    location VARCHAR(255),
    description TEXT,
    job_url TEXT UNIQUE
);

Setup

Clone or download the project.

Create and activate a Python virtual environment:

python -m venv venv
source venv/bin/activate   # Linux / macOS
venv\Scripts\activate      # Windows


Install dependencies:

pip install -r requirements.txt


Update db.py with your PostgreSQL connection credentials:

import psycopg2

def get_connection():
    return psycopg2.connect(
        host="localhost",
        database="your_database",
        user="your_username",
        password="your_password"
    )

Usage
Scrape Python.org jobs:
python pythonorg_scraper.py

Scrape We Work Remotely jobs:
python weworkremotely_scraper.py


Each script prints job titles + links to console

Inserts jobs into the jobs table

Automatically avoids duplicate URLs