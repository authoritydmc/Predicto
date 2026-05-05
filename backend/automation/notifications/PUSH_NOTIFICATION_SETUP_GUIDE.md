# Push Notification Setup Guide

This comprehensive guide will help you set up push notifications for your cricket automation system, allowing users to receive personalized notifications directly on their devices.

## 🎯 What You'll Get

### **Individual User Notifications**
Unlike Discord notifications that go to a common channel, push notifications deliver messages directly to individual users based on their preferences:

- **🏏 Match Events**: Users get notified about matches they're interested in
- **🤖 Personal Alerts**: Automation errors and system status based on user preferences
- **📊 Score Updates**: Real-time score updates for followed matches
- **🔔 Customizable**: Users control exactly what they receive

### **Cross-Platform Support**
- **📱 Mobile**: iOS and Android via Firebase Cloud Messaging (FCM)
- **💻 Web**: Desktop browsers via Web Push API
- **🖥️ Desktop**: Native desktop notifications
- **⚙️ Preferences**: User-specific settings and quiet hours

## 📋 Prerequisites

- Firebase project with FCM enabled
- HTTPS for web push notifications (required for service workers)
- Firebase Admin SDK installed
- Basic understanding of push notification concepts

## 🚀 Step-by-Step Setup

### Step 1: Firebase Project Setup

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com/)
   - Click "Add project"
   - Enter project name: `cricket-automation-push`
   - Enable Google Analytics (optional)

2. **Enable Cloud Messaging**
   - In Firebase Console, go to "Project Settings"
   - Click "Cloud Messaging" tab
   - Copy your **Sender ID** and **Server Key**

3. **Generate Service Account Key**
   - Go to "Service Accounts" tab
   - Click "Generate new private key"
   - Select JSON format
   - Download and save the key file securely

### Step 2: Backend Configuration

1. **Install Required Packages**
   ```bash
   pip install firebase-admin pywebpush cryptography
   ```

2. **Configure Firebase in Control Panel**
   - Open your automation control panel
   - Go to "Push Notifications" section
   - Enter Firebase Project ID
   - Paste Service Account Key JSON
   - Enable push notifications

3. **Test Configuration**
   - Click "Test Push Notification"
   - Verify configuration is working

### Step 3: Web Push Setup (for browsers)

1. **Generate VAPID Keys**
   The system automatically generates VAPID keys when Web Push is configured:
   - VAPID Public Key: Used by client browsers
   - VAPID Private Key: Used by server for authentication

2. **Service Worker Setup**
   Create a service worker file (`sw.js`) in your web app:
   ```javascript
   // sw.js
   self.addEventListener('push', event => {
     const data = event.data.json();
     
     const options = {
       body: data.body,
       icon: data.icon,
       badge: data.badge,
       vibrate: data.vibrate,
       data: data.data,
       actions: data.actions
     };
     
     event.waitUntil(
       self.registration.showNotification(data.title, options)
     );
   });
   
   self.addEventListener('notificationclick', event => {
     event.notification.close();
     
     if (event.action) {
       // Handle action clicks
       clients.openWindow(event.action);
     } else {
       // Handle notification click
       clients.openWindow(event.notification.data.url);
     }
   });
   ```

3. **Register Service Worker**
   In your main app:
   ```javascript
   // Register service worker
   if ('serviceWorker' in navigator) {
     navigator.serviceWorker.register('/sw.js')
       .then(registration => {
         console.log('Service Worker registered');
         
         // Register for push notifications
         return registerPushNotifications(registration);
       })
       .catch(error => console.error('SW registration failed:', error));
   }
   
   async function registerPushNotifications(registration) {
     try {
       // Request permission
       const permission = await Notification.requestPermission();
       if (permission !== 'granted') {
         console.log('Notification permission denied');
         return;
       }
       
       // Get VAPID public key from server
       const response = await fetch('/api/vapid-public-key');
       const { publicKey } = await response.json();
       
       // Subscribe to push notifications
       const subscription = await registration.pushManager.subscribe({
         userVisibleOnly: true,
         applicationServerKey: publicKey
       });
       
       // Send subscription to server
       await fetch('/api/register-device', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           device_type: 'web',
           platform: navigator.platform.toLowerCase(),
           subscription: subscription
         })
       });
       
       console.log('Push notifications enabled!');
     } catch (error) {
       console.error('Push registration failed:', error);
     }
   }
   ```

### Step 4: Mobile App Integration

#### For React Native (iOS/Android)

1. **Install Firebase Messaging**
   ```bash
   npm install @react-native-firebase/app @react-native-firebase/messaging
   # or for Expo
   npx expo install firebase
   ```

2. **Configure Firebase**
   - Add `google-services.json` (Android)
   - Add `GoogleService-Info.plist` (iOS)

3. **Request Permissions**
   ```javascript
   import messaging from '@react-native-firebase/messaging';
   
   async function requestUserPermission() {
     const authStatus = await messaging().requestPermission();
     const enabled =
       authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
       authStatus === messaging.AuthorizationStatus.PROVISIONAL;
     
     if (enabled) {
       console.log('Authorization status:', authStatus);
     }
   }
   ```

4. **Get FCM Token**
   ```javascript
   async function getFCMToken() {
     const fcmToken = await messaging().getToken();
     if (fcmToken) {
       console.log('FCM Token:', fcmToken);
       // Send to server
       await registerDevice(fcmToken);
     }
   }
   ```

#### For Flutter (iOS/Android)

1. **Add Dependencies**
   ```yaml
   dependencies:
     firebase_core: ^2.15.1
     firebase_messaging: ^14.7.10
   ```

2. **Initialize Firebase**
   ```dart
   import 'package:firebase_core/firebase_core.dart';
   import 'package:firebase_messaging/firebase_messaging.dart';
   
   Future<void> main() async {
     WidgetsFlutterBinding.ensureInitialized();
     await Firebase.initializeApp();
     runApp(MyApp());
   }
   ```

3. **Request Permissions and Get Token**
   ```dart
   class NotificationService {
     final FirebaseMessaging _fcm = FirebaseMessaging.instance;
     
     Future<void> initNotifications() async {
       // Request permission
       NotificationSettings settings = await _fcm.requestPermission();
       
       if (settings.authorizationStatus == AuthorizationStatus.authorized) {
         // Get token
         String? token = await _fcm.getToken();
         if (token != null) {
           // Send to server
           await registerDevice(token);
         }
       }
     }
   }
   ```

### Step 5: User Preference Management

The system provides comprehensive user preference controls:

#### **Global Preferences**
- **All Notifications**: Receive all enabled notification types
- **Important Only**: Only high and critical priority notifications
- **Match Events Only**: Only match-related notifications
- **None**: Disable all notifications

#### **Notification Types**
Users can enable/disable specific notification types:
- ✅ Match Created
- ✅ Match Started  
- ✅ Match Completed
- ❌ Score Updates (disabled by default - too frequent)
- ✅ Automation Errors
- ✅ System Alerts

#### **Quiet Hours**
Users can set quiet hours to avoid notifications during specific times:
- Start time (e.g., 22:00)
- End time (e.g., 08:00)
- Timezone support
- Critical notifications still delivered

#### **Device Management**
- Register multiple devices per user
- Enable/disable specific devices
- Automatic cleanup of inactive devices
- Device type detection (web, mobile, desktop)

## 🔧 Advanced Configuration

### **Firebase Cloud Messaging Settings**

```json
{
  "firebase_config": {
    "project_id": "your-project-id",
    "service_account_key": {
      "type": "service_account",
      "project_id": "your-project-id",
      "private_key_id": "...",
      "private_key": "...",
      "client_email": "...",
      "client_id": "...",
      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
      "token_uri": "https://oauth2.googleapis.com/token"
    },
    "fcm_settings": {
      "collapse_key": "automation_notifications",
      "priority": "high",
      "time_to_live": 86400,
      "restricted_package_name": "com.yourapp.cricket"
    }
  }
}
```

### **Web Push Configuration**

```json
{
  "web_push_config": {
    "vapid_public_key": "generated_public_key",
    "vapid_private_key": "generated_private_key", 
    "vapid_email": "push@yourapp.com",
    "ttl": 86400,
    "urgency": "normal"
  }
}
```

### **Notification Templates**

The system supports customizable notification templates:

```json
{
  "templates": {
    "match_created": {
      "title": "🏏 New Match: {team_a} vs {team_b}",
      "body": "Match scheduled for {date} at {venue}",
      "icon": "/icons/match-created.png",
      "actions": [
        {"action": "view_match", "title": "View Match"},
        {"action": "predict", "title": "Make Prediction"}
      ]
    },
    "match_completed": {
      "title": "✅ Match Finished: {winner} won!",
      "body": "Final score: {score} • {predictions_count} predictions",
      "icon": "/icons/match-completed.png",
      "actions": [
        {"action": "results", "title": "View Results"},
        {"action": "leaderboard", "title": "Leaderboard"}
      ]
    }
  }
}
```

## 📱 Notification Examples

### **Match Created Notification**
```
🏏 New Match: CSK vs MI

Match scheduled for May 6, 2026 at 19:30
Venue: M.A. Chidambaram Stadium

[View Match] [Make Prediction]
```

### **Score Update Notification**
```
📊 Score Update: CSK 145/4 (18.3) vs MI

Live score update from Chennai

[View Match] [Live Scores]
```

### **Automation Error Notification**
```
⚠️ Automation Error

Scraper failed: Cricbuzz timeout
Component: scraper_manager

[Dashboard] [Dismiss]
```

## 🛠️ Troubleshooting

### **Common Issues**

#### 1. Firebase Configuration Errors
**Problem**: "Invalid Firebase credentials"
**Solutions**:
- Verify service account key is valid JSON
- Check project ID matches Firebase console
- Ensure service account has FCM permissions

#### 2. Web Push Not Working
**Problem**: "Push subscription failed"
**Solutions**:
- Ensure site is served over HTTPS
- Check VAPID keys are properly configured
- Verify service worker is registered correctly

#### 3. Mobile Notifications Not Received
**Problem**: "FCM token registration failed"
**Solutions**:
- Check Firebase configuration files are correct
- Verify app has notification permissions
- Test with FCM diagnostic tools

#### 4. User Preferences Not Saving
**Problem**: "Settings not persisting"
**Solutions**:
- Check Firebase database rules
- Verify user ID is correct
- Check network connectivity

### **Debug Mode**

Enable debug logging to troubleshoot issues:

```javascript
// Client-side debugging
console.log('Push notification debug:', {
  subscription: subscription,
  vapidKey: vapidPublicKey,
  permission: Notification.permission
});
```

```python
# Server-side debugging
logger.setLevel(logging.DEBUG)
logger.debug('Push notification debug:', {
  user_id: user_id,
  devices: devices,
  notification: notification
})
```

### **Testing Tools**

#### Firebase Console
- Use Firebase Console > Cloud Messaging > Send test message
- Test with specific FCM tokens
- Check delivery reports

#### Web Push Testing
- Use browser DevTools > Application > Service Workers
- Test push events manually
- Check subscription details

#### Mobile Testing
- Use Firebase A/B Testing for delivery rates
- Test with different device types
- Monitor background/foreground behavior

## 📊 Analytics and Monitoring

### **Delivery Metrics**
Track push notification performance:

```javascript
// Client-side analytics
analytics.track('push_notification_received', {
  notification_type: notification.type,
  device_type: device.type,
  timestamp: Date.now()
});
```

```python
# Server-side analytics
stats = {
  'total_sent': total_sent,
  'total_failed': total_failed,
  'delivery_rate': total_sent / (total_sent + total_failed),
  'user_engagement': click_through_rate
}
```

### **User Engagement**
Monitor how users interact with notifications:
- Open rates
- Click-through rates
- Action completion rates
- Unsubscription rates

### **Performance Optimization**
- Batch notifications to reduce API calls
- Use collapse keys to group similar notifications
- Implement rate limiting per user
- Cache user preferences

## 🔒 Security Best Practices

### **Token Security**
- Never expose service account keys in client code
- Use HTTPS for all API calls
- Implement token expiration and refresh
- Validate all incoming requests

### **User Privacy**
- Allow users to opt out completely
- Provide clear privacy policy
- Don't store unnecessary personal data
- Implement data retention policies

### **API Security**
- Rate limit notification endpoints
- Validate user permissions
- Use authentication for all API calls
- Monitor for abuse patterns

## 🎯 Best Practices

### **Do's**
- ✅ Test on all target platforms
- ✅ Respect user preferences
- ✅ Use meaningful notification content
- ✅ Implement proper error handling
- ✅ Monitor delivery rates
- ✅ Provide opt-out options

### **Don'ts**
- ❌ Spam users with too many notifications
- ❌ Send sensitive information in notifications
- ❌ Ignore user quiet hours
- ❌ Use generic notification content
- ❌ Skip permission requests
- ❌ Forget to test edge cases

## 📚 Additional Resources

### **Documentation**
- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push API Specification](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)

### **Tools**
- [Firebase Console](https://console.firebase.google.com/)
- [Web Push Test Tool](https://web-push-test.glitch.me/)
- [FCM Diagnostic Tool](https://firebase.google.com/docs/cloud-messaging/understand#diagnostics)

### **Libraries**
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [PyWebPush](https://github.com/web-push-libs/pywebpush)
- [React Native Firebase](https://rnfirebase.io/)

---

## 🎉 Congratulations!

You've successfully set up a comprehensive push notification system for your cricket automation platform! Your users can now:

- **Receive personalized notifications** based on their preferences
- **Control exactly what they get** through granular settings
- **Enjoy cross-platform support** on web, mobile, and desktop
- **Respect quiet hours** and user preferences
- **Get real-time updates** about matches and automation status

The system is now ready to deliver targeted, user-specific push notifications that enhance the user experience while respecting their preferences and privacy.

For questions or support, refer to the troubleshooting section or contact our development team.
