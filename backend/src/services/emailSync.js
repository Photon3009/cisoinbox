const Imap = require("node-imap");
const { simpleParser } = require("mailparser");
const elasticService = require("./elasticsearch");
const aiService = require("./categorization");
const slackService = require("./slack");
const webhookService = require("./webhook");

class EmailSyncService {
  constructor() {
    this.connections = new Map();
    this.isRunning = false;
    this.accounts = this.getAccountConfigs();
  }

  getAccountConfigs() {
    const accounts = [];

    // Account 1
    if (process.env.EMAIL1_USER) {
      accounts.push({
        id: "account1",
        email: process.env.EMAIL1_USER,
        config: {
          user: process.env.EMAIL1_USER,
          password: process.env.EMAIL1_PASSWORD,
          host: process.env.EMAIL1_HOST,
          port: parseInt(process.env.EMAIL1_PORT),
          tls: process.env.EMAIL1_TLS === "true",
          tlsOptions: { rejectUnauthorized: false },
        },
      });
    }

    // Account 2
    // if (process.env.EMAIL2_USER) {
    //   accounts.push({
    //     id: "account2",
    //     email: process.env.EMAIL2_USER,
    //     config: {
    //       user: process.env.EMAIL2_USER,
    //       password: process.env.EMAIL2_PASSWORD,
    //       host: process.env.EMAIL2_HOST,
    //       port: parseInt(process.env.EMAIL2_PORT),
    //       tls: process.env.EMAIL2_TLS === "true",
    //       tlsOptions: { rejectUnauthorized: false },
    //     },
    //   });
    // }

    return accounts;
  }

  async startSync() {
    if (this.isRunning) {
      console.log("📧 Email sync already running");
      return;
    }

    this.isRunning = true;
    console.log("🚀 Starting email synchronization...");

    for (const account of this.accounts) {
      await this.connectAccount(account);
    }
  }

  async connectAccount(account) {
    try {
      const imap = new Imap(account.config);
      this.connections.set(account.id, imap);

      imap.once("ready", () => {
        console.log(`✅ Connected to ${account.email}`);
        this.setupImapHandlers(imap, account);
      });

      imap.once("error", (err) => {
        console.error(`❌ IMAP error for ${account.email}:`, err);
        this.reconnectAccount(account);
      });

      imap.once("end", () => {
        console.log(`🔌 Connection ended for ${account.email}`);
        this.reconnectAccount(account);
      });

      imap.connect();
    } catch (error) {
      console.error(`❌ Failed to connect ${account.email}:`, error);
      setTimeout(() => this.connectAccount(account), 30000);
    }
  }

  setupImapHandlers(imap, account) {
    imap.openBox("INBOX", false, (err, box) => {
      if (err) {
        console.error(`❌ Failed to open inbox for ${account.email}:`, err);
        return;
      }

      console.log(`📬 Opened inbox for ${account.email}`);

      // 👉 Move sync here
      this.syncRecentEmails(imap, account);

      // Enable IDLE mode for real-time updates
      imap.on("mail", (numNewMsgs) => {
        console.log(`📨 ${numNewMsgs} new emails received in ${account.email}`);
        this.fetchNewEmails(imap, account, numNewMsgs);
      });

      if (imap.serverSupports("IDLE")) {
        console.log(`⏰ Starting IDLE mode for ${account.email}`);
        // imap.idle(); // (More on this in issue 2)
      } else {
        this.startPolling(imap, account);
      }
    });
  }

  async syncRecentEmails(imap, account) {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const searchCriteria = [["SINCE", thirtyDaysAgo]];

      imap.search(searchCriteria, async (err, results) => {
        if (err) {
          console.error(`❌ Search error for ${account.email}:`, err);
          return;
        }

        if (!results || results.length === 0) {
          console.log(`📭 No recent emails found for ${account.email}`);
          return;
        }

        console.log(
          `📧 Found ${results.length} recent emails for ${account.email}`
        );
        await this.processEmails(imap, account, results.slice(-5)); // Process last 50 emails
      });
    } catch (error) {
      console.error(
        `❌ Error syncing recent emails for ${account.email}:`,
        error
      );
    }
  }

  async fetchNewEmails(imap, account, count) {
    try {
      imap.search(["UNSEEN"], async (err, results) => {
        if (err) {
          console.error(
            `❌ Error fetching new emails for ${account.email}:`,
            err
          );
          return;
        }

        if (results && results.length > 0) {
          await this.processEmails(imap, account, results);
        }
      });
    } catch (error) {
      console.error(
        `❌ Error processing new emails for ${account.email}:`,
        error
      );
    }
  }

  async processEmails(imap, account, uids) {
    if (!uids || uids.length === 0) return;

    const fetch = imap.fetch(uids, {
      bodies: "",
      struct: true,
      envelope: true,
    });

    fetch.on("message", (msg, seqno) => {
      let emailData = {
        uid: null,
        account: account.id,
        accountEmail: account.email,
        subject: "",
        from: "",
        to: "",
        date: new Date(),
        body: "",
        folder: "INBOX",
      };

      msg.on("body", async (stream, info) => {
        try {
          const parsed = await simpleParser(stream);

          emailData = {
            ...emailData,
            uid: msg.uid || seqno,
            subject: parsed.subject || "",
            from: parsed.from?.text || "",
            to: parsed.to?.text || "",
            date: parsed.date || new Date(),
            body: parsed.text || parsed.html || "",
            messageId: parsed.messageId,
          };
          console.log(
            `📧 Processing email: ${emailData.subject} from ${emailData.from}`
          );

          await this.processEmail(emailData);
        } catch (error) {
          console.error("❌ Error parsing email:", error);
        }
      });

      msg.once("attributes", (attrs) => {
        emailData.uid = attrs.uid;
      });
    });

    fetch.once("error", (err) => {
      console.error(`❌ Fetch error for ${account.email}:`, err);
    });
  }

  async processEmail(emailData) {
    try {
      // Store in Elasticsearch
      const docId = await elasticService.indexEmail(emailData);
      emailData.id = docId;

      // AI Categorization
      const category = await aiService.categorizeEmail(emailData);
      emailData.category = category;

      // Update document with category
      await elasticService.updateEmailCategory(docId, category);

      // Send real-time update to frontend
      if (global.io) {
        global.io.emit("newEmail", emailData);
      }

      // Handle "Interested" emails
      if (category === "Spam") {
        console.log(
          `📬 Interested email detected: ${emailData.subject} (${emailData.category})`
        );
        // Send Slack notification
        await slackService.sendNotification(emailData);

        // // Trigger webhook
        await webhookService.triggerWebhook(emailData);
      }

      console.log(`✅ Processed email: ${emailData.subject} (${category})`);
    } catch (error) {
      console.error("❌ Error processing email:", error);
    }
  }

  startPolling(imap, account) {
    setInterval(() => {
      this.fetchNewEmails(imap, account, 0);
    }, 60000); // Poll every minute
  }

  async reconnectAccount(account) {
    if (!this.isRunning) return;

    console.log(`🔄 Reconnecting ${account.email} in 30 seconds...`);
    setTimeout(() => {
      if (this.isRunning) {
        this.connectAccount(account);
      }
    }, 30000);
  }

  async stopSync() {
    console.log("🛑 Stopping email synchronization...");
    this.isRunning = false;

    for (const [accountId, imap] of this.connections) {
      try {
        imap.end();
      } catch (error) {
        console.error(`❌ Error closing connection for ${accountId}:`, error);
      }
    }

    this.connections.clear();
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      connectedAccounts: Array.from(this.connections.keys()),
      totalAccounts: this.accounts.length,
    };
  }
}

module.exports = new EmailSyncService();
