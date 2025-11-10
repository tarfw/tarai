┌─────────────────────────────────────────────────────────────────────────────┐
│  START: Expo/React Native Project (New or Existing)                         │
│  Goal: Build Android app with op-sqlite, bypass Expo limits                 │
└────────────────────────────┬────────────────────────────────────────────────┘
                             │
         ┌───────────────────▼──────────────────┐
         │  Do you have `android/` folder?       │
         └────────┬──────────────┬───────────────┘
                  │              │
         YES ─────┘              └──── NO
                  │              │
                  ▼              ▼
         ┌─────────────────┐  ┌──────────────────────────────┐
         │ Already Bare    │  │ Convert to Bare Workflow:    │
         │ Workflow ✅       │  │   npx expo prebuild          │
         │                 │  │   --platform android         │
         └────────┬────────┘  └──────────┬───────────────────┘
                  │                      │
                  └──────────┬───────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│  PHASE 1: Create Keystore (One-Time, Using EAS)        │
│                                                          │
│  • Run: `eas credentials`                                │
│  • Select: "Android Keystore"                            │
│  • Choose: "Generate new keystore"                       │
│  • Expo asks: key alias, passwords                       │
│  • Expo creates & stores it securely                     │
│                                                          │
│  💰 Cost: 1 EAS build credit (only this step)            │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│  PHASE 2: Download Keystore to Your PC                 │
│                                                          │
│  • Run: `eas credentials:download`                      │
│  • Choose: "Android Keystore"                          │
│  • Saves to: `~/keys/myapp.keystore` (or your path)    │
│                                                          │
│  🔐 You now own the keystore file! Keep it safe!        │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│  PHASE 3: Configure Local Builds                       │
│                                                          │
│  1. Create folder: `mkdir ~/keys`                      │
│  2. Move keystore there                                │
│  3. Edit `android/gradle.properties`:                  │
│                                                          │
│     MYAPP_UPLOAD_STORE_FILE=~/keys/myapp.keystore      │
│     MYAPP_UPLOAD_STORE_PASSWORD=your_store_password    │
│     MYAPP_UPLOAD_KEY_ALIAS=your_key_alias              │
│     MYAPP_UPLOAD_KEY_PASSWORD=your_key_password        │
│                                                          │
│  4. Edit `android/app/build.gradle`:                   │
│     (Add signing config pointing to these vars)        │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│  PHASE 4: Build App Locally (Unlimited!)               │
│                                                          │
│  • Run: `npx react-native build-android --mode=release`│
│  • Gradle runs on YOUR machine                         │
│  • Compiles native code (op-sqlite C++, etc.)          │
│  • Bundles JavaScript                                  │
│  • Signs with your local keystore                      │
│                                                          │
│  ⏱️  Time: 5-15 minutes (first run), 1-3 min (later)  │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│  PHASE 5: Get AAB File                                 │
│                                                          │
│  Output location:                                        │
│  `android/app/build/outputs/bundle/release/app-release.aab`│
│                                                          │
│  📦 File size: 20-50MB (typical)                       │
└────────────────────────────┬─────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│  PHASE 6: Upload to Play Store                         │
│                                                          │
│  • Go to: play.google.com/console                      │
│  • Create release → Upload .aab                        │
│  • Fill release notes → Rollout                        │
│                                                          │
│  ✅ App is LIVE!                                         │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  KEY BENEFITS OF THIS FLOW                               │
├──────────────────────────────────────────────────────────┤
│  ✓ No Android Studio GUI needed (pure CLI)              │
│  ✓ Unlimited builds (bypasses 30/month limit)           │
│  ✓ Works with ANY native lib (op-sqlite, etc.)          │
│  ✓ You fully own your keystore & build process          │
│  ✓ Only paid for EAS once (keystore creation)           │
└──────────────────────────────────────────────────────────┘
