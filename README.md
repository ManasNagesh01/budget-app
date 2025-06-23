# Budget Tracker with Monzo Integration

A personal finance tracking application that helps you manage your daily and monthly expenses, loans, and integrates with Monzo bank for automatic transaction tracking.

## Features

- User authentication with Firebase
- Track daily and monthly expenses
- Manage loans and loan payments
- View spending summaries with charts
- Connect to Monzo bank to automatically import transactions
- Responsive design that works on desktop and mobile

## Setup Instructions

### Prerequisites

1. Node.js and npm installed
2. Firebase account (https://firebase.google.com/)
3. Monzo Developer account (https://developers.monzo.com/)

### Firebase Setup

1. Create a new Firebase project at https://console.firebase.google.com/
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Update security rules (see below)
5. Go to Project Settings > General > Your Apps > Web App
6. Copy the Firebase configuration to `firebase-config.js`

### Monzo Setup

1. Create a new OAuth client in the Monzo Developer Portal
2. Set the redirect URI to `https://your-domain.com/callback.html`
3. Replace `YOUR_MONZO_CLIENT_ID` and `YOUR_MONZO_CLIENT_SECRET` in the code

### Installation

1. Clone this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Update `firebase-config.js` with your Firebase configuration
4. Deploy to your hosting service (e.g., Firebase Hosting, Netlify, Vercel)

## Firebase Security Rules

```
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Environment Variables

Create a `.env` file in the root directory with the following variables:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Deploy to Firebase
firebase deploy
```

## License

MIT
