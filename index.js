// server/index.js
require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');

const Contact = require('./models/Contact');

const app = express();
const PORT = process.env.PORT || 5000;

// Basic security & parsing
app.use(helmet());
app.use(express.json());

// CORS - allow client URL from env or localhost
app.use(cors({
  origin: process.env.CLIENT_URL || 'https://elite-smart-tech.vercel.app',
}));

// Rate limiter to avoid spam
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
}));

// MongoDB connect (✅ removed deprecated options)
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// Nodemailer transporter (use EMAIL_USER as sender)
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: process.env.EMAIL_SECURE === 'true',
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
});

transporter.verify(err => {
  if (err) console.error('Email transporter error:', err);
  else console.log('Email transporter is ready');
});

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

// Contact API
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, message } = req.body;
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Fill all required fields' });
    }
    // email basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ error: 'Invalid email' });

    // Save
    const contact = new Contact({ name, email, message });
    await contact.save();

    // Compose & send email — use EMAIL_USER as "from", replyTo original sender
    const mailOptions = {
      from: process.env.EMAIL_USER,
      replyTo: email,
      to: process.env.EMAIL_USER,
      subject: `New contact from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Message:</strong><br/>${message.replace(/\n/g,'<br/>')}</p>`
    };

    await transporter.sendMail(mailOptions);
    res.json({ message: 'Message  send successfully ' });
  } catch (err) {
    console.error('Contact API error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Serve built client in production (✅ fixed wildcard route)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
