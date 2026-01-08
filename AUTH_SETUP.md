# Email/Password Authentication Setup Guide

## ✅ What's Already Done
- ✅ Supabase auth context with email/password support
- ✅ Email/password login screen with sign up/sign in toggle
- ✅ Session persistence across app restarts
- ✅ Bluesky as optional integration (not required for login)

## 🚀 Ready to Test - Just 2 Steps!

### Step 1: Disable Email Confirmation (Optional but Recommended for Testing)

By default, Supabase requires users to confirm their email before logging in. For testing, you can disable this:

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **erkapwbrlflitysminxq**
3. Go to **Authentication** → **Providers** → **Email**
4. Toggle **OFF** the "Confirm email" setting
5. Click **Save**

This way, when you sign up with a test email, you can log in immediately without needing to verify.

### Step 2: Run the App

```bash
npm run android
```

## 📱 How It Works

### Sign Up Flow:
1. App opens → Shows login screen
2. Click "Sign Up" link at bottom
3. Enter email (any email, even fake like `test@test.com`)
4. Enter password (min 6 characters)
5. Click "Sign Up"
6. Automatically logged in and redirected to tasks screen

### Sign In Flow:
1. Enter your email
2. Enter your password
3. Click "Sign In"
4. Redirected to tasks screen

### Bluesky Integration (Optional):
1. After logging in, go to "Integrations" tab
2. Click on Bluesky card
3. Enter your Bluesky handle and password
4. Click "Connect"
5. Now you can use Relay features

## 🎯 Features

✅ **Email/Password Auth**
- Sign up with any email
- Sign in with existing account
- Password visibility toggle
- Form validation (email format, password length)
- Error messages for failed attempts

✅ **Session Management**
- Auto-login on app restart
- Secure token storage
- Auto-refresh tokens

✅ **Bluesky as Integration**
- Optional, not required for main app
- Connect/disconnect anytime
- Separate from main auth

## 🧪 Testing Accounts

Create test accounts directly from the app:

```
Email: test1@example.com
Password: test123

Email: test2@example.com
Password: test123
```

(Any email/password combo works for testing!)

## 🔒 Security Notes

- Passwords are hashed by Supabase (bcrypt)
- Sessions stored securely in AsyncStorage
- Access tokens auto-refresh
- No passwords stored locally

## 🐛 Troubleshooting

### Error: "Invalid email or password"
- **Sign Up**: Email might already exist, try signing in instead
- **Sign In**: Double-check email and password
- Make sure password is at least 6 characters

### Error: "Email not confirmed"
- Go to Supabase Dashboard → Authentication → Providers → Email
- Disable "Confirm email" for testing
- OR check the email inbox for confirmation link

### Error: "User already registered"
- Email already exists
- Click "Sign In" link at bottom instead

### Session not persisting
- Clear app data and try again
- Check Supabase dashboard → Authentication → Users to verify account exists

## 📋 What's Next?

Your app is now ready with:
- ✅ Email/password authentication
- ✅ User management via Supabase
- ✅ Session persistence
- ✅ Bluesky as optional integration
- ✅ Clean separation: Auth vs Integrations

Just run `npm run android` and test it out!

## 💡 Future Enhancements

If you want to add more later:
- Password reset via email
- Social login (Google, Apple, etc.)
- Two-factor authentication
- Profile management
