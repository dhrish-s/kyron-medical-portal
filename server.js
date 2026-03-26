require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');
const { Resend } = require('resend');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const resend = new Resend(process.env.RESEND_API_KEY);

// ─── DOCTORS DATABASE ─────────────────────────────────
function generateSlots(days, times) {
  const slots = [];
  const dayMap = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5 };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 3; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];
    if (days.includes(dayName)) {
      times.forEach(t => {
        slots.push({
          date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
          time: t,
          iso: d.toISOString().split('T')[0],
          available: true
        });
      });
    }
  }
  return slots;
}

const DOCTORS = [
  {
    id: 'DR001',
    name: 'Dr. Sarah Chen',
    specialty: 'Orthopedics',
    focus: 'bones joints spine back knee hip shoulder wrist ankle fracture orthopedic musculoskeletal arthritis',
    emoji: '🦴',
    bio: 'Board-certified orthopedic surgeon with 15 years experience',
    slots: generateSlots(['Mon', 'Wed', 'Fri'], ['9:00 AM', '10:30 AM', '2:00 PM', '3:30 PM'])
  },
  {
    id: 'DR002',
    name: 'Dr. Marcus Rivera',
    specialty: 'Cardiology',
    focus: 'heart chest pain palpitations blood pressure cardiovascular cardiac hypertension arrhythmia cholesterol',
    emoji: '<3',
    bio: 'Interventional cardiologist specializing in preventive heart care',
    slots: generateSlots(['Tue', 'Thu'], ['8:00 AM', '9:30 AM', '11:00 AM', '1:30 PM', '3:00 PM'])
  },
  {
    id: 'DR003',
    name: 'Dr. Priya Nair',
    specialty: 'Dermatology',
    focus: 'skin rash acne mole eczema psoriasis hair loss nail dermatology lesion biopsy sunburn itching',
    emoji: '🩺',
    bio: 'Dermatologist specializing in medical, surgical and cosmetic skin care',
    slots: generateSlots(['Mon', 'Tue', 'Thu', 'Fri'], ['10:00 AM', '11:30 AM', '2:00 PM', '4:00 PM'])
  },
  {
    id: 'DR004',
    name: 'Dr. James Whitfield',
    specialty: 'Neurology',
    focus: 'brain headache migraine seizure nerve numbness tingling memory dizzy vertigo neurological stroke',
    emoji: '>3',
    bio: 'Neurologist with expertise in headache disorders and neurodegenerative conditions',
    slots: generateSlots(['Mon', 'Wed', 'Thu'], ['9:00 AM', '11:00 AM', '1:00 PM', '3:00 PM'])
  }
];

const OFFICE_INFO = {
  address: '2847 Westlake Medical Drive, Suite 400, Los Angeles, CA 90025',
  phone: '(310) 555-0190',
  hours: 'Mon–Fri: 8:00 AM – 6:00 PM · Sat: 9:00 AM – 1:00 PM',
  parking: 'Free validated parking in the adjacent garage',
  telehealth: 'Available for follow-ups via secure video link'
};

const SYSTEM_PROMPT = `You are Kyra, a warm, professional AI health assistant for Kyron Medical, a physician practice in Los Angeles.

You help patients with:
1. Scheduling appointments (PRIMARY workflow)
2. Checking prescription refill status  
3. Office information (hours, address, directions)
4. General questions about the practice

CRITICAL RULES:
- NEVER provide medical advice, diagnoses, or treatment recommendations
- If asked for medical advice say exactly: "I'm not able to provide medical advice. Please speak with one of our physicians about that."
- Be friendly, empathetic, and concise
- Keep responses under 3 sentences unless showing structured info
- Address patient by first name once collected
- The practice has 4 specialists: Orthopedics (Dr. Sarah Chen), Cardiology (Dr. Marcus Rivera), Dermatology (Dr. Priya Nair), Neurology (Dr. James Whitfield)
- If concern doesn't match any specialty, say the practice doesn't treat that area

Office: ${OFFICE_INFO.address}
Hours: ${OFFICE_INFO.hours}
Phone: ${OFFICE_INFO.phone}`;

// ─── MATCH DOCTOR ─────────────────────────────────────
function matchDoctor(reason) {
  const lower = reason.toLowerCase();
  let best = null;
  let bestScore = 0;
  DOCTORS.forEach(doc => {
    const keywords = doc.focus.split(' ');
    let score = 0;
    keywords.forEach(k => { if (lower.includes(k)) score++; });
    if (score > bestScore) { bestScore = score; best = doc; }
  });
  return bestScore >= 1 ? best : null;
}

// ─── API: CHAT ─────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, patientContext } = req.body;
    const systemWithContext = SYSTEM_PROMPT + (patientContext ? `\n\nCurrent patient: ${JSON.stringify(patientContext)}` : '');
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemWithContext,
      messages: messages.slice(-10)
    });

    const rawReply = response.content[0].text;
    const formatted = rawReply
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
    res.json({ reply: formatted, isHTML: true });
  } catch (err) {
    console.error('Claude error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: MATCH DOCTOR ────────────────────────────────
app.post('/api/match-doctor', (req, res) => {
  const { reason } = req.body;
  const doctor = matchDoctor(reason);
  if (doctor) {
    res.json({ doctor: { id: doctor.id, name: doctor.name, specialty: doctor.specialty, bio: doctor.bio, emoji: doctor.emoji } });
  } else {
    res.json({ doctor: null });
  }
});

// ─── API: GET SLOTS ───────────────────────────────────
app.post('/api/slots', (req, res) => {
  const { doctorId, filterDay } = req.body;
  const doctor = DOCTORS.find(d => d.id === doctorId);
  if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
  
  let slots = doctor.slots.filter(s => s.available);
  if (filterDay) {
    slots = slots.filter(s => s.date.toLowerCase().startsWith(filterDay.toLowerCase()));
  }
  const slotsWithWait = slots.slice(0, 9).map((s, i) => ({...s,
  waitLabel: i === 0 ? "⚡ Next available" :
             i === 1 ? "~15 min wait" :
             i === 2 ? "~30 min wait" :
             i < 5   ? "~" + (i * 15) + " min wait" : "Flexible"
}));
res.json({ slots: slotsWithWait, doctorName: doctor.name });
});

// ─── API: BOOK APPOINTMENT ────────────────────────────

function generateICS(patient, doctor, slot) {
  const dateStr = slot.iso.replace(/-/g, '');
  const timeStr = slot.time.replace(/:/g, '').replace(' AM','').replace(' PM','');
  const hour = parseInt(slot.time.split(':')[0]);
  const isPM = slot.time.includes('PM');
  const hour24 = isPM && hour !== 12 ? hour + 12 : (!isPM && hour === 12 ? 0 : hour);
  const startTime = `${dateStr}T${String(hour24).padStart(2,'0')}${slot.time.split(':')[1].substring(0,2)}00`;
  const endHour = String(hour24 + 1).padStart(2,'0');
  const endTime = `${dateStr}T${endHour}${slot.time.split(':')[1].substring(0,2)}00`;
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Kyron Medical//EN
BEGIN:VEVENT
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:Appointment with ${doctor.name}
DESCRIPTION:${doctor.specialty} appointment at Kyron Medical.\\nConfirmation: ${patient.confirmationNumber}\\nPlease arrive 15 minutes early.
LOCATION:2847 Westlake Medical Drive Suite 400 Los Angeles CA 90025
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

app.post('/api/book', async (req, res) => {
  try {
    const { patient, doctorId, slot, sessionId } = req.body;
    const doctor = DOCTORS.find(d => d.id === doctorId);
    if (!doctor) return res.status(404).json({ error: 'Doctor not found' });

    // Mark slot unavailable
    const slotObj = doctor.slots.find(s => s.iso === slot.iso && s.time === slot.time);
    if (slotObj) slotObj.available = false;

    const confirmationNumber = 'KM-' + Math.random().toString(36).substring(2, 8).toUpperCase();

    // Send confirmation email
    await resend.emails.send({
      from: 'Kyron Medical <onboarding@resend.dev>',
      to: patient.email,
      subject: `Appointment Confirmed — ${doctor.name} on ${slot.date}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
          <div style="background: linear-gradient(135deg, #0d2144, #1a4a8a); padding: 30px; border-radius: 12px; text-align: center; margin-bottom: 20px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">⚕️ Kyron Medical</h1>
            <p style="color: #4fb3e8; margin: 8px 0 0;">Appointment Confirmed</p>
          </div>
          <div style="background: white; padding: 24px; border-radius: 12px; margin-bottom: 16px;">
            <h2 style="color: #0d2144; margin-top: 0;">Hello ${patient.firstName},</h2>
            <p style="color: #64748b;">Your appointment has been successfully scheduled.</p>
            <div style="background: #f0f9ff; border-left: 4px solid #1a4a8a; padding: 16px; border-radius: 0 8px 8px 0; margin: 20px 0;">
              <p style="margin: 4px 0;"><strong>Doctor:</strong> ${doctor.name}</p>
              <p style="margin: 4px 0;"><strong>Specialty:</strong> ${doctor.specialty}</p>
              <p style="margin: 4px 0;"><strong>Date:</strong> ${slot.date}</p>
              <p style="margin: 4px 0;"><strong>Time:</strong> ${slot.time}</p>
              <p style="margin: 4px 0;"><strong>Confirmation #:</strong> ${confirmationNumber}</p>
            </div>
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
              <p style="margin: 4px 0; color: #64748b;"><strong>📍 Location:</strong> 2847 Westlake Medical Drive, Suite 400, Los Angeles, CA 90025</p>
              <p style="margin: 4px 0; color: #64748b;"><strong>📞 Phone:</strong> (310) 555-0190</p>
              <p style="margin: 8px 0 0; color: #94a3b8; font-size: 13px;">Please arrive 15 minutes early to complete paperwork.</p>
            </div>
          </div>
          <p style="color: #94a3b8; font-size: 12px; text-align: center;">
            Session ID: ${sessionId} · If you need to reschedule, call (310) 555-0190
          </p>
        </div>
      `
    });

    const icsContent = generateICS(
  {...patient, confirmationNumber}, 
  doctor, 
  slot
);
const icsBase64 = Buffer.from(icsContent).toString('base64');
savePatientHistory(patient, doctor, slot, confirmationNumber);
res.json({ success: true, confirmationNumber, doctorName: doctor.name, icsBase64 });

  } catch (err) {
    console.error('Booking error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ─── API: VAPI CONTEXT ────────────────────────────────
app.post('/api/vapi-context', (req, res) => {
  const { sessionId, patient, matchedDoctor, selectedSlot, conversationSummary } = req.body;
  // Store context for voice call pickup
  global.vapiSessions = global.vapiSessions || {};
  global.vapiSessions[sessionId] = {
    patient, matchedDoctor, selectedSlot, conversationSummary,
    timestamp: new Date().toISOString()
  };
  res.json({ success: true, sessionId });
});

// ─── PATIENT HISTORY ──────────────────────────────────
global.patientHistory = global.patientHistory || {};

function savePatientHistory(patient, doctor, slot, confirmationNumber) {
  const key = patient.email.toLowerCase();
  if (!global.patientHistory[key]) {
    global.patientHistory[key] = { patient, visits: [] };
  }
  global.patientHistory[key].visits.push({
    doctor: doctor.name,
    specialty: doctor.specialty,
    date: slot.date,
    time: slot.time,
    confirmationNumber,
    bookedAt: new Date().toISOString()
  });
}

app.post('/api/check-patient', (req, res) => {
  const { email } = req.body;
  const key = email?.toLowerCase();
  const history = global.patientHistory[key];
  if (history && history.visits.length > 0) {
    const last = history.visits[history.visits.length - 1];
    res.json({
      returning: true,
      firstName: history.patient.firstName,
      lastName: history.patient.lastName,
      lastVisit: last
    });
  } else {
    res.json({ returning: false });
  }
});



app.get('/api/vapi-context/:sessionId', (req, res) => {
  const session = (global.vapiSessions || {})[req.params.sessionId];
  if (session) res.json(session);
  else res.status(404).json({ error: 'Session not found' });
});

// ─── START SERVER ─────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Kyron Medical server running on http://localhost:${PORT}`);
});