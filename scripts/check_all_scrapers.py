"""
Comprehensive checker for all scrapers in the Scrapers folder.
Checks for code correctness, interface compliance, and functionality.
"""

import sys
import io
import importlib.util
from pathlib import Path
from typing import List, Dict, Any

# Fix Windows console encoding
if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

# Add the project root to Python path
project_root = Path(__file__).parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from app.services.Scrapers.base_scraper import BaseScraper


def check_scraper_file(file_path: Path) -> Dict[str, Any]:
    """Check a single scraper file for issues."""
    issues = []
    warnings = []
    status = "unknown"
    
    file_name = file_path.name
    class_name = file_path.stem.replace('_', '').title().replace('.py', '') + 'Scraper'
    
    # Read file content
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return {
            'file': file_name,
            'status': 'error',
            'issues': [f"Cannot read file: {e}"],
            'warnings': []
        }
    
    # Check 1: Has correct import
    if 'from .base_scraper import BaseScraper' not in content and 'from app.services.Scrapers.base_scraper import BaseScraper' not in content:
        issues.append("Missing or incorrect BaseScraper import")
    
    # Check 2: Has source_name property
    if '@property' not in content or 'source_name' not in content:
        issues.append("Missing source_name property")
    
    # Check 3: Has scrape method
    if 'def scrape(self)' not in content:
        issues.append("Missing scrape() method")
    
    # Check 4: Returns List[Dict] not int
    if 'return processed' in content or 'return 0' in content or 'return processed' in content:
        issues.append("Returns int instead of List[Dict] - should return list of job dicts")
    
    # Check 5: Uses non-existent methods
    if 'self.save_job(' in content:
        issues.append("Uses self.save_job() which doesn't exist in BaseScraper")
    if 'self.clean_text(' in content:
        issues.append("Uses self.clean_text() which doesn't exist in BaseScraper")
    if 'self.is_valid_company(' in content:
        issues.append("Uses self.is_valid_company() which doesn't exist in BaseScraper")
    if 'self.commit()' in content:
        issues.append("Uses self.commit() which doesn't exist in BaseScraper")
    if 'self.close()' in content:
        issues.append("Uses self.close() which doesn't exist in BaseScraper")
    
    # Check 6: Wrong import style
    if 'from app.services.Scrapers.base_scraper' in content:
        warnings.append("Uses absolute import instead of relative import (from .base_scraper)")
    
    # Check 7: Try to import and instantiate
    try:
        spec = importlib.util.spec_from_file_location(file_path.stem, file_path)
        if spec and spec.loader:
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            
            # Find the scraper class
            scraper_class = None
            for name in dir(module):
                obj = getattr(module, name)
                if (isinstance(obj, type) and 
                    issubclass(obj, BaseScraper) and 
                    obj != BaseScraper):
                    scraper_class = obj
                    break
            
            if scraper_class:
                # Try to instantiate
                try:
                    scraper = scraper_class()
                    
                    # Check source_name
                    try:
                        source_name = scraper.source_name
                        if not isinstance(source_name, str) or not source_name:
                            issues.append("source_name property returns invalid value")
                    except Exception as e:
                        issues.append(f"source_name property error: {e}")
                    
                    # Check scrape method signature
                    import inspect
                    sig = inspect.signature(scraper.scrape)
                    if sig.return_annotation != List[Dict] and 'List' not in str(sig.return_annotation):
                        warnings.append(f"scrape() return type annotation: {sig.return_annotation}")
                    
                except Exception as e:
                    issues.append(f"Cannot instantiate scraper: {e}")
            else:
                issues.append("Cannot find scraper class in file")
        else:
            issues.append("Cannot create module spec")
    except Exception as e:
        issues.append(f"Import error: {e}")
    
    # Determine status
    if len(issues) == 0:
        status = "correct"
    elif len(issues) <= 2:
        status = "needs_fix"
    else:
        status = "broken"
    
    return {
        'file': file_name,
        'status': status,
        'issues': issues,
        'warnings': warnings
    }


def main():
    """Check all scraper files."""
    scrapers_dir = project_root / "app" / "services" / "Scrapers"
    
    print("=" * 70)
    print("🔍 Checking All Scrapers")
    print("=" * 70)
    print()
    
    scraper_files = sorted([f for f in scrapers_dir.glob("*.py") 
                           if f.name != "__init__.py" and f.name != "base_scraper.py" and f.name != "runner.py"])
    
    results = []
    for file_path in scraper_files:
        result = check_scraper_file(file_path)
        results.append(result)
    
    # Print results
    correct = [r for r in results if r['status'] == 'correct']
    needs_fix = [r for r in results if r['status'] == 'needs_fix']
    broken = [r for r in results if r['status'] == 'broken']
    
    print(f"✓ Correct: {len(correct)}/{len(results)}")
    for r in correct:
        print(f"  - {r['file']:30s}")
    
    if needs_fix:
        print(f"\n⚠️  Needs Fix: {len(needs_fix)}/{len(results)}")
        for r in needs_fix:
            print(f"  - {r['file']:30s}")
            for issue in r['issues'][:3]:  # Show first 3 issues
                print(f"    • {issue}")
            if r['warnings']:
                for warn in r['warnings']:
                    print(f"    ⚠ {warn}")
    
    if broken:
        print(f"\n✗ Broken: {len(broken)}/{len(results)}")
        for r in broken:
            print(f"  - {r['file']:30s}")
            for issue in r['issues'][:5]:  # Show first 5 issues
                print(f"    • {issue}")
    
    print()
    print("=" * 70)
    print(f"Summary: {len(correct)} correct, {len(needs_fix)} need fixes, {len(broken)} broken")
    print("=" * 70)
    
    return results


if __name__ == "__main__":
    main()
