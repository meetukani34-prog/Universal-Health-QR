// Load environment variables if available
try { require('dotenv').config(); } catch (e) { }

const express = require('express');
const admin = require('firebase-admin');
const { onRequest } = require('firebase-functions/v2/https');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const nodemailer = require('nodemailer');
const { Resend } = require('resend');

// Initialize Resend if key exists
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
if (resend) console.log('- Resend Mailer Ready (API Key detected)');
const rateLimit = require('express-rate-limit');

// -- Nodemailer Transport --------------------------------------
const mailerConfig = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || ''
  },
  debug: true,
  logger: true,
  family: 4,
  connectionTimeout: 5000,
  greetingTimeout: 5000,
  socketTimeout: 5000
};
const mailerTransport = nodemailer.createTransport(mailerConfig);

// Startup SMTP Verification
mailerTransport.verify((error, success) => {
  if (error) {
    console.error('- SMTP Connection Error:', error.message);
    console.warn('--  System will fallback to Dev Mode for Forgot Password.');
  } else {
    console.log('- SMTP Mailer Ready (connected to ' + mailerConfig.host + ')');
  }
});

// -- In-Memory OTP Store (bulletproof fallback for Railway) --
const memoryOtpStore = new Map();
function setMemoryOtp(email, otp, purpose) {
  const key = `${email}::${purpose}`;
  memoryOtpStore.set(key, { otp, createdAt: Date.now() });
  // Auto-cleanup after 6 minutes
  setTimeout(() => memoryOtpStore.delete(key), 6 * 60 * 1000);
}
function verifyMemoryOtp(email, otp, purpose) {
  const key = `${email}::${purpose}`;
  const entry = memoryOtpStore.get(key);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > 5 * 60 * 1000) {
    memoryOtpStore.delete(key);
    return false;
  }
  if (entry.otp === otp) {
    memoryOtpStore.delete(key);
    return true;
  }
  return false;
}

// -- Branded Sarvam Email Template -----------------------
function buildOtpEmailHtml(otp, recipientName = 'User') {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0f1117; font-family:'Segoe UI',Arial,sans-serif; }
  .shell { max-width:560px; margin:0 auto; background:#0f1117; padding:2rem 1rem; }
  .card {
    background:linear-gradient(145deg,#1a1d2e,#12151f);
    border:1px solid rgba(99,120,255,0.25);
    border-radius:20px;
    overflow:hidden;
  }
  .header {
    background:linear-gradient(135deg,#3a47d5 0%,#5c47ff 100%);
    padding:2.5rem 2rem;
    text-align:center;
  }
  .logo {
    font-size:1.1rem;
    font-weight:700;
    color:rgba(255,255,255,0.7);
    letter-spacing:0.1em;
    text-transform:uppercase;
    margin-bottom:0.5rem;
  }
  .brand { font-size:2.2rem; font-weight:800; color:#fff; letter-spacing:-0.02em; }
  .body { padding:2.5rem 2rem; }
  .greeting { font-size:1.125rem; color:#e2e8f0; margin-bottom:1rem; }
  .msg { font-size:0.9375rem; color:#94a3b8; line-height:1.7; margin-bottom:2rem; }
  .otp-box {
    background:linear-gradient(135deg,rgba(99,120,255,0.15),rgba(92,71,255,0.1));
    border:1.5px solid rgba(99,120,255,0.4);
    border-radius:14px;
    text-align:center;
    padding:1.75rem 1rem;
    margin-bottom:2rem;
  }
  .otp-label { font-size:0.75rem; color:#6480ff; letter-spacing:0.12em; text-transform:uppercase; font-weight:600; margin-bottom:0.75rem; }
  .otp-code { font-size:1.5rem; font-weight:800; color:#fff; letter-spacing:0.35em; font-variant-numeric:tabular-nums; }
  .ttl { font-size:0.8125rem; color:#64748b; margin-top:0.75rem; }
  .divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:1.5rem 0; }
  .warning { font-size:0.8125rem; color:#64748b; line-height:1.6; }
  .warning strong { color:#94a3b8; }
  .footer { padding:1.5rem 2rem; text-align:center; border-top:1px solid rgba(255,255,255,0.05); }
  .footer p { font-size:0.75rem; color:#475569; line-height:1.7; }
  .footer a { color:#6480ff; text-decoration:none; }
</style>
</head>
<body>
<div class="shell">
  <div class="card">
    <div class="header">
      <div class="logo">SARVAM</div>
      <div class="brand">Health Care</div>
    </div>
    <div class="body">
      <p class="greeting">Hello, ${recipientName} </p>
      <p class="msg">You requested a password reset for your <strong style="color:#e2e8f0">Sarvam Health</strong> account. Use the secure one-time code below to proceed. This code is time-sensitive - please act quickly.</p>
      <div class="otp-box">
        <div class="otp-label">Your Identity Restoration Code</div>
        <div class="otp-code">${otp}</div>
        <div class="ttl">[Time] Expires in <strong style="color:#f59e0b">3 minutes</strong></div>
      </div>
      <hr class="divider">
      <p class="warning"><strong>Did not request this?</strong> If you did not request a password reset, you can safely ignore this email. Your account remains secure and no changes have been made.</p>
    </div>
    <div class="footer">
      <p>This email was sent by <a href="${process.env.APP_URL || 'http://localhost:3000'}">${process.env.APP_NAME || 'Sarvam'} Health Platform</a>.<br>For support, reply to this email. Do not share this code with anyone.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}

// -- Branded Sarvam Login Verification Email Template --------
function buildLoginOtpEmailHtml(otp, recipientName = 'User', purpose = 'login') {
  const isLogin = purpose === 'login';
  const actionTitle = isLogin ? 'Login Verification' : 'Registration Verification';
  const messageText = isLogin
    ? `We detected a <strong style="color:#e2e8f0">new login</strong> to your Sarvam Health account from an unrecognized device or browser. Use the secure one-time code below to confirm it's you.`
    : `You are taking the first step to create a new <strong style="color:#e2e8f0">Sarvam Health account</strong>. Use the secure one-time code below to verify your email address.`;
  const timeLimit = 5;
  const warningText = isLogin
    ? `<strong>Not you?</strong> If you did not attempt to log in, your password may be compromised. Please change it immediately via Forgot Password.`
    : `<strong>Never share this code.</strong> Our team will never ask you for this code.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#0f1117; font-family:'Segoe UI',Arial,sans-serif; }
  .shell { max-width:560px; margin:0 auto; background:#0f1117; padding:2rem 1rem; }
  .card { background:linear-gradient(145deg,#1a1d2e,#12151f); border:1px solid rgba(99,120,255,0.25); border-radius:20px; overflow:hidden; }
  .header { background:linear-gradient(135deg,#005d90 0%,#00a651 100%); padding:2.5rem 2rem; text-align:center; }
  .logo { font-size:1.1rem; font-weight:700; color:rgba(255,255,255,0.7); letter-spacing:0.1em; text-transform:uppercase; margin-bottom:0.5rem; }
  .brand { font-size:2.2rem; font-weight:800; color:#fff; letter-spacing:-0.02em; }
  .body { padding:2.5rem 2rem; }
  .greeting { font-size:1.125rem; color:#e2e8f0; margin-bottom:1rem; }
  .msg { font-size:0.9375rem; color:#94a3b8; line-height:1.7; margin-bottom:2rem; }
  .otp-box { background:linear-gradient(135deg,rgba(0,93,144,0.2),rgba(0,166,81,0.1)); border:1.5px solid rgba(0,166,81,0.4); border-radius:14px; text-align:center; padding:1.75rem 1rem; margin-bottom:2rem; }
  .otp-label { font-size:0.75rem; color:#00a651; letter-spacing:0.12em; text-transform:uppercase; font-weight:600; margin-bottom:0.75rem; }
  .otp-code { font-size:1.5rem; font-weight:800; color:#fff; letter-spacing:0.35em; font-variant-numeric:tabular-nums; }
  .ttl { font-size:0.8125rem; color:#64748b; margin-top:0.75rem; }
  .divider { border:none; border-top:1px solid rgba(255,255,255,0.07); margin:1.5rem 0; }
  .warning { font-size:0.8125rem; color:#64748b; line-height:1.6; }
  .warning strong { color:#94a3b8; }
  .footer { padding:1.5rem 2rem; text-align:center; border-top:1px solid rgba(255,255,255,0.05); }
  .footer p { font-size:0.75rem; color:#475569; line-height:1.7; }
  .footer a { color:#00a651; text-decoration:none; }
</style>
</head>
<body>
<div class="shell">
  <div class="card">
    <div class="header">
      <div class="logo">SARVAM</div>
      <div class="brand">Health Care</div>
    </div>
    <div class="body">
      <p class="greeting">Hello, ${recipientName} &#x1F44B;</p>
      <p class="msg">${messageText}</p>
      <div class="otp-box">
        <div class="otp-label">Your ${actionTitle} Code</div>
        <div class="otp-code">${otp}</div>
        <div class="ttl">&#x23F1; Expires in <strong style="color:#f59e0b">${timeLimit} minutes</strong></div>
      </div>
      <hr class="divider">
      <p class="warning">${warningText}</p>
    </div>
    <div class="footer">
      <p>This email was sent by <a href="${process.env.APP_URL || 'http://localhost:3000'}">${process.env.APP_NAME || 'Sarvam'} Health Platform</a>.<br>Do not share this code with anyone.</p>
    </div>
  </div>
</div>
</body>
</html>`;
}
/**
 * Unified Email Sender
 * Supports: Resend (API), Nodemailer (SMTP)
 */
async function sendUniversalEmail({ to, subject, html, text, replyTo }) {
  const from = process.env.SMTP_FROM || `"${process.env.APP_NAME || 'Sarvam'}" <${process.env.SMTP_USER}>`;

  // Option 1: Resend (Recommended for Reliability)
  if (resend) {
    try {
      // Resend requires verified domains or "onboarding@resend.dev"
      const resendFrom = from.includes('resend.dev') || from.includes('sarvam') ? from : 'onboarding@resend.dev';

      const { data, error } = await resend.emails.send({
        from: resendFrom.includes('<') ? resendFrom : `"Sarvam Health" <${resendFrom}>`,
        to,
        replyTo,
        subject,
        html,
        text
      });
      if (error) throw error;
      return { success: true, provider: 'resend', id: data.id };
    } catch (err) {
      console.warn('- Resend failed, falling back to SMTP:', err.message);
    }
  }

  // Option 2: Nodemailer (SMTP Fallback)
  return new Promise((resolve, reject) => {
    mailerTransport.sendMail({ from, to, subject, html, text, replyTo }, (err, info) => {
      if (err) {
        console.error('- SMTP Error:', err.message);
        return reject(err);
      }
      resolve({ success: true, provider: 'smtp', id: info.messageId });
    });
  });
}

async function sendOtpEmail(toEmail, otp, recipientName) {
  const html = buildOtpEmailHtml(otp, recipientName);
  const text = `Your Sarvam identity restoration code is: ${otp}. Expires in 3 minutes.`;
  return sendUniversalEmail({
    to: toEmail,
    subject: `${otp} - Sarvam Health Identity Restoration`,
    html,
    text
  });
}

function buildContactEmailHtml(data) {
  return `
<!DOCTYPE html>
<html>
<head><style>
  body { font-family: sans-serif; line-height: 1.6; color: #333; }
  .container { max-width: 600px; margin: 20px auto; border: 1px solid #eee; border-radius: 8px; overflow: hidden; }
  .header { background: #008037; color: white; padding: 20px; text-align: center; }
  .content { padding: 20px; }
  .field { margin-bottom: 15px; }
  .label { font-weight: bold; color: #666; font-size: 0.8rem; text-transform: uppercase; }
  .value { font-size: 1.1rem; color: #111; }
  .footer { background: #f9f9f9; padding: 15px; font-size: 0.8rem; text-align: center; color: #999; }
</style></head>
<body>
<div class="container">
  <div class="header"><h1>New Inquiry Received</h1></div>
  <div class="content">
    <div class="field"><div class="label">From</div><div class="value">${data.name} (${data.email})</div></div>
    <div class="field"><div class="label">Phone</div><div class="value">${data.phone || 'Not provided'}</div></div>
    <div class="field"><div class="label">Inquiry Type</div><div class="value">${data.type}</div></div>
    <div class="field"><div class="label">Message</div><div class="value" style="background:#f5f5f5;padding:15px;border-radius:4px;">${data.message}</div></div>
  </div>
  <div class="footer">Sent via Sarvam Health Contact Form</div>
</div>
</body>
</html>`;
}

// (Environment variables now loaded at the top)


// Initialize Firebase
let firebaseInitialized = false;
if (admin.apps.length === 0) {
  const saKey = process.env.SERVICE_ACCOUNT_KEY || process.env.FIREBASE_SERVICE_ACCOUNT;
  if (saKey) {
    try {
      const serviceAccount = JSON.parse(saKey);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('- Firebase Initialized via Service Account (Railway mode)');
      firebaseInitialized = true;
    } catch (e) {
      console.error('CRITICAL: Firebase Service Account Parse Error:', e.message);
    }
  } else {
    console.warn('WARNING: No SERVICE_ACCOUNT_KEY found. Firestore operations will fail.');
    if (process.env.GOOGLE_CLOUD_PROJECT) {
       try {
         admin.initializeApp();
         firebaseInitialized = true;
       } catch(e) { console.error('GCP Auto-init failed:', e.message); }
    }
  }
} else {
  firebaseInitialized = true;
}

const firestore = firebaseInitialized ? admin.firestore() : null;

const OpenAI = require('openai');

// Initialize OpenAI client
console.log('- Initializing AI Neural Link...');
console.log(`  - Base URL: ${process.env.OPENAI_API_BASE_URL || 'https://integrate.api.nvidia.com/v1'}`);
console.log(`  - Model: ${process.env.OPENAI_MODEL || 'meta/llama-3.1-70b-instruct'}`);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'MISSING_API_KEY',
  baseURL: process.env.OPENAI_API_BASE_URL || 'https://integrate.api.nvidia.com/v1'
});

const app = express();
const PORT = parseInt(process.env.PORT || 3000);

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.post('/api/contact', async (req, res) => {
  console.log('--- Incoming Contact Request ---');
  console.log('Body:', req.body);
  try {
    const { name, email, phone, type, message } = req.body;
    if (!name || !email || !message) {
      console.warn('Validation Failed: Missing required fields');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    console.log('Attempting to send email to:', process.env.SMTP_USER);
    await sendUniversalEmail({
      to: process.env.SMTP_USER,
      replyTo: `"${name}" <${email}>`,
      subject: `New ${type} from ${name}`,
      html: buildContactEmailHtml({ name, email, phone, type, message }),
      text: `Inquiry from ${name} (${email}): ${message}`
    });

    console.log('Email Sent Successfully!');
    res.json({ success: true });
  } catch (err) {
    console.error('--- Contact Form Error ---');
    console.error(err);
    res.status(500).json({ error: 'Failed to send message. Please try again later.' });
  }
});

// -- SSE real-time subscribers ----------------------------------
// Maps: doctorId - Set<res>, patientId - Set<res>
const doctorSSE = new Map();
const patientSSE = new Map();

function sseSubscribe(map, id, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();
  if (!map.has(id)) map.set(id, new Set());
  map.get(id).add(res);
  res.on('close', () => { map.get(id)?.delete(res); });
  // keep-alive ping every 25s
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => clearInterval(ping));
}

function sseSend(map, id, data) {
  map.get(id)?.forEach(res => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

app.use(cors());
app.use(express.json());

// Railway Health Check
app.get('/health', (req, res) => res.status(200).send('OK'));

// Force browsers to always fetch fresh JS/HTML files (prevent caching of stale code)
app.use((req, res, next) => {
  if (req.path.endsWith('.js') || req.path.endsWith('.html') || req.path === '/') {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

let db;
const DB_PATH = path.join(__dirname, 'healthqr.db');

// --- Firestore Compatibility Layer ---
// These functions mock SQL behavior but talk to Firestore
async function run(sql, params = []) {
  if (!firestore) return console.warn('Skipping Firestore RUN - DB not initialized');
  try {
    const tableMatch = sql.match(/(?:INSERT INTO|UPDATE|DELETE FROM) (\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    if (!table) return;

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore Timeout')), 5000));

    if (sql.toUpperCase().startsWith('INSERT INTO')) {
      const colMatch = sql.match(/\((.*?)\)/);
      if (!colMatch) return;
      const cols = colMatch[1].split(',').map(c => c.trim());
      const data = {};
      cols.forEach((c, i) => data[c] = params[i]);
      data.updated_at = new Date().toISOString();
      
      if (data.id) {
        await Promise.race([firestore.collection(table).doc(String(data.id)).set(data, { merge: true }), timeout]);
      } else {
        await Promise.race([firestore.collection(table).add(data), timeout]);
      }
    } else if (sql.toUpperCase().startsWith('UPDATE')) {
      const whereMatch = sql.match(/WHERE (.*?)(?:$|ORDER BY|LIMIT)/i);
      if (!whereMatch) return;
      const whereClause = whereMatch[1];
      const [whereCol] = whereClause.split('=').map(s => s.trim().replace(/\?/, ''));
      const qValue = params[params.length - 1]; 
      
      const snap = await Promise.race([firestore.collection(table).where(whereCol, '==', qValue).get(), timeout]);
      
      const updateData = {};
      const setPart = sql.match(/SET (.*?) WHERE/i)[1];
      const setCols = setPart.split(',').map(s => s.split('=')[0].trim());
      setCols.forEach((c, i) => updateData[c] = params[i]);
      updateData.updated_at = new Date().toISOString();

      const batch = firestore.batch();
      snap.forEach(doc => batch.update(doc.ref, updateData));
      await Promise.race([batch.commit(), timeout]);
    }
  } catch (err) {
    console.error('Firestore RUN error:', err.message, sql);
  }
}

async function get(sql, params = []) {
  if (!firestore) return null;
  try {
    const tableMatch = sql.match(/FROM (\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    if (!table) return null;

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore Timeout')), 5000));

    const whereMatch = sql.match(/WHERE (.*?)(?:$|ORDER BY|LIMIT)/i);
    if (!whereMatch) {
        const snap = await Promise.race([firestore.collection(table).limit(1).get(), timeout]);
        return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
    }

    const whereClause = whereMatch[1];
    const colName = whereClause.split('=')[0].trim();
    let query = firestore.collection(table).where(colName, '==', params[0]);
    
    if (sql.includes('ORDER BY')) {
        const orderCol = sql.match(/ORDER BY (\w+)/i)[1];
        const direction = sql.includes('DESC') ? 'desc' : 'asc';
        query = query.orderBy(orderCol, direction);
    }
    
    const snap = await Promise.race([query.limit(1).get(), timeout]);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  } catch (err) {
    console.error('Firestore GET error:', err.message, sql);
    return null;
  }
}

async function all(sql, params = []) {
  if (!firestore) return [];
  try {
    const tableMatch = sql.match(/FROM (\w+)/i);
    const table = tableMatch ? tableMatch[1] : null;
    if (!table) return [];

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore Timeout')), 5000));

    let query = firestore.collection(table);
    const whereMatch = sql.match(/WHERE (.*?)(?:$|ORDER BY|LIMIT)/i);
    
    if (whereMatch) {
        const colName = whereMatch[1].split('=')[0].trim();
        query = query.where(colName, '==', params[0]);
    }

    if (sql.includes('ORDER BY')) {
        const orderCol = sql.match(/ORDER BY (\w+)/i)[1];
        const direction = sql.includes('DESC') ? 'desc' : 'asc';
        query = query.orderBy(orderCol, direction);
    }

    if (sql.includes('LIMIT')) {
        const limit = parseInt(sql.match(/LIMIT (\d+)/i)[1]);
        query = query.limit(limit);
    }

    const snap = await Promise.race([query.get(), timeout]);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (err) {
    console.error('Firestore ALL error:', err.message, sql);
    return [];
  }
}

function generatePatientId(name, phone) {
  return crypto.createHash('sha256').update(`${name}-${phone}-${Date.now()}-${uuidv4()}`).digest('hex').substring(0, 16);
}
function generateOTP() { return Math.floor(100000 + Math.random() * 900000).toString(); }
function generateSecureOTP() { return String(crypto.randomInt(100000, 999999)); }

// --- AES-256-GCM Encryption Logic ---
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const KEY_BUFFER = crypto.createHash('sha256').update(String(process.env.CRYPTO_SECRET || 'fallback_secret')).digest();

function encrypt(text) {
  if (!text) return null;
  if (typeof text !== 'string') text = String(text);
  // Don't re-encrypt already encrypted content
  if (text.startsWith('v1:')) return text;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, KEY_BUFFER, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `v1:${iv.toString('hex')}:${tag}:${encrypted}`;
}

function decrypt(ciphertext) {
  if (!ciphertext || typeof ciphertext !== 'string' || !ciphertext.startsWith('v1:')) return ciphertext;
  try {
    const parts = ciphertext.split(':');
    const iv = Buffer.from(parts[1], 'hex');
    const tag = Buffer.from(parts[2], 'hex');
    const content = parts[3];
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, KEY_BUFFER, iv);
    decipher.setAuthTag(tag);
    let decrypted = decipher.update(content, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return ciphertext; // Return original if decryption fails (safely degraded)
  }
}

// --- PHI Protection Helpers ---
function preparePatientForDB(p) {
  if (!p) return p;
  return {
    ...p,
    dob: encrypt(p.dob),
    phone: encrypt(p.phone),
    blood_group: encrypt(p.blood_group),
    gender: encrypt(p.gender),
    address: encrypt(p.address),
    abha_id: encrypt(p.abha_id)
  };
}

function formatPatientFromDB(p) {
  if (!p) return p;
  const formatted = {
    ...p,
    dob: decrypt(p.dob),
    phone: decrypt(p.phone),
    blood_group: decrypt(p.blood_group),
    gender: decrypt(p.gender),
    address: decrypt(p.address),
    abha_id: decrypt(p.abha_id)
  };

  // Handle Medical History fields if joined
  if (p.allergies !== undefined) formatted.allergies = decrypt(p.allergies);
  if (p.chronic_conditions !== undefined) formatted.chronic_conditions = decrypt(p.chronic_conditions);
  if (p.immunization_status !== undefined) formatted.immunization_status = decrypt(p.immunization_status);

  return formatted;
}

async function initDB() {
  console.log('- Initializing Firestore Database Connection...');
  
  // Seed default Super Admin if none exists
  try {
    const saSnap = await firestore.collection('super_admins').limit(1).get();
    if (saSnap.empty) {
      const id = uuidv4();
      await firestore.collection('super_admins').doc(id).set({
        id,
        name: 'Super Admin',
        email: 'admin@uhqr.com',
        password_hash: bcrypt.hashSync('Admin@123', 10),
        created_at: new Date().toISOString()
      });
      console.log('  - Seeded default Super Admin');
    }
  } catch (err) {
    console.error('Error seeding Firestore:', err);
  }
}

async function migrateToEncryption() {
  // Encryption is handled at the document level in the new refactored functions
  return;
}

// === PATIENT ROUTES ===
app.post('/api/patients/register', upload.single('photo'), async (req, res) => {
  try {
    const { name, dob, phone, blood_group, email, password, gender, address,
      immunization_status, organ_donor_status,
      emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
      insurance_provider, policy_number, abha_id, scheme_name } = req.body;
    if (!name || !dob || !phone || !blood_group || !email || !password) return res.status(400).json({ error: 'Name, DOB, Phone, Blood Group, Email, and Password are required' });

    const existingEmail = await get('SELECT id FROM patients WHERE email = ?', [email]);
    if (existingEmail) return res.status(409).json({ error: 'Email already registered' });

    const patientId = generatePatientId(name, phone);
    const photo = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
    const qrUrl = `${req.protocol}://${req.get('host')}/#/patient/${patientId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2, color: { dark: '#005d90', light: '#ffffff' } });
    const passwordHash = bcrypt.hashSync(password, 10);

    const enc = preparePatientForDB({ dob, phone, blood_group, gender, address, abha_id });

    await run('INSERT INTO patients (id,name,dob,phone,blood_group,email,password_hash,gender,address,photo,abha_id,qr_code_url) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)',
      [patientId, name, enc.dob, enc.phone, enc.blood_group, email, passwordHash, enc.gender || null, enc.address || null, photo, enc.abha_id || null, qrCodeDataUrl]);

    let allergies = req.body.allergies || [];
    let conditions = req.body.chronic_conditions || [];
    if (typeof allergies === 'string') allergies = [allergies];
    if (typeof conditions === 'string') conditions = [conditions];

    await run('INSERT INTO medical_history (patient_id,allergies,chronic_conditions,immunization_status,organ_donor_status) VALUES (?,?,?,?,?)',
      [patientId, encrypt(JSON.stringify(allergies)), encrypt(JSON.stringify(conditions)), encrypt(immunization_status || 'Not Updated'), organ_donor_status || 'No']);

    if (emergency_contact_name && emergency_contact_phone)
      await run('INSERT INTO emergency_contacts (patient_id,name,relationship,phone) VALUES (?,?,?,?)',
        [patientId, encrypt(emergency_contact_name), emergency_contact_relationship || 'Other', encrypt(emergency_contact_phone)]);

    if (insurance_provider || policy_number)
      await run('INSERT INTO insurance (patient_id,provider,policy_number,abha_id,scheme_name) VALUES (?,?,?,?,?)',
        [patientId, encrypt(insurance_provider) || null, encrypt(policy_number) || null, encrypt(abha_id) || null, encrypt(scheme_name) || null]);

    console.log(`- Patient registered: ${name} (ID: ${patientId})`);
    res.json({ success: true, patient: { id: patientId, name, phone, email, blood_group, qr_code_url: qrCodeDataUrl } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Registration failed' }); }
});

app.get('/api/patients/:id/emergency', async (req, res) => {
  try {
    const p = await get('SELECT p.id,p.name,p.dob,p.blood_group,p.photo,mh.allergies,mh.chronic_conditions FROM patients p LEFT JOIN medical_history mh ON p.id=mh.patient_id WHERE p.id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    const contacts = await all('SELECT name,relationship,phone FROM emergency_contacts WHERE patient_id=?', [req.params.id]);
    // Log doctor QR scan visit
    const { doctor_id, doctor_name, doctor_specialization } = req.query;
    if (doctor_id) {
      await run("INSERT INTO access_logs (patient_id,accessor_id,accessor_name,accessor_type,layer_accessed,purpose) VALUES (?,?,?,'doctor','Layer 1 - Emergency','QR Scan')",
        [req.params.id, doctor_id, doctor_name || 'Unknown Doctor']);
    }
    const fp = formatPatientFromDB(p);
    res.json({
      ...fp,
      allergies: JSON.parse(fp.allergies || '[]'),
      chronic_conditions: JSON.parse(fp.chronic_conditions || '[]'),
      emergency_contacts: contacts.map(c => ({ ...c, name: decrypt(c.name), phone: decrypt(c.phone) }))
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/patients/:id/visit-history', async (req, res) => {
  try {
    const p = await get('SELECT id FROM patients WHERE id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    const visits = await all(`SELECT al.id, al.accessor_id, al.accessor_name, al.accessor_type, al.layer_accessed, al.purpose, al.timestamp,
      d.specialization, d.hospital FROM access_logs al
      LEFT JOIN doctors d ON al.accessor_id=d.id
      WHERE al.patient_id=? AND al.accessor_type='doctor'
      ORDER BY al.timestamp DESC LIMIT 50`, [req.params.id]);
    res.json({ success: true, visits });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/patients/:id/clinical', async (req, res) => {
  try {
    const p = await get('SELECT p.*,mh.allergies,mh.chronic_conditions,mh.immunization_status,mh.organ_donor_status FROM patients p LEFT JOIN medical_history mh ON p.id=mh.patient_id WHERE p.id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    const rxs = await all('SELECT * FROM prescriptions WHERE patient_id=? ORDER BY date DESC LIMIT 5', [req.params.id]);
    const contacts = await all('SELECT * FROM emergency_contacts WHERE patient_id=?', [req.params.id]);
    const { accessor_id, accessor_name, accessor_type } = req.query;
    if (accessor_id && accessor_type === 'doctor') await run("INSERT INTO access_logs (patient_id,accessor_id,accessor_name,accessor_type,layer_accessed,purpose) VALUES (?,?,?,?,'Layer 2 - Clinical','OTP Verified Access')",
      [req.params.id, accessor_id, accessor_name || 'Unknown', 'doctor']);
    const fp = formatPatientFromDB(p);
    res.json({
      ...fp, allergies: JSON.parse(fp.allergies || '[]'), chronic_conditions: JSON.parse(fp.chronic_conditions || '[]'),
      prescriptions: rxs.map(r => ({
        ...r,
        medications: JSON.parse(decrypt(r.medications) || '[]'),
        notes: decrypt(r.notes),
        lab_report: r.lab_report, // Base64 URI (already formatted in storage or handled)
        lab_report_name: decrypt(r.lab_report_name)
      })),
      emergency_contacts: contacts.map(c => ({ ...c, name: decrypt(c.name), phone: decrypt(c.phone) }))
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/patients/:id/admin', async (req, res) => {
  try {
    const p = await get('SELECT p.*,mh.allergies,mh.chronic_conditions,mh.immunization_status,mh.organ_donor_status FROM patients p LEFT JOIN medical_history mh ON p.id=mh.patient_id WHERE p.id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    const rxs = await all('SELECT * FROM prescriptions WHERE patient_id=? ORDER BY date DESC LIMIT 5', [req.params.id]);
    const contacts = await all('SELECT * FROM emergency_contacts WHERE patient_id=?', [req.params.id]);
    const ins = await get('SELECT * FROM insurance WHERE patient_id=?', [req.params.id]);
    const logs = await all('SELECT * FROM access_logs WHERE patient_id=? ORDER BY timestamp DESC LIMIT 20', [req.params.id]);
    const { accessor_id, accessor_name } = req.query;
    if (accessor_id) await run("INSERT INTO access_logs (patient_id,accessor_id,accessor_name,accessor_type,layer_accessed,purpose) VALUES (?,?,?,'admin','Layer 3 - Admin','Admin Panel Access')",
      [req.params.id, accessor_id, accessor_name || 'Admin']);
    const fp = formatPatientFromDB(p);
    res.json({
      ...fp,
      allergies: JSON.parse(fp.allergies || '[]'),
      chronic_conditions: JSON.parse(fp.chronic_conditions || '[]'),
      prescriptions: rxs.map(r => ({
        ...r,
        medications: JSON.parse(decrypt(r.medications) || '[]'),
        notes: decrypt(r.notes),
        lab_report: r.lab_report,
        lab_report_name: decrypt(r.lab_report_name)
      })),
      emergency_contacts: contacts.map(c => ({ ...c, name: decrypt(c.name), phone: decrypt(c.phone) })),
      insurance: ins ? { ...ins, provider: decrypt(ins.provider), policy_number: decrypt(ins.policy_number), scheme_name: decrypt(ins.scheme_name) } : {},
      access_logs: logs
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/patients/login', async (req, res) => {
  try {
    const { phone } = req.body;
    const p = await get('SELECT id,name FROM patients WHERE phone=?', [phone]);
    if (!p) return res.status(404).json({ error: 'No patient found with this phone' });
    const otp = generateOTP();
    const otpHash = bcrypt.hashSync(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
    await run('INSERT INTO otp_sessions (phone,otp_hash,expires_at,purpose) VALUES (?,?,?,?)', [phone, otpHash, expiresAt, 'patient_login']);
    console.log(` OTP for ${phone}: ${otp}`);
    res.json({ success: true, mock_otp: otp, patient_name: p.name });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Trusted device token helpers
function hashDeviceToken(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
async function checkDeviceToken(userId, role, token) {
  if (!token) return false;
  const hash = hashDeviceToken(token);
  const session = await get("SELECT id FROM login_sessions WHERE user_id=? AND role=? AND token_hash=? AND expires_at>datetime('now')", [userId, role, hash]);
  return !!session;
}
async function issueDeviceToken(userId, role) {
  const token = crypto.randomBytes(48).toString('hex');
  const hash = hashDeviceToken(token);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await run('INSERT INTO login_sessions (user_id, role, token_hash, expires_at) VALUES (?,?,?,?)', [userId, role, hash, expiresAt]);
  return token;
}

// Patient login via email/password
app.post('/api/patients/login-password', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const patient = await get('SELECT * FROM patients WHERE email=?', [email]);
    if (!patient) return res.status(404).json({ error: 'No patient with this email' });
    if (!bcrypt.compareSync(password, patient.password_hash)) return res.status(401).json({ error: 'Invalid password' });

    // -- New Login Verification: check for trusted device token
    const deviceToken = req.headers['x-device-token'] || '';
    if (!checkDeviceToken(patient.id, 'patient', deviceToken)) {
      // Unknown device: send OTP and gate the session
      const otp = generateSecureOTP();
      const otpHash = bcrypt.hashSync(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await run('INSERT INTO otp_sessions (phone, otp_hash, expires_at, purpose) VALUES (?,?,?,?)',
        [email, otpHash, expiresAt, 'login_verify_patient']);
      setMemoryOtp(email, otp, 'login_verify_patient');

      let emailSent = false, devOtp = null;
      try {
        await sendUniversalEmail({
          to: email,
          subject: `${otp} - Your Sarvam Login Verification Code`,
          html: buildLoginOtpEmailHtml(otp, patient.name),
          text: `Your Sarvam login verification code is: ${otp}. Expires in 5 minutes.`
        });
        emailSent = true;
        console.log(`- Login OTP emailed to ${email}`);
      } catch (mailErr) {
        console.warn('- SMTP failed or timed out, falling back to dev mode:', mailErr.message);
      }
      return res.json({ requires_verification: true, user_name: patient.name, email, email_sent: emailSent, dev_otp: otp });
    }

    // Trusted device: return full session
    delete patient.password_hash;
    const fp = formatPatientFromDB(patient);
    const history = await get('SELECT * FROM medical_history WHERE patient_id=?', [fp.id]);
    const rxs = await all('SELECT * FROM prescriptions WHERE patient_id=? ORDER BY date DESC', [fp.id]);
    const contacts = await all('SELECT * FROM emergency_contacts WHERE patient_id=?', [fp.id]);
    const logs = await all('SELECT * FROM access_logs WHERE patient_id=? ORDER BY timestamp DESC LIMIT 20', [fp.id]);
    const ins = await get('SELECT * FROM insurance WHERE patient_id=?', [fp.id]);
    res.json({
      success: true, patient: {
        ...fp,
        medical_history: history ? { ...history, allergies: JSON.parse(decrypt(history.allergies) || '[]'), chronic_conditions: JSON.parse(decrypt(history.chronic_conditions) || '[]'), immunization_status: decrypt(history.immunization_status) } : null,
        prescriptions: rxs.map(r => ({ ...r, medications: JSON.parse(decrypt(r.medications) || '[]'), notes: decrypt(r.notes) })),
        emergency_contacts: contacts.map(c => ({ ...c, name: decrypt(c.name), phone: decrypt(c.phone) })),
        insurance: ins ? { ...ins, provider: decrypt(ins.provider), policy_number: decrypt(ins.policy_number), scheme_name: decrypt(ins.scheme_name) } : {},
        access_logs: logs
      }
    });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Login failed' }); }
});

// === AUTH & PASSWORD RECOVERY ===
app.post('/api/auth/forgot-password-request', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check both patients and doctors
    let user = await get('SELECT id, name FROM patients WHERE email=?', [email]);
    let userType = 'patient';
    if (!user) {
      user = await get('SELECT id, name FROM doctors WHERE email=?', [email]);
      userType = 'doctor';
    }

    if (!user) return res.status(404).json({ error: 'No account found with this email' });

    const otp = generateOTP();
    const otpHash = bcrypt.hashSync(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes

    await run('INSERT INTO otp_sessions (phone, otp_hash, expires_at, purpose) VALUES (?, ?, ?, ?)',
      [email, otpHash, expiresAt, 'forgot_password']);
    setMemoryOtp(email, otp, 'forgot_password');

    console.log(` Password Recovery OTP for ${email} (${userType}): ${otp}`);
    res.json({ success: true, message: 'OTP sent to your email (Fallback active)', dev_otp: otp });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields are required' });

    const session = await get('SELECT * FROM otp_sessions WHERE phone=? AND purpose=? AND used=0 ORDER BY expires_at DESC LIMIT 1',
      [email, 'forgot_password']);

    if (!session || new Date() > new Date(session.expires_at)) {
      // Fallback: check in-memory store
      if (verifyMemoryOtp(email, otp, 'forgot_password')) {
        console.log(`- Forgot password OTP verified via MEMORY fallback for ${email}`);
        const newHash = bcrypt.hashSync(req.body.newPassword, 10);
        await run('UPDATE patients SET password_hash=? WHERE email=?', [newHash, email]);
        await run('UPDATE doctors SET password_hash=? WHERE email=?', [newHash, email]);
        return res.json({ success: true, message: 'Password reset successful' });
      }
      return res.status(401).json({ error: 'Invalid or expired OTP' });
    }

    if (!bcrypt.compareSync(otp, session.otp_hash)) {
      if (verifyMemoryOtp(email, otp, 'forgot_password')) {
        console.log(`- Forgot password OTP verified via MEMORY fallback for ${email}`);
        const newHash = bcrypt.hashSync(req.body.newPassword, 10);
        await run('UPDATE patients SET password_hash=? WHERE email=?', [newHash, email]);
        await run('UPDATE doctors SET password_hash=? WHERE email=?', [newHash, email]);
        return res.json({ success: true, message: 'Password reset successful' });
      }
      return res.status(401).json({ error: 'Incorrect OTP' });
    }

    const newHash = bcrypt.hashSync(newPassword, 10);
    let updated = false;

    await run('UPDATE patients SET password_hash=? WHERE email=?', [newHash, email]);
    if (db.getRowsModified() > 0) updated = true;

    if (!updated) {
      await run('UPDATE doctors SET password_hash=? WHERE email=?', [newHash, email]);
      if (db.getRowsModified() > 0) updated = true;
    }

    if (!updated) return res.status(404).json({ error: 'User not found' });

    await run('UPDATE otp_sessions SET used=1 WHERE id=?', [session.id]);
    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});


// -- Pre-Registration Email Verification --
app.post('/api/auth/register-send-otp', async (req, res) => {
  try {
    const { email, role } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    const emailLower = email.toLowerCase();

    // Check if email already used (patients or doctors or admins)
    if (role === 'patient') {
      const existing = await get('SELECT id FROM patients WHERE email=?', [emailLower]);
      if (existing) return res.status(400).json({ error: 'Email is already registered as a patient.' });
    } else if (role === 'doctor') {
      const existing = await get('SELECT id FROM doctors WHERE email=?', [emailLower]);
      if (existing) return res.status(400).json({ error: 'Email is already registered as a doctor.' });
    } else {
      const existingPatient = await get('SELECT id FROM patients WHERE email=?', [emailLower]);
      const existingDoctor = await get('SELECT id FROM doctors WHERE email=?', [emailLower]);
      if (existingPatient || existingDoctor) return res.status(400).json({ error: 'Email is already registered. Please login.' });
    }

    const otp = generateSecureOTP();
    const otpHash = bcrypt.hashSync(otp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes
    await run('INSERT INTO otp_sessions (phone, otp_hash, expires_at, purpose) VALUES (?,?,?,?)',
      [emailLower, otpHash, expiresAt, 'register_verify']);
    setMemoryOtp(emailLower, otp, 'register_verify');

    let emailSent = false, devOtp = null;
    try {
      await sendUniversalEmail({
        to: emailLower,
        subject: `${otp} - Verify your email to register on Sarvam`,
        html: buildLoginOtpEmailHtml(otp, role ? "Future " + (role === 'doctor' ? "Doctor" : "Patient") : "Future User", 'register'),
        text: `Your registration verification code is: ${otp}. Expires in 5 minutes.`
      });
      emailSent = true;
      console.log(`- Registration OTP emailed to ${emailLower}`);
    } catch (mailErr) {
      console.warn('- SMTP failed or timed out, falling back to dev mode:', mailErr.message);
    }
    
    // CRITICAL FALLBACK: If everything fails, log it so the user can see it in Railway logs
    console.log('************************************************');
    console.log(`DEVELOMENT OTP FOR ${emailLower}: ${otp}`);
    console.log('************************************************');

    res.json({ success: true, email: emailLower, email_sent: emailSent, dev_otp: otp });
  } catch (err) { 
    console.error('OTP Route Error:', err); 
    res.status(500).json({ error: 'Failed to process OTP request' }); 
  }
});

app.post('/api/auth/register-verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });
    const emailLower = email.toLowerCase();

    const session = await get(
      "SELECT * FROM otp_sessions WHERE phone=? AND purpose='register_verify' AND used=0 AND expires_at>datetime('now') ORDER BY id DESC LIMIT 1",
      [emailLower]
    );
    if (!session) {
      // Fallback: check in-memory store
      if (verifyMemoryOtp(emailLower, otp, 'register_verify')) {
        console.log(`- Register OTP verified via MEMORY fallback for ${emailLower}`);
        return res.json({ success: true, verified_email: emailLower });
      }
      return res.status(401).json({ error: 'OTP expired or not found' });
    }
    if (!bcrypt.compareSync(otp, session.otp_hash)) {
      // Also try memory fallback for hash mismatches
      if (verifyMemoryOtp(emailLower, otp, 'register_verify')) {
        console.log(`- Register OTP verified via MEMORY fallback for ${emailLower}`);
        await run('UPDATE otp_sessions SET used=1 WHERE id=?', [session.id]);
        return res.json({ success: true, verified_email: emailLower });
      }
      return res.status(401).json({ error: 'Incorrect OTP' });
    }

    await run('UPDATE otp_sessions SET used=1 WHERE id=?', [session.id]);
    res.json({ success: true, verified_email: emailLower });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to verify OTP' }); }
});
// -- Login Email Verification: Verify OTP & Issue Device Token --
app.post('/api/auth/login-verify-otp', async (req, res) => {
  try {
    const { email, role, otp } = req.body;
    if (!email || !role || !otp) return res.status(400).json({ error: 'email, role, and otp are required' });

    const purpose = role === 'doctor' ? 'login_verify_doctor' : 'login_verify_patient';
    const session = await get(
      "SELECT * FROM otp_sessions WHERE phone=? AND purpose=? AND used=0 AND expires_at>datetime('now') ORDER BY id DESC LIMIT 1",
      [email, purpose]
    );
    const memoryVerified = verifyMemoryOtp(email, otp, purpose);
    if (!session && !memoryVerified) return res.status(401).json({ error: 'OTP expired or not found. Please try logging in again.' });
    if (session && !bcrypt.compareSync(otp, session.otp_hash) && !memoryVerified) return res.status(401).json({ error: 'Incorrect OTP' });
    if (session) await run('UPDATE otp_sessions SET used=1 WHERE id=?', [session.id]);
    if (memoryVerified) console.log(`- Login OTP verified via MEMORY fallback for ${email}`);

    // Issue a trusted device token
    let user, sessionData;
    if (role === 'patient') {
      const patient = await get('SELECT * FROM patients WHERE email=?', [email]);
      if (!patient) return res.status(404).json({ error: 'Patient not found' });
      const deviceToken = issueDeviceToken(patient.id, 'patient');
      delete patient.password_hash;
      const fp = formatPatientFromDB(patient);
      const history = await get('SELECT * FROM medical_history WHERE patient_id=?', [fp.id]);
      const rxs = await all('SELECT * FROM prescriptions WHERE patient_id=? ORDER BY date DESC', [fp.id]);
      const contacts = await all('SELECT * FROM emergency_contacts WHERE patient_id=?', [fp.id]);
      const logs = await all('SELECT * FROM access_logs WHERE patient_id=? ORDER BY timestamp DESC LIMIT 20', [fp.id]);
      const ins = await get('SELECT * FROM insurance WHERE patient_id=?', [fp.id]);
      sessionData = {
        success: true,
        device_token: deviceToken,
        patient: {
          ...fp,
          medical_history: history ? { ...history, allergies: JSON.parse(decrypt(history.allergies) || '[]'), chronic_conditions: JSON.parse(decrypt(history.chronic_conditions) || '[]'), immunization_status: decrypt(history.immunization_status) } : null,
          prescriptions: rxs.map(r => ({ ...r, medications: JSON.parse(decrypt(r.medications) || '[]'), notes: decrypt(r.notes) })),
          emergency_contacts: contacts.map(c => ({ ...c, name: decrypt(c.name), phone: decrypt(c.phone) })),
          insurance: ins ? { ...ins, provider: decrypt(ins.provider), policy_number: decrypt(ins.policy_number), scheme_name: decrypt(ins.scheme_name) } : {},
          access_logs: logs
        }
      };
    } else if (role === 'doctor') {
      const doc = await get('SELECT * FROM doctors WHERE email=?', [email]);
      if (!doc) return res.status(404).json({ error: 'Doctor not found' });
      const deviceToken = issueDeviceToken(doc.id, 'doctor');
      const recent = await all('SELECT DISTINCT al.patient_id,p.name as patient_name,al.timestamp,al.layer_accessed FROM access_logs al JOIN patients p ON al.patient_id=p.id WHERE al.accessor_id=? ORDER BY al.timestamp DESC LIMIT 10', [doc.id]);
      delete doc.password_hash;
      sessionData = { success: true, device_token: deviceToken, doctor: doc, recent_patients: recent };
    } else {
      return res.status(400).json({ error: 'Invalid role' });
    }

    console.log(`- Login OTP verified for ${email} (${role}). Device token issued.`);
    res.json(sessionData);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Verification failed' }); }
});
app.post('/api/patients/verify-otp', async (req, res) => {
  try {
    const { phone, otp } = req.body;
    const sessions = await all("SELECT * FROM otp_sessions WHERE phone=? AND used=0 AND expires_at>datetime('now') ORDER BY id DESC LIMIT 1", [phone]);
    const session = sessions[0];
    if (!session) return res.status(400).json({ error: 'OTP expired or not found' });
    if (!bcrypt.compareSync(otp, session.otp_hash)) return res.status(400).json({ error: 'Invalid OTP' });
    await run('UPDATE otp_sessions SET used=1 WHERE id=?', [session.id]);
    const patient = await get('SELECT * FROM patients WHERE phone=?', [phone]);
    const fp = formatPatientFromDB(patient);
    const history = await get('SELECT * FROM medical_history WHERE patient_id=?', [fp.id]);
    const rxs = await all('SELECT * FROM prescriptions WHERE patient_id=? ORDER BY date DESC', [fp.id]);
    const contacts = await all('SELECT * FROM emergency_contacts WHERE patient_id=?', [fp.id]);
    const logs = await all('SELECT * FROM access_logs WHERE patient_id=? ORDER BY timestamp DESC LIMIT 20', [fp.id]);
    const ins = await get('SELECT * FROM insurance WHERE patient_id=?', [fp.id]);
    res.json({
      success: true, patient: {
        ...fp,
        medical_history: history ? { ...history, allergies: JSON.parse(decrypt(history.allergies) || '[]'), chronic_conditions: JSON.parse(decrypt(history.chronic_conditions) || '[]'), immunization_status: decrypt(history.immunization_status) } : null,
        prescriptions: rxs.map(r => ({ ...r, medications: JSON.parse(decrypt(r.medications) || '[]'), notes: decrypt(r.notes) })),
        emergency_contacts: contacts.map(c => ({ ...c, name: decrypt(c.name), phone: decrypt(c.phone) })),
        access_logs: logs, insurance: ins ? { ...ins, provider: decrypt(ins.provider), policy_number: decrypt(ins.policy_number), scheme_name: decrypt(ins.scheme_name) } : {}
      }
    });
  } catch (err) { res.status(500).json({ error: 'Verification failed' }); }
});

app.put('/api/patients/:id', async (req, res) => {
  try {
    const { name, dob, phone, blood_group, gender, address, email, photo, allergies, chronic_conditions, immunization_status, organ_donor_status } = req.body;
    const enc = preparePatientForDB({ dob, phone, blood_group, gender, address, email });
    await run('UPDATE patients SET name=?,dob=?,phone=?,blood_group=?,gender=?,address=?,email=?,photo=? WHERE id=?',
      [name, enc.dob, enc.phone, enc.blood_group, enc.gender || null, enc.address || null, enc.email || null, photo || null, req.params.id]);

    await run('UPDATE medical_history SET allergies=?,chronic_conditions=?,immunization_status=?,organ_donor_status=? WHERE patient_id=?',
      [encrypt(JSON.stringify(allergies || [])), encrypt(JSON.stringify(chronic_conditions || [])), encrypt(immunization_status || 'Not Updated'), organ_donor_status || 'No', req.params.id]);
    // Update emergency contacts
    if (req.body.emergency_contact_name) {
      await run('DELETE FROM emergency_contacts WHERE patient_id=?', [req.params.id]);
      await run('INSERT INTO emergency_contacts (patient_id,name,relationship,phone) VALUES (?,?,?,?)',
        [req.params.id, encrypt(req.body.emergency_contact_name), req.body.emergency_contact_relationship || 'Other', encrypt(req.body.emergency_contact_phone || '')]);
    }
    // Update insurance
    if (req.body.insurance_provider || req.body.policy_number || req.body.abha_id) {
      const existIns = await get('SELECT id FROM insurance WHERE patient_id=?', [req.params.id]);
      if (existIns) await run('UPDATE insurance SET provider=?,policy_number=?,abha_id=?,scheme_name=? WHERE patient_id=?',
        [encrypt(req.body.insurance_provider) || null, encrypt(req.body.policy_number) || null, encrypt(req.body.abha_id) || null, encrypt(req.body.scheme_name) || null, req.params.id]);
      else await run('INSERT INTO insurance (patient_id,provider,policy_number,abha_id,scheme_name) VALUES (?,?,?,?,?)',
        [req.params.id, encrypt(req.body.insurance_provider) || null, encrypt(req.body.policy_number) || null, encrypt(req.body.abha_id) || null, encrypt(req.body.scheme_name) || null]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Update failed' }); }
});

app.post('/api/patients/:id/request-otp', async (req, res) => {
  try {
    const p = await get('SELECT id, phone, name FROM patients WHERE id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    const realPhone = decrypt(p.phone);
    const otp = generateOTP();
    await run('INSERT INTO otp_sessions (phone,otp_hash,expires_at,purpose) VALUES (?,?,?,?)',
      [realPhone, bcrypt.hashSync(otp, 10), new Date(Date.now() + 5 * 60 * 1000).toISOString(), 'doctor_access']);
    const { doctor_id, doctor_name } = req.body;
    await run("INSERT INTO access_logs (patient_id,accessor_id,accessor_name,accessor_type,layer_accessed,purpose) VALUES (?,?,?,'doctor','Layer 1 - Emergency','QR Scan')",
      [req.params.id, doctor_id || 'anonymous', doctor_name || 'Unknown']);
    console.log(` Doctor OTP for ${p.name}: ${otp}`);
    res.json({ success: true, mock_otp: otp, patient_phone: realPhone });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/patients/:id/verify-doctor-otp', async (req, res) => {
  try {
    const p = await get('SELECT id, phone FROM patients WHERE id=?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Patient not found' });
    const realPhone = decrypt(p.phone);
    const { otp } = req.body;
    const sessions = await all("SELECT * FROM otp_sessions WHERE phone=? AND purpose='doctor_access' AND used=0 AND expires_at>datetime('now') ORDER BY id DESC LIMIT 1", [realPhone]);
    const session = sessions[0];
    if (!session) return res.status(400).json({ error: 'OTP expired' });
    if (!bcrypt.compareSync(otp, session.otp_hash)) return res.status(400).json({ error: 'Invalid OTP' });
    await run('UPDATE otp_sessions SET used=1 WHERE id=?', [session.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/hospitals/list', async (req, res) => {
  try {
    const hospitals = await all('SELECT id, name, city, type FROM hospitals ORDER BY name');
    res.json({ success: true, hospitals });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch hospitals' }); }
});

// === DOCTOR ROUTES ===
app.post('/api/doctors/register', upload.fields([{ name: 'photo', maxCount: 1 }, { name: 'certificate', maxCount: 1 }]), async (req, res) => {
  try {
    const { name, specialization, hospital, hospital_id, license_number, phone, email, password,
      latitude, longitude, consultation_fee, experience_years, available_days, available_start, available_end } = req.body;

    if (!name || !email || !password) return res.status(400).json({ error: 'Name, email, password required' });
    if (await get('SELECT id FROM doctors WHERE email=?', [email])) return res.status(409).json({ error: 'Email exists' });

    // Process files
    let profile_photo = null;
    let medical_certificate = null;

    if (req.files) {
      if (req.files.photo && req.files.photo[0]) {
        profile_photo = `data:${req.files.photo[0].mimetype};base64,${req.files.photo[0].buffer.toString('base64')}`;
      }
      if (req.files.certificate && req.files.certificate[0]) {
        medical_certificate = `data:${req.files.certificate[0].mimetype};base64,${req.files.certificate[0].buffer.toString('base64')}`;
      }
    }

    if (!medical_certificate) return res.status(400).json({ error: 'Medical certificate is mandatory' });

    const id = uuidv4();
    await run(`INSERT INTO doctors (id,name,specialization,hospital,hospital_id,license_number,phone,email,password_hash,latitude,longitude,consultation_fee,experience_years,available_days,available_start,available_end,bio,profile_photo,medical_certificate,status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, name, specialization, hospital, hospital_id || null, license_number, phone, email, bcrypt.hashSync(password, 10),
        latitude ? parseFloat(latitude) : null, longitude ? parseFloat(longitude) : null,
        consultation_fee ? parseInt(consultation_fee) : 500, experience_years ? parseInt(experience_years) : 0,
        available_days || 'Mon,Tue,Wed,Thu,Fri', available_start || '09:00', available_end || '17:00', '', profile_photo, medical_certificate, 'pending']);

    console.log(`--- Doctor registered (Pending Approval): Dr. ${name} for ${hospital || 'Unknown'}`);
    res.json({ success: true, doctor: { id, name, email, specialization, hospital, status: 'pending' } });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Registration failed' }); }
});

// ============================================================
// PROXIMITY INTELLIGENCE - City-Locked Hospital Discovery
// ============================================================
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

app.get('/api/hospitals/proximity', async (req, res) => {
  try {
    const { lat, lng, city, radius, search } = req.query;
    const maxKm = parseFloat(radius) || 80;
    let hospitals = await all('SELECT * FROM hospitals ORDER BY name ASC');

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    // Calculate Haversine distance and fetch beds for all hospitals
    hospitals = await Promise.all(hospitals.map(async h => {
      if (userLat && userLng && h.latitude && h.longitude) {
        h.distance_km = haversine(userLat, userLng, parseFloat(h.latitude), parseFloat(h.longitude));
      } else {
        h.distance_km = null;
      }
      // Attach bed data
      try {
        const beds = await get('SELECT * FROM hospital_beds WHERE hospital_id=?', [h.id]);
        if (beds) {
          h.icu_available = beds.icu_available; h.icu_total = beds.icu_total;
          h.emergency_available = beds.emergency_available; h.emergency_total = beds.emergency_total;
          h.general_available = beds.general_available; h.general_total = beds.general_total;
        }
      } catch (_) { }
      return h;
    }));

    // -- SARVAM SPATIAL RESONANCE: Strict City-Node Protocol --
    if (city && city.trim()) {
      const cityLower = city.trim().toLowerCase();
      // Resonance Synonym Mapping (Bangalore/Bengaluru/Legacy Typos)
      const isBangalore = cityLower.includes('bangalore') || cityLower.includes('bengaluru') || cityLower.includes('bangaore');

      hospitals = hospitals.filter(h => {
        const hCity = (h.city || '').toLowerCase();
        if (hCity.includes(cityLower)) return true;
        if (isBangalore && (hCity.includes('bangalore') || hCity.includes('bengaluru') || hCity.includes('bangaore'))) return true;
        return false;
      });
    }

    // Filter by radius if GPS is provided and no city lock is active
    if (userLat && userLng && (!city || !city.trim())) {
      hospitals = hospitals.filter(h => h.distance_km === null || h.distance_km <= maxKm);
    }

    // Optional text search (name/address)
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      hospitals = hospitals.filter(h =>
        (h.name || '').toLowerCase().includes(q) ||
        (h.city || '').toLowerCase().includes(q) ||
        (h.address || '').toLowerCase().includes(q)
      );
    }

    // Sort: distance ascending (nulls last)
    hospitals.sort((a, b) => {
      if (a.distance_km === null && b.distance_km === null) return 0;
      if (a.distance_km === null) return 1;
      if (b.distance_km === null) return -1;
      return a.distance_km - b.distance_km;
    });

    res.json({ success: true, hospitals, total: hospitals.length, city_locked: !!(userLat && userLng) });
  } catch (e) {
    res.status(500).json({ error: 'Proximity search failed: ' + e.message });
  }
});

// List doctors (optionally filter nearby + city-lock)
app.get('/api/doctors/nearby', async (req, res) => {
  try {
    const { lat, lng, radius, search, city } = req.query;
    let docs = await all('SELECT id,name,specialization,hospital,hospital_id,phone,email,latitude,longitude,consultation_fee,experience_years,available_days,available_start,available_end,profile_photo,created_at FROM doctors WHERE status=? ORDER BY created_at DESC', ['approved']);

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;
    const maxKm = parseFloat(radius) || 25;

    // Calculate distance for ALL doctors first
    docs = await Promise.all(docs.map(async d => {
      if (userLat && userLng && d.latitude && d.longitude) {
        const R = 6371;
        const dLat = (d.latitude - userLat) * Math.PI / 180;
        const dLng = (d.longitude - userLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLat * Math.PI / 180) * Math.cos(d.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
        d.distance_km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      } else if (userLat && userLng) {
        // No coords on doctor - try to match by hospital city
        const hid = d.hospital_id;
        if (hid) {
          const hosp = await get('SELECT city, latitude, longitude FROM hospitals WHERE id=?', [hid]);
          if (hosp && hosp.latitude && hosp.longitude) {
            const R = 6371;
            const dLat = (hosp.latitude - userLat) * Math.PI / 180;
            const dLng = (hosp.longitude - userLng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) ** 2 + Math.cos(userLat * Math.PI / 180) * Math.cos(hosp.latitude * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
            d.distance_km = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          } else {
            d.distance_km = null;
          }
        } else {
          d.distance_km = null;
        }
      } else {
        d.distance_km = null;
      }
      return d;
    }));

    // -- SARVAM SPATIAL RESONANCE: Doctor City-Node Handshake --
    if (city && city.trim()) {
      const cityLower = city.trim().toLowerCase();
      const isBangalore = cityLower.includes('bangalore') || cityLower.includes('bengaluru');
      const filteredDocs = [];
      for (const d of docs) {
        const docHospital = (d.hospital || '').toLowerCase();
        let match = false;
        if (docHospital.includes(cityLower)) match = true;
        else if (isBangalore && (docHospital.includes('bangalore') || docHospital.includes('bengaluru'))) match = true;
        else if (d.hospital_id) {
          try {
            const hosp = await get('SELECT city, address FROM hospitals WHERE id=?', [d.hospital_id]);
            if (hosp) {
              const hCity = (hosp.city || '').toLowerCase();
              if (hCity.includes(cityLower) || (isBangalore && (hCity.includes('bangalore') || hCity.includes('bengaluru'))) || (hosp.address || '').toLowerCase().includes(cityLower)) {
                match = true;
              }
            }
          } catch (_) { }
        }
        if (match) filteredDocs.push(d);
      }
      docs = filteredDocs;
    }

    // GPS-based sort: sort by distance ascending (nulls last)
    if (userLat && userLng) {
      docs.sort((a, b) => {
        if (a.distance_km === null && b.distance_km === null) return 0;
        if (a.distance_km === null) return 1;
        if (b.distance_km === null) return -1;
        return a.distance_km - b.distance_km;
      });
    }

    // Text search filter
    if (search) {
      const q = search.toLowerCase();
      docs = docs.filter(d => (d.name || '').toLowerCase().includes(q) || (d.specialization || '').toLowerCase().includes(q) || (d.hospital || '').toLowerCase().includes(q));
    }

    res.json({ success: true, doctors: docs });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/doctors/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const doc = await get('SELECT * FROM doctors WHERE email=?', [email]);
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });

    // Approval Guard
    if (doc.status === 'pending') {
      const hospitalName = doc.hospital || 'your selected hospital';
      return res.status(403).json({ error: `Your registration is pending approval from ${hospitalName}. Please try again later.` });
    }
    if (doc.status === 'rejected') return res.status(403).json({ error: 'Your registration was not approved. Please contact the hospital administrator.' });

    if (!bcrypt.compareSync(password, doc.password_hash)) return res.status(401).json({ error: 'Invalid password' });

    // -- New Login Verification: check for trusted device token
    const deviceToken = req.headers['x-device-token'] || '';
    if (!checkDeviceToken(doc.id, 'doctor', deviceToken)) {
      const otp = generateSecureOTP();
      const otpHash = bcrypt.hashSync(otp, 10);
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      await run('INSERT INTO otp_sessions (phone, otp_hash, expires_at, purpose) VALUES (?,?,?,?)',
        [email, otpHash, expiresAt, 'login_verify_doctor']);
      setMemoryOtp(email, otp, 'login_verify_doctor');

      let emailSent = false, devOtp = null;
      try {
        await sendUniversalEmail({
          to: email,
          subject: `${otp} - Your Sarvam Login Verification Code`,
          html: buildLoginOtpEmailHtml(otp, 'Dr. ' + doc.name),
          text: `Your Sarvam login verification code is: ${otp}. Expires in 5 minutes.`
        });
        emailSent = true;
        console.log(`- Doctor Login OTP emailed to ${email}`);
      } catch (mailErr) {
        console.warn('- SMTP failed or timed out, falling back to dev mode:', mailErr.message);
      }
      return res.json({ requires_verification: true, user_name: doc.name, email, email_sent: emailSent, dev_otp: otp });
    }

    // Trusted device: return full session
    const recent = await all('SELECT DISTINCT al.patient_id,p.name as patient_name,al.timestamp,al.layer_accessed FROM access_logs al JOIN patients p ON al.patient_id=p.id WHERE al.accessor_id=? ORDER BY al.timestamp DESC LIMIT 10', [doc.id]);
    delete doc.password_hash;
    res.json({ success: true, doctor: doc, recent_patients: recent });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/prescriptions', upload.single('lab_report'), async (req, res) => {
  try {
    const { patient_id, doctor_id, doctor_name, hospital, medications, notes } = req.body;
    if (!patient_id) return res.status(400).json({ error: 'Patient ID required' });
    if (!await get('SELECT id FROM patients WHERE id=?', [patient_id])) return res.status(404).json({ error: 'Patient not found' });
    const lab = req.file ? `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}` : null;
    const labName = req.file ? req.file.originalname : null;
    await run('INSERT INTO prescriptions (patient_id,doctor_id,doctor_name,hospital,medications,notes,lab_report,lab_report_name) VALUES (?,?,?,?,?,?,?,?)',
      [patient_id, doctor_id, doctor_name, hospital, encrypt(typeof medications === 'string' ? medications : JSON.stringify(medications || [])), encrypt(notes), lab, encrypt(labName)]);
    await run("INSERT INTO access_logs (patient_id,accessor_id,accessor_name,accessor_type,layer_accessed,purpose) VALUES (?,?,?,'doctor','Layer 2','Added Prescription')",
      [patient_id, doctor_id, doctor_name || 'Doctor']);
    res.json({ success: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed' }); }
});

// === SARVAM QUANTUM SCAN (Dual-Save Logic) ===
app.post('/api/sarvam/quantum-scan', async (req, res) => {
  const { patientId, doctorId } = req.body;
  const hospitalId = req.body.hospitalId || doctorId;
  if (!patientId || !doctorId || !hospitalId) return res.status(400).json({ error: 'Missing scan metadata' });

  try {
    // 1. Verify Patient
    const patient = await get('SELECT id, name, blood_group FROM patients WHERE id = ?', [patientId]);
    if (!patient) return res.status(404).json({ error: 'Patient Identity Not Found' });

    // 2. Generate Secure Handshake Token (10 min expiry)
    const accessToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    // 3. Global Access Log (Privacy Record)
    await run(`INSERT INTO access_logs (patient_id, accessor_id, accessor_name, accessor_type, layer_accessed, purpose)
         VALUES (?, ?, ?, 'doctor', 'Quantum Scan', 'Zero-Contact Onboarding')`,
      [patientId, doctorId, 'Doctor (' + doctorId.substring(0, 8) + ')']);

    // 4. Hospital Node Archival (Many-to-One Relationship)
    const existing = await get('SELECT id FROM hospital_patient_archives WHERE hospital_id = ? AND patient_id = ?', [hospitalId, patientId]);
    if (!existing) {
      await run(`INSERT INTO hospital_patient_archives (id, hospital_id, patient_id, access_token, expires_at, status)
           VALUES (?, ?, ?, ?, ?, 'synced')`,
        [uuidv4(), hospitalId, patientId, accessToken, expiresAt]);
    } else {
      await run(`UPDATE hospital_patient_archives SET access_token = ?, expires_at = ?, created_at = datetime('now') WHERE id = ?`,
        [accessToken, expiresAt, existing.id]);
    }

    // 5. Real-Time Success Notification
    const fp = formatPatientFromDB(patient);
    sseSend(doctorSSE, doctorId, 'quantum_scan_success', {
      patient: { id: fp.id, name: fp.name, blood_group: fp.blood_group },
      hospitalId,
      accessToken
    });

    res.json({ success: true, accessToken, patient: { name: fp.name } });
  } catch (err) {
    console.error('Handshake Error:', err);
    res.status(500).json({ error: 'Quantum scan failed to sync' });
  }
});


// === ADMIN ROUTES ===
app.post('/api/admins/register', async (req, res) => {
  try {
    const { name, organization, org_type, email, password } = req.body;
    if (!name || !organization || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (await get('SELECT id FROM admins WHERE email=?', [email])) return res.status(409).json({ error: 'Email exists' });
    const id = uuidv4();
    await run('INSERT INTO admins (id,name,organization,org_type,email,password_hash) VALUES (?,?,?,?,?,?)',
      [id, name, organization, org_type || 'Hospital', email, bcrypt.hashSync(password, 10)]);
    res.json({ success: true, admin: { id, name, organization, org_type } });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/admins/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await get('SELECT * FROM admins WHERE email=?', [email]);
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    if (!bcrypt.compareSync(password, admin.password_hash)) return res.status(401).json({ error: 'Invalid password' });
    const stats = {
      patientCount: await get('SELECT COUNT(*) as count FROM patients').count,
      doctorCount: await get('SELECT COUNT(*) as count FROM doctors').count,
      prescriptionCount: await get('SELECT COUNT(*) as count FROM prescriptions').count
    };
    const patients = await all('SELECT id,name,phone,blood_group,created_at FROM patients ORDER BY created_at DESC LIMIT 20');
    const doctors = await all('SELECT id,name,specialization,hospital,email FROM doctors ORDER BY created_at DESC');
    const recentLogs = await all('SELECT al.*,p.name as patient_name FROM access_logs al LEFT JOIN patients p ON al.patient_id=p.id ORDER BY al.timestamp DESC LIMIT 20');
    delete admin.password_hash;
    res.json({ success: true, admin, stats, patients, doctors, recentLogs });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// === APPOINTMENT ROUTES ===

// Slot availability for a doctor on a date (30-min slots)
app.get('/api/appointments/slots/:doctorId/:date', async (req, res) => {
  try {
    const doc = await get('SELECT available_start,available_end,available_days FROM doctors WHERE id=?', [req.params.doctorId]);
    const start = doc?.available_start || '09:00';
    const end = doc?.available_end || '17:00';
    const days = doc?.available_days || 'Mon,Tue,Wed,Thu,Fri'; // default Mon-Fri

    // Strict Day-of-Week Handshake
    const requestedDay = new Date(req.params.date).toLocaleDateString('en-US', { weekday: 'short' });
    if (!days.toLowerCase().includes(requestedDay.toLowerCase())) {
      return res.json({ success: true, slots: [], message: 'Doctor is not available on this day' });
    }
    // Build 30-min slot list
    const slots = [];
    let [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    while (sh * 60 + sm < eh * 60 + em) {
      const hh = String(sh).padStart(2, '0');
      const mm = String(sm).padStart(2, '0');
      const ampm = sh < 12 ? 'AM' : 'PM';
      const h12 = sh === 0 ? 12 : sh > 12 ? sh - 12 : sh;
      slots.push(`${String(h12).padStart(2, '0')}:${mm} ${ampm}`);
      sm += 30; if (sm >= 60) { sm -= 60; sh++; }
    }
    // Find booked/pending slots
    const taken = await all(
      `SELECT time_slot FROM appointments WHERE doctor_id=? AND date=? AND status IN ('pending','confirmed')`,
      [req.params.doctorId, req.params.date]
    ).map(r => r.time_slot);
    res.json({ success: true, slots: slots.map(s => ({ time: s, locked: taken.includes(s) })) });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/appointments', async (req, res) => {
  try {
    const { patient_id, doctor_id, patient_name, doctor_name, date, time_slot, notes } = req.body;
    if (!patient_id || !doctor_id || !date) return res.status(400).json({ error: 'Patient, doctor, and date required' });
    // Conflict check
    if (time_slot) {
      const conflict = await get(`SELECT id FROM appointments WHERE doctor_id=? AND date=? AND time_slot=? AND status IN ('pending','confirmed')`,
        [doctor_id, date, time_slot]);
      if (conflict) return res.status(409).json({ error: 'This slot was just booked. Please choose another.' });
    }
    await run('INSERT INTO appointments (patient_id,doctor_id,patient_name,doctor_name,date,time_slot,notes,status) VALUES (?,?,?,?,?,?,?,?)',
      [patient_id, doctor_id, patient_name, doctor_name, date, time_slot || null, encrypt(notes || null), 'pending']);
    const apt = await get('SELECT * FROM appointments WHERE patient_id=? AND doctor_id=? AND date=? AND time_slot=? ORDER BY id DESC LIMIT 1',
      [patient_id, doctor_id, date, time_slot || null]);
    // Notify doctor via SSE
    sseSend(doctorSSE, doctor_id, 'new_request', { appointment: apt });
    res.json({ success: true, appointment: apt });
  } catch (err) { res.status(500).json({ error: 'Booking failed' }); }
});

app.get('/api/appointments/:patientId', async (req, res) => {
  try {
    const appointments = await all('SELECT a.*,d.specialization,d.hospital,d.phone as doctor_phone FROM appointments a LEFT JOIN doctors d ON a.doctor_id=d.id WHERE a.patient_id=? ORDER BY a.date DESC', [req.params.patientId]);
    res.json({ success: true, appointments: appointments.map(a => ({ ...a, notes: decrypt(a.notes) })) });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Doctor appointments with stats
app.get('/api/doctors/:id/appointments', async (req, res) => {
  try {
    const apts = await all('SELECT a.*,p.phone as patient_phone FROM appointments a LEFT JOIN patients p ON a.patient_id=p.id WHERE a.doctor_id=? ORDER BY a.date DESC', [req.params.id]);
    const finalApts = apts.map(a => ({ ...a, notes: decrypt(a.notes), patient_phone: decrypt(a.patient_phone) }));
    const today = new Date().toISOString().split('T')[0];
    const total = finalApts.length;
    const upcoming = finalApts.filter(a => a.date >= today && a.status === 'confirmed').length;
    const pending = finalApts.filter(a => a.status === 'pending').length;
    res.json({ success: true, appointments: finalApts, stats: { total, upcoming, pending } });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Fetch archived patients for a doctor's hospital (Sarvam History)
app.get('/api/doctors/:id/archives', async (req, res) => {
  try {
    const doc = await get('SELECT id, hospital_id FROM doctors WHERE id = ?', [req.params.id]);
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });
    const targetHospitalId = doc.hospital_id || doc.id;

    const archives = await all(`
      SELECT 
        a.id, a.created_at as sync_at, a.status,
        p.name as patient_name, p.id as patient_id, 
        p.blood_group, p.photo
      FROM hospital_patient_archives a
      JOIN patients p ON a.patient_id = p.id
      WHERE a.hospital_id = ?
      ORDER BY a.created_at DESC
    `, [targetHospitalId]);

    res.json({ success: true, archives: archives.map(a => ({ ...a, blood_group: decrypt(a.blood_group) })) });
  } catch (err) {
    console.error('Archives Fetch Error:', err);
    res.status(500).json({ error: 'Failed to load quantum history' });
  }
});

// Approve appointment
app.patch('/api/appointments/:id/approve', async (req, res) => {
  try {
    await run('UPDATE appointments SET status=? WHERE id=?', ['confirmed', req.params.id]);
    
    const apt = await get('SELECT * FROM appointments WHERE id=?', [req.params.id]);
    if (apt) sseSend(patientSSE, apt.patient_id, 'appointment_update', { appointment: apt });
    res.json({ success: true, appointment: apt });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Cancel appointment
app.patch('/api/appointments/:id/cancel', async (req, res) => {
  try {
    const apBefore = await get('SELECT * FROM appointments WHERE id=?', [req.params.id]);
    await run('UPDATE appointments SET status=? WHERE id=?', ['cancelled', req.params.id]);
    
    const apt = await get('SELECT * FROM appointments WHERE id=?', [req.params.id]);
    if (apt) sseSend(patientSSE, apt.patient_id, 'appointment_update', { appointment: apt });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// SSE streams
app.get('/api/sse/doctor/:doctorId', async (req, res) => {
  sseSubscribe(doctorSSE, req.params.doctorId, res);
});
app.get('/api/sse/patient/:patientId', async (req, res) => {
  sseSubscribe(patientSSE, req.params.patientId, res);
});

// Update doctor profile & availability
app.put('/api/doctors/:id', async (req, res) => {
  try {
    const { name, specialization, hospital, phone, email, consultation_fee, experience_years,
      available_days, available_start, available_end, bio, profile_photo } = req.body;
    await run(`UPDATE doctors SET name=?,specialization=?,hospital=?,phone=?,email=?,consultation_fee=?,experience_years=?,available_days=?,available_start=?,available_end=?,bio=?,profile_photo=? WHERE id=?`,
      [name, specialization, hospital, phone, email,
        consultation_fee ? parseInt(consultation_fee) : 500, experience_years ? parseInt(experience_years) : 0,
        available_days || 'Mon,Tue,Wed,Thu,Fri', available_start || '09:00', available_end || '17:00', bio || '', profile_photo || null, req.params.id]);
    
    const updated = await get('SELECT * FROM doctors WHERE id=?', [req.params.id]);
    delete updated.password_hash;
    res.json({ success: true, doctor: updated });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Update failed' }); }
});

// =====================================================
// SUPER ADMIN ROUTES
// =====================================================
app.post('/api/super-admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const sa = await get('SELECT * FROM super_admins WHERE email=?', [email]);
    if (!sa) return res.status(404).json({ error: 'Super Admin not found' });
    if (!bcrypt.compareSync(password, sa.password_hash)) return res.status(401).json({ error: 'Invalid password' });
    delete sa.password_hash;
    res.json({ success: true, superAdmin: sa });
  } catch (err) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/super-admin/dashboard', async (req, res) => {
  try {
    const stats = {
      hospitals: await get('SELECT COUNT(*) as c FROM hospitals').c,
      hospitalHeads: await get('SELECT COUNT(*) as c FROM hospital_heads').c,
      doctors: await get('SELECT COUNT(*) as c FROM doctors').c,
      patients: await get('SELECT COUNT(*) as c FROM patients').c,
      appointments: await get('SELECT COUNT(*) as c FROM appointments').c,
      totalBeds: await get('SELECT COALESCE(SUM(beds_total),0) as c FROM hospitals').c,
    };
    const hospitals = await all('SELECT h.*, (SELECT COUNT(*) FROM hospital_heads hh WHERE hh.hospital_id=h.id) as head_count, (SELECT COUNT(*) FROM departments d WHERE d.hospital_id=h.id) as dept_count, (SELECT COUNT(*) FROM staff s WHERE s.hospital_id=h.id) as staff_count FROM hospitals h ORDER BY h.created_at DESC');
    const recentLogs = await all('SELECT al.*,p.name as patient_name FROM access_logs al LEFT JOIN patients p ON al.patient_id=p.id ORDER BY al.timestamp DESC LIMIT 20');
    res.json({ success: true, stats, hospitals, recentLogs });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/super-admin/hospitals', async (req, res) => {
  try {
    const { name, address, city, phone, email, type, beds_total } = req.body;
    if (!name) return res.status(400).json({ error: 'Hospital name required' });
    if (!email) return res.status(400).json({ error: 'Admin email required' });
    const id = uuidv4();
    await run('INSERT INTO hospitals (id,name,address,city,phone,email,type,beds_total) VALUES (?,?,?,?,?,?,?,?)',
      [id, name, address || '', city || '', phone || '', email || '', type || 'Hospital', parseInt(beds_total) || 0]);
    res.status(201).json({ success: true, hospital: { id, name, address, city, phone, email, type, beds_total: parseInt(beds_total) || 0 } });
  } catch (err) { res.status(500).json({ error: 'Failed to save hospital' }); }
});

app.get('/api/super-admin/hospitals', async (req, res) => {
  try {
    const hospitals = await all('SELECT h.*, (SELECT COUNT(*) FROM hospital_heads hh WHERE hh.hospital_id=h.id) as head_count, (SELECT COUNT(*) FROM departments d WHERE d.hospital_id=h.id) as dept_count, (SELECT COUNT(*) FROM staff s WHERE s.hospital_id=h.id) as staff_count FROM hospitals h ORDER BY h.created_at DESC');
    res.json({ success: true, hospitals });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/super-admin/hospitals/:id', async (req, res) => {
  try {
    const { name, address, city, phone, email, type, beds_total } = req.body;
    await run('UPDATE hospitals SET name=?,address=?,city=?,phone=?,email=?,type=?,beds_total=? WHERE id=?',
      [name, address || '', city || '', phone || '', email || '', type || 'Hospital', parseInt(beds_total) || 0, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/super-admin/hospitals/:id', async (req, res) => {
  try {
    await run('DELETE FROM hospital_heads WHERE hospital_id=?', [req.params.id]);
    await run('DELETE FROM departments WHERE hospital_id=?', [req.params.id]);
    await run('DELETE FROM staff WHERE hospital_id=?', [req.params.id]);
    await run('DELETE FROM inventory WHERE hospital_id=?', [req.params.id]);
    await run('DELETE FROM hospitals WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Hospital Head CRUD (Super Admin manages)
app.post('/api/super-admin/hospital-heads', async (req, res) => {
  try {
    const { hospital_id, name, email, password } = req.body;
    if (!hospital_id || !name || !email || !password) return res.status(400).json({ error: 'All fields required' });
    if (!await get('SELECT id FROM hospitals WHERE id=?', [hospital_id])) return res.status(404).json({ error: 'Hospital not found' });
    if (await get('SELECT id FROM hospital_heads WHERE email=?', [email])) return res.status(409).json({ error: 'Email already exists' });
    const id = uuidv4();
    await run('INSERT INTO hospital_heads (id,hospital_id,name,email,password_hash) VALUES (?,?,?,?,?)',
      [id, hospital_id, name, email, bcrypt.hashSync(password, 10)]);
    res.json({ success: true, head: { id, hospital_id, name, email } });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/super-admin/hospital-heads', async (req, res) => {
  try {
    const heads = await all('SELECT hh.id,hh.hospital_id,hh.name,hh.email,hh.created_at,h.name as hospital_name FROM hospital_heads hh LEFT JOIN hospitals h ON hh.hospital_id=h.id ORDER BY hh.created_at DESC');
    res.json({ success: true, heads });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/super-admin/hospital-heads/:id', async (req, res) => {
  try {
    await run('DELETE FROM hospital_heads WHERE id=?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.get('/api/super-admin/logs', async (req, res) => {
  try {
    const logs = await all('SELECT al.*,p.name as patient_name FROM access_logs al LEFT JOIN patients p ON al.patient_id=p.id ORDER BY al.timestamp DESC LIMIT 50');
    res.json({ success: true, logs });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// =====================================================
// HOSPITAL HEAD ROUTES (Scoped to hospital_id)
// =====================================================
app.post('/api/hospital-head/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const hh = await get('SELECT hh.*,h.name as hospital_name,h.type as hospital_type,h.city as hospital_city,h.beds_total FROM hospital_heads hh LEFT JOIN hospitals h ON hh.hospital_id=h.id WHERE hh.email=?', [email]);
    if (!hh) return res.status(404).json({ error: 'Hospital Head not found' });
    if (!bcrypt.compareSync(password, hh.password_hash)) return res.status(401).json({ error: 'Invalid password' });
    delete hh.password_hash;
    res.json({ success: true, hospitalHead: hh });
  } catch (err) { res.status(500).json({ error: 'Login failed' }); }
});

app.get('/api/hospital-head/:hospitalId/dashboard', async (req, res) => {
  try {
    const hid = req.params.hospitalId;
    const hospital = await get('SELECT * FROM hospitals WHERE id=?', [hid]);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    const stats = {
      departments: await get('SELECT COUNT(*) as c FROM departments WHERE hospital_id=?', [hid]).c,
      staff: await get('SELECT COUNT(*) as c FROM staff WHERE hospital_id=?', [hid]).c,
      inventory: await get('SELECT COUNT(*) as c FROM inventory WHERE hospital_id=?', [hid]).c,
      lowStock: await get('SELECT COUNT(*) as c FROM inventory WHERE hospital_id=? AND quantity<=reorder_level', [hid]).c,
    };
    res.json({ success: true, hospital, stats });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Departments
app.get('/api/hospital-head/:hospitalId/departments', async (req, res) => {
  try {
    const depts = await all('SELECT d.*, (SELECT COUNT(*) FROM staff s WHERE s.department_id=d.id) as staff_count FROM departments d WHERE d.hospital_id=? ORDER BY d.name', [req.params.hospitalId]);
    res.json({ success: true, departments: depts });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/hospital-head/:hospitalId/departments', async (req, res) => {
  try {
    const { name, head_name } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name required' });
    const id = uuidv4();
    await run('INSERT INTO departments (id,hospital_id,name,head_name) VALUES (?,?,?,?)',
      [id, req.params.hospitalId, name, head_name || '']);
    res.json({ success: true, department: { id, name, head_name } });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/hospital-head/:hospitalId/departments/:id', async (req, res) => {
  try {
    await run('DELETE FROM departments WHERE id=? AND hospital_id=?', [req.params.id, req.params.hospitalId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Staff
app.get('/api/hospital-head/:hospitalId/staff', async (req, res) => {
  try {
    const staffList = await all('SELECT s.*,d.name as department_name FROM staff s LEFT JOIN departments d ON s.department_id=d.id WHERE s.hospital_id=? ORDER BY s.name', [req.params.hospitalId]);
    res.json({ success: true, staff: staffList });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/hospital-head/:hospitalId/staff', async (req, res) => {
  try {
    const { name, role, department_name, phone, email, shift } = req.body;
    if (!name) return res.status(400).json({ error: 'Staff name required' });

    const hid = req.params.hospitalId;
    let deptId = null;

    if (department_name) {
      // Find or Create department
      let dept = await get('SELECT id FROM departments WHERE hospital_id=? AND name=?', [hid, department_name]);
      if (dept) {
        deptId = dept.id;
      } else {
        deptId = uuidv4();
        await run('INSERT INTO departments (id,hospital_id,name,head_name) VALUES (?,?,?,?)', [deptId, hid, department_name, '']);
      }
    }

    const id = uuidv4();
    await run('INSERT INTO staff (id,hospital_id,department_id,name,role,phone,email,shift) VALUES (?,?,?,?,?,?,?,?)',
      [id, hid, deptId, name, role || 'Nurse', phone || '', email || '', shift || 'Day']);
    res.json({ success: true, staff: { id, name, role, department_id: deptId, phone, email, shift } });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/hospital-head/:hospitalId/staff/:id', async (req, res) => {
  try {
    await run('DELETE FROM staff WHERE id=? AND hospital_id=?', [req.params.id, req.params.hospitalId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// Inventory
app.get('/api/hospital-head/:hospitalId/inventory', async (req, res) => {
  try {
    const items = await all('SELECT * FROM inventory WHERE hospital_id=? ORDER BY item_name', [req.params.hospitalId]);
    res.json({ success: true, inventory: items });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.post('/api/hospital-head/:hospitalId/inventory', async (req, res) => {
  try {
    const { item_name, category, quantity, unit, reorder_level } = req.body;
    if (!item_name) return res.status(400).json({ error: 'Item name required' });
    await run('INSERT INTO inventory (hospital_id,item_name,category,quantity,unit,reorder_level) VALUES (?,?,?,?,?,?)',
      [req.params.hospitalId, item_name, category || 'Medicine', parseInt(quantity) || 0, unit || 'pcs', parseInt(reorder_level) || 10]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.put('/api/hospital-head/:hospitalId/inventory/:id', async (req, res) => {
  try {
    const { item_name, category, quantity, unit, reorder_level } = req.body;
    await run('UPDATE inventory SET item_name=?,category=?,quantity=?,unit=?,reorder_level=?,updated_at=datetime("now") WHERE id=? AND hospital_id=?',
      [item_name, category, parseInt(quantity) || 0, unit || 'pcs', parseInt(reorder_level) || 10, req.params.id, req.params.hospitalId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

app.delete('/api/hospital-head/:hospitalId/inventory/:id', async (req, res) => {
  try {
    await run('DELETE FROM inventory WHERE id=? AND hospital_id=?', [req.params.id, req.params.hospitalId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// =====================================================
// AI HEALTH ASSISTANT ROUTES
// =====================================================
function generateHealthResponse(message, patientContext) {
  const msg = message.toLowerCase().trim();
  const disclaimer = '\n\n-- *I am an AI assistant, not a doctor. For serious concerns or emergencies, please consult a healthcare professional or call your local emergency services immediately.*';

  // Greetings
  if (/^(hi|hello|hey|good\s*(morning|afternoon|evening)|greetings)/i.test(msg)) {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    return {
      reply: `${timeGreeting}! I'm your AI Health & Wellness Assistant. \n\nI can help you with:\n* **Symptom assessment** - describe your symptoms for guidance\n* **Medication information** - ask about common medications\n* **Lifestyle advice** - nutrition, exercise, sleep tips\n* **Health tips** - preventive care and wellness\n* **BMI calculation** - say "BMI" with your height and weight\n\nWhat health concern can I help you with today?`,
      category: 'greeting'
    };
  }

  // Emergency detection
  if (/chest\s*pain|heart\s*attack|can't\s*breathe|difficulty\s*breathing|stroke|severe\s*bleeding|unconscious|not\s*breathing|suicide|self[\s-]*harm/i.test(msg)) {
    return {
      reply: ' **EMERGENCY ALERT** \n\nThis sounds like a medical emergency. Please take immediate action:\n\n1. **Call emergency services NOW** (112 / 108 / 911)\n2. Do not wait - every second counts\n3. If someone is with you, ask them to help\n4. Stay calm and follow dispatcher instructions\n\nIf you are experiencing thoughts of self-harm, please contact a crisis helpline:\n* **iCall**: 9152987821\n* **Vandrevala Foundation**: 1860-2662-345\n\n**Do not delay seeking help.**',
      category: 'emergency'
    };
  }

  // Symptom: Fever
  if (/fever|high\s*temperature|chills|body\s*ache/i.test(msg)) {
    const tempMatch = msg.match(/(\d{2,3}(\.\d)?)\s*(-|degree|f|c|fahrenheit|celsius)?/i);
    let tempAdvice = '';
    if (tempMatch) {
      const temp = parseFloat(tempMatch[1]);
      if (temp >= 104) tempAdvice = '\n\n **Your temperature is dangerously high (>104-F / 40-C). Seek emergency medical attention immediately.**';
      else if (temp >= 102) tempAdvice = '\n\n **Your fever is high (>102-F). Consider seeing a doctor soon.**';
      else if (temp >= 100.4) tempAdvice = '\n\n **You have a fever (>100.4-F). Monitor closely.**';
    }
    return {
      reply: `**Fever Management Guidelines**${tempAdvice}\n\n**What to do:**\n* Rest and stay hydrated - drink water, ORS, coconut water\n* Take Paracetamol (Acetaminophen) 500-650mg every 4-6 hours (max 4g/day)\n* Apply a cool, damp cloth to your forehead\n* Wear light clothing\n* Monitor temperature every 4 hours\n\n**See a doctor if:**\n* Fever persists >3 days\n* Temperature exceeds 103-F (39.4-C)\n* Accompanied by severe headache, stiff neck, rash, or confusion\n* You have a weakened immune system${disclaimer}`,
      category: 'symptom'
    };
  }

  // Symptom: Headache
  if (/headache|migraine|head\s*(pain|throbbing|pounding)/i.test(msg)) {
    return {
      reply: `**Headache Assessment & Relief**\n\n**Common causes:**\n* Tension (stress, poor posture, eye strain)\n* Dehydration\n* Sleep deprivation\n* Sinus congestion\n* Migraine\n\n**Home remedies:**\n* Rest in a quiet, dark room\n* Apply a cold or warm compress\n* Stay hydrated (drink 2-3 glasses of water)\n* Try gentle neck/shoulder stretches\n* Paracetamol 500mg or Ibuprofen 400mg with food\n\n**-- Seek immediate care if:**\n* Sudden, severe "thunderclap" headache\n* Headache with fever, stiff neck, confusion, or rash\n* After a head injury\n* Vision changes or weakness on one side\n* Worst headache of your life${disclaimer}`,
      category: 'symptom'
    };
  }

  // Symptom: Cold / Cough
  if (/cold|cough|runny\s*nose|sore\s*throat|congestion|sneezing|flu/i.test(msg)) {
    return {
      reply: `**Cold, Cough & Flu Guidance**\n\n**Home care:**\n* Rest adequately (7-9 hours of sleep)\n* Drink warm fluids - herbal tea, warm water with honey & lemon\n* Gargle with warm salt water for sore throat\n* Use a humidifier or steam inhalation\n* Saline nasal spray for congestion\n* Vitamin C-rich foods (citrus fruits, amla)\n\n**OTC Medications:**\n* Paracetamol for body ache/fever\n* Cetirizine for runny nose\n* Dextromethorphan for dry cough\n* Honey (1 tsp) for cough (not for children <1 year)\n\n**See a doctor if:**\n* Symptoms worsen after 7 days\n* High fever (>102-F) for >3 days\n* Green/yellow phlegm (possible bacterial infection)\n* Difficulty breathing or wheezing\n* Blood in sputum${disclaimer}`,
      category: 'symptom'
    };
  }

  // Symptom: Stomach / Digestive
  if (/stomach|nausea|vomit|diarrhea|diarrhoea|constipation|indigestion|acidity|gas|bloating|food\s*poisoning/i.test(msg)) {
    return {
      reply: `**Digestive Health Guidance**\n\n**For Diarrhea/Vomiting:**\n* ORS (Oral Rehydration Solution) - sip frequently\n* BRAT diet: Banana, Rice, Applesauce, Toast\n* Avoid dairy, spicy, and fatty foods\n* Stay hydrated - clear fluids, coconut water\n\n**For Acidity/Heartburn:**\n* Eat smaller, frequent meals\n* Avoid spicy/oily food, caffeine, alcohol\n* Don't lie down immediately after eating\n* Antacids (like Gelusil) for relief\n* Elevate head while sleeping\n\n**For Constipation:**\n* Increase fiber intake (fruits, vegetables, whole grains)\n* Drink 8-10 glasses of water daily\n* Regular physical activity\n* Prune juice can help naturally\n\n**-- See a doctor if:**\n* Blood in stool or vomit\n* Severe abdominal pain\n* Symptoms persist >3 days\n* Signs of dehydration (dark urine, dizziness)${disclaimer}`,
      category: 'symptom'
    };
  }

  // Symptom: Back pain / Body pain
  if (/back\s*pain|body\s*pain|joint\s*pain|muscle\s*pain|neck\s*pain|knee\s*pain|arthritis/i.test(msg)) {
    return {
      reply: `**Pain Management Guidance**\n\n**For Back/Neck Pain:**\n* Apply ice for the first 48 hours, then switch to heat\n* Gentle stretching and movement (avoid bed rest >1-2 days)\n* Maintain good posture while sitting\n* Over-the-counter: Ibuprofen 400mg with food\n* Use a firm mattress and proper pillow\n\n**For Joint/Knee Pain:**\n* RICE: Rest, Ice, Compression, Elevation\n* Low-impact exercise (swimming, walking)\n* Maintain healthy weight to reduce joint stress\n* Consider glucosamine supplements (consult doctor)\n\n**For Muscle Pain:**\n* Gentle stretching and light movement\n* Warm bath or heating pad\n* Topical analgesics (diclofenac gel)\n* Adequate protein intake for recovery\n\n**See a doctor if:**\n* Pain persists >2 weeks\n* Numbness, tingling, or weakness in limbs\n* Pain after injury or accident\n* Pain with fever or unexplained weight loss${disclaimer}`,
      category: 'symptom'
    };
  }

  // Symptom: Skin issues
  if (/skin|rash|itch|acne|eczema|allergy.*skin|hives|dry\s*skin|burn/i.test(msg)) {
    return {
      reply: `**Skin Health Guidance**\n\n**For Rashes/Itching:**\n* Avoid scratching - use a cold compress instead\n* Apply calamine lotion or moisturizer\n* Wear loose, breathable cotton clothing\n* Identify and avoid triggers (new soap, food, fabric)\n* Antihistamine (Cetirizine) for allergic itching\n\n**For Acne:**\n* Wash face twice daily with gentle cleanser\n* Don't pick or squeeze pimples\n* Use non-comedogenic moisturizer\n* Benzoyl peroxide (2.5-5%) for mild acne\n* Change pillowcase frequently\n\n**For Dry Skin:**\n* Moisturize immediately after bathing\n* Use fragrance-free products\n* Limit hot water showers\n* Humidifier in dry environments\n\n**See a dermatologist if:**\n* Rash spreads rapidly or has blisters\n* Signs of infection (warmth, pus, red streaks)\n* Persistent acne unresponsive to OTC treatment\n* New or changing moles${disclaimer}`,
      category: 'symptom'
    };
  }

  // Symptom: Sleep issues
  if (/sleep|insomnia|can't\s*sleep|sleepless|fatigue|tired|exhausted|drowsy/i.test(msg)) {
    return {
      reply: `**Sleep & Fatigue Guidance**\n\n**Sleep Hygiene Tips:**\n* Maintain a consistent sleep schedule (even weekends)\n* Avoid screens 1 hour before bed (blue light disrupts melatonin)\n* Keep bedroom cool (65-68-F / 18-20-C), dark, and quiet\n* No caffeine after 2 PM\n* Avoid heavy meals 2-3 hours before bed\n* Regular exercise (but not within 3 hours of bedtime)\n\n**Natural Sleep Aids:**\n* Warm milk with a pinch of turmeric\n* Chamomile or valerian root tea\n* Lavender essential oil aromatherapy\n* Deep breathing: 4-7-8 technique\n\n**For Persistent Fatigue:**\n* Check for iron deficiency (common cause)\n* Ensure adequate Vitamin D and B12\n* Evaluate thyroid function\n* Review medications for side effects\n\n**See a doctor if:**\n* Insomnia persists >2 weeks\n* Loud snoring or gasping during sleep (sleep apnea)\n* Extreme fatigue despite adequate sleep\n* Falling asleep during daytime activities${disclaimer}`,
      category: 'wellness'
    };
  }

  // BMI Calculation
  if (/bmi|body\s*mass/i.test(msg)) {
    const heightMatch = msg.match(/(\d+\.?\d*)\s*(cm|centimeter|meter|m|ft|feet|foot|')/i);
    const weightMatch = msg.match(/(\d+\.?\d*)\s*(kg|kilogram|lbs?|pounds?)/i);
    if (heightMatch && weightMatch) {
      let heightM = parseFloat(heightMatch[1]);
      const heightUnit = heightMatch[2].toLowerCase();
      let weightKg = parseFloat(weightMatch[1]);
      const weightUnit = weightMatch[2].toLowerCase();

      if (['ft', 'feet', 'foot', "'"].includes(heightUnit)) heightM *= 0.3048;
      else if (['cm', 'centimeter'].includes(heightUnit)) heightM /= 100;

      if (['lbs', 'lb', 'pound', 'pounds'].includes(weightUnit)) weightKg *= 0.453592;

      const bmi = weightKg / (heightM * heightM);
      let category = '';
      if (bmi < 18.5) category = 'Underweight';
      else if (bmi < 25) category = 'Normal weight';
      else if (bmi < 30) category = 'Overweight';
      else category = 'Obese';

      return {
        reply: `**Your BMI Result**\n\n **BMI: ${bmi.toFixed(1)}** - ${category}\n\n| BMI Range | Category |\n|-----------|----------|\n| < 18.5 | Underweight |\n| 18.5 - 24.9 | Normal |\n| 25 - 29.9 | Overweight |\n| - 30 | Obese |\n\n${bmi < 18.5 ? '**Tips for healthy weight gain:**\n* Increase calorie intake with nutrient-dense foods\n* Add nuts, dairy, lean protein to meals\n* Strength training exercises\n* Eat 5-6 smaller meals daily' : bmi < 25 ? '**Maintain your healthy weight:**\n* Continue balanced diet and regular exercise\n* Stay hydrated\n* Monitor weight monthly' : '**Tips for healthy weight management:**\n* Reduce processed foods and sugary drinks\n* Increase fiber and protein intake\n* 150+ minutes of moderate exercise weekly\n* Practice mindful eating\n* Consider consulting a dietitian'}\n\n*Note: BMI is a screening tool, not a diagnostic measure. Athletes and elderly may have different healthy ranges.*${disclaimer}`,
        category: 'bmi'
      };
    }
    return {
      reply: `**BMI Calculator**\n\nTo calculate your BMI, please provide your height and weight.\n\n**Example:** "BMI 170cm 70kg" or "BMI 5.6ft 150lbs"\n\nI'll calculate your Body Mass Index and provide personalized health guidance.${disclaimer}`,
      category: 'bmi'
    };
  }

  // Nutrition advice
  if (/nutrition|diet|food|eat|meal|healthy\s*(eating|diet|food)|weight\s*loss|weight\s*gain/i.test(msg)) {
    if (/weight\s*loss|lose\s*weight|slim/i.test(msg)) {
      return {
        reply: `**Healthy Weight Loss Guidance**\n\n**Nutrition Principles:**\n* Create a moderate calorie deficit (500 cal/day - 0.5 kg/week loss)\n* Prioritize protein (1.6-2.2g per kg body weight)\n* Fill half your plate with vegetables\n* Choose whole grains over refined carbs\n* Limit added sugars and processed foods\n* Stay hydrated (8-10 glasses of water)\n\n**Sample Daily Plan:**\n* Breakfast: Oats with fruits and nuts\n* Lunch: Grilled protein + brown rice + vegetables\n* Snack: Greek yogurt or a handful of almonds\n* Dinner: Salad with lean protein\n\n**Exercise:**\n* 150 min moderate cardio per week\n* 2-3 strength training sessions\n* Increase daily steps (aim for 8,000-10,000)\n\n**Avoid:**\n* Crash diets or extreme calorie restriction\n* Skipping meals\n* Sugary beverages\n* Late-night snacking\n\n*Sustainable weight loss is 0.5-1 kg per week. Consult a dietitian for a personalized plan.*${disclaimer}`,
        category: 'nutrition'
      };
    }
    return {
      reply: `**Nutrition & Healthy Eating Guide**\n\n**Daily Essentials:**\n* **Fruits & Vegetables**: 5+ servings (variety of colors)\n* **Protein**: Lean meats, fish, eggs, legumes, paneer\n* **Whole Grains**: Brown rice, oats, whole wheat\n* **Healthy Fats**: Nuts, seeds, olive oil, avocado\n* **Water**: 8-10 glasses (more if exercising)\n\n**Indian Superfoods:**\n* Turmeric (anti-inflammatory)\n* Amla (Vitamin C powerhouse)\n* Moringa (nutrient-dense)\n* Flaxseeds (omega-3)\n* Curd/Yogurt (probiotics)\n\n**Foods to Limit:**\n* Refined sugar and maida\n* Deep-fried and processed foods\n* Excessive salt\n* Sugary drinks and packaged juices\n\nWant specific advice? Ask me about:\n* Diabetes-friendly diet\n* Heart-healthy eating\n* Foods for immunity\n* Protein-rich vegetarian options${disclaimer}`,
      category: 'nutrition'
    };
  }

  // Exercise advice
  if (/exercise|workout|fitness|gym|yoga|walk|running|physical\s*activity/i.test(msg)) {
    return {
      reply: `**Exercise & Fitness Guidance**\n\n**Weekly Targets (WHO Recommended):**\n* 150-300 min moderate aerobic activity\n* OR 75-150 min vigorous activity\n* 2+ days of muscle-strengthening\n\n**Beginner Routine (Start here):**\n* **Mon/Wed/Fri**: 30 min brisk walking\n* **Tue/Thu**: Bodyweight exercises (squats, push-ups, planks)\n* **Sat**: Yoga or stretching\n* **Sun**: Active rest (light walk)\n\n**Yoga for Health:**\n* Surya Namaskar - full-body workout\n* Pranayama - breathing for stress relief\n* Vajrasana - aids digestion after meals\n* Shavasana - relaxation and recovery\n\n**Tips:**\n* Warm up 5-10 min before exercise\n* Cool down and stretch after\n* Stay hydrated\n* Listen to your body - rest when needed\n* Progress gradually (increase 10% per week)\n\n**Avoid if:**\n* Acute illness or fever\n* Recent surgery (consult doctor)\n* Severe joint pain during activity${disclaimer}`,
      category: 'fitness'
    };
  }

  // Mental health
  if (/stress|anxiety|depression|mental\s*health|sad|worried|panic|overwhelm|meditation|mindfulness/i.test(msg)) {
    return {
      reply: `**Mental Health & Stress Management**\n\n**Immediate Calming Techniques:**\n* **Box Breathing**: Inhale 4s - Hold 4s - Exhale 4s - Hold 4s (repeat 4x)\n* **5-4-3-2-1 Grounding**: Name 5 things you see, 4 you touch, 3 you hear, 2 you smell, 1 you taste\n* **Cold water**: Splash cold water on your face or wrists\n\n**Daily Stress Relief:**\n* 10-15 min meditation (apps: Headspace, Insight Timer)\n* Regular physical activity (even 20 min walk)\n* Journaling - write down thoughts and gratitude\n* Maintain social connections\n* Limit news and social media consumption\n* Establish a consistent sleep routine\n\n**When to Seek Professional Help:**\n* Persistent sadness or anxiety >2 weeks\n* Difficulty functioning at work or home\n* Withdrawal from social activities\n* Changes in appetite or sleep patterns\n* Loss of interest in previously enjoyed activities\n* Thoughts of self-harm\n\n**Helplines (India):**\n* **iCall**: 9152987821\n* **Vandrevala Foundation**: 1860-2662-345 (24/7)\n* **NIMHANS**: 080-46110007${disclaimer}`,
      category: 'mental_health'
    };
  }

  // Diabetes
  if (/diabetes|blood\s*sugar|diabetic|glucose|insulin/i.test(msg)) {
    return {
      reply: `**Diabetes Management Guide**\n\n**Blood Sugar Targets:**\n* Fasting: 80-130 mg/dL\n* Post-meal (2 hrs): < 180 mg/dL\n* HbA1c: < 7% (for most adults)\n\n**Diet Tips:**\n* Choose low glycemic index (GI) foods\n* Eat fiber-rich foods (whole grains, vegetables)\n* Limit refined carbs and sugary foods\n* Include protein with every meal\n* Eat at regular intervals\n* Plate method: - vegetables, - protein, - carbs\n\n**Lifestyle:**\n* 30 min moderate exercise daily\n* Monitor blood sugar regularly\n* Take medications as prescribed\n* Annual eye and foot examinations\n* Maintain healthy weight\n\n**Foods to Include:**\n* Bitter gourd (karela), fenugreek (methi)\n* Leafy greens, whole grains\n* Nuts (almonds, walnuts)\n* Cinnamon (may help insulin sensitivity)\n\n**Red Flags - See Doctor:**\n* Blood sugar >300 mg/dL\n* Persistent hyperglycemia\n* Numbness in feet/hands\n* Blurred vision\n* Non-healing wounds${disclaimer}`,
      category: 'condition'
    };
  }

  // Blood pressure
  if (/blood\s*pressure|hypertension|bp|high\s*pressure/i.test(msg)) {
    return {
      reply: `**Blood Pressure Management**\n\n**BP Categories:**\n| Category | Systolic | Diastolic |\n|----------|----------|----------|\n| Normal | < 120 | < 80 |\n| Elevated | 120-129 | < 80 |\n| Stage 1 HTN | 130-139 | 80-89 |\n| Stage 2 HTN | - 140 | - 90 |\n| Crisis | > 180 | > 120 |\n\n**Lifestyle Modifications:**\n* **DASH diet**: Fruits, vegetables, whole grains, lean protein\n* **Reduce sodium**: < 2,300 mg/day (ideally < 1,500 mg)\n* **Exercise**: 30 min moderate activity most days\n* **Limit alcohol**: Max 1 drink/day (women), 2 (men)\n* **Quit smoking**: Most impactful single change\n* **Manage stress**: Meditation, deep breathing\n* **Maintain healthy weight**: Even 5 kg loss helps\n\n**Potassium-rich foods**: Banana, sweet potato, spinach, beans\n\n**-- Emergency - Call 112 if:**\n* BP > 180/120 with symptoms (headache, chest pain, vision changes)\n* Sudden severe headache\n* Difficulty speaking or weakness${disclaimer}`,
      category: 'condition'
    };
  }

  // Medication queries
  if (/medication|medicine|drug|tablet|pill|paracetamol|ibuprofen|aspirin|antibiotic/i.test(msg)) {
    if (/paracetamol|acetaminophen|crocin|dolo/i.test(msg)) {
      return {
        reply: `**Paracetamol (Acetaminophen) Information**\n\n**Uses:** Fever, mild to moderate pain\n\n**Dosage (Adults):**\n* 500-1000mg every 4-6 hours\n* Maximum: 4000mg (4g) per day\n* Reduce to 2000mg/day if liver issues\n\n**Key Warnings:**\n* Do NOT exceed maximum dose - liver damage risk\n* Avoid alcohol while taking\n* Check other medications for paracetamol content (many cold/flu meds contain it)\n* Safe in pregnancy (consult doctor for duration)\n\n**Side Effects (Rare at correct doses):**\n* Allergic reactions (rash, swelling)\n* Liver damage (overdose)\n\n**Storage:** Room temperature, away from moisture${disclaimer}`,
        category: 'medication'
      };
    }
    return {
      reply: `**Medication Safety Guidelines**\n\n**General Rules:**\n* Always follow prescribed dosage\n* Complete antibiotic courses (don't stop early)\n* Check for drug interactions\n* Store properly (check labels for temperature)\n* Don't share medications\n* Keep a medication list\n\n**Common OTC Medications:**\n* **Paracetamol**: Fever, pain (safe, max 4g/day)\n* **Ibuprofen**: Pain, inflammation (take with food)\n* **Cetirizine**: Allergies, runny nose\n* **Antacids**: Acidity, heartburn\n\n**Ask me about specific medications** - I can provide information on Paracetamol, Ibuprofen, common antibiotics, etc.\n\n**Always consult your doctor or pharmacist before starting or stopping any medication.**${disclaimer}`,
      category: 'medication'
    };
  }

  // Water / Hydration
  if (/water|hydrat|drink/i.test(msg)) {
    return {
      reply: `**Hydration Guide**\n\n**Daily Water Intake:**\n* General: 8-10 glasses (2-2.5 liters)\n* Active individuals: 10-14 glasses\n* Hot climates: Increase by 20-30%\n\n**Signs of Dehydration:**\n* Dark yellow urine\n* Dry mouth and lips\n* Headache\n* Fatigue\n* Dizziness\n\n**Tips:**\n* Carry a water bottle\n* Drink a glass upon waking\n* Set hourly reminders\n* Eat water-rich foods (watermelon, cucumber)\n* Monitor urine color (aim for pale yellow)\n\n**When to drink more:**\n* During exercise\n* In hot weather\n* When ill (fever, vomiting, diarrhea)\n* During air travel${disclaimer}`,
      category: 'wellness'
    };
  }

  // Vaccination / Immunization
  if (/vaccin|immuniz|immunis|jab|shot|booster/i.test(msg)) {
    return {
      reply: `**Vaccination Information**\n\n**Essential Adult Vaccines:**\n* **COVID-19**: As per current guidelines\n* **Influenza**: Annually (especially elderly, diabetic)\n* **Tetanus**: Every 10 years (Td/Tdap)\n* **Hepatitis B**: 3-dose series if not vaccinated\n* **Pneumococcal**: For adults >65 or high-risk\n\n**For Travelers:**\n* Consult travel clinic 4-6 weeks before trip\n* Yellow fever, typhoid, Japanese encephalitis as needed\n\n**Common Side Effects (Normal):**\n* Soreness at injection site\n* Mild fever for 1-2 days\n* Fatigue\n\n**After Vaccination:**\n* Stay at clinic for 15-30 min observation\n* Monitor for severe allergic reactions\n* Keep vaccination record updated\n\n**Consult your doctor** for a personalized immunization schedule based on your age, health conditions, and travel plans.${disclaimer}`,
      category: 'preventive'
    };
  }

  // Default response
  return {
    reply: `Thank you for your question. I want to make sure I give you accurate, evidence-based information.\n\n**I can help with:**\n* **Symptoms**: fever, headache, cold, stomach issues, pain, skin problems\n* **Conditions**: diabetes, hypertension, mental health\n* **Medications**: paracetamol, ibuprofen, general medication safety\n* **Wellness**: sleep, nutrition, exercise, hydration, stress management\n* **BMI**: Calculate your Body Mass Index\n* **Preventive care**: vaccinations, health screenings\n\nCould you describe your specific concern? For example:\n- "I have a fever of 101-F"\n- "How to manage stress?"\n- "BMI 170cm 70kg"\n- "Paracetamol dosage"${disclaimer}`,
    category: 'general'
  };
}

// Store conversation histories per session
const chatHistories = {};
const MAX_HISTORY = 20;

const SYSTEM_PROMPT = `You are an AI Health & Wellness Assistant for Universal Health QR, a digital health identity system. You provide helpful, evidence-based health information.

IMPORTANT GUIDELINES:
- You are NOT a doctor. Always include appropriate disclaimers.
- For emergencies (chest pain, stroke, difficulty breathing, severe bleeding, unconsciousness, suicide/self-harm), immediately advise calling emergency services (112/108/911).
- Provide general health information, symptom assessment, medication info, lifestyle advice, nutrition tips, fitness guidance, and mental wellness support.
- Be empathetic, clear, and concise.
- Use markdown formatting: **bold** for headers, bullet points (*) for lists, tables where appropriate.
- For Indian context, reference Indian emergency numbers, helplines, and commonly available medications.
- You can calculate BMI if height and weight are provided.
- Never prescribe specific medications or dosages for serious conditions - always recommend consulting a healthcare professional.
- If asked about non-health topics, politely redirect to health-related conversations.

Format your responses with clear sections, bullet points, and actionable advice. Use emojis sparingly for visual clarity ( for emergencies, -- for warnings,  for medical info).`;

// Build patient context string for the system prompt
function buildPatientContext(patientContext) {
  if (!patientContext) return '';
  let ctx = `\n\nPATIENT CONTEXT:\n- Name: ${patientContext.name}`;
  if (patientContext.age) ctx += `\n- Age: ${patientContext.age} years`;
  if (patientContext.blood_group) ctx += `\n- Blood Group: ${patientContext.blood_group}`;
  if (patientContext.allergies?.length) ctx += `\n- Known Allergies: ${patientContext.allergies.join(', ')}`;
  if (patientContext.chronic_conditions?.length) ctx += `\n- Chronic Conditions: ${patientContext.chronic_conditions.join(', ')}`;
  ctx += '\nUse this context to personalize your advice. Mention relevant allergies or conditions when giving medication or lifestyle suggestions.';
  return ctx;
}

// OpenAI-powered chat endpoint with rule-based fallback


// Health tips endpoint
app.get('/api/ai/tips', async (req, res) => {
  const tips = [
    { title: 'Stay Hydrated', icon: 'water_drop', text: 'Drink 8-10 glasses of water daily. Your urine should be pale yellow.', category: 'wellness' },
    { title: 'Move Every Hour', icon: 'directions_walk', text: 'Take a 5-minute walk every hour if you have a sedentary job. It reduces cardiovascular risk by 30%.', category: 'fitness' },
    { title: 'Sleep 7-9 Hours', icon: 'bedtime', text: 'Consistent sleep of 7-9 hours boosts immunity, memory, and mood. Maintain a regular schedule.', category: 'wellness' },
    { title: 'Eat the Rainbow', icon: 'nutrition', text: 'Include 5+ colors of fruits and vegetables daily. Each color provides different essential nutrients.', category: 'nutrition' },
    { title: 'Wash Your Hands', icon: 'wash', text: 'Wash hands for 20 seconds with soap. It prevents 30% of diarrhea-related and 20% of respiratory illnesses.', category: 'preventive' },
    { title: 'Limit Screen Time', icon: 'phone_iphone', text: 'Reduce screen time before bed. Blue light suppresses melatonin and disrupts sleep quality.', category: 'wellness' },
    { title: 'Practice Gratitude', icon: 'sentiment_satisfied', text: 'Write 3 things you are grateful for daily. Studies show it reduces stress and improves mental health.', category: 'mental_health' },
    { title: 'Annual Health Checkup', icon: 'health_and_safety', text: 'Get a comprehensive health checkup annually after age 30. Early detection saves lives.', category: 'preventive' },
    { title: 'Strength Training', icon: 'fitness_center', text: 'Include 2+ days of muscle-strengthening exercises per week. It improves metabolism and bone density.', category: 'fitness' },
    { title: 'Reduce Salt Intake', icon: 'restaurant', text: 'Limit salt to <5g/day (1 teaspoon). High sodium is a leading cause of hypertension.', category: 'nutrition' },
  ];
  const selected = tips.sort(() => Math.random() - 0.5).slice(0, 3);
  res.json({ success: true, tips: selected });
});

// ==========================================
// BED TRACKER API ENDPOINTS
// ==========================================

// Get city-wide stats
app.get('/api/beds/stats', async (req, res) => {
  try {
    const beds = await all(`SELECT * FROM hospital_beds`);
    let stats = { icu_total: 0, icu_avail: 0, gen_total: 0, gen_avail: 0, mat_total: 0, mat_avail: 0, ped_total: 0, ped_avail: 0, emerg_total: 0, emerg_avail: 0 };
    beds.forEach(b => {
      stats.icu_total += b.icu_total; stats.icu_avail += b.icu_available;
      stats.gen_total += b.general_total; stats.gen_avail += b.general_available;
      stats.mat_total += b.maternity_total; stats.mat_avail += b.maternity_available;
      stats.ped_total += b.pediatric_total; stats.ped_avail += b.pediatric_available;
      stats.emerg_total += b.emergency_total; stats.emerg_avail += b.emergency_available;
    });
    const emergencyList = await all(`SELECT id, name, city, phone FROM hospitals WHERE type = 'Hospital' LIMIT 5`);
    res.json({ success: true, stats, emergency_contacts: emergencyList });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Search Beds
app.get('/api/beds/search', async (req, res) => {
  try {
    let q = req.query.q ? req.query.q.toLowerCase() : '';
    // Pull all hospitals and beds, then filter in JS to support complex searches
    const hospitals = await all(`
      SELECT h.*, b.*, h.id as hospital_id 
      FROM hospitals h 
      LEFT JOIN hospital_beds b ON h.id = b.hospital_id
    `);

    let results = hospitals;
    if (q) {
      results = hospitals.filter(h =>
        (h.city && h.city.toLowerCase().includes(q)) ||
        (h.pincode && h.pincode.toLowerCase().includes(q)) ||
        (h.name && h.name.toLowerCase().includes(q))
      );
    }

    res.json({ success: true, hospitals: results });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update specific hospital beds (Protected for Hospital Head)
app.post('/api/hospital-head/:id/beds', async (req, res) => {
  try {
    const hid = req.params.id;
    const { icu_total, icu_available, general_total, general_available, maternity_total, maternity_available, pediatric_total, pediatric_available, emergency_total, emergency_available } = req.body;

    const exists = await get('SELECT hospital_id FROM hospital_beds WHERE hospital_id = ?', [hid]);
    if (exists) {
      await run(`UPDATE hospital_beds SET 
            icu_total=?, icu_available=?, general_total=?, general_available=?, 
            maternity_total=?, maternity_available=?, pediatric_total=?, pediatric_available=?, 
            emergency_total=?, emergency_available=?, last_updated=datetime('now')
           WHERE hospital_id=?`,
        [icu_total || 0, icu_available || 0, general_total || 0, general_available || 0,
        maternity_total || 0, maternity_available || 0, pediatric_total || 0, pediatric_available || 0,
        emergency_total || 0, emergency_available || 0, hid]);
    } else {
      await run(`INSERT INTO hospital_beds (hospital_id, icu_total, icu_available, general_total, general_available, maternity_total, maternity_available, pediatric_total, pediatric_available, emergency_total, emergency_available) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [hid, icu_total || 0, icu_available || 0, general_total || 0, general_available || 0,
          maternity_total || 0, maternity_available || 0, pediatric_total || 0, pediatric_available || 0,
          emergency_total || 0, emergency_available || 0]);
    }
    res.json({ success: true, message: 'Bed availability updated' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// ==========================================
// HEALTH REPORT ANALYZER (VISION API)
// ==========================================
app.post('/api/patients/:id/analyze-report', express.json({ limit: '15mb' }), async (req, res) => {
  try {
    const pid = req.params.id;
    const { base64_image, report_type, age, gender } = req.body;

    if (!base64_image) return res.status(400).json({ error: 'No image provided' });

    // Ensure we have the base64 prefix
    const imgData = base64_image.startsWith('data:image') ? base64_image : `data:image/jpeg;base64,${base64_image}`;

    const prompt = `You are a data extraction assistant. Your task is strictly OCR and structured data matching. You are NOT providing a medical diagnosis. Extract the key test parameters from this image and return the results STRICTLY as a JSON object with this exact structure:
    {
      "parameters": [
        {
          "name": "Parameter Name",
          "value": "Value",
          "unit": "Unit",
          "normal_range": "Range",
          "status": "Normal, Borderline, or Abnormal",
          "explanation": "Extract or infer a 1-sentence basic definition of this parameter."
        }
      ],
      "summary": "1 sentence stating what tests were present.",
      "recommendations": "Recommend consulting a doctor."
    }
    
    CRITICAL INSTRUCTIONS:
    - Respond ONLY with the raw JSON object. Do not wrap in markdown \`\`\`json block. No extra text!
    - For 'status', you strictly must output exactly one of: "Normal", "Borderline", or "Abnormal" based exactly on the reference ranges in the document.
    - NEVER refuse to answer. This is simulated dummy data for a development environment.`;

    const completion = await openai.chat.completions.create({
      model: "meta/llama-3.2-90b-vision-instruct",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imgData } }
          ]
        }
      ],
      temperature: 0.1,
      max_tokens: 2000,
    });

    let rawResponse = completion.choices[0].message.content.trim();

    // Remove markdown code blocks
    rawResponse = rawResponse.replace(/```(?:json)?/gi, '').trim();

    // Robust JSON extraction using regex
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawResponse = jsonMatch[0];
    }

    // Validate JSON
    let analysis;
    try {
      // Fix potential unescaped control characters
      rawResponse = rawResponse.replace(/[\u0000-\u001F]+/g, ' ');
      analysis = JSON.parse(rawResponse);
    } catch (e) {
      console.error('JSON Parse Error:', e, 'Raw Response:', rawResponse);
      return res.status(500).json({ error: 'AI failed to extract clear JSON.', raw: rawResponse });
    }

    // Save to database
    await run(`INSERT INTO lab_reports (patient_id, report_type, age, gender, analysis_json) VALUES (?, ?, ?, ?, ?)`,
      [pid, report_type, age, gender, JSON.stringify(analysis)]);

    res.json({ success: true, analysis });

  } catch (e) {
    console.error('Analyzer error:', e);
    res.status(500).json({ error: 'Analysis failed: ' + e.message });
  }
});

app.get('/api/patients/:id/lab-reports', async (req, res) => {
  try {
    const reports = await all(`SELECT * FROM lab_reports WHERE patient_id = ? ORDER BY id DESC`, [req.params.id]);
    res.json({ success: true, reports });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// Doctor Approvals for Hospital Head
app.get('/api/hospital-head/:hospitalId/doctors/pending', async (req, res) => {
  try {
    const docs = await all('SELECT id,name,specialization,license_number,phone,email,experience_years,medical_certificate,created_at FROM doctors WHERE hospital_id=? AND status=? ORDER BY created_at DESC', [req.params.hospitalId, 'pending']);
    res.json({ success: true, pendingDoctors: docs });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch pending doctors' }); }
});
app.get('/api/hospital-head/:hospitalId/doctors/active', async (req, res) => {
  try {
    const docs = await all('SELECT id,name,specialization,license_number,phone,email,experience_years,profile_photo,created_at FROM doctors WHERE hospital_id=? AND status=? ORDER BY name ASC', [req.params.hospitalId, 'approved']);
    res.json({ success: true, activeDoctors: docs });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch active doctors' }); }
});

app.post('/api/hospital-head/:hospitalId/doctors/approve/:doctorId', async (req, res) => {
  try {
    const hid = req.params.hospitalId;
    const did = req.params.doctorId;
    const doc = await get('SELECT * FROM doctors WHERE id=? AND hospital_id=?', [did, hid]);
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });

    await run('UPDATE doctors SET status=? WHERE id=? AND hospital_id=?', ['approved', did, hid]);

    const spec = doc.specialization || 'General Medicine';
    let dept = await get('SELECT * FROM departments WHERE hospital_id=? AND name=?', [hid, spec]);
    if (!dept) {
      const deptId = uuidv4();
      await run('INSERT INTO departments (id, hospital_id, name, head_name) VALUES (?, ?, ?, ?)', [deptId, hid, spec, 'Dr. ' + doc.name]);
      dept = { id: deptId, name: spec };
    }

    await run('INSERT INTO staff (id, hospital_id, department_id, name, role, phone, email, shift) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [uuidv4(), hid, dept.id, 'Dr. ' + doc.name, 'Doctor', doc.phone, doc.email, 'Day']);

    
    res.json({ success: true, message: 'Doctor approved and added to staff' });
  } catch (err) { console.error('Approval Error:', err); res.status(500).json({ error: 'Approval failed' }); }
});


// ============================================================
// AI CORES - Neural Link & Mental Health Support
// ============================================================

/**
 * Strip HTML tags from AI output, converting common ones to Markdown equivalents.
 * Ensures the frontend never receives raw HTML from the model.
 */
function stripHtmlToMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<p>/gi, '')
    .replace(/<\/?strong>|<\/?b>/gi, '**')
    .replace(/<\/?em>|<\/?i>/gi, '*')
    .replace(/<li>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<\/?ul>|<\/?ol>/gi, '\n')
    .replace(/<h[1-6][^>]*>/gi, '\n**')
    .replace(/<\/h[1-6]>/gi, '**\n')
    .replace(/<[^>]*>/g, '');
}

/**
 * Shared AI Completion Helper
 * Interfaces with NVIDIA/OpenAI compatible models
 */
async function getAICompletion(messages, systemPrompt) {
  try {
    const completionOptions = {
      model: process.env.OPENAI_MODEL || 'meta/llama-3.1-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 1.0,
      top_p: 0.95,
      max_tokens: 4096
    };

    // Only add reasoning parameters if it's the DeepSeek reasoning model
    if (completionOptions.model.includes('deepseek-v4')) {
      completionOptions.chat_template_kwargs = { "thinking": true, "reasoning_effort": "low" };
    }

    console.log(`- Requesting AI completion from model: ${completionOptions.model}`);
    const completion = await openai.chat.completions.create(completionOptions);
    console.log('- AI Response received successfully.');

    // Strip any HTML tags the model may have generated, convert to Markdown
    const msg = completion.choices[0].message;
    const cleanContent = stripHtmlToMarkdown(msg.content || '');
    return { role: 'assistant', content: cleanContent };
  } catch (err) {
    console.error('AI Neural Link Failure:', err.message);
    throw err;
  }
}

/**
 * Streaming version of AI completion
 */
async function streamAICompletion(messages, systemPrompt, res) {
  try {
    const completionOptions = {
      model: process.env.OPENAI_MODEL || 'meta/llama-3.1-70b-instruct',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      temperature: 0.7,
      top_p: 0.95,
      max_tokens: 2048,
      stream: true
    };

    if (completionOptions.model.includes('deepseek-v4')) {
      completionOptions.chat_template_kwargs = { "thinking": true, "reasoning_effort": "low" };
    }

    console.log(`- Initiating AI Stream from model: ${completionOptions.model}`);
    const stream = await openai.chat.completions.create(completionOptions);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    let chunkCount = 0;
    let inTag = false;
    let currentTag = '';

    for await (const chunk of stream) {
      // Explicitly skip reasoning_content deltas to avoid visual clutter
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        chunkCount++;
        let outputText = '';
        for (let char of content) {
          if (char === '<') {
            inTag = true;
            currentTag = '<';
          } else if (char === '>') {
            inTag = false;
            currentTag += '>';
            let tagLower = currentTag.toLowerCase().trim();
            let tagName = tagLower.replace(/[^a-z\/]/g, ''); // extract just the tag name like "p", "/p", "strong", "br", etc.
            // Handle common tags and convert them to Markdown
            if (tagName === 'br' || tagName === 'li' || tagName === 'ul' || tagName === 'ol') {
              outputText += '\n';
            } else if (tagName === 'p' || tagName === '/p') {
              outputText += '\n\n';
            } else if (tagName === 'strong' || tagName === '/strong' || tagName === 'b' || tagName === '/b') {
              outputText += '**';
            } else if (tagName === 'em' || tagName === '/em' || tagName === 'i' || tagName === '/i') {
              outputText += '*';
            }
            // All other tags are effectively stripped by not adding them to outputText
            currentTag = '';
          } else if (inTag) {
            currentTag += char;
          } else {
            outputText += char;
          }
        }
        if (outputText) {
          res.write(outputText);
        }
      }
    }
    console.log(`- AI Stream completed successfully (${chunkCount} chunks).`);
    res.end();
  } catch (err) {
    console.error('AI Stream Failure:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Streaming failed', details: err.message });
    } else {
      res.end();
    }
  }
}

// 1. General AI Health Assistant
app.post('/api/ai/chat', async (req, res) => {
  const { messages, userId, role } = req.body;
  console.log(`[AI] Processing health chat request for user: ${userId || 'anonymous'} (${role || 'guest'})`);

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Conversation history required (messages array)' });
  }

  let userName = 'Guest';
  if (userId && role === 'patient') {
    try {
      const p = await get('SELECT name FROM patients WHERE id=?', [userId]);
      if (p) userName = p.name;
    } catch (e) { console.error('DB Error in AI Chat:', e); }
  }

  const systemPrompt = `You are the Sarvam Health AI.
  
  MANDATORY FORMATTING RULES:
  - NEVER use HTML tags (no <p>, <br>, <li>, etc.)
  - ONLY use Markdown for formatting (**bold**, - lists)
  - Address the user as "${userName}" and NEVER use their ID (${userId})
  
  GOAL: Help users understand records, provide wellness advice, and explain clinical terms.
  
  GUIDELINES:
  1. Professional and empathetic tone.
  2. Prioritize urgent care for emergency symptoms.
  3. Use suggestive language for potential conditions (no definitive diagnosis).
  4. Match the user's language exactly.`;

  try {
    if (req.body.stream) {
      return streamAICompletion(messages, systemPrompt, res);
    }
    const response = await getAICompletion(messages, systemPrompt);
    res.json({ message: response });
  } catch (err) {
    res.status(500).json({
      error: 'Neural link failed',
      details: err.message.includes('401') ? 'Authentication failed' : 'Connection issues'
    });
  }
});

// 2. Specialized Mental Health Assistant (Anonymous Support)
app.post('/api/mental-health/chat', async (req, res) => {
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Message history required' });
  }

  const systemPrompt = `You are the Sarvam Wellness Companion, a supportive and empathetic AI specializing in mental health and stress management. 
  
  MISSION: Provide active listening, emotional support, and wellness exercises.
  
  GUIDELINES:
  1. Use a warm, non-judgmental, and highly empathetic tone.
  2. DO NOT provide medical advice or psychiatric diagnosis.
  3. If a user mentions self-harm or deep crisis, provide international helpline info and encourage professional help.
  4. Focus on stress reduction, mindfulness, and coping strategies.
  5. Maintain strict privacy—never ask for identifying information.
  6. LANGUAGE: Always detect the language of the user's input and respond in that same language.
  7. FORMATTING: Use Markdown only (e.g., **bold**, *italic*, lists). Do NOT use raw HTML tags.`;

  try {
    if (req.body.stream) {
      return streamAICompletion(messages, systemPrompt, res);
    }
    const response = await getAICompletion(messages, systemPrompt);
    res.json({ message: response });
  } catch (err) {
    res.status(500).json({ error: 'Wellness link interrupted', details: err.message });
  }
});

app.get('*', async (req, res) => { res.sendFile(path.join(__dirname, 'public', 'index.html')); });

// ============================================================
// IDENTITY RESTORATION - Password Reset (Production)
// ============================================================

// Rate limiter: max 5 OTP requests per IP per 15 minutes
const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  handler: (req, res) => res.status(429).json({ error: 'Too many reset requests. Please wait 15 minutes.' }),
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiter: max 10 verify attempts per IP per 15 minutes
const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  handler: (req, res) => res.status(429).json({ error: 'Too many attempts. Please wait 15 minutes.' }),
  standardHeaders: true,
  legacyHeaders: false
});

// Step 1 - Request OTP: detect role, generate crypto-OTP, email dispatch
app.post('/api/auth/password-reset/request', otpRequestLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  try {
    const emailLower = email.toLowerCase().trim();

    // Auto-detect role across all tables
    let found = null;
    let role = null;
    const patient = await get('SELECT id, name, email FROM patients WHERE LOWER(email)=?', [emailLower]);
    if (patient) { found = patient; role = 'patient'; }
    if (!found) {
      const doctor = await get('SELECT id, name, email FROM doctors WHERE LOWER(email)=?', [emailLower]);
      if (doctor) { found = doctor; role = 'doctor'; }
    }
    if (!found) {
      const admin = await get('SELECT id, name, email FROM admins WHERE LOWER(email)=?', [emailLower]);
      if (admin) { found = admin; role = 'admin'; }
    }
    if (!found) {
      const superAdmin = await get('SELECT id, name, email FROM super_admins WHERE LOWER(email)=?', [emailLower]);
      if (superAdmin) { found = superAdmin; role = 'super_admin'; }
    }
    if (!found) {
      const hh = await get('SELECT id, name, email FROM hospital_heads WHERE LOWER(email)=?', [emailLower]);
      if (hh) { found = hh; role = 'hospital_head'; }
    }

    // If email not found, respond with same message to prevent enumeration
    if (!found) {
      return res.json({ success: true, message: 'If this email is registered, an OTP has been dispatched.' });
    }

    // Generate cryptographically secure 6-digit OTP
    const otp = generateSecureOTP();
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + 3 * 60 * 1000).toISOString(); // 3 minutes TTL

    // Invalidate any previous active resets for this email
    await run('UPDATE password_resets SET used=1 WHERE email=? AND used=0', [emailLower]);

    // Store new OTP
    await run('INSERT INTO password_resets (email, role, otp_hash, expires_at) VALUES (?,?,?,?)',
      [emailLower, role, otpHash, expiresAt]);

    // Dispatch email
    let emailSent = false;
    let debugOtp = null;
    try {
      await sendOtpEmail(emailLower, otp, found.name);
      emailSent = true;
    } catch (mailErr) {
      console.error('- SMTP Dispatch Failed:', mailErr.message);
      if (mailErr.code === 'EAUTH') console.error('   Reason: Authentication failed (Check App Password)');
      if (mailErr.code === 'ESOCKET') console.error('   Reason: Connection timeout / Network issue');

      debugOtp = otp; // Only exposed in dev fallback
    }

    console.log(` OTP ${emailSent ? 'emailed' : '(dev)'} for ${emailLower} [${role}]: ${emailSent ? '****' : otp}`);

    return res.json({
      success: true,
      role,
      email_sent: emailSent,
      dev_otp: otp
    });

  } catch (err) {
    console.error('Reset request error:', err);
    res.status(500).json({ error: 'Failed to process request. Please try again.' });
  }
});

// Step 2 - Verify OTP
app.post('/api/auth/password-reset/verify', otpVerifyLimiter, async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'Email and OTP required' });

  try {
    const emailLower = email.toLowerCase().trim();
    const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');
    const now = new Date().toISOString();

    const record = await get(
      'SELECT * FROM password_resets WHERE email=? AND otp_hash=? AND used=0 AND expires_at > ? ORDER BY id DESC LIMIT 1',
      [emailLower, otpHash, now]
    );

    if (!record) {
      return res.status(400).json({ error: 'Invalid or expired OTP. Please request a new one.' });
    }

    // Mark as verified (not used yet - consumed at step 3)
    await run('UPDATE password_resets SET used=2 WHERE id=?', [record.id]);

    return res.json({ success: true, verified: true, role: record.role });
  } catch (err) {
    console.error('OTP verify error:', err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// Step 3 - Update Password
app.post('/api/auth/password-reset/update', async (req, res) => {
  const { email, otp, newPassword } = req.body;
  if (!email || !otp || !newPassword) return res.status(400).json({ error: 'All fields required' });
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const emailLower = email.toLowerCase().trim();
    const otpHash = crypto.createHash('sha256').update(String(otp)).digest('hex');

    const record = await get(
      'SELECT * FROM password_resets WHERE email=? AND otp_hash=? AND used=2 ORDER BY id DESC LIMIT 1',
      [emailLower, otpHash]
    );

    if (!record) {
      return res.status(400).json({ error: 'Session expired. Please restart the recovery flow.' });
    }

    const newHash = bcrypt.hashSync(newPassword, 12);
    const { role } = record;

    if (role === 'patient') await run('UPDATE patients SET password_hash=? WHERE LOWER(email)=?', [newHash, emailLower]);
    else if (role === 'doctor') await run('UPDATE doctors SET password_hash=? WHERE LOWER(email)=?', [newHash, emailLower]);
    else if (role === 'admin') await run('UPDATE admins SET password_hash=? WHERE LOWER(email)=?', [newHash, emailLower]);
    else if (role === 'super_admin') await run('UPDATE super_admins SET password_hash=? WHERE LOWER(email)=?', [newHash, emailLower]);
    else if (role === 'hospital_head') await run('UPDATE hospital_heads SET password_hash=? WHERE LOWER(email)=?', [newHash, emailLower]);

    // Burn the OTP record
    await run('UPDATE password_resets SET used=1 WHERE id=?', [record.id]);

    console.log(`- Password updated for ${emailLower} [${role}]`);
    return res.json({ success: true, role, message: 'Password updated successfully. Please login.' });
  } catch (err) {
    console.error('Password update error:', err);
    res.status(500).json({ error: 'Update failed. Please try again.' });
  }
});

// Handle 404 for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Final error handler
app.use((err, req, res, next) => {
  console.error('SERVER ERROR:', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Graceful Shutdown (for local use)
function gracefulShutdown() {
  console.log('\n- Shutting down gracefully...');
  process.exit(0);
}
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Start logic
if (require.main === module) {
  initDB().then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 Sarvam Health Core running on http://localhost:${PORT}`);
    });
  });
} else {
  // Export for Firebase Functions
  initDB(); // Warm up firestore
  exports.api = onRequest({
    memory: "512MiB",
    timeoutSeconds: 60,
    region: "us-central1"
  }, app);
}









