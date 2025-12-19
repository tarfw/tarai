# TARAI Quick Commands Reference

## 🚀 Getting Started

```bash
# Install dependencies
yarn install

# Start development server
yarn start

# Run on Android (builds native app)
yarn android

# Run on iOS (builds native app)
yarn ios
```

---

## 📱 Development Server

After running `yarn start`, you can:

### Interactive Menu
- Press **`a`** - Open on Android device/emulator
- Press **`i`** - Open on iOS simulator
- Press **`w`** - Open in web browser
- Press **`r`** - Reload app
- Press **`m`** - Toggle menu
- Press **`j`** - Open debugger

### Using Expo Go
1. Install **Expo Go** app on your phone
2. Scan the QR code shown in terminal
3. App loads instantly (no native build needed)

---

## 🧹 Cleaning & Troubleshooting

```bash
# Clear Metro bundler cache
yarn start --clear

# Clear all caches and reinstall
rm -rf node_modules
yarn install
yarn start --clear

# Reset project (removes example code)
yarn reset-project

# On Android: Clear app data
adb shell pm clear com.tarai

# Rebuild native Android
cd android && ./gradlew clean && cd ..
yarn android
```

---

## 📊 Useful Commands

```bash
# Lint code
yarn lint

# Check TypeScript errors
npx tsc --noEmit

# View logs (Android)
npx react-native log-android

# View logs (iOS)
npx react-native log-ios
```

---

## 🔧 Native Build Commands

### Android
```bash
# Debug build
yarn android

# Release build
cd android
./gradlew assembleRelease
# APK location: android/app/build/outputs/apk/release/

# Install on connected device
adb install android/app/build/outputs/apk/release/app-release.apk
```

### iOS
```bash
# Debug build
yarn ios

# Specific simulator
yarn ios --simulator="iPhone 15 Pro"

# Release build (requires Xcode)
# Open ios/tarai.xcworkspace in Xcode
# Product > Archive > Distribute
```

---

## 📦 Package Management

```bash
# Add package
yarn add package-name

# Add dev dependency
yarn add -D package-name

# Remove package
yarn remove package-name

# Update all packages
yarn upgrade

# Check outdated packages
yarn outdated
```

---

## 🗄️ Database Commands

### OP-SQLite Debug

```javascript
// In your code, add:
import { open } from "@op-engineering/op-sqlite";

const db = open({ name: "tarai.db" });

// View all tables
const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table'");
console.log(tables);

// View table schema
const schema = await db.execute("PRAGMA table_info(mycache)");
console.log(schema);

// View data
const data = await db.execute("SELECT * FROM mycache LIMIT 10");
console.log(data);
```

---

## 🤖 AI Model Commands

### Download Models Manually

If the app is stuck on "Loading AI model...", the model might not be downloading. Check:

```javascript
// Model location (check file exists):
// iOS: Documents directory
// Android: /data/data/com.tarai/files/

// Model files:
// - all-MiniLM-L6-v2.pte (~25MB)
// - tokenizer.bin
```

---

## 📲 Device Commands

### Android
```bash
# List connected devices
adb devices

# Install APK
adb install path/to/app.apk

# Uninstall app
adb uninstall com.tarai

# Clear app data
adb shell pm clear com.tarai

# View app logs
adb logcat | grep "ReactNativeJS"

# Reverse port (for local API)
adb reverse tcp:8081 tcp:8081
```

### iOS
```bash
# List simulators
xcrun simctl list devices

# Boot simulator
xcrun simctl boot "iPhone 15 Pro"

# Install on simulator
xcrun simctl install booted path/to/app.app

# Clear app data
xcrun simctl erase all
```

---

## 🧪 Testing Demo Data

### Enable Demo Listings

In `app/index.tsx`, uncomment:

```typescript
const { loadDemoListings } = await import("@/services/demo/sampleListings");
await loadDemoListings();
```

### Test Searches

```typescript
// In app or console
import { listingService } from "@/services/listingService";

// Search
const results = await listingService.searchListingsByText("taxi");
console.log(results);

// Get cached
const cached = await listingService.getCachedListings();
console.log(cached);

// Get suggestions
const suggestions = await listingService.getSemanticSuggestions("tax");
console.log(suggestions);
```

---

## 🐛 Common Issues

### Issue: "Unable to resolve module"
```bash
# Solution: Clear cache and reinstall
rm -rf node_modules
yarn install
yarn start --clear
```

### Issue: "Could not connect to development server"
```bash
# Solution: Check Metro bundler is running
yarn start

# On Android, reverse the port
adb reverse tcp:8081 tcp:8081
```

### Issue: "Vector stores failed to load"
```bash
# Solution: Check internet connection (first-time download)
# Or clear app data and restart
adb shell pm clear com.tarai  # Android
yarn android
```

### Issue: "Database locked" or SQLite errors
```bash
# Solution: Close all connections and restart
# In code:
await db.close();

# Or uninstall and reinstall app
adb uninstall com.tarai
yarn android
```

---

## 📚 Documentation Quick Links

- **[README.md](README.md)** - Project overview
- **[QUICKSTART.md](QUICKSTART.md)** - Get started in 3 steps
- **[SETUP.md](SETUP.md)** - Detailed setup & API
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - System architecture
- **[TARAI.md](TARAI.md)** - Complete specification
- **[CHANGES.md](CHANGES.md)** - What changed

---

## 💡 Pro Tips

1. **Use Expo Go for quick testing** - Faster than native builds
2. **Enable demo data first** - So you have listings to search
3. **Check console logs** - Most errors show there first
4. **Use React DevTools** - Install extension in Chrome
5. **Test on real device** - Better performance than emulator

---

## 🎯 Quick Start Checklist

```bash
# 1. Install
yarn install

# 2. Enable demo data (uncomment in app/index.tsx)

# 3. Run
yarn android  # or yarn ios

# 4. Wait for "Ready!" message

# 5. Try searching: "book taxi", "order food", etc.
```

---

Happy coding! 🚀
