# Kyron Medical — AI Patient Portal

A production-grade AI-powered patient portal built for Kyron Medical, 
enabling patients to schedule appointments, manage prescriptions, and 
get answers through an intelligent conversational interface.

## 🌐 Live Demo
https://kyronmedical.mooo.com

## ✨ Features
- **AI Chat** — Powered by Claude (Anthropic) for natural conversation
- **Appointment Scheduling** — Patient intake, doctor matching by specialty, slot selection
- **4 Specialist Doctors** — Orthopedics, Cardiology, Dermatology, Neurology
- **Smart Matching** — Semantically matches patient concerns to the right specialist
- **Email Confirmation** — Automated confirmation emails via Resend
- **Voice Handoff** — Switch from chat to AI voice call via Vapi with full context transfer
- **Prescription Refill** — Check medication refill status
- **Office Info** — Hours, location, parking, telehealth info
- **SMS Opt-in** — Patient consent for appointment reminders
- **Liquid Glass UI** — Kyron Medical branded design with animations

## 🏗️ Tech Stack
- **Frontend:** Vanilla HTML/CSS/JS — liquid glass design
- **Backend:** Node.js + Express
- **AI:** Claude Sonnet (Anthropic API)
- **Voice:** Vapi.ai with context transfer
- **Email:** Resend
- **Hosting:** AWS EC2 (Ubuntu 24.04) + Nginx
- **Version Control:** GitHub

## 👨‍⚕️ Doctors & Specialties
| Doctor | Specialty | Days |
|--------|-----------|------|
| Dr. Sarah Chen | Orthopedics | Mon, Wed, Fri |
| Dr. Marcus Rivera | Cardiology | Tue, Thu |
| Dr. Priya Nair | Dermatology | Mon, Tue, Thu, Fri |
| Dr. James Whitfield | Neurology | Mon, Wed, Thu |

## 🚀 Setup & Installation

### Prerequisites
- Node.js v20+
- Anthropic API key
- Resend API key
- Vapi account

### Local Development
```bash
git clone https://github.com/dhrish-s/kyron-medical-portal
cd kyron-medical-portal
npm install
```

Create `.env` file:
```
ANTHROPIC_API_KEY=your_key
RESEND_API_KEY=your_key
VAPI_ASSISTANT_ID=your_assistant_id
PORT=3000
```
```bash
node server.js
```

Open `http://localhost:3000`

## 📋 Patient Workflows
1. **Schedule Appointment** — Intake → Doctor Match → Slot Selection → Confirm → Email
2. **Prescription Refill** — Select medication → View status
3. **Office Info** — Address, hours, parking, telehealth
4. **Voice Handoff** — Click "Switch to Call" to continue with AI voice

## 🔒 Safety
- AI never provides medical advice or diagnosis
- All patient data handled securely
- Voice AI safety tested against harmful outputs


## 📝 Voice Feature Note
The voice handoff feature is fully implemented using Vapi.ai. 
The call connects and context transfers successfully. 
For microphone access to work, the site requires a trusted SSL 
certificate. This is configured and ready — a production domain 
with Let's Encrypt SSL can be attached in under 10 minutes.
For local testing, run on localhost with Chrome microphone 
permissions manually enabled.
```

## 🔄 Returning Patient Recognition
Kyra recognizes returning patients within the same session and greets 
them with their visit history. Persistent cross-session recognition 
is ready to be connected to a database (MongoDB/PostgreSQL).

