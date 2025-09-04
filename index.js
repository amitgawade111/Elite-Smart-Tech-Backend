// server/index.js
require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const Contact = require('./models/Contact');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 5000;

// ---------------------- Middleware ----------------------
app.use(helmet());
app.use(express.json());

app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  methods: ["GET", "POST"],
  credentials: true
}));

app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ---------------------- MongoDB ----------------------
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

// ---------------------- Nodemailer ----------------------
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

transporter.verify(err => {
  if (err) console.error('❌ Email transporter error:', err);
  else console.log('✅ Email transporter is ready');
});

// ---------------------- Routes ----------------------
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Fill all required fields' });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email' });
    }

    // Save to MongoDB
    const contact = new Contact({ name, email, message });
    await contact.save();

    // Send notification email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      replyTo: email,
      to: process.env.EMAIL_USER,
      subject: `New contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Message:</strong><br/>${message.replace(/\n/g, '<br/>')}</p>`
    });

    res.json({ message: 'Message sent successfully' });
  } catch (err) {
    console.error('❌ Contact API error:', err);
    res.status(500).json({ error: process.env.NODE_ENV === "development" ? err.message : 'Server error' });
  }
});

// ---------------------- Start Server ----------------------
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});