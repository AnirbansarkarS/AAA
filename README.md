<div align="center">

<img src="screenshots/banner.png" alt="AutoApply Agent Banner" width="100%">

# ⚡ AutoApply Agent

### Your Personal Application Strategist — Not Just an Autofill

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://github.com/yourusername/autoapply-agent)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-orange?style=for-the-badge)](https://developer.chrome.com/docs/extensions/mv3/)
[![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-F55036?style=for-the-badge)](https://groq.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)

**Built at [Hackathon Name] · April 2026**

[🚀 Install Extension](#installation) · [📺 Watch Demo](#demo) · [🏗 Architecture](#architecture) · [🤝 Contributing](#contributing)

</div>

---

## 🧠 The Problem

People don't fail applications because they lack skill.  
They fail because they don't know **how to present themselves.**

Every hackathon, job, or grant application forces the same painful loop:

- 📋 Re-typing the same personal details across dozens of forms
- 😶 Staring at *"Why do you want to join?"* with no idea how to stand out  
- 📝 Writing generic, forgettable answers that sound like everyone else
- 🔄 Manually copying skills from a resume that's probably outdated anyway

**AutoApply Agent breaks this loop entirely.**

---

## ✨ What It Does

<div align="center">
<img src="screenshots/demo-flow.gif" alt="AutoApply Agent Demo" width="85%">
</div>

AutoApply builds a **Personal Intelligence Vault** from your resume, LinkedIn, GitHub, government documents, and even your voice — then uses that vault to fill any form intelligently:

| Field Type | How It's Handled |
|---|---|
| Name, Email, College, CGPA, PAN | ⚡ Filled instantly from vault — zero AI latency |
| Why this company? Describe a challenge? | 🤖 AI crafts a tailored answer using your real projects + goals |
| ATS keywords missing from your answers | 🔍 Live web search injects trending role-specific keywords |

---

## 🎯 Intent Mode — The Core Differentiator

Before generating, you choose **what winning means for this application:**

```
🏆  Get Selected   →  Maximize acceptance. Highlight impact + mission alignment.
💰  Max Salary     →  Lead with market value, unique leverage, competing offers.
🚀  Stand Out      →  Unconventional framing. Bold hook. Memorable story angle.
🤝  Network        →  Warmth, curiosity, genuine shared interest.
```

Every single answer changes based on your intent. This is agent behavior — not just generation.

---

## 📸 Screenshots

<div align="center">

### Onboarding — Profile Capture
<img src="screenshots/01-onboarding.png" alt="Onboarding Screen" width="380">

*First-run onboarding captures your name, skills, top project, goal, and tone preference.*

---

### Personal Intelligence Vault
<img src="screenshots/02-vault.png" alt="Personal Vault" width="380">

*All data from resume, LinkedIn, GitHub, Aadhaar, PAN, and voice merges into one vault.*

---

### Live Agent Activity Feed
<img src="screenshots/03-agent-working.png" alt="Agent Working" width="380">

*Real-time activity log shows exactly what the agent is doing — no black boxes.*

---

### Answer Cards + Form Fill
<img src="screenshots/04-answer-cards.png" alt="Answer Cards" width="380">

*3 tailored variations per question. Click to select. One button fills the entire form.*

---

### Outreach Generator
<img src="screenshots/05-outreach.png" alt="Outreach Generator" width="380">

*Intent-aware cold emails and LinkedIn DMs generated from the same page context.*

</div>

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────┐
│                 Chrome Extension (MV3)               │
│                                                      │
│  ┌──────────────┐    ┌─────────────────────────┐    │
│  │  Content.js  │    │       Sidebar UI         │    │
│  │              │    │  Intent Selector         │    │
│  │ Field Detect │◄──►│  Profile Chip            │    │
│  │ DOM Inject   │    │  Answer Cards            │    │
│  │ Page Scrape  │    │  Activity Feed           │    │
│  └──────┬───────┘    └────────────┬────────────┘    │
│         │                         │                  │
│         ▼                         ▼                  │
│  ┌──────────────────────────────────────────────┐   │
│  │              Background (Service Worker)      │   │
│  │                                              │   │
│  │  Orchestrator → Context Reasoner             │   │
│  │              → Answer Crafter (Groq)         │   │
│  │              → Outreach Composer             │   │
│  │              → ATS Keyword Engine (Tavily)   │   │
│  └──────────────────┬───────────────────────────┘   │
│                     │                                │
│  ┌──────────────────▼───────────────────────────┐   │
│  │            Personal Intelligence Vault        │   │
│  │                                              │   │
│  │  Resume PDF  │  LinkedIn  │  GitHub API      │   │
│  │  Aadhaar     │  PAN Card  │  Voice (STT)     │   │
│  │                                              │   │
│  │         chrome.storage.local (on-device)     │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

### Data Sources → Vault

```
📄 Resume PDF          → Skills, experience, projects, education
🔗 LinkedIn Profile    → Headline, bio, skills, roles (DOM scrape on your own profile)
🐙 GitHub API          → Top repos, languages, stars (no auth needed)
🪪 Aadhaar Card (img)  → Name, DOB, address, last 4 digits only
💳 PAN Card (img)      → Name, PAN number, DOB
🎓 Marksheet (PDF/img) → College, degree, CGPA, year
🎤 Voice Input         → Spoken skills/bio via ElevenLabs STT
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Extension | Chrome MV3, Manifest V3, Content Scripts |
| Primary LLM | Groq — LLaMA 3.3 70B |
| Vision (docs) | Google Gemini 1.5 Flash |
| Voice STT | ElevenLabs Scribe v1 |
| ATS Research | Tavily Search API |
| Fallback LLMs | OpenRouter → Gemini 1.5-flash-8b |
| Storage | chrome.storage.local (on-device only) |
| Audio | Chrome Offscreen API + MediaRecorder |

---

## 📁 File Structure

```
autoapply-agent/
│
├── manifest.json
├── background.js              # Service worker + orchestrator
├── content.js                 # DOM field detection + answer injection
├── offscreen.html             # MV3 audio recording context
├── offscreen.js               # MediaRecorder + ElevenLabs STT
├── linkedin-scraper.js        # LinkedIn profile DOM scraper
│
├── sidebar/
│   ├── sidebar.html           # Main extension UI
│   ├── sidebar.js             # UI logic + message handling
│   └── sidebar.css
│
├── onboarding/
│   ├── onboarding.html        # First-run profile setup
│   └── onboarding.js
│
├── core/
│   └── agents/
│       ├── answerCrafter.js   # Intent-aware answer generation
│       ├── outreachComposer.js
│       └── contextReasoner.js
│
├── memory/
│   ├── vault.js               # Personal data vault schema
│   ├── storage.js             # chrome.storage wrapper
│   └── historyTracker.js      # Application history + outcome tracking
│
└── prompts/
    ├── system.js              # Master system prompt
    ├── answerPrompt.js
    └── outreachPrompt.js
```

---

## 🚀 Installation

### From Source (Developer Mode)

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/autoapply-agent.git
cd autoapply-agent

# 2. Add your API keys
cp .env.example .env
# Edit .env with your keys (see below)

# 3. Load in Chrome
# Open chrome://extensions
# Enable "Developer mode" (top right toggle)
# Click "Load unpacked"
# Select the autoapply-agent folder
```

### API Keys Required

Create a `.env` file (or set these in `config.js`):

```env
GROQ_API_KEY=gsk_...          # groq.com — free tier, most generous
GEMINI_API_KEY=AIza...        # aistudio.google.com — for vision/docs
ELEVENLABS_API_KEY=sk_...     # elevenlabs.io — for voice STT
TAVILY_API_KEY=tvly-...       # tavily.com — for ATS keyword search
```

> **All free tiers work for personal use.** Groq is the primary — get that one first.

---

## 🔒 Privacy & Security

All your personal data stays **on your device**.

- ✅ Vault stored in `chrome.storage.local` — never leaves your browser
- ✅ No server, no database, no cloud sync
- ✅ Aadhaar: only last 4 digits stored — full number never extracted
- ✅ API calls go directly from your browser to LLM providers
- ✅ No analytics, no tracking, no ads

The extension only activates on pages where you explicitly click **Generate**.

---

## 💡 How It Works — Step by Step

```
1. First Run
   └─ Onboarding: enter name, skills, project, goal, tone
   └─ Optional: upload resume, Aadhaar, LinkedIn import, GitHub username

2. On any form page
   └─ Click the AutoApply icon
   └─ Select your Intent Mode (🏆 Win / 💰 Salary / 🚀 Stand Out / 🤝 Network)
   └─ Click "Generate Answers"

3. Agent kicks off
   └─ ✦ Reading page context...
   └─ ✦ Identified: Software Engineer @ TechCorp
   └─ ✦ Loading your profile (Aryan · ML, React, IoT)
   └─ ✦ Fetching ATS keywords for this role...
   └─ ✦ Found 8 trending keywords
   └─ ✦ Crafting answers with intent: 🏆 Get Selected

4. Output
   └─ Standard fields filled instantly from vault (name, email, college...)
   └─ Subjective fields → 3 answer variations shown as cards
   └─ Each card shows: "Optimized for: highlights your IoT project
      because this hackathon theme is smart infrastructure"
   └─ Click preferred answer → injected into form field
   └─ Click "Draft Outreach" → cold email generated for recruiter/organizer
```

---

## 🌟 Key Features

- **Two-tier filling** — vault fields fill in <100ms, AI only runs on questions that need thinking
- **Intent Mode** — same form, 4 completely different strategies
- **Live activity feed** — see exactly what the agent is reasoning about in real time
- **Multi-source vault** — resume + LinkedIn + GitHub + government docs + voice, all merged
- **ATS optimization** — Tavily search injects trending keywords for the specific role
- **LLM fallback chain** — Groq → OpenRouter → Gemini, never a dead end
- **Reasoning transparency** — every AI answer explains *why* it was written that way
- **Application history** — track every form you've filled, mark outcomes, agent learns what works

---

## 🧪 Supported Platforms

Tested and working on:

| Platform | Standard Fill | AI Answers | Notes |
|---|---|---|---|
| Devfolio | ✅ | ✅ | Full support |
| Unstop | ✅ | ✅ | Full support |
| LinkedIn Easy Apply | ✅ | ✅ | |
| Greenhouse | ✅ | ✅ | Uses native setter for React inputs |
| Lever | ✅ | ✅ | |
| Workday | ⚠️ | ✅ | Some custom dropdowns manual |
| Google Forms | ✅ | ✅ | |
| Typeform | ✅ | ✅ | |

---

## 🔮 What's Next

- [ ] Firefox extension port
- [ ] Resume PDF generation from vault
- [ ] Calendar integration — auto-schedule follow-ups after applications
- [ ] Success rate analytics — which intent mode wins most for which role type
- [ ] Team vaults — share a project description across a hackathon team
- [ ] Interview prep mode — generate likely questions based on the job description

---

## 🏆 Built At

This project was built during **[Hackathon Name]** in April 2026.

**Team:** [Your Name]  
**Track:** [Track Name]  
**Award:** [If applicable]

---

## 🤝 Contributing

Pull requests welcome. For major changes, open an issue first.

```bash
git checkout -b feature/your-feature-name
git commit -m "feat: add your feature"
git push origin feature/your-feature-name
```

---

## 📄 License

MIT © 2026 [Your Name]

---

<div align="center">

**If this helped you win an application, give it a ⭐**

Made with ⚡ and way too much Groq quota

</div>