# Our Space Chat

A modern real-time social chat platform built with Firebase. Users can create accounts, search for friends by username, send friend requests, join chat rooms, and communicate in real time through a clean Instagram-inspired interface.

---

## Features

### Authentication
- User Registration
- User Login
- Secure Firebase Authentication
- Persistent Login Sessions

### User Profiles
- Unique Username System
- Edit Profile
- Bio Support
- Followers Count
- Following Count
- Friends Count

### Friend System
- Search Users by Username
- Send Friend Requests
- Accept Friend Requests
- Remove Friends
- Real-Time Friend Status Updates

### Chat System
- Real-Time Messaging
- Private Chats
- Chat Rooms
- Emoji Support
- Message Timestamps
- Online User Status

### Notifications
- Friend Request Notifications
- Friend Acceptance Notifications
- New Message Notifications
- Notification Badges

### Responsive Design
- Mobile-Friendly Interface
- Desktop-Friendly Interface
- Instagram-Inspired Layout
- Modern Premium UI

---

## Technology Stack

### Frontend
- HTML5
- CSS3
- JavaScript (ES6 Modules)

### Backend
- Firebase Authentication
- Cloud Firestore
- Firebase Storage

### Hosting
- GitHub Pages
- Firebase Hosting

---

## Project Structure

```text
OurSpaceChat/
│
├── index.html
├── home.html
├── rooms.html
├── chat.html
├── profile.html
├── notifications.html
│
├── style.css
│
├── firebase.js
├── auth.js
├── home.js
├── rooms.js
├── chat.js
├── profile.js
└── notifications.js
```

---

## Firebase Setup

### 1. Create Firebase Project

1. Open Firebase Console
2. Create New Project
3. Enable Firebase Services

### 2. Enable Authentication

Authentication → Sign-in Method → Email/Password → Enable

### 3. Create Firestore Database

Firestore Database → Create Database → Start in Test Mode

### 4. Add Firebase Config

Paste your Firebase configuration inside:

```javascript
firebase.js
```

Example:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_ID",
  appId: "YOUR_APP_ID"
};
```

---

## Firestore Collections

### users

```javascript
{
  uid: "",
  username: "",
  name: "",
  email: "",
  bio: "",
  followersCount: 0,
  followingCount: 0,
  createdAt: timestamp
}
```

### friendRequests

```javascript
{
  fromUser: "",
  toUser: "",
  status: "pending",
  createdAt: timestamp
}
```

### friends

```javascript
{
  user1: "",
  user2: "",
  createdAt: timestamp
}
```

### notifications

```javascript
{
  userId: "",
  type: "",
  message: "",
  read: false,
  createdAt: timestamp
}
```

### rooms

```javascript
{
  roomName: "",
  roomCode: "",
  createdBy: "",
  createdAt: timestamp
}
```

### messages

```javascript
{
  senderId: "",
  senderName: "",
  text: "",
  timestamp: timestamp
}
```

---

## Installation

Clone Repository:

```bash
git clone https://github.com/yourusername/our-space-chat.git
```

Enter Project Folder:

```bash
cd our-space-chat
```

Run using Live Server or Host Online.

---

## Deployment

### GitHub Pages

1. Push project to GitHub
2. Open Repository Settings
3. Click Pages
4. Select Main Branch
5. Save

Your website URL:

```text
https://yourusername.github.io/repository-name/
```

---

## Firebase Authorized Domain

Authentication → Settings → Authorized Domains

Add:

```text
yourusername.github.io
```

Example:

```text
bharathkv3011.github.io
```

---

## Firebase Spark Plan

Current Plan:

```text
Spark Plan
$0/month
```

Suitable for:

- Personal Projects
- Testing
- College Projects
- Small Communities
- 10–20 Active Users

---

## Future Updates

- Private Friend Chats
- Message Notifications
- Sound Alerts
- Read Receipts
- Typing Indicators
- Online Status
- Friend Suggestions
- Dark/Light Mode
- Chat Search
- Admin Panel

---

## Author

**Kv Bharath**

Our Space Chat is a Firebase-powered social chat platform focused on friendship, communication, and real-time conversations.

---

## License

MIT License

Free to use, modify, and distribute.
