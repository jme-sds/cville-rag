import os
import torch
import gradio as gr
import spaces
from transformers import AutoTokenizer, AutoModelForCausalLM, TextIteratorStreamer
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.vectorstores import FAISS
from threading import Thread

HF_TOKEN = os.getenv("HF_TOKEN")

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

# --- CONFIGURATION ---
MODEL_NAME = 'Qwen/Qwen2.5-7B-Instruct'
EMBEDDING_NAME = 'Qwen/Qwen3-Embedding-0.6B'
VECDB_PATH = 'index/' 

# --- GLOBAL INSTANTIATION ---
# This runs once when the container starts.
try:
    rag = MyRAGPipeline(MODEL_NAME, EMBEDDING_NAME, VECDB_PATH)
except Exception as e:
    print(f"Initialization Error: {e}")
    rag = None

# --- ZERO-GPU INFERENCE FUNCTION ---
@spaces.GPU(duration=15)
def chat_function(message, history):
    if rag is None:
        return "System Error: RAG Pipeline failed to initialize."
    
    # 1. Move Model to GPU (Fast operation on ZeroGPU)
    print("Moving model to GPU...")
    rag.model.to("cuda")
    
    # 2. Generate
    response = rag.generate(message)
    
    # 3. (Optional) Move back to CPU to save VRAM? 
    # Usually not needed as ZeroGPU handles cleanup, but good practice if sharing resources.
    # rag.model.to("cpu") 
    
    return response

demo = gr.ChatInterface(
    fn=chat_function, 
    type="messages",
    #title="Charlottesville Municipal RAG Assistant",
    #description="Ask a question about the City of Charlottesville municipal code. This app is intended to increase accessibility to the municipal code and is not a replacement for a legal professional. AI makes mistakes, check important information.",
    fill_width = True,
    examples=[
        "My neighbor is playing loud music on their porch. What time does the 'quiet period' start, and what is the maximum decibel level allowed in a residential zone?",
        "There is a massive oak tree on my property I want to cut down. Do I need permission from the city to remove it?",
        "I got a parking ticket near the Downtown Mall. What is the deadline to pay the fine, and how do I contest it if I think it was issued in error?",
        "I want to build a privacy fence in my backyard. How tall can it be before I need a permit, and are there different rules for the front yard versus the back yard?",
        "I found a deer in my backyard. Can I keep it as a pet if I put a leash on it?",
        "I'm having trouble catching fish in the Rivanna River. Is it legal to use explosives to help catch them?",
        "Can I legally attach a flamethrower to my car to melt the snow on my driveway?",
        "Is it legal for me to practice my bagpipes on the sidewalk at 2:00 AM if I'm technically walking and not 'loitering'?"]
)

if __name__ == "__main__":
    demo.launch()
