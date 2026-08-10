# SafeReach – Smart Community Emergency Alert System

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Deployed-success?style=for-the-badge&logo=vercel)](https://safereach-alert-system.vercel.app)
[![Live Mobile Link](https://img.shields.io/badge/Live_App-Open_on_Mobile-blue?style=for-the-badge&logo=google-chrome)](https://safereach-alert-system.vercel.app)

> **SafeReach** is an intelligent, private community emergency notification system. Every Senior Citizen account maintains an independent, isolated emergency network. Alerts are routed exclusively to linked responders (Family Members, Neighbors, Security Guards, Volunteers) who have accepted connection requests.

---

## 🌐 Live Production Mobile Link

📱 **[https://safereach-alert-system.vercel.app](https://safereach-alert-system.vercel.app)**

---

## 🛠️ Key Features & Architecture

- **Private Emergency Networks**: Each Senior Citizen account manages an isolated list of private contacts. SOS alerts are never broadcast to unrelated users.
- **Connection Approval Workflow**: Responders receive a `"A Senior Citizen wants to connect with you."` prompt upon signup/login, with **Accept** and **Reject** buttons. Accounts are linked only after clicking **Accept**.
- **Targeted 60-Second Escalation**:
  - **Tier 1 (Immediate)**: SOS alerts notify linked **Neighbors** and **Security Guards**.
  - **Tier 2 (60s Countdown)**: If no Tier 1 responder accepts within 60 seconds, the system automatically escalates to linked **Family Members** and **Volunteers**.
  - **Zero Unrelated Notifications**: Unlinked users receive 0 alerts.
- **Dedicated Role Logins**: Separate portal views for Senior Citizens, Family Members, Neighbors, Security Guards, Volunteers, and Admins.
- **GPS Location Tracking**: Integrated high-accuracy location tracking with 1-click Google Maps links for responders.

---

## 🚀 Quick Setup & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables (`.env`)
```env
PORT=3000
JWT_SECRET=your_jwt_secret_key
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/safereach?retryWrites=true&w=majority
```

### 3. Start Local Server
```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000) in your browser.
