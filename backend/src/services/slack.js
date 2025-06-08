const { WebClient } = require('@slack/web-api');

class SlackService {
  constructor() {
    this.client = null;
    this.channelId = process.env.SLACK_CHANNEL_ID;
    
    if (process.env.SLACK_BOT_TOKEN) {
      this.client = new WebClient(process.env.SLACK_BOT_TOKEN);
    }
  }

  async sendNotification(emailData) {
    if (!this.client || !this.channelId) {
      console.warn('⚠️ Slack not configured, skipping notification');
      return;
    }

    try {
      const message = this.formatEmailNotification(emailData);
      
      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        ...message
      });

      console.log('✅ Slack notification sent:', result.ts);
      return result;
    } catch (error) {
      console.error('❌ Error sending Slack notification:', error);
      throw error;
    }
  }

  formatEmailNotification(emailData) {
    const truncatedBody = emailData.body.length > 200 
      ? emailData.body.substring(0, 200) + '...' 
      : emailData.body;

    return {
      text: `🎯 New Interested Email Received!`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: '🎯 New Interested Email!'
          }
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*From:*\n${emailData.from}`
            },
            {
              type: 'mrkdwn',
              text: `*Account:*\n${emailData.accountEmail}`
            },
            {
              type: 'mrkdwn',
              text: `*Date:*\n${new Date(emailData.date).toLocaleString()}`
            },
            {
              type: 'mrkdwn',
              text: `*Category:*\n${emailData.category}`
            }
          ]
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Subject:*\n${emailData.subject}`
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Preview:*\n${truncatedBody}`
          }
        },
        {
          type: 'divider'
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Email ID: ${emailData.id} | Folder: ${emailData.folder}`
            }
          ]
        }
      ]
    };
  }

  async sendCustomMessage(message, channel = null) {
    if (!this.client) {
      console.warn('⚠️ Slack not configured');
      return;
    }

    try {
      const result = await this.client.chat.postMessage({
        channel: channel || this.channelId,
        text: message
      });

      console.log('✅ Custom Slack message sent:', result.ts);
      return result;
    } catch (error) {
      console.error('❌ Error sending custom Slack message:', error);
      throw error;
    }
  }

  async sendDailySummary(stats) {
    if (!this.client || !this.channelId) {
      console.warn('⚠️ Slack not configured, skipping daily summary');
      return;
    }

    try {
      const message = {
        text: '📊 Daily Email Summary',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '📊 Daily Email Summary'
            }
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Total Emails:*\n${stats.totalEmails}`
              },
              {
                type: 'mrkdwn',
                text: `*Interested:*\n${stats.byCategory.find(c => c.key === 'Interested')?.doc_count || 0}`
              },
              {
                type: 'mrkdwn',
                text: `*Meetings Booked:*\n${stats.byCategory.find(c => c.key === 'Meeting Booked')?.doc_count || 0}`
              },
              {
                type: 'mrkdwn',
                text: `*Not Interested:*\n${stats.byCategory.find(c => c.key === 'Not Interested')?.doc_count || 0}`
              }
            ]
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: '*Accounts:*\n' + stats.byAccount.map(acc => 
                `• ${acc.key}: ${acc.doc_count} emails`
              ).join('\n')
            }
          }
        ]
      };

      const result = await this.client.chat.postMessage({
        channel: this.channelId,
        ...message
      });

      console.log('✅ Daily summary sent to Slack:', result.ts);
      return result;
    } catch (error) {
      console.error('❌ Error sending daily summary:', error);
      throw error;
    }
  }

  async testConnection() {
    if (!this.client) {
      throw new Error('Slack not configured');
    }

    try {
      const result = await this.client.auth.test();
      console.log('✅ Slack connection test successful:', result.user);
      return result;
    } catch (error) {
      console.error('❌ Slack connection test failed:', error);
      throw error;
    }
  }

  isConfigured() {
    return !!(this.client && this.channelId);
  }
}

module.exports = new SlackService();