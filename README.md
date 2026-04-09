---
title: Cville Assistant
emoji: 💬
colorFrom: yellow
colorTo: purple
sdk: gradio
sdk_version: 5.42.0
app_file: app.py
pinned: false
hf_oauth: true
hf_oauth_scopes:
- inference-api
license: apache-2.0
short_description: RAG Enabled ChatBot for Charlottesville Municipal Code
---

# Charlottesville Local Ordinance Assistant

## 1. Introduction
Local laws are often written in dense legal terminology that the average person struggles to interpret, turning simple questions about parking or zoning into a maze of irrelevant sections and complex jargon. While current Large Language Models (LLMs) like ChatGPT have seen municipal codes, they are trained on codes from across the country, leading to generalized answers that may blend details from different jurisdictions and hallucinate non-existent regulations. To solve this, I developed the **Charlottesville Local Ordinance Assistant**, a system designed specifically to answer questions about Charlottesville, VA municipal code in plain English. This project utilizes a Retrieval-Augmented Generation (RAG) pipeline to ensure legal accuracy by retrieving up-to-date ordinances, coupled with a specific system prompt designed to translate that "legalese" into clear, accessible language without the need for computationally expensive fine-tuning. The results demonstrate that constraining the model to local data and utilizing strong prompt engineering significantly reduces hallucinations compared to off-the-shelf generalist models.

## 2. Data

For the RAG pipeline, the knowledge base consists of the unedited Charlottesville Municipal Code text, scraped and pre-processed from [Municode](https://library.municode.com/va/charlottesville/codes/code_of_ordinances). These chunks were not rephrased, ensuring that the retrieval mechanism pulls the exact letter of the law. To evaluate the RAG pipeline, I utilized a set of questions and answers generated from the original sections of the municipal code to validate retrieval accuracy (checking if the retrieved node matched the ground truth node for a given query). This dataset can be found at [jme-datasci/charlottesville_qa](https://huggingface.co/datasets/jme-datasci/charlottesville_qa/tree/main).

## 3. Methodology

For the RAG methodology, I implemented a dense retrieval system. I selected **Qwen3-Embedding-0.6B** as the embedding model due to the relatively small size of the RAG corpus (municipal code). This model allows for high-precision retrieval without the latency of larger embedding models. The retrieved context is passed to the **Qwen2.5-7B-Instruct** generator to synthesize the final answer.

The generation model uses a maximum token count of 500 for responses where more explanation may be required and a temperature of 0.9 to encourage more factual responses. The embedding model is set to retreive 3 documents from the FAISS index using cosine similarity.

## 4. Evaluation

### Benchmark Results

To strictly evaluate the legal reasoning and retrieval capabilities of the model, I utilized two established benchmarks: [LegalBench-RAG](https://github.com/hazyresearch/legalbench), [RAGBench](https://arxiv.org/abs/2306.16092), and my own custom dataset. I chose these because they specifically target the weaknesses of legal LLMs: the ability to reason over specific documents and the frequency of hallucinations. 

The LegalBench-RAG, RAGBench, and my custom test split were all evaluated using **meta-llama/Llama-3.1-8B** as judge for seven different metrics: 

* **Context Relevance**: Measures the proportion of retrieved information that is actually pertinent to the user's query.
* **Context Recall**: Assesses if the retrieved context contains all the necessary ground-truth information required to answer.
* **Chunk Relevance**: Evaluates the precision of individual retrieved document segments relative to the input query.
* **Faithfulness**: Checks if the generated answer is factually derived solely from the retrieved context (hallucination detection).
* **Answer Relevance**: Determines how well the generated response directly addresses the user's original prompt.
* **Answer Correctness**: Scores the accuracy of the generated answer against a known gold-standard reference.
* **Answer Completeness**: Checks if the response addresses all parts of the query without omitting key details.

|           **Benchmark** |           | **LegalBench-RAG** |             |           | **Charlottesville Municipal Code** |             |           | **RAGBench** |             |
|------------------------:|:---------:|:------------------:|:-----------:|:---------:|:----------------------------------:|:-----------:|:---------:|:------------:|:-----------:|
|               **Model** |  **Qwen** |      **Llama**     | **Mistral** |  **Qwen** |              **Llama**             | **Mistral** |  **Qwen** |   **Llama**  | **Mistral** |
|   **Context Relevance** |   87.14   |      **87.27**     |    87.23    |   84.54   |              **84.65**             |    84.54    | **22.47** |     22.14    |    22.00    |
|      **Context Recall** | **72.31** |        71.85       |    71.92    |   42.74   |              **43.23**             |    42.65    |   20.43   |     20.63    |  **20.79**  |
|     **Chunk Relevance** |   85.62   |      **85.72**     |    85.68    |   75.57   |                75.47               |  **75.60**  | **24.39** |     24.00    |    24.31    |
|       **Faithfullness** | **87.11** |        81.50       |    84.71    | **83.65** |                81.88               |    82.99    | **83.78** |     80.73    |    79.33    |
|    **Answer Relevance** | **92.17** |        88.80       |    91.31    | **88.88** |                87.33               |    87.70    | **86.42** |     79.37    |    85.31    |
|  **Answer Correctness** | **71.15** |        67.94       |    56.24    |   60.73   |              **60.79**             |    60.40    | **25.09** |     16.78    |    20.86    |
| **Answer Completeness** | **89.99** |        87.22       |    88.70    | **86.88** |                83.54               |    83.12    | **85.64** |     80.84    |    82.69    |

I compared my primary model (Qwen2.5-7B-Instruct) against **Mistral-7B-Instruct-v0.3** and **Llama-3.1-8B-Instruct**, two similarly sized instruction tuned generation models. The results in the table above show that all models performed comparatively in the context retrieval tasks, which is expected since they all used the same embedding model, Qwen3-Embedding-0.6B. However, Qwen2.5-7B-Instruct wins in almost every generation-based metric. The 7B Qwen model shows remarkably better resistance to hallucination and ability to answer with more relevance, accuracy and completeness.

## 5. Usage and Intended Uses

The intended use case for this model is to assist residents of Charlottesville, VA, in understanding local ordinances regarding zoning, parking, and noise complaints without needing a legal background. It is **not** a replacement for a lawyer but rather a tool for accessibility.

Below is an example of how the RAG pipeline class is constructed and used to generate responses with retrieval.

```python
import torch
from transformers import AutoTokenizer, AutoModelForCausalLM, pipeline, AutoModel
import faiss as fai
from langchain_community.vectorstores import  FAISS
import os
import numpy as np
import pandas as pd
import random

class MyRAGPipeline:
    def __init__(self, model_name: str, embedding_model_name: str, vector_db_path: str):
        self.embedding_model_name = embedding_model_name
        self.max_new_tokens = 500
        
        print(f"Loading Model: {model_name}...")
        self.tokenizer = AutoTokenizer.from_pretrained(model_name, token=HF_TOKEN)
        
        # --- CRITICAL: Load to CPU first ---
        # ZeroGPU does not have a GPU available during global startup.
        # We load the weights into System RAM now, and move them to GPU later.
        self.model = AutoModelForCausalLM.from_pretrained(
            model_name, 
            device_map="cpu",  # Force CPU loading
            torch_dtype=torch.bfloat16, 
            token=HF_TOKEN
        )
        
        self.tokenizer.pad_token_id = self.tokenizer.eos_token_id
        self.tokenizer.padding_side = "left"
        
        print("Loading Embeddings...")
        self.embedding_model = HuggingFaceEmbeddings(
            model_name=self.embedding_model_name,
            model_kwargs={"device": "cpu"}, # Keep embeddings on CPU
            encode_kwargs={"normalize_embeddings": True},
        )     

        print(f"Loading Vector DB from {vector_db_path}...")
        if not os.path.exists(vector_db_path):
             raise FileNotFoundError(f"Could not find vector DB at {vector_db_path}. Please upload your 'index' folder.")
             
        self.vector_db = FAISS.load_local(vector_db_path, self.embedding_model, allow_dangerous_deserialization=True)
        print("RAG Pipeline Initialized (CPU Mode)")

    def retrieve(self, query, num_docs=3):
        return self.vector_db.similarity_search(query, k=num_docs)

    def _format_prompt(self, query, retrieved_docs):
        # 1. Build Context
        context = "Extracted documents:\n"
        for doc in retrieved_docs:
            section = doc.metadata.get('Section', 'N/A')
            subtitle = doc.metadata.get('Subtitle', 'Context')
            context += f"{section} - {subtitle}:::\n{doc.page_content}\n\n"

        # 2. Universal Chat Template (Works for Qwen, Llama, Mistral, etc.)
        messages = [
            {
                "role": "system",
                "content": f"You are a helpful legal interpreter. Use the following context to answer the user's question.\nContext:\n{context}"
            },
            {
                "role": "system",
                "content": "Using the information contained in the context, give a comprehensive answer to the question. Respond only to the question asked. Your response should be concise and relevant to the question. Always provide the section number and title of the source document. Also please use plain English when responding, not legal jargon. \n Now answer the following question."
            },
            {
                "role": "user",
                "content": query
            }
        ]
        
        # This applies the correct format for WHATEVER model you are using
        prompt = self.tokenizer.apply_chat_template(
            messages, 
            tokenize=False, 
            add_generation_prompt=True
        )
        return prompt

    def generate(self, query, num_docs=3):
        # 1. Retrieve
        retrieved_docs = self.retrieve(query, num_docs)
        
        # 2. Format Prompt
        prompt_str = self._format_prompt(query, retrieved_docs)
        
        # 3. Tokenize
        inputs = self.tokenizer(prompt_str, return_tensors="pt").to(self.model.device)
        
        # 4. Generate (Streaming is simpler for direct model usage, but here we do blocking)
        with torch.no_grad():
            outputs = self.model.generate(
                **inputs,
                max_new_tokens=self.max_new_tokens,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
            
        # 5. Decode
        # Slicing [input_len:] ensures we only return the new text, not the prompt
        input_len = inputs.input_ids.shape[1]
        generated_text = self.tokenizer.decode(outputs[0][input_len:], skip_special_tokens=True)
        
        return generated_text

# --- INITIALIZATION ---
# Using standard paths and models
MODEL_NAME = "Qwen/Qwen2.5-7B-Instruct"
EMBEDDING_NAME = 'Qwen/Qwen3-Embedding-0.6B'
VECDB_PATH = 'index/'

rag = MyRAGPipeline(model_name, embedding_name, vecdb_path)

prompt = "My neighbor is playing loud music on their porch. What time does the 'quiet period' start, and what is the maximum decibel level allowed in a residential zone?"


print(rag.generate(prompt))


```

## Prompt Format

The model relies on a strict system prompt to ensure the output is simplified but factually accurate. The prompt injects the retrieved RAG context directly into the system message.
```
You are a helpful legal interpreter.
        You are given the following context:
        {context}\n\n
        Using the information contained in the context,
        give a comprehensive answer to the question.
        Respond only to the question asked. Your response should be concise and relevant to the question.
        Always provide the section number and title of the source document.
        Also please use plain English when responding, not legal jargon.
        
        Question: {query}"
```

## Expected Output Format

The model is expected to output a plain-English translation of the input text, simplifying sentence structure while retaining critical entities (dates, fines, locations).

```
According to document <Section number>, the Clerk of the Council is responsible for keeping the city's official seal. 
They must stamp this seal on any papers or documents when the Council's laws 
or decisions require it.
```

## Limitations
The primary limitation of this model is that while it reduces hallucinations, it does not eliminate them; users should verify important legal details with the official [Municode](https://library.municode.com/va/charlottesville/codes/code_of_ordinances) source. Additionally, the model is strictly limited to the Charlottesville context; applying it to Albemarle County or other jurisdictions will result in incorrect information. Finally, because the model was not fine-tuned, it may occasionally slip back into dense terminology if the retrieved ordinance is exceptionally complex.
