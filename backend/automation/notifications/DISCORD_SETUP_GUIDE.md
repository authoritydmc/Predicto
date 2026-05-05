# Discord Integration Setup Guide

This guide will help you set up Discord notifications for your automation system. You'll receive real-time notifications about match events, automation status, and system alerts directly in your Discord channels.

## 🎯 What You'll Get

Once set up, you'll receive Discord notifications like these:

### 📊 Match Events
- **Match Created**: When new matches are scheduled
- **Match Started**: When matches begin
- **Match Completed**: When matches finish with results
- **Score Updates**: Live score changes during matches

### 🤖 Automation Status
- **System Started**: When automation system starts
- **System Stopped**: When automation system stops
- **Component Errors**: When scrapers or other components fail
- **Scoring Completed**: When score processing finishes

### 🚨 System Alerts
- **Critical Errors**: System failures requiring attention
- **Performance Issues**: High error rates or timeouts
- **Custom Alerts**: Any custom notifications you configure

## 📋 Prerequisites

- Discord account with server admin permissions
- Ability to create Discord applications
- Access to your automation system's Firebase configuration

## 🚀 Step-by-Step Setup

### Step 1: Create Discord Application

1. **Go to Discord Developer Portal**
   - Visit: https://discord.com/developers/applications
   - Click "New Application"

2. **Configure Application**
   ```
   Name: Automation Notifications
   Description: Cricket automation system notifications
   Icon: Upload a logo (optional)
   ```
   
3. **Create Bot**
   - Go to "Bot" tab
   - Click "Add Bot"
   - Set bot name and avatar
   - **Important**: Uncheck "Public Bot" (this keeps your bot private)

4. **Configure Bot Permissions**
   Enable these bot permissions:
   - ✅ **Send Messages** - Required for sending notifications
   - ✅ **Embed Links** - For rich message formatting
   - ✅ **Read Message History** (optional, for debugging)
   - ✅ **Use External Emojis** (optional, for custom emojis)

### Step 2: Create Webhook

1. **Go to Your Discord Server**
   - Open your Discord server
   - Choose the channel where you want notifications (or create a new one)

2. **Create Webhook**
   - Right-click on the channel
   - Select "Edit Channel"
   - Go to "Integrations" tab
   - Click "Webhooks"
   - Click "New Webhook"

3. **Configure Webhook**
   ```
   Name: Automation Bot
   Avatar: Upload bot avatar (optional)
   Channel: Select your notifications channel
   ```

4. **Copy Webhook URL**
   - Click "Copy Webhook URL"
   - **Save this URL securely** - it's like a password!

   Your webhook URL will look like:
   ```
   https://discord.com/api/webhooks/1234567890/AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
   ```

### Step 3: Configure in Your System

1. **Open Host Control App**
   - Launch your automation system
   - Open the control panel

2. **Go to Notifications Section**
   - Find the "Notifications" or "Discord" section
   - Click "Add Discord Provider"

3. **Enter Configuration**
   ```
   Webhook URL: [Paste your webhook URL here]
   Username: Automation Bot (or your preferred name)
   Avatar URL: [Optional - bot avatar image URL]
   Enable Rich Embeds: ✅ (recommended)
   Default Color: #3498db (blue)
   Rate Limit: 10 messages per minute
   ```

4. **Test Configuration**
   - Click "Test Webhook"
   - You should receive a test message in your Discord channel
   - If successful, click "Save Configuration"

### Step 4: Configure Notification Types

1. **Enable Notification Types**
   In the control panel, enable which events you want to receive:
   - ✅ Match Created
   - ✅ Match Started  
   - ✅ Match Completed
   - ✅ Score Updates
   - ✅ Automation Errors
   - ✅ System Alerts

2. **Set Priorities**
   Configure notification priorities:
   - **Critical**: System failures, automation stopped
   - **High**: Scraper errors, scoring issues
   - **Normal**: Match events, score updates
   - **Low**: General status updates

3. **Customize Settings**
   - **Rate Limiting**: Prevent spam (recommended: 10/min)
   - **Retry Logic**: Auto-retry failed notifications
   - **Quiet Hours**: Disable notifications during certain times

## 🔧 Advanced Configuration

### Custom Webhook Formatting

You can customize how notifications appear:

```json
{
  "username": "Cricket Bot",
  "avatar_url": "https://example.com/bot-avatar.png",
  "enable_embeds": true,
  "default_color": "#3498db",
  "rate_limit": 15
}
```

### Channel Organization

For better organization, consider setting up multiple channels:

1. **#notifications** - General notifications
2. **#alerts** - Critical errors and system alerts
3. **#matches** - Match-specific events
4. **#debug** - Development and debugging info

Create separate webhooks for each channel and configure accordingly.

### Custom Message Templates

You can customize notification templates in Firebase:

```json
{
  "match_created": {
    "title": "🏏 New Match: {team_a} vs {team_b}",
    "content": "Match scheduled for {date} at {venue}"
  },
  "automation_error": {
    "title": "⚠️ Automation Error",
    "content": "Component: {component}\nError: {error}"
  }
}
```

## 🎨 Notification Examples

### Match Created Notification
```
🏏 Match Created: CSK vs MI

A new match has been scheduled:

**CSK vs MI**
Date: 2026-05-06 19:30
Venue: M.A. Chidambaram Stadium
Sport: Cricket
```

### Automation Error Notification
```
⚠️ Automation Error

An error occurred in the automation system:

**Component**: scraper_manager
**Error**: Failed to fetch data from Cricbuzz
**Time**: 2026-05-05 20:15:30
```

### Match Completed Notification
```
✅ Match Completed: CSK vs MI

Match finished!

**Winner: CSK**
Final Score: 178/4 (20.0) vs 165/8 (20.0)
Predictions processed: 245
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Webhook Not Working
**Problem**: No notifications received
**Solutions**:
- Check webhook URL is correct
- Verify bot has "Send Messages" permission
- Ensure channel is not in read-only mode
- Test webhook with the "Test" button

#### 2. Rate Limit Errors
**Problem**: "Too many requests" errors
**Solutions**:
- Reduce rate limit in configuration
- Enable notification filtering
- Use multiple webhooks for high-volume notifications

#### 3. Permission Errors
**Problem**: Bot can't send messages
**Solutions**:
- Check bot permissions in server settings
- Ensure channel allows webhooks
- Verify webhook wasn't deleted

#### 4. Formatting Issues
**Problem**: Messages look broken
**Solutions**:
- Check Discord markdown syntax
- Ensure embed formatting is enabled
- Verify character limits (Discord: 2000 chars)

### Debug Mode

Enable debug logging to troubleshoot issues:

1. In your control panel, enable "Debug Mode"
2. Check the debug window for detailed logs
3. Look for these log entries:
   ```
   [DiscordProvider] Sending notification: notification_id
   [DiscordProvider] Notification sent successfully
   [DiscordProvider] Error: HTTP 400 - Bad Request
   ```

### Webhook Security

Keep your webhook secure:

- **Never share webhook URLs** publicly
- **Regenerate webhooks** if compromised
- **Use IP restrictions** if possible
- **Monitor webhook usage** regularly

## 📱 Mobile Notifications

To receive mobile notifications:

1. **Install Discord Mobile App**
   - Download from App Store or Google Play

2. **Enable Push Notifications**
   - Go to Discord Settings > Notifications
   - Enable "Mobile Push Notifications"
   - Configure notification settings per server

3. **Set Notification Priority**
   - Set server to "All Messages" or "@mentions only"
   - Create custom notification settings

## 🔗 Integration with Automation

The Discord integration works seamlessly with your automation system:

### Automatic Triggers
- Match creation from external APIs
- Live score updates from scrapers
- Score processing completion
- System health monitoring
- Error detection and alerting

### Manual Triggers
- Test notifications from control panel
- Custom alerts via API
- Manual status updates

### Event Filtering
Configure which events trigger notifications:

```javascript
// Example event configuration
{
  "match.created": {
    "enabled": true,
    "priority": "normal",
    "channels": ["#matches"]
  },
  "automation.error": {
    "enabled": true,
    "priority": "critical", 
    "channels": ["#alerts", "#notifications"]
  }
}
```

## 🎯 Best Practices

### Do's
- ✅ Use descriptive channel names
- ✅ Set appropriate rate limits
- ✅ Test webhooks before going live
- ✅ Monitor notification volume
- ✅ Use different priorities for different event types

### Don'ts
- ❌ Share webhook URLs publicly
- ❌ Send sensitive information in notifications
- ❌ Spam with too many notifications
- ❌ Ignore rate limits
- ❌ Use webhook URLs in client-side code

## 📊 Monitoring and Analytics

Monitor your Discord notifications:

### In Control Panel
- View notification statistics
- Check success/failure rates
- Monitor queue sizes
- View error logs

### Discord Server Insights
- Check message delivery rates
- Monitor engagement
- Track notification effectiveness

### Firebase Analytics
- Notification counts by type
- Provider performance metrics
- Error rate tracking
- Usage patterns

## 🔄 Maintenance

### Regular Tasks
- **Monthly**: Review notification performance
- **Quarterly**: Update bot permissions
- **As Needed**: Regenerate webhooks if compromised

### Backup and Recovery
- Save webhook configurations
- Document notification settings
- Keep backup of custom templates

## 🆘 Getting Help

If you need assistance:

1. **Check Logs**: Review debug logs in control panel
2. **Test Webhook**: Use the test functionality
3. **Review Configuration**: Double-check all settings
4. **Consult Documentation**: Refer to this guide
5. **Community Support**: Join our Discord community

## 📚 Additional Resources

- [Discord Developer Documentation](https://discord.com/developers/docs/intro)
- [Discord Webhook Guide](https://support.discord.com/hc/en-us/articles/228383668)
- [Discord Bot Permissions](https://discord.com/developers/docs/topics/permissions)
- [Markdown Guide](https://support.discord.com/hc/en-us/articles/210298617-Markdown-Text-101-Chat-Formatting-Bold-Italic-Underline-)

---

**🎉 Congratulations!** You've successfully set up Discord notifications for your automation system. You'll now receive real-time updates about your cricket automation directly in Discord.

For questions or support, refer to the troubleshooting section or contact our development team.
