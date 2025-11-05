# 🚀 Backend Startup Guide

## Your backend should have these endpoints:

- `POST /session/create` - Create Watson session
- `POST /chat` - Send messages (handles Watson follow-ups)
- `POST /upload` - Upload documents
- `GET /status` - Check system status
- `POST /clear` - Clear session

## Quick Start Commands:

### Option 1: Using DevTunnel (Current Setup)

```bash
# Navigate to your FastAPI backend folder
cd path\to\your\fastapi-backend

# Activate virtual environment (if you have one)
.\venv\Scripts\Activate.ps1

# Start FastAPI server
python -m uvicorn main:app --reload --port 8000

# In another terminal, create DevTunnel
devtunnel create --allow-anonymous
devtunnel port create 8000
devtunnel host
```

### Option 2: Local Development

```bash
# Navigate to backend
cd path\to\your\fastapi-backend

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Start server
python -m uvicorn main:app --reload --port 8000
```

Then update `.env.local` in your Next.js project:

```
BACKEND_URL=http://localhost:8000
```

## 🔍 Check if Backend is Running:

Open PowerShell and test:

```powershell
# Test local backend
curl http://localhost:8000/status

# Test DevTunnel backend
curl https://xm2jmtrf-8000.inc1.devtunnels.ms/status
```

## 📋 Backend Should Return (from your Streamlit code):

### `/session/create` Response:

```json
{
  "session_id": "uuid-here",
  "watson_session_id": "watson-session-id",
  "welcome_message": "Welcome message from Watson"
}
```

### `/chat` Response:

```json
{
  "watson_stage": {
    "response": "Watson's response",
    "follow_ups": ["Question 1?", "Question 2?"],
    "intents": [...],
    "entities": [...],
    "actions": [...],
    "is_goodbye": false,
    "has_actions": true
  },
  "detailed_answer": "Detailed legal answer from Granite",
  "simplified_answer": "Simplified explanation",
  "sources": [...]
}
```

## ⚠️ Current Issue:

Your DevTunnel `https://xm2jmtrf-8000.inc1.devtunnels.ms` is not responding.

### Solutions:

1. **Start your backend** using commands above
2. **Restart DevTunnel** if using remote access
3. **Update BACKEND_URL** if changed to localhost
