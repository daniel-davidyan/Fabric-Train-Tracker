# 🚂 Train Tracker

A client-side web application to track Azure DevOps Pull Request deployment status across Fabric environments (trains).

## 📋 Overview

Train Tracker allows you to:
- Input an Azure DevOps PR URL and PAT token
- View PR details and commits
- Track deployment progress across Fabric train environments:
  - Daily → DXT → MSIT → Canary1 → Canary2 → PROD → ROW → Sovereign

## 🏗️ Architecture

```
┌─────────────────┐                    ┌─────────────────┐
│   React App     │ ──── fetch() ────▶ │   Azure DevOps  │
│   (Browser)     │ ◀────────────────  │   REST APIs     │
└─────────────────┘                    └─────────────────┘
```

**Why Client-Only?**
- ✅ No server needed - runs entirely in the browser
- ✅ PAT is used directly with Azure DevOps APIs (no middleware)
- ✅ Real-time data - no caching or storage
- ✅ Simple deployment - just static files

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or pnpm

### Installation

```bash
cd client
npm install
```

### Running the Application

```bash
npm run dev
```

Open your browser to http://localhost:5173

### Build for Production

```bash
npm run build
```

The built files will be in `client/dist/` - can be served from any static file server.

## 📖 Usage

1. **Enter your PR URL** in the format:
   - `https://dev.azure.com/{org}/{project}/_git/{repo}/pullrequest/{prId}`
   - Or: `https://{org}.visualstudio.com/{project}/_git/{repo}/pullrequest/{prId}`

2. **Enter your Personal Access Token (PAT)** with the following scopes:
   - `vso.code` - Read code and PR information
   - `vso.build` - Read build information
   - `vso.release` - Read release/deployment information

3. **Click "Check Deployment Status"** to see where your code has reached

## 🔌 APIs Used

### Azure DevOps REST APIs (v7.1)

| API | Purpose |
|-----|---------|
| `GET /_apis/git/repositories/{repo}/pullRequests/{prId}` | Get PR details |
| `GET /_apis/git/repositories/{repo}/pullRequests/{prId}/commits` | Get PR commits |
| `GET /_apis/build/builds` | List builds for branch |
| `GET /vsrm/_apis/release/deployments` | List classic release deployments |

## 🔒 Security

- PAT tokens are **never stored** - used only in memory for API calls
- PAT is sent directly to Azure DevOps APIs via HTTPS
- No server-side processing or logging
- All data is fetched in real-time

## 📁 Project Structure

```
Train-Tracker/
├── client/                 # React Frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   │   ├── PRInput.tsx        # Input form for PR URL & PAT
│   │   │   ├── PRInfo.tsx         # PR details display
│   │   │   ├── DeploymentTable.tsx # Environment status table
│   │   │   └── StatusBadge.tsx    # Status indicator badge
│   │   ├── services/
│   │   │   ├── adoService.ts      # ADO API client
│   │   │   └── urlParser.ts       # PR URL parsing
│   │   ├── types/
│   │   │   └── index.ts           # TypeScript types
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── README.md
```

## 🎨 Tech Stack

- React 18
- TypeScript
- Tailwind CSS
- Vite

## 🔗 Useful Links

- [Azure DevOps REST API Documentation](https://learn.microsoft.com/en-us/rest/api/azure/devops)
- [Train Schedule Status (aka.ms/pbitrains)](https://aka.ms/pbitrains)
- [Fabric Platform Deployment Dashboard](https://aka.ms/fabricdeployment)

## 🚂 Fabric Train Environments

| Order | Environment | Description |
|-------|-------------|-------------|
| 1 | Daily | Pre-production daily builds |
| 2 | DXT | Developer testing |
| 3 | MSIT | Microsoft internal testing |
| 4 | Canary 1 | First production canary |
| 5 | Canary 2 | Second production canary |
| 6 | PROD | Production |
| 7 | ROW | Rest of World |
| 8 | Sovereign | Sovereign clouds |

## 📝 License

Internal Microsoft use only.