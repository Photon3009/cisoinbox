const axios = require('axios');

class WebhookService {
  constructor() {
    this.webhookUrl = process.env.WEBHOOK_URL;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  async triggerWebhook(emailData, eventType = 'interested_email') {
    if (!this.webhookUrl) {
      console.warn('⚠️ Webhook URL not configured, skipping webhook trigger');
      return;
    }

    const payload = this.createPayload(emailData, eventType);
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(this.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'EmailSync-Webhook/1.0'
          },
          timeout: 10000 // 10 seconds timeout
        });

        console.log(`✅ Webhook triggered successfully (attempt ${attempt}):`, response.status);
        return response.data;
      } catch (error) {
        console.error(`❌ Webhook attempt ${attempt} failed:`, error.message);
        
        if (attempt === this.retryAttempts) {
          console.error('❌ All webhook attempts failed');
          throw error;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
      }
    }
  }

  createPayload(emailData, eventType) {
    return {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        id: emailData.id,
        subject: emailData.subject,
        from: emailData.from,
        to: emailData.to,
        account: emailData.account,
        accountEmail: emailData.accountEmail,
        category: emailData.category,
        date: emailData.date,
        folder: emailData.folder,
        preview: emailData.body ? emailData.body.substring(0, 200) : '',
        messageId: emailData.messageId
      },
      metadata: {
        source: 'email-sync-system',
        version: '1.0.0',
        processed_at: new Date().toISOString()
      }
    };
  }

  async triggerCustomWebhook(data, eventType = 'custom_event') {
    if (!this.webhookUrl) {
      console.warn('⚠️ Webhook URL not configured');
      return;
    }

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: data,
      metadata: {
        source: 'email-sync-system',
        version: '1.0.0',
        processed_at: new Date().toISOString()
      }
    };

    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EmailSync-Webhook/1.0'
        },
        timeout: 10000
      });

      console.log('✅ Custom webhook triggered:', response.status);
      return response.data;
    } catch (error) {
      console.error('❌ Custom webhook failed:', error.message);
      throw error;
    }
  }

  async sendBatchWebhook(emails, eventType = 'batch_interested_emails') {
    if (!this.webhookUrl || !emails || emails.length === 0) {
      return;
    }

    const payload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      data: {
        count: emails.length,
        emails: emails.map(email => ({
          id: email.id,
          subject: email.subject,
          from: email.from,
          account: email.account,
          category: email.category,
          date: email.date
        }))
      },
      metadata: {
        source: 'email-sync-system',
        version: '1.0.0',
        processed_at: new Date().toISOString()
      }
    };

    try {
      const response = await axios.post(this.webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EmailSync-Webhook/1.0'
        },
        timeout: 15000
      });

      console.log(`✅ Batch webhook sent for ${emails.length} emails:`, response.status);
      return response.data;
    } catch (error) {
      console.error('❌ Batch webhook failed:', error.message);
      throw error;
    }
  }

  async testWebhook() {
    if (!this.webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const testPayload = {
      event: 'webhook_test',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook from EmailSync system',
        test: true
      },
      metadata: {
        source: 'email-sync-system',
        version: '1.0.0',
        processed_at: new Date().toISOString()
      }
    };

    try {
      const response = await axios.post(this.webhookUrl, testPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EmailSync-Webhook/1.0'
        },
        timeout: 10000
      });

      console.log('✅ Webhook test successful:', response.status);
      return {
        success: true,
        status: response.status,
        response: response.data
      };
    } catch (error) {
      console.error('❌ Webhook test failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  isConfigured() {
    return !!this.webhookUrl;
  }

  getWebhookUrl() {
    return this.webhookUrl;
  }

  setWebhookUrl(url) {
    this.webhookUrl = url;
  }
}

module.exports = new WebhookService();