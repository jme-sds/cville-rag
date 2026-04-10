# Charlottesville Local Ordinance Assistant

A RAG-powered chatbot that answers questions about the Charlottesville, VA municipal code in plain English. Built with a FastAPI retrieval backend, a Next.js chat frontend, and inference via the OpenRouter API.

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Architecture](#2-architecture)
3. [Data](#3-data)
4. [Methodology](#4-methodology)
5. [Evaluation](#5-evaluation)
6. [Deployment](#6-deployment)
7. [Limitations](#7-limitations)

---

## 1. Introduction

Local laws are often written in dense legal terminology that the average person struggles to interpret, turning simple questions about parking or zoning into a maze of irrelevant sections and complex jargon. While current Large Language Models (LLMs) have seen municipal codes, they are trained on codes from across the country, leading to generalized answers that may blend details from different jurisdictions and hallucinate non-existent regulations.

To solve this, I developed the **Charlottesville Local Ordinance Assistant**, a system designed specifically to answer questions about Charlottesville, VA municipal code in plain English. It uses a Retrieval-Augmented Generation (RAG) pipeline to ensure legal accuracy by retrieving up-to-date ordinances, coupled with a system prompt designed to translate legal language into clear, accessible language without computationally expensive fine-tuning.

---

## 2. Architecture

```
Browser → Next.js frontend (port 3000)
              │
              ├─ /api/chat (Next.js API route)
              │       │
              │       ├─ POST /retrieve → FastAPI backend (internal)
              │       │       └─ FAISS similarity search (CPU)
              │       │               └─ Qwen3-Embedding-0.6B
              │       │
              │       └─ streamText → OpenRouter API
              │                       └─ Qwen2.5-7B-Instruct
```

| Component | Technology |
|---|---|
| Chat UI | Next.js 15, Vercel AI SDK, Tailwind CSS |
| Retrieval API | Python FastAPI |
| Embedding model | Qwen3-Embedding-0.6B (CPU, float32) |
| Vector store | FAISS (CPU) |
| LLM inference | OpenRouter → Qwen2.5-7B-Instruct |
| Containerization | Docker Compose |
| CI/CD | GitHub Actions → GHCR (amd64 + arm64) |

---

## 3. Data

The knowledge base consists of the unedited Charlottesville Municipal Code text, scraped and pre-processed from [Municode](https://library.municode.com/va/charlottesville/codes/code_of_ordinances). Chunks were not rephrased, ensuring the retrieval mechanism pulls the exact letter of the law.

To evaluate the pipeline, a question-answer dataset was generated from the original sections of the municipal code to validate retrieval accuracy. That dataset is published at [jme-datasci/charlottesville_qa](https://huggingface.co/datasets/jme-datasci/charlottesville_qa/tree/main).

---

## 4. Methodology

Dense retrieval with **Qwen3-Embedding-0.6B** was selected for its high retrieval precision relative to its size, well-suited to the relatively small municipal code corpus. The top-3 retrieved chunks (by cosine similarity) are injected into the system prompt sent to the generation model.

The generation model (**Qwen2.5-7B-Instruct** via OpenRouter) uses:
- `max_tokens`: 500
- `temperature`: 0.7
- A system prompt instructing it to answer only from the provided context, cite section numbers, and use plain English

---

## 5. Evaluation

### Benchmark Results

Evaluated against [LegalBench-RAG](https://github.com/hazyresearch/legalbench), [RAGBench](https://arxiv.org/abs/2306.16092), and a custom Charlottesville dataset. **meta-llama/Llama-3.1-8B** was used as the judge model across seven metrics.

|           **Benchmark** |           | **LegalBench-RAG** |             |           | **Charlottesville Municipal Code** |             |           | **RAGBench** |             |
|------------------------:|:---------:|:------------------:|:-----------:|:---------:|:----------------------------------:|:-----------:|:---------:|:------------:|:-----------:|
|               **Model** |  **Qwen** |      **Llama**     | **Mistral** |  **Qwen** |              **Llama**             | **Mistral** |  **Qwen** |   **Llama**  | **Mistral** |
|   **Context Relevance** |   87.14   |      **87.27**     |    87.23    |   84.54   |              **84.65**             |    84.54    | **22.47** |     22.14    |    22.00    |
|      **Context Recall** | **72.31** |        71.85       |    71.92    |   42.74   |              **43.23**             |    42.65    |   20.43   |     20.63    |  **20.79**  |
|     **Chunk Relevance** |   85.62   |      **85.72**     |    85.68    |   75.57   |                75.47               |  **75.60**  | **24.39** |     24.00    |    24.31    |
|         **Faithfulness** | **87.11** |        81.50       |    84.71    | **83.65** |                81.88               |    82.99    | **83.78** |     80.73    |    79.33    |
|    **Answer Relevance** | **92.17** |        88.80       |    91.31    | **88.88** |                87.33               |    87.70    | **86.42** |     79.37    |    85.31    |
|  **Answer Correctness** | **71.15** |        67.94       |    56.24    |   60.73   |              **60.79**             |    60.40    | **25.09** |     16.78    |    20.86    |
| **Answer Completeness** | **89.99** |        87.22       |    88.70    | **86.88** |                83.54               |    83.12    | **85.64** |     80.84    |    82.69    |

Qwen2.5-7B-Instruct was compared against Mistral-7B-Instruct-v0.3 and Llama-3.1-8B-Instruct. All models used the same embedding model so context retrieval metrics are comparable across models. Qwen leads on nearly every generation metric — particularly faithfulness, answer relevance, and answer completeness.

---

## 6. Deployment

### Local development

```bash
# 1. Clone and enter the repo
git clone https://github.com/jme-sds/cville-rag && cd cville-rag

# 2. Configure environment
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY at minimum

# 3. Start services (builds images locally)
docker compose up --build
```

Open `http://localhost:3002`. The backend downloads the embedding model on first start (~600 MB) and caches it in a Docker volume.

### Production (Cloudflare Tunnel)

```bash
# 1. Copy and edit the production compose template
cp compose.yml.example docker-compose.yml
cp .env.example .env
# Edit .env — set OPENROUTER_API_KEY, BACKEND_IMAGE, FRONTEND_IMAGE, DOMAIN

# 2. Pull pre-built images and start
docker compose pull && docker compose up -d
```

Images are published to GHCR for both `linux/amd64` and `linux/arm64` on every push to `main`. Configure your Cloudflare Tunnel to route your domain to `http://localhost:3000`.

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter API key for LLM inference |
| `BACKEND_IMAGE` | Prod only | Full GHCR image path for the backend |
| `FRONTEND_IMAGE` | Prod only | Full GHCR image path for the frontend |
| `DOMAIN` | Prod only | Public domain name (e.g. `assistant.example.com`) |
| `HF_TOKEN` | No | HuggingFace token (only needed for gated models) |
| `DEV_MODE` | No | Set `true` to disable HTTPS redirect enforcement (default: `true`) |

---

## 7. Limitations

- **Hallucinations are reduced, not eliminated** — always verify important legal details with the official [Municode](https://library.municode.com/va/charlottesville/codes/code_of_ordinances) source.
- **Charlottesville only** — the knowledge base is scoped to Charlottesville city ordinances. Queries about Albemarle County or other jurisdictions will produce incorrect results.
- **Terminology** — because the model was not fine-tuned, it may occasionally use dense legal language if the retrieved ordinance is particularly complex.
- **Not legal advice** — this tool is intended to improve accessibility to public information, not to replace a licensed attorney.
