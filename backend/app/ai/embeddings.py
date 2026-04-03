import numpy as np
from typing import List
from sentence_transformers import SentenceTransformer
import logging

logger = logging.getLogger(__name__)


class SemanticEmbedder:
    """
    Embedding model using the pretrained all-MiniLM-L6-v2 sentence transformer.
    No training required — the model is loaded from HuggingFace on first use.
    """

    def __init__(self):
        logger.info("Loading sentence-transformer model: all-MiniLM-L6-v2")
        self.model = SentenceTransformer("all-MiniLM-L6-v2")
        logger.info("Model loaded successfully")

    def encode(self, texts: List[str]) -> np.ndarray:
        """Encode a list of texts into L2-normalized embeddings."""
        embeddings = self.model.encode(
            texts,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return np.array(embeddings, dtype="float32")

    def encode_single(self, text: str) -> np.ndarray:
        """Encode a single text into an L2-normalized embedding."""
        return self.encode([text])[0]

    @property
    def is_fitted(self) -> bool:
        """Always True — model is pretrained and requires no fitting."""
        return True
