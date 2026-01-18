# Render Deployment Guide

## ✅ Your backend is Render-ready!

### Steps to Deploy on Render:

#### 1. Create Web Service on Render

- Go to [Render Dashboard](https://dashboard.render.com/)
- Click **"New +"** → **"Web Service"**
- Connect your GitHub repository

#### 2. Configure Service

```yaml
Name: legal-advisor-backend
Environment: Python 3
Region: Choose nearest (e.g., Oregon/Ohio)
Branch: main
Root Directory: backend
Build Command: pip install -r requirements.txt
Start Command: python "bhararth1 (1).py"
```

#### 3. Add Environment Variables

In Render dashboard, add these environment variables:

```
WATSON_API_KEY=dbHbv-pyL4m3-1SFEmex0xa1S9PRJ9q1oq2KlypK03Fq
WATSON_SERVICE_URL=https://api.us-south.assistant.watson.cloud.ibm.com/instances/7389cc4a-cdd3-4d13-bd24-fe858352875a
WATSON_ENVIRONMENT_ID=81585a1e-eb85-43d3-9a51-e8b5ce011ccb
WATSON_ASSISTANT_ID=582532e2-23cb-4303-82ad-e443549a6c34
WATSONX_API_KEY=dbHbv-pyL4m3-1SFEmex0xa1S9PRJ9q1oq2KlypK03Fq
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_PROJECT_ID=e9db3db0-805d-4594-8f76-71b30d1e9f70
MODEL_ID=ibm/granite-3-8b-instruct
```

#### 4. Update Frontend API Routes

After deployment, copy your Render URL (e.g., `https://your-app.onrender.com`)

Update in your Next.js project:

- Create/update `.env.local`:

```
BACKEND_URL=https://your-app.onrender.com
```

#### 5. Important Notes

**Free Tier Limitations:**

- Service spins down after 15 minutes of inactivity
- First request after spin-down takes ~30-60 seconds
- Upgrade to paid tier ($7/month) for always-on

**CORS Configuration:**
The backend already handles CORS automatically with FastAPI.

**File Storage:**

- Render's filesystem is ephemeral
- Uploaded PDFs and FAISS index will reset on each deploy
- Consider using external storage (AWS S3, Cloudinary) for production

**Health Check:**
Render automatically checks your `/` endpoint

### Alternative: Use render.yaml

Create `render.yaml` in your repo root:

```yaml
services:
  - type: web
    name: legal-advisor-backend
    env: python
    region: oregon
    plan: free
    buildCommand: pip install -r backend/requirements.txt
    startCommand: python backend/bhararth1\ \(1\).py
    envVars:
      - key: WATSON_API_KEY
        sync: false
      - key: WATSON_SERVICE_URL
        sync: false
      - key: WATSON_ENVIRONMENT_ID
        sync: false
      - key: WATSON_ASSISTANT_ID
        sync: false
      - key: WATSONX_API_KEY
        sync: false
      - key: WATSONX_URL
        sync: false
      - key: WATSONX_PROJECT_ID
        sync: false
      - key: MODEL_ID
        value: ibm/granite-3-8b-instruct
```

Then you just need to fill in the secret values in Render dashboard.
