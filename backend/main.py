import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from rag import RAGPipeline

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

rag: RAGPipeline | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    global rag
    logger.info("Initializing RAG pipeline…")
    rag = RAGPipeline()
    yield


app = FastAPI(title="Cville RAG API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class RetrieveRequest(BaseModel):
    query: str
    k: int = Field(default=3, ge=1, le=8)


@app.get("/health")
def health():
    return {"status": "ok", "rag_ready": rag is not None}


@app.post("/retrieve")
def retrieve(req: RetrieveRequest):
    if rag is None:
        raise HTTPException(status_code=503, detail="RAG pipeline not initialized")
    documents = rag.retrieve(req.query, k=req.k)
    return {"documents": documents}
