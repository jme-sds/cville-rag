import os
import logging
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS

logger = logging.getLogger(__name__)

EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "Qwen/Qwen3-Embedding-0.6B")
VECDB_PATH = os.getenv("VECDB_PATH", "/app/index")


class RAGPipeline:
    def __init__(self):
        logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
        self.embeddings = HuggingFaceEmbeddings(
            model_name=EMBEDDING_MODEL,
            # Force float32 — BF16 matmul is not supported on all CPUs (e.g. aarch64
            # without AMX/BF16 extensions) and produces corrupted embeddings.
            model_kwargs={"device": "cpu", "trust_remote_code": True}, #, "torch_dtype": "float32"},
            encode_kwargs={"normalize_embeddings": True},
        )

        logger.info(f"Loading FAISS index from {VECDB_PATH}")
        if not os.path.exists(VECDB_PATH):
            raise FileNotFoundError(f"FAISS index not found at {VECDB_PATH}")

        self.vectorstore = FAISS.load_local(
            VECDB_PATH,
            self.embeddings,
            allow_dangerous_deserialization=True,
        )
        logger.info("RAG pipeline ready")

    def retrieve(self, query: str, k: int = 3) -> list[dict]:
        docs = self.vectorstore.similarity_search(query, k=k)
        return [
            {
                "content": doc.page_content,
                "section": doc.metadata.get("Section", ""),
                "subtitle": doc.metadata.get("Subtitle", ""),
            }
            for doc in docs
        ]
