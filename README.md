# 📬 Real-Time AI Email Sync Platform

An end-to-end system that syncs multiple IMAP inboxes in real-time, categorizes incoming emails using AI, stores and indexes them in Elasticsearch, and provides a web-based UI to search and manage conversations. Includes Slack and Webhook integrations and AI-powered reply suggestions using RAG.

---

## 🚀 Features

### **1. Real-Time Email Synchronization**

* Connects to **multiple IMAP accounts**.
* Fetches at least **30 days of emails** on startup.
* Maintains **persistent IMAP (IDLE) connections** for live email updates.
* No cron jobs used.

### **2. Searchable Storage using Elasticsearch**

* All emails are stored in a **local Elasticsearch** instance (via Docker).
* Indexes support **fast search and filtering**.
* Filters: `account`, `folder`, `category`, and date range.

### **3. AI-Based Email Categorization**

* Incoming emails are auto-labeled into:

  * **Interested**
  * **Meeting Booked**
  * **Not Interested**
  * **Spam**
  * **Out of Office**

### **4. Slack & Webhook Integration**

* Sends Slack notification for each **Interested** email.
* Triggers webhook (like [webhook.site](https://webhook.site)) for external automations.

### **5. Frontend Interface**

* Web-based UI to:

  * View and search emails.
  * Filter by folder, account, or category.
  * See AI labels.

### **6. AI-Powered Suggested Replies**

* Uses **RAG (Retrieval-Augmented Generation)** to suggest replies.
* Product agenda & messaging stored in a **vector DB**.
* Example: Auto-suggest reply like “You can book your interview slot here.”

---

## 💠 Setup Instructions

### **1. Clone the Repository**

```bash
git clone https://github.com/your-repo/email-sync-platform.git
cd email-sync-platform
```

### **2. Setup Environment Variables**

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Elasticsearch Configuration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=emails

# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key
GOOGLE_API_KEY=your-google-api-key

# Slack Configuration
SLACK_BOT_TOKEN=your-slack-bot-token
SLACK_CHANNEL_ID=your-slack-channel-id

# Webhook Configuration
WEBHOOK_URL=https://your-webhook-url.com

# Email Account 1
EMAIL1_HOST=imap.gmail.com
EMAIL1_PORT=993
EMAIL1_USER=example1@gmail.com
EMAIL1_PASSWORD=your-app-password-1
EMAIL1_TLS=true

# Email Account 2
EMAIL2_HOST=outlook.office365.com
EMAIL2_PORT=993
EMAIL2_USER=example2@outlook.com
EMAIL2_PASSWORD=your-app-password-2
EMAIL2_TLS=true

# RAG Configuration
VECTOR_DB_PATH=./vector_db
MEETING_LINK=https://cal.com/example
PRODUCT_DESCRIPTION=Your product or service description here
```

# 🔗 Slack Integration Guide

To enable Slack notifications for **Interested** emails, follow these steps:

## 🛠️ Step 1: Create a Slack App

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Choose **"From scratch"**
4. Give it a name (e.g., `EmailSyncBot`) and select your Slack workspace
5. Click **"Create App"**

---

## 🔐 Step 2: Add OAuth Scopes

1. In the app settings, go to **"OAuth & Permissions"**
2. Under **Scopes > Bot Token Scopes**, add the following:
   - `chat:write`
   - `channels:read`
   - `groups:read`
3. Click **"Install App to Workspace"**
4. **Authorize** the app to get your **Bot User OAuth Token**

Save this token as:
```env
SLACK_BOT_TOKEN=your-bot-token
```

## 📡 Step 3: Get the Channel ID

1. Go to the Slack workspace and open the channel where you want to send notifications
2. Click the channel name > "View channel details"
3. In the URL, copy the ID part:
   - For example, in `https://app.slack.com/client/TXXXXXXX/CYYYYYYY`, the channel ID is `CYYYYYYY`

Save it as:
```env
SLACK_CHANNEL_ID=your-channel-id
```

### **3. Start Elasticsearch (via Docker)**

```bash
docker run -d -p 9200:9200 -e "discovery.type=single-node" elasticsearch:8.12.0
```

### **4. Install Backend Dependencies**

```bash
cd backend
npm install
```

### **5. Start the Backend**

```bash
npm run dev
```

### **6. Start the Frontend**

```bash
cd frontend
npm install
npm run dev
```

---

## 🧪 Architecture Overview

```
                                +----------------------+
                                |  IMAP Email Accounts |
                                +----------------------+
                                          |
                                          ▼
                                +----------------------+
                                |   Email Sync Service |
                                | (IDLE Real-Time Sync)|
                                +----------------------+
                                          |
                                          ▼
+-------------+        +---------------------+        +------------------+
| Slack Bot   |<------>| Categorization/AI   |<------>| Webhook Trigger  |
+-------------+        +---------------------+        +------------------+
                                          |
                                          ▼
                                +----------------------+
                                |    Elasticsearch DB  |
                                +----------------------+
                                          |
                                          ▼
                                +----------------------+
                                |    Vector DB (RAG)   |
                                +----------------------+
                                          |
                                          ▼
                                +----------------------+
                                |       Frontend       |
                                +----------------------+
```

---

## 🧾 Folder Structure

```
.
├── backend/
│   ├── routes/
│   ├── services/
│   ├── index.js
│   └── .env
├── frontend/
│   ├── pages/
│   └── components/
├── vector_db/
└── docker-compose.yml 
```

---

## 🔑 API Highlights

* `GET /api/emails`: List emails with filters
* `GET /api/emails/:id`: Get email by ID
* `POST /api/emails/:id/suggest-reply`: Get suggested reply
* `POST /api/emails/search`: Search emails

---

## 🔥 Tech Stack

* **Backend**: Node.js, Express
* **Email Sync**: `node-imap`
* **AI**: OpenAI / Gemini API
* **Database**: Elasticsearch + File-based Vector DB
* **Frontend**: Next.js (React)
* **Notifications**: Slack API, Webhook

---

## 🧪 Testing

To simulate email sync, send an email to one of your IMAP inboxes and observe:

* Logs in terminal
* Slack notification if `Interested`
* Webhook trigger
* Display in frontend with category

---

## 📄 License

MIT License
