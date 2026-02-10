import requests
from bs4 import BeautifulSoup

HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

url = "https://daleel-madani.org/jobs"
response = requests.get(url, headers=HEADERS)
soup = BeautifulSoup(response.text, "html.parser")

print("=" * 80)
print("INSPECTING DALEEL-MADANI.ORG JOBS PAGE")
print("=" * 80)
print(f"\nStatus Code: {response.status_code}")
print(f"Page Title: {soup.title.string if soup.title else 'No title'}\n")

# Look for common job listing patterns
print("Looking for job listings...\n")

# Try to find common patterns
job_containers = [
    soup.select("article"),
    soup.select(".job"),
    soup.select(".job-listing"),
    soup.select(".job-item"),
    soup.select("div[class*='job']"),
    soup.select("li[class*='job']"),
    soup.select("a[href*='job']"),
    soup.select("div.view-content > div"),
    soup.select(".views-row"),
]

for i, containers in enumerate(job_containers):
    if containers:
        print(f"Found {len(containers)} potential job containers using pattern {i+1}")
        if len(containers) > 0:
            print(f"\nFirst container HTML (first 500 chars):")
            print(str(containers[0])[:500])
            print("\n" + "-" * 80)

# Print all links that might be job links
print("\n\nAll links containing 'job' in href:")
job_links = soup.select("a[href*='job']")
print(f"Found {len(job_links)} links")
if job_links:
    for link in job_links[:5]:  # Show first 5
        print(f"  - {link.get('href')}: {link.get_text(strip=True)[:50]}")

# Print page structure
print("\n\nPage structure (main containers):")
main_divs = soup.select("div[class], section[class], article[class]")
print(f"Found {len(main_divs)} divs/sections/articles with classes")
if main_divs:
    classes = set()
    for div in main_divs[:20]:
        if div.get('class'):
            classes.add(' '.join(div.get('class')))
    print("Sample classes found:")
    for cls in list(classes)[:10]:
        print(f"  - .{cls.replace(' ', '.')}")
