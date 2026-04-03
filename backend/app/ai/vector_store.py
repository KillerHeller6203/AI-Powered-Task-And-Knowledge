import faiss
import numpy as np
import json
import os
import logging
from typing import List, Tuple, Optional
from .embeddings import SemanticEmbedder

logger = logging.getLogger(__name__)

CHUNK_SIZE = 512    # words per chunk
CHUNK_OVERLAP = 64  # words shared between adjacent chunks
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2 output dimension


def _base_path(store_path: str) -> str:
    """Strip .pkl extension (legacy) and return clean base path."""
    return store_path.rstrip("/").replace(".pkl", "")


class VectorStore:
    """
    FAISS IndexFlatIP vector store.
    Metadata (doc_id, title, chunk_text) is stored in a parallel list
    that stays in sync with the FAISS index row order.
    """

    def __init__(self, store_path: Optional[str] = None):
        self.store_path = store_path
        self.embedder = SemanticEmbedder()
        self.index: faiss.Index = faiss.IndexFlatIP(EMBEDDING_DIM)
        self.metadata: List[dict] = []  # [{doc_id, title, chunk_text}, ...]
        self._load()

    # ------------------------------------------------------------------ paths
    def _faiss_file(self) -> Optional[str]:
        if self.store_path:
            return f"{_base_path(self.store_path)}.faiss"
        return None

    def _meta_file(self) -> Optional[str]:
        if self.store_path:
            return f"{_base_path(self.store_path)}_meta.json"
        return None

    # ----------------------------------------------------------------- load/save
    def _load(self) -> None:
        ff, mf = self._faiss_file(), self._meta_file()
        if ff and mf and os.path.exists(ff) and os.path.exists(mf):
            try:
                self.index = faiss.read_index(ff)
                with open(mf, "r", encoding="utf-8") as f:
                    self.metadata = json.load(f)
                logger.info(
                    "Loaded FAISS index: %d vectors, %d chunks",
                    self.index.ntotal, len(self.metadata),
                )
            except Exception as exc:
                logger.error("Failed to load FAISS store: %s", exc)
                self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
                self.metadata = []

    def _save(self) -> None:
        ff, mf = self._faiss_file(), self._meta_file()
        if ff:
            try:
                faiss.write_index(self.index, ff)
                with open(mf, "w", encoding="utf-8") as f:
                    json.dump(self.metadata, f)
            except Exception as exc:
                logger.error("Failed to save FAISS store: %s", exc)

    # -------------------------------------------------------------- chunking
    @staticmethod
    def _chunk_text(text: str) -> List[str]:
        words = text.split()
        if not words:
            return [text]
        chunks = []
        i = 0
        while i < len(words):
            chunk_words = words[i: i + CHUNK_SIZE]
            chunks.append(" ".join(chunk_words))
            if i + CHUNK_SIZE >= len(words):
                break
            i += CHUNK_SIZE - CHUNK_OVERLAP
        return chunks or [text]

    # ----------------------------------------------------------- public API
    def add_document(self, doc_id: int, title: str, content: str) -> None:
        """Index a document (re-indexes if it already exists)."""
        self.remove_document(doc_id)

        chunks = self._chunk_text(content)
        if not chunks:
            return

        embeddings = self.embedder.encode(chunks).astype("float32")
        self.index.add(embeddings)

        for chunk_text in chunks:
            self.metadata.append({
                "doc_id": doc_id,
                "title": title,
                "chunk_text": chunk_text,
            })

        self._save()
        logger.info("Indexed doc %d → %d chunks", doc_id, len(chunks))

    def remove_document(self, doc_id: int) -> None:
        """Remove all chunks for a document and rebuild the index."""
        keep = [i for i, m in enumerate(self.metadata) if m["doc_id"] != doc_id]
        if len(keep) == len(self.metadata):
            return  # nothing to remove

        if not keep:
            self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
            self.metadata = []
        else:
            new_meta = [self.metadata[i] for i in keep]
            texts = [m["chunk_text"] for m in new_meta]
            embeddings = self.embedder.encode(texts).astype("float32")
            self.index = faiss.IndexFlatIP(EMBEDDING_DIM)
            self.index.add(embeddings)
            self.metadata = new_meta

        self._save()
        logger.info("Removed doc %d from vector store", doc_id)

    def search(self, query: str, top_k: int = 5) -> List[Tuple[int, str, float, str]]:
        """
        Return [(doc_id, title, score, chunk_excerpt), ...] sorted by score desc.
        Deduplicates by doc_id, keeping the highest-scoring chunk per document.
        """
        if self.index.ntotal == 0:
            return []

        query_vec = self.embedder.encode_single(query).reshape(1, -1).astype("float32")
        k = min(top_k * 5, self.index.ntotal)
        scores, indices = self.index.search(query_vec, k)

        best: dict[int, Tuple[float, dict]] = {}
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0:
                continue
            meta = self.metadata[idx]
            doc_id = meta["doc_id"]
            if doc_id not in best or score > best[doc_id][0]:
                best[doc_id] = (float(score), meta)

        results = []
        for doc_id, (score, meta) in sorted(best.items(), key=lambda x: -x[1][0])[:top_k]:
            if score < 0.01:
                continue
            excerpt = meta["chunk_text"][:500]
            results.append((doc_id, meta["title"], score, excerpt))

        return results

    # ----------------------------------------------------------- properties
    @property
    def document_count(self) -> int:
        return len({m["doc_id"] for m in self.metadata})

    @property
    def chunk_count(self) -> int:
        return len(self.metadata)


_vector_store: Optional[VectorStore] = None


def get_vector_store(store_path: Optional[str] = None) -> VectorStore:
    global _vector_store
    if _vector_store is None:
        _vector_store = VectorStore(store_path)
    return _vector_store
