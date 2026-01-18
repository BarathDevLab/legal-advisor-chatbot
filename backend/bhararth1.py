from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import os
import tempfile
from pathlib import Path
from typing import List, Dict, Any, Optional
import numpy as np
import faiss
import shutil
from datetime import datetime
import json
import uuid
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFDirectoryLoader
from ibm_watsonx_ai.foundation_models import Model

app = FastAPI(title="Legal RAG Navigator API - Watson Flow with Processing Detection")

# Watson Assistant integration
try:
    from ibm_watson import AssistantV2
    from ibm_cloud_sdk_core.authenticators import IAMAuthenticator
    WATSON_ASSISTANT_AVAILABLE = True
except ImportError:
    WATSON_ASSISTANT_AVAILABLE = False

# Store active sessions with conversation context
active_sessions = {}

def init_watson_assistant():
    if not WATSON_ASSISTANT_AVAILABLE:
        return None
    
    try:
        authenticator = IAMAuthenticator(os.getenv('WATSON_API_KEY'))
        assistant = AssistantV2(
            version='2021-11-27',
            authenticator=authenticator
        )
        assistant.set_service_url(os.getenv('WATSON_SERVICE_URL'))
        
        environment_id = os.getenv('WATSON_ENVIRONMENT_ID')
        assistant_id = os.getenv('WATSON_ASSISTANT_ID')
        
        return {
            'assistant': assistant, 
            'assistant_id': assistant_id,
            'environment_id': environment_id
        }
    except Exception as e:
        print(f"⚠ Watson Assistant error: {str(e)[:100]}")
        return None

def load_embeddings():
    return SentenceTransformer('all-MiniLM-L6-v2')

def init_llm():
    try:
        model = Model(
            model_id=os.getenv('MODEL_ID', 'ibm/granite-3-8b-instruct'),
            credentials={
                'apikey': os.getenv('WATSONX_API_KEY'), 
                'url': os.getenv('WATSONX_URL')
            },
            project_id=os.getenv('WATSONX_PROJECT_ID'),
            params={
                "max_new_tokens": 500,
                "temperature": 0.7,
                "decoding_method": "greedy"
            }
        )
        return model
    except Exception as e:
        print(f"IBM Watsonx.ai initialization error: {str(e)}")
        return None

def init_simplification_model():
    try:
        model = Model(
            model_id=os.getenv('MODEL_ID', 'ibm/granite-3-8b-instruct'),
            credentials={
                'apikey': os.getenv('WATSONX_API_KEY'), 
                'url': os.getenv('WATSONX_URL')
            },
            project_id=os.getenv('WATSONX_PROJECT_ID'),
            params={
                "max_new_tokens": 400,
                "temperature": 0.5,
                "decoding_method": "greedy"
            }
        )
        return model
    except Exception as e:
        return None

# Initialize models at startup
watson_assistant = init_watson_assistant()
llm_model = init_llm()
simplification_model = init_simplification_model()

def load_or_create_vectorstore():
    if Path("faiss_index").exists() and Path("vector_data.json").exists():
        index = faiss.read_index("faiss_index")
        with open("vector_data.json", "r") as f:
            data = json.load(f)
        return index, data["chunks"], data["metadata"]
    else:
        return None, [], []

# Pydantic models
class SessionCreateRequest(BaseModel):
    user_id: Optional[str] = "sit23cs199@sairamtap.edu.in"

class SessionCreateResponse(BaseModel):
    session_id: str
    watson_session_id: Optional[str] = None
    welcome_message: str

class ChatRequest(BaseModel):
    session_id: str
    question: str
    user_id: Optional[str] = "sit23cs199@sairamtap.edu.in"

class WatsonStage(BaseModel):
    response: str
    follow_ups: List[str]
    intents: List[Dict[str, Any]]
    entities: List[Dict[str, Any]]
    actions: List[Dict[str, Any]]
    is_goodbye: bool
    has_actions: bool
    should_generate_answer: bool

class ChatResponse(BaseModel):
    watson_stage: Optional[WatsonStage] = None
    simplified_answer: Optional[str] = None
    sources: List[Dict[str, Any]]
    timestamp: str
    awaiting_followup: bool
    conversation_context: List[str]

class SessionStatus(BaseModel):
    session_id: str
    watson_session_id: Optional[str]
    awaiting_followup: bool
    conversation_context: List[str]
    message_count: int
    chat_session_started: bool

# API Endpoints

@app.get("/")
async def root():
    """Root endpoint - API information"""
    return JSONResponse({
        "name": "Legal RAG Navigator API",
        "version": "Final",
        "description": "Watson flow with processing detection",
        "endpoints": {
            "POST /session/create": "Create new chat session",
            "POST /chat": "Send message with Watson flow tracking",
            "GET /session/{session_id}/status": "Get session status",
            "GET /chat/history/{session_id}": "Get chat history",
            "DELETE /session/{session_id}": "Delete session",
            "POST /upload": "Upload and index PDFs",
            "GET /status": "System status",
            "DELETE /clear": "Clear document index"
        },
        "docs": "/docs"
    })

@app.post("/upload")
async def upload_documents(files: List[UploadFile] = File(...)):
    """Upload and index PDF documents"""
    try:
        temp_dir = tempfile.mkdtemp()
        uploaded_file_names = []
        
        for file in files:
            if not file.filename.endswith('.pdf'):
                raise HTTPException(status_code=400, detail=f"File {file.filename} is not a PDF")
            
            file_path = os.path.join(temp_dir, file.filename)
            with open(file_path, "wb") as f:
                content = await file.read()
                f.write(content)
            uploaded_file_names.append(file.filename)
        
        loader = PyPDFDirectoryLoader(temp_dir)
        documents = loader.load()
        
        splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
        chunks = splitter.split_documents(documents)
        
        embedder = load_embeddings()
        def embed_text(texts):
            return embedder.encode(texts, convert_to_numpy=True)
        
        embeddings = embed_text([chunk.page_content for chunk in chunks])
        dimension = len(embeddings[0])
        index = faiss.IndexFlatL2(dimension)
        index.add(np.array(embeddings).astype('float32'))
        
        vector_store_data = {
            "chunks": [chunk.page_content for chunk in chunks],
            "metadata": [chunk.metadata for chunk in chunks],
            "embeddings": embeddings.tolist()
        }
        
        faiss.write_index(index, "faiss_index")
        with open("vector_data.json", "w") as f:
            json.dump(vector_store_data, f)
        
        shutil.rmtree(temp_dir)
        
        return JSONResponse({
            "status": "success",
            "message": f"Documents indexed successfully! {len(chunks)} chunks from {len(files)} document(s)",
            "indexed_files": uploaded_file_names,
            "total_chunks": len(chunks)
        })
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error indexing documents: {str(e)}")

@app.post("/session/create", response_model=SessionCreateResponse)
async def create_session(request: SessionCreateRequest):
    """Create a new chat session with Watson Assistant"""
    session_id = str(uuid.uuid4())
    
    watson_session_id = None
    welcome_message = "Welcome to Legal RAG Navigator! 👋 Ask me any question about land tenure laws."
    
    if watson_assistant:
        try:
            session_response = watson_assistant['assistant'].create_session(
                assistant_id=watson_assistant['assistant_id'],
                environment_id=watson_assistant['environment_id']
            ).get_result()
            watson_session_id = session_response['session_id']
            
            # Get welcome message
            response = watson_assistant['assistant'].message(
                assistant_id=watson_assistant['assistant_id'],
                environment_id=watson_assistant['environment_id'],
                session_id=watson_session_id,
                input={'message_type': 'text', 'text': ''},
                user_id=request.user_id
            ).get_result()
            
            if response['output']['generic']:
                welcome_message = response['output']['generic'][0].get('text', welcome_message)
        except Exception as e:
            print(f"Watson session creation error: {e}")
    
    # Store session with conversation tracking
    active_sessions[session_id] = {
        "watson_session_id": watson_session_id,
        "messages": [{
            "role": "assistant",
            "content": welcome_message,
            "timestamp": datetime.now().isoformat()
        }],
        "user_id": request.user_id,
        "created_at": datetime.now().isoformat(),
        "conversation_context": [],
        "awaiting_followup": False,
        "chat_session_started": True
    }
    
    return SessionCreateResponse(
        session_id=session_id,
        watson_session_id=watson_session_id,
        welcome_message=welcome_message
    )

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message with Watson conversation flow tracking and processing detection"""
    
    if request.session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found. Create a session first.")
    
    session_data = active_sessions[request.session_id]
    watson_session_id = session_data.get("watson_session_id")
    
    # Load vector store
    index, chunks, metadata = load_or_create_vectorstore()
    
    if not index:
        raise HTTPException(status_code=400, detail="No documents indexed. Please upload documents first.")
    
    try:
        # Add user message to history
        session_data["messages"].append({
            "role": "user",
            "content": request.question,
            "timestamp": datetime.now().isoformat()
        })
        
        # Embed question and search
        embedder = load_embeddings()
        q_embedding = embedder.encode(request.question).reshape(1, -1)
        distances, indices = index.search(q_embedding, k=3)
        retrieved_chunks = [chunks[i] for i in indices[0]]
        retrieved_meta = [metadata[i] for i in indices[0]]
        context = "\n\n".join(retrieved_chunks)
        
        # Watson Assistant Flow with Processing Detection
        watson_stage_data = None
        watson_response = None
        follow_up_questions = []
        watson_intents = []
        watson_entities = []
        watson_actions = []
        has_actions = False
        is_goodbye = False
        should_generate_answer = False
        
        if watson_assistant and watson_session_id:
            try:
                # Build combined query for follow-ups
                if session_data["awaiting_followup"] and session_data["conversation_context"]:
                    combined_query = " ".join(session_data["conversation_context"]) + " " + request.question
                    clean_question = combined_query.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
                else:
                    clean_question = request.question.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
                    session_data["conversation_context"] = [request.question]
                
                response = watson_assistant['assistant'].message(
                    assistant_id=watson_assistant['assistant_id'],
                    environment_id=watson_assistant['environment_id'],
                    session_id=watson_session_id,
                    input={'message_type': 'text', 'text': clean_question},
                    user_id=request.user_id
                ).get_result()
                
                # Extract Watson responses
                watson_messages = []
                if response['output']['generic']:
                    for item in response['output']['generic']:
                        if item.get('response_type') == 'text':
                            text = item.get('text', '')
                            if text:
                                watson_messages.append(text)
                
                watson_response = "\n\n".join(watson_messages) if watson_messages else "No response"
                follow_up_questions = [msg for msg in watson_messages if '?' in msg]
                
                # Check if Watson is processing/checking (keywords that indicate Watson needs our help)
                processing_keywords = ['checking', 'typing', 'pause', 'documentation', 'searching', 'looking', 'reviewing', 'analyzing']
                should_generate_answer = any(keyword in watson_response.lower() for keyword in processing_keywords)
                
                # Check for goodbye
                if watson_response and "goodbye" in watson_response.lower():
                    is_goodbye = True
                    session_data["awaiting_followup"] = False
                    session_data["conversation_context"] = []
                    
                    # End Watson session
                    try:
                        watson_assistant['assistant'].delete_session(
                            assistant_id=watson_assistant['assistant_id'],
                            environment_id=watson_assistant['environment_id'],
                            session_id=watson_session_id
                        )
                        session_data["watson_session_id"] = None
                    except:
                        pass
                
                # Check for actions
                if 'actions' in response['output'] and response['output']['actions'] and not is_goodbye:
                    watson_actions = response['output']['actions']
                    
                    for action in watson_actions:
                        if action.get('name') == 'session_end' or action.get('type') == 'end_session':
                            is_goodbye = True
                            session_data["awaiting_followup"] = False
                            session_data["conversation_context"] = []
                            
                            try:
                                watson_assistant['assistant'].delete_session(
                                    assistant_id=watson_assistant['assistant_id'],
                                    environment_id=watson_assistant['environment_id'],
                                    session_id=watson_session_id
                                )
                                session_data["watson_session_id"] = None
                            except:
                                pass
                            break
                    
                    if not is_goodbye:
                        has_actions = True
                        if follow_up_questions:
                            session_data["awaiting_followup"] = True
                            if request.question not in session_data["conversation_context"]:
                                session_data["conversation_context"].append(request.question)
                        else:
                            session_data["awaiting_followup"] = False
                else:
                    has_actions = False
                    session_data["awaiting_followup"] = False
                
                if 'intents' in response['output']:
                    watson_intents = response['output']['intents']
                if 'entities' in response['output']:
                    watson_entities = response['output']['entities']
                
                watson_stage_data = WatsonStage(
                    response=watson_response,
                    follow_ups=follow_up_questions,
                    intents=watson_intents,
                    entities=watson_entities,
                    actions=watson_actions,
                    is_goodbye=is_goodbye,
                    has_actions=has_actions,
                    should_generate_answer=should_generate_answer
                )
                
            except Exception as e:
                print(f"Watson error: {e}")
                session_data["watson_session_id"] = None
                session_data["awaiting_followup"] = False
        
        # Only generate simplified answer if Watson is checking/processing (not goodbye, and has keywords)
        simplified_answer = None
        if should_generate_answer and not is_goodbye and llm_model:
            try:
                conversation_history = ""
                for msg in session_data["messages"][-4:]:
                    if msg["role"] == "user":
                        conversation_history += f"User: {msg['content']}\n"
                    elif msg["role"] == "assistant" and "stages" not in msg:
                        conversation_history += f"Assistant: {msg['content']}\n"
                
                prompt_template = """You are explaining legal matters to someone who has never studied law and doesn't understand legal language.

Previous Conversation (for context):
{history}

Context from legal documents: {context}

User's Question: {question}

INSTRUCTIONS:
- Use only simple everyday words (like talking to a family member)
- Explain what each legal term means in normal language
- Tell them exactly what they need to do step by step
- Use "you" and "your" 
- Break into very short sentences
- Imagine explaining to someone who finished 8th grade

SIMPLIFIED EXPLANATION:"""
                
                full_prompt = prompt_template.format(
                    history=conversation_history if conversation_history else "No previous conversation",
                    context=context,
                    question=request.question
                )
                
                # Use simplification model if available, otherwise use main LLM
                simplifier = simplification_model if simplification_model else llm_model
                simplified_answer = simplifier.generate_text(full_prompt)
            except Exception as e:
                print(f"Answer generation error: {e}")
                simplified_answer = None
        
        # Prepare sources (only if answer was generated)
        sources_list = []
        if should_generate_answer and not is_goodbye:
            for i, chunk in enumerate(retrieved_chunks):
                doc_name = Path(retrieved_meta[i].get('source', 'Unknown')).name if 'source' in retrieved_meta[i] else 'Unknown'
                sources_list.append({
                    "source_number": i + 1,
                    "document": doc_name,
                    "page": retrieved_meta[i].get('page', 'N/A'),
                    "content": chunk
                })
        
        # Add assistant message to history
        timestamp = datetime.now().isoformat()
        session_data["messages"].append({
            "role": "assistant",
            "content": watson_response if watson_response else "No response",
            "stages": {
                "watson": watson_stage_data.dict() if watson_stage_data else None,
                "simplified": simplified_answer,
                "sources": sources_list
            },
            "timestamp": timestamp
        })
        
        return ChatResponse(
            watson_stage=watson_stage_data,
            simplified_answer=simplified_answer,
            sources=sources_list,
            timestamp=timestamp,
            awaiting_followup=session_data["awaiting_followup"],
            conversation_context=session_data["conversation_context"]
        )
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error processing question: {str(e)}")

@app.get("/session/{session_id}/status", response_model=SessionStatus)
async def get_session_status(session_id: str):
    """Get session status including conversation flow state"""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = active_sessions[session_id]
    
    return SessionStatus(
        session_id=session_id,
        watson_session_id=session_data.get("watson_session_id"),
        awaiting_followup=session_data.get("awaiting_followup", False),
        conversation_context=session_data.get("conversation_context", []),
        message_count=len(session_data.get("messages", [])),
        chat_session_started=session_data.get("chat_session_started", False)
    )

@app.get("/chat/history/{session_id}")
async def get_chat_history(session_id: str):
    """Get full chat history"""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return JSONResponse({
        "session_id": session_id,
        "messages": active_sessions[session_id]["messages"]
    })

@app.delete("/session/{session_id}")
async def delete_session(session_id: str):
    """Delete a chat session"""
    if session_id not in active_sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    
    session_data = active_sessions[session_id]
    watson_session_id = session_data.get("watson_session_id")
    
    if watson_assistant and watson_session_id:
        try:
            watson_assistant['assistant'].delete_session(
                assistant_id=watson_assistant['assistant_id'],
                environment_id=watson_assistant['environment_id'],
                session_id=watson_session_id
            )
        except:
            pass
    
    del active_sessions[session_id]
    
    return JSONResponse({
        "status": "success",
        "message": "Session deleted successfully"
    })

@app.get("/status")
async def get_status():
    """Get system status"""
    index, chunks, metadata = load_or_create_vectorstore()
    
    unique_docs = set()
    if metadata:
        for meta in metadata:
            if 'source' in meta:
                doc_name = Path(meta['source']).name
                unique_docs.add(doc_name)
    
    return JSONResponse({
        "watson_assistant": watson_assistant is not None,
        "llm_model": llm_model is not None,
        "simplification_model": simplification_model is not None,
        "index_status": {
            "indexed": index is not None,
            "total_chunks": len(chunks) if chunks else 0,
            "documents": sorted(list(unique_docs))
        },
        "active_sessions": len(active_sessions)
    })

@app.delete("/clear")
async def clear_index():
    """Clear the document index"""
    try:
        if Path("faiss_index").exists():
            Path("faiss_index").unlink()
        if Path("vector_data.json").exists():
            Path("vector_data.json").unlink()
        
        return JSONResponse({
            "status": "success",
            "message": "Index cleared successfully"
        })
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error clearing index: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)