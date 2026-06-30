<div align="center">

# 🚨 Awaaz

### AI-Powered Civic Collaboration & Accountability Platform

Transforming traditional civic complaint reporting into a transparent, community-driven civic operations ecosystem powered by **Gemini AI**, **Firebase**, and **real-time collaboration**.

## 🚀 Live Demo

🌐 **Application:** https://awaaz-887788131548.us-west1.run.app

Experience the complete civic issue lifecycle—from AI-assisted issue reporting to community collaboration, evidence-based resolution, and AI-powered truth verification.

---

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?logo=vite)
![Firebase](https://img.shields.io/badge/Firebase-Cloud-orange?logo=firebase)
![Firestore](https://img.shields.io/badge/Firestore-Realtime-orange?logo=firebase)
![Google Cloud](https://img.shields.io/badge/Google%20Cloud-Run-4285F4?logo=googlecloud)
![Gemini](https://img.shields.io/badge/Gemini-AI-blue)
![Express](https://img.shields.io/badge/Express.js-Backend-black?logo=express)
![License](https://img.shields.io/badge/License-MIT-green)

---

*Awaaz bridges the gap between citizens and authorities by combining structured issue reporting, community participation, deterministic governance, and specialized AI agents.*

</div>

---

# 📖 Table of Contents

- Overview
- Motivation
- Key Features
- System Architecture
- User Workflows
- AI Architecture
- Technology Stack
- Project Structure
- Installation
- Environment Variables
- Future Scope
- Contributors
- License

---

# 🌍 Overview

Awaaz is a modern civic collaboration platform that enables citizens to report, discuss, and track public infrastructure issues while providing municipal authorities with AI-assisted operational tools for efficient resolution.

Unlike conventional complaint portals, Awaaz manages the **entire lifecycle** of a civic issue—from reporting and validation to prioritization, evidence-based resolution, AI verification, and structured reopening.

---

## Why Awaaz?

Most civic reporting applications stop after allowing citizens to submit complaints.

Awaaz transforms isolated complaints into a collaborative workflow by combining:

- 🤖 Specialized AI Agents
- 🏘 Community-based discussions
- 📍 Location-aware reporting
- 📊 Deterministic prioritization
- 🛠 Transparent administrative workflows
- ✅ AI-assisted truth verification

---

# ✨ Key Features

## 🤖 AI-Powered Issue Reporting

- Image-based reporting
- GPS & interactive map selection
- AI-generated issue titles
- Automatic categorization
- Severity estimation
- Department recommendation

---

## 📍 Location Intelligence

- Browser GPS
- Interactive Maps
- Reverse Geocoding
- Nearby Issue Discovery

---

## 🔁 Duplicate Detection

Rather than allowing multiple identical complaints,

Awaaz intelligently detects nearby issues.

Users can:

- Support existing issues
- Join discussions
- Submit structured reopen requests

instead of creating duplicates.

---

## 🏘 Community-Based Collaboration

Instead of one giant city feed,

Awaaz organizes issues into

- Residential Societies
- Apartment Complexes
- RWAs
- Locality Groups
- Public Civic Network

Each community has

- private feeds
- dedicated moderation
- localized administration

---

## 📊 Deterministic Priority Engine

Issue priority is calculated using

- Severity
- Age
- Duplicate reports
- Community endorsements
- Verification state
- Reopen history

No AI decides issue priority.

The scoring engine remains completely explainable.

---

## 🛠 Operations Dashboard

Administrators receive

- Dashboard Overview
- Analytics
- Issue Queue
- Filters
- Community Summaries
- Truth Verification
- Resolution Evidence
- Reopen Requests
- PDF Report Generation

---

## 📄 Official Reports

Every issue can generate an official PDF including

- Original report
- Community summary
- Resolution evidence
- Truth verification
- Issue DNA
- Administrative history

---

# 🏗 System Architecture

```text
Citizen
      │
      ▼
Issue Reporting
      │
      ▼
AI Ingestion Agent
      │
      ▼
Duplicate Detection
      │
      ▼
Priority Engine
      │
      ▼
Community Discussion
      │
      ▼
Operations Dashboard
      │
      ▼
Community Agent
      │
      ▼
Resolution Workflow
      │
      ▼
Truth Engine
      │
      ▼
Official Report
```

---

# 🔄 User Workflow

## Citizen

```text
Login
    ↓
Join Communities
    ↓
Report Issue
    ↓
AI Validation
    ↓
Discussion
    ↓
Support Existing Issue
    ↓
Track Progress
    ↓
View Resolution
    ↓
Truth Verification
    ↓
Request Reopen
```

---

## Administrator

```text
Dashboard
    ↓
Issue Queue
    ↓
Community Summary
    ↓
Status Updates
    ↓
Resolution Evidence
    ↓
Truth Verification
    ↓
Close Issue
```

# 🧠 Agentic AI Architecture

Unlike traditional AI applications that rely on one monolithic prompt,

Awaaz employs **three specialized Gemini agents**, each responsible for a single task.

## 🛡 AI Reliability

To improve reliability and reduce downtime caused by model-specific quotas, Awaaz uses a configurable multi-model fallback strategy.

Each AI agent is assigned a chain of Gemini models.

If the primary model becomes unavailable due to quota limits or temporary failures, the system automatically retries using the next configured model.

This allows uninterrupted AI functionality while remaining completely transparent to the user.

---

## 1️⃣ AI Ingestion Agent

Responsible for validating newly submitted reports.

### Responsibilities

- Validate civic relevance
- Categorize issues
- Estimate severity
- Generate titles
- Generate summaries
- Recommend departments

---

## 2️⃣ Community Agent

Summarizes community intelligence.

Instead of reading dozens of comments,

administrators receive

- Executive Brief
- Key Insights
- Community Mood
- Suggested Actions
- Possible Contributing Factors

---

## 3️⃣ Truth Engine

Audits completed work.

Evaluates

- Before Image
- After Image
- Resolution Notes
- Community Context

Returns

- Verification Status
- Confidence Score
- Visual Assessment
- Recommendations

---

### Responsible AI

AI never

- changes issue status
- changes priority
- resolves issues
- rejects reports
- grants permissions

Administrators remain the final authority.

---

# ⚡ Technology Stack

## Frontend

- React
- Vite
- JavaScript
- Tailwind CSS

## Backend

- Node.js
- Express.js

## Database

- Cloud Firestore

## Authentication

- Firebase Authentication

## AI

- Gemini API
- Structured JSON Prompting
- Multi-Agent Architecture

## Media

- Cloudinary

---

# ☁ Google Technologies

- Firebase Authentication
- Cloud Firestore
- Firebase Admin SDK
- Gemini API
- Google AI Studio
- Google Maps & Geolocation APIs

---

# 📂 Project Structure

```text
client/
    components/
    pages/
    hooks/
    api/

server/
    agents/
    prompts/
    routes/
    services/

shared/
```

---

# 🚀 Installation

```bash
git clone https://github.com/yourusername/Awaaz.git

cd Awaaz

npm install

npm run dev
```

---

# 🔐 Environment Variables

```env
GEMINI_API_KEY=

FIREBASE_PROJECT_ID=

FIREBASE_CLIENT_EMAIL=

FIREBASE_PRIVATE_KEY=

VITE_FIREBASE_API_KEY=

VITE_FIREBASE_AUTH_DOMAIN=

VITE_FIREBASE_PROJECT_ID=

CLOUDINARY_CLOUD_NAME=

CLOUDINARY_API_KEY=

CLOUDINARY_API_SECRET=

--- GEMINI MODEL CHAINS (OPTIONAL CONFIGURATION WITH DEFAULT FALLBACKS) ---

INGESTION_MODEL_PRIMARY="gemini-3.5-flash"

INGESTION_MODEL_SECONDARY="gemini-2.5-flash"

INGESTION_MODEL_TERTIARY="gemini-3.1-flash-lite"

COMMUNITY_MODEL_PRIMARY="gemini-2.5-flash"

COMMUNITY_MODEL_SECONDARY="gemini-3.1-flash-lite"

TRUTH_MODEL_PRIMARY="gemini-3.5-flash"

TRUTH_MODEL_SECONDARY="gemini-2.5-flash"

TRUTH_MODEL_TERTIARY="gemini-3.1-flash-lite"
```

---

# 📈 Scalability

Awaaz is designed to scale from

- Residential Societies

to

- Apartment Complexes

to

- RWAs

to

- University Campuses

to

- Municipal Corporations

without requiring architectural changes.

---

# 🔮 Future Scope

Future versions of Awaaz will include

- 🎤 Voice-based reporting
- 🌐 Multilingual support
- 📈 Predictive maintenance
- ⏱ SLA monitoring
- 🔔 Smart notifications
- 🏛 Municipal ERP integrations
- 📱 Native mobile applications

---

# 🤝 Contributors

Developed as part of a hackathon project focused on building scalable, AI-assisted civic technology.

---

<div align="center">

### ⭐ If you found this project interesting, consider giving it a star!

Built with ❤️ using React, Firebase & Gemini AI.

</div>