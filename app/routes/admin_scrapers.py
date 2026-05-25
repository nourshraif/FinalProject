from fastapi import APIRouter, HTTPException
from typing import Dict, Any, List

from app.models.scraper_source import (
    get_all_scraper_sources,
    create_scraper_source,
    update_scraper_source,
    delete_scraper_source,
)

router = APIRouter(prefix="/api/admin/scrapers", tags=["Admin Scrapers"])


# -----------------------------
# GET ALL SOURCES
# -----------------------------
@router.get("/")
def get_sources():
    return get_all_scraper_sources()


# -----------------------------
# CREATE SOURCE
# -----------------------------
@router.post("/")
def add_source(data: Dict[str, Any]):

    required_fields = ["source_name", "source_key", "base_url", "scraper_type"]

    for field in required_fields:
        if field not in data:
            raise HTTPException(status_code=400, detail=f"Missing field: {field}")

    try:
        source_id = create_scraper_source(data)
        return {"message": "Created successfully", "id": source_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# UPDATE SOURCE
# -----------------------------
@router.put("/{source_id}")
def update_source(source_id: int, data: Dict[str, Any]):

    try:
        updated = update_scraper_source(source_id, data)

        if not updated:
            raise HTTPException(status_code=404, detail="Source not found")

        return {"message": "Updated successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# -----------------------------
# DELETE SOURCE
# -----------------------------
@router.delete("/{source_id}")
def delete_source(source_id: int):

    try:
        deleted = delete_scraper_source(source_id)

        if not deleted:
            raise HTTPException(status_code=404, detail="Source not found")

        return {"message": "Deleted successfully"}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))