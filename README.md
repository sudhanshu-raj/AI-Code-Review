# RevBot - AI Code Review Assistant

Automated code reviews powered by AI. Get instant feedback on pull requests, catch bugs early, and maintain code quality effortlessly.

## Features

-  **Automated PR Analysis** - Reviews code changes automatically on every pull request
-  **Quality Scoring** - Get comprehensive quality scores (0-100) with risk levels
-  **Inline Comments** - Precise feedback directly on specific code lines
-  **Instant Feedback** - Analysis complete in seconds, not hours
-  **Actionable Recommendations** - Clear suggestions to improve code quality

## Tech Stack

**Backend:**
- Node.js + Express
- GitHub App API
- **Cline CLI** (AI code analysis)

**Frontend:**
- React + Vite
- Modern UI with animations

## Setup

### Prerequisites
- Node.js 22+
- GitHub Account
- Cline CLI installed (`npm install -g cline`)

### Installation

1. Clone the repository
```bash
git clone https://github.com/sudhanshu-raj/AI-Code-Review
cd code_reviewer_project
```

2. Install dependencies
```bash
cd backend
npm install

cd ../frontend
npm install
```

3. Configure environment variables
```bash
# backend/.env
PORT=3000
NODE_ENV=development

GITHUB_APP_ID=your_app_id
GITHUB_APP_NAME=your_app_name
GITHUB_PRIVATE_KEY=your_github_private_key
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_WEBHOOK_SECRET=your_webhook_secret
GITHUB_TOKEN=ghp_your_github_token

FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000
```

4. Run locally
```bash
# Terminal 1 - Backend
cd backend
npm run devs

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - Ngrok (for webhooks)
ngrok http 3000 --host-header="localhost:3000"
```

## Usage

1. **Install GitHub App** on your repository
2. **Open a Pull Request** - RevBot automatically triggers
3. **Get Review Results** - Check run + inline comments on your PR


