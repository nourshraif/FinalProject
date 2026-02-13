"""
Embedding service.

This module centralizes creation of embedding models so that they can be
shared across services (e.g., matching) in a single place.

For now it provides a simple factory for the sentence-transformers model
used by the matching service. The matching algorithm itself remains
unchanged.
"""

from functools import lru_cache

from sentence_transformers import SentenceTransformer


@lru_cache(maxsize=1)
def get_skill_embedding_model() -> SentenceTransformer:
    """
    Return a shared SentenceTransformer model instance for skill embeddings.

    Uses LRU caching to avoid re-loading the model repeatedly inside the
    same process.
    """

    return SentenceTransformer("all-MiniLM-L6-v2")

