# Sarvam | Universal Health QR

**Sarvam** is a secure, digital healthcare identity system that leverages QR technology to provide a unified medical profile for patients, real-time management for hospitals, and specialized AI assistance for general and mental health.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-ISC-green)

---

## 🌟 Key Features

### 🏥 For Patients
- **Universal Health QR**: A unique digital identity containing critical health data (vitals, blood group, allergies) accessible instantly by paramedics in emergencies.
- **Secure Medical Vault**: HIPAA-compliant storage of clinical records, prescriptions, and reports, protected by OTP verification.
- **AI Health & Wellness Assistant**: A smart assistant capable of explaining medical terms, analyzing symptoms, and calculating BMI.
- **Anonymous Mental Health Support**: A private space for mental health tracking, assessment, and AI-driven empathetic support.
- **Appointment Tracking**: Real-time monitoring of doctor visits and upcoming appointments.

### 🏢 For Hospitals & Doctors
- **Real-time Bed Management**: Live tracking of ICU, Emergency, and General ward bed availability.
- **Digital Prescription System**: Doctors can issue digital prescriptions linked directly to the patient's QR identity.
- **Access Audit Logs**: Transparent tracking of who accessed patient data, when, and for what purpose.
- **Staff & Inventory Management**: Integrated tools for hospital heads to manage departments and medical staff.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla JavaScript (SPA Architecture), Vanilla CSS, Material Symbols.
- **Backend**: Node.js, Express.
- **Database**: SQLite (sql.js) with AES-256-GCM encryption for PHI (Protected Health Information).
- **AI Integration**: OpenAI/NVIDIA API (Llama 3.1) for specialized health completions.
- **Libraries**: 
  - `html5-qrcode` for scanning.
  - `Chart.js` for health tracking visualizations.
  - `pdf.js` & `html2pdf.js` for report handling.

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v16+)
- npm

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the root directory and configure the following:
   ```env
   # AI Configuration
   OPENAI_API_KEY=your_key_here
   OPENAI_API_BASE_URL=https://integrate.api.nvidia.com/v1
   OPENAI_MODEL=meta/llama-3.1-8b-instruct
   
   # SMTP Configuration (for OTPs)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_email@gmail.com
   SMTP_PASS=your_app_password
   
   # Security
   CRYPTO_SECRET=your_32_character_secret_key
   ```

### Running the Application
Start the development server:
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

---

## 🔒 Security & Privacy
- **PHI Encryption**: All sensitive medical data is encrypted at rest using AES-256-GCM.
- **OTP Verification**: Patient medical history requires time-sensitive OTP verification before access is granted to doctors.
- **Audit Trails**: Every data access event is logged to prevent unauthorized information leakage.

---

## 📜 License
This project is licensed under the ISC License.
