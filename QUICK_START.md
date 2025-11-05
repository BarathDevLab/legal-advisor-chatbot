# 🚀 Quick Start Guide

## Prerequisites

- Python 3.9+
- Node.js 18+
- npm or pnpm

## 1. Start the Backend (FastAPI)

```bash
# Navigate to backend directory (or wherever your Python code is)
cd backend

# Install dependencies (if not already installed)
pip install fastapi uvicorn sentence-transformers faiss-cpu \
    langchain langchain-community pypdf ibm-watson \
    ibm-watsonx-ai python-multipart numpy pydantic

# Run the server
python main.py
```

**Expected Output:**

```
🚀 Legal RAG Navigator API v2.0
====================================
Watson Assistant: ✅
LLM Service: ✅
Vector Service: ✅
====================================
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
```

## 2. Verify Backend is Running

Open a new terminal and test:

```bash
# PowerShell
curl http://localhost:8000/status

# Or open in browser
# http://localhost:8000/docs
```

## 3. Start the Frontend (Next.js)

```bash
# In the project root
npm run dev
# Or: pnpm dev
```

**Expected Output:**

```
- ready started server on 0.0.0.0:3000, url: http://localhost:3000
- event compiled client and server successfully in XXX ms
```

## 4. Access the Application

Open your browser and go to:

```
http://localhost:3000/home
```

## 5. Test the Chat Flow

### Test 1: Simple Greeting

1. Type: `Hello`
2. **Expected:** Watson greeting, no RAG processing
3. **You should see:** Only Watson's response message

### Test 2: Legal Question (Full RAG)

1. First, make sure documents are uploaded (see step 6 below)
2. Type: `What is land tenure?`
3. **Expected:**
   - Watson message: "Let me check the documentation..."
   - "Searching legal documents..." indicator
   - Simplified legal explanation
   - Expandable sources section

### Test 3: Follow-up

1. After the previous answer, type: `Tell me more`
2. **Expected:**
   - Blue banner: "Watson is waiting for your answer..."
   - Watson's follow-up question

### Test 4: Goodbye

1. Type: `Goodbye`
2. **Expected:**
   - Goodbye message
   - "New Chat" button appears
   - Message input disappears

## 6. Upload Documents (Admin Only)

If you see "No documents indexed" error:

1. Go to: `http://localhost:3000/upload`
2. Upload PDF documents (legal documents work best)
3. Wait for success message
4. Go back to chat and try asking questions

## 🔧 Configuration

### Backend Configuration

**File:** `backend/config/settings.py` (if using restructured version)

Or directly in your Python file, update these:

- Watson API Key
- Watson Assistant ID
- Watson Environment ID
- Watsonx.ai API Key
- Watsonx.ai Project ID

### Frontend Configuration

**File:** `.env.local` (create in project root)

```bash
BACKEND_URL=http://localhost:8000
```

## 🐛 Troubleshooting

### Backend Won't Start

**Error:** `ModuleNotFoundError: No module named 'fastapi'`

**Solution:**

```bash
pip install -r requirements.txt
```

### Backend Starts But Crashes

**Error:** Watson Assistant or Watsonx.ai errors

**Solution:**

1. Check credentials in the code
2. Verify API keys are valid
3. Check network connectivity to IBM Cloud

### Frontend Can't Connect to Backend

**Error:** "Failed to connect to backend server"

**Solution:**

1. Verify backend is running: `curl http://localhost:8000/status`
2. Check BACKEND_URL in `.env.local`
3. Check browser console for CORS errors

### No Documents Error

**Error:** "No documents indexed"

**Solution:**

1. Go to `/upload` page
2. Upload PDF documents
3. Wait for indexing to complete
4. Try asking question again

## 📝 Environment Variables

### Backend (Optional - for production)

Create `.env` file in backend directory:

```bash
WATSON_API_KEY=your_key_here
WATSON_ASSISTANT_ID=your_id_here
WATSON_ENVIRONMENT_ID=your_env_id_here
WATSONX_API_KEY=your_key_here
WATSONX_PROJECT_ID=your_project_id_here
```

### Frontend (Optional)

Create `.env.local` in project root:

```bash
BACKEND_URL=http://localhost:8000
# For production: BACKEND_URL=https://your-backend-domain.com
```

## 🎯 Expected Behavior Summary

| User Action            | Watson Response    | Should Generate Answer | Display                       |
| ---------------------- | ------------------ | ---------------------- | ----------------------------- |
| "Hello"                | Greeting           | ❌ No                  | Watson message only           |
| "What is land tenure?" | "Let me check..."  | ✅ Yes                 | Watson + Simplified + Sources |
| "Tell me more"         | Follow-up question | ❌ No                  | Watson question + Blue banner |
| "Goodbye"              | "Goodbye!"         | ❌ No                  | Goodbye + New Chat button     |

## 🚦 Health Checks

### Backend Health

```bash
curl http://localhost:8000/status
```

Should return:

```json
{
  "watson_assistant": true,
  "llm_model": true,
  "simplification_model": true,
  "index_status": {
    "indexed": true,
    "total_chunks": 100,
    "documents": ["doc1.pdf", "doc2.pdf"]
  },
  "active_sessions": 1
}
```

### Frontend Health

Open: `http://localhost:3000/home`

Should:

- ✅ Load without errors
- ✅ Show welcome message
- ✅ Have working input field
- ✅ No red errors in browser console

## 📞 Getting Help

1. Check `CHAT_FLOW_ANALYSIS.md` for detailed flow explanation
2. Check `FRONTEND_FIXES.md` for fixes applied
3. Look at browser console for errors
4. Check backend terminal for errors
5. Verify all dependencies are installed

## 🎉 Success Indicators

You know everything is working when:

1. ✅ Backend shows "✅" for all services on startup
2. ✅ Frontend loads without console errors
3. ✅ Welcome message appears immediately
4. ✅ Simple greetings work (no RAG)
5. ✅ Legal questions trigger full RAG flow
6. ✅ Sources appear and are expandable
7. ✅ Follow-ups are detected
8. ✅ Goodbye ends session properly

---

**Happy Coding! 🚀**
