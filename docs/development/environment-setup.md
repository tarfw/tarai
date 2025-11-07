# Environment Setup

Complete guide to setting up your development environment for the Universal Commerce AI System.

## Required Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# ================================
# InstantDB Configuration
# ================================
# Used for real-time CRUD operations (products, orders, inventory)
INSTANTDB_APP_ID=d2c4873f-988d-4a4d-977b-9b4746b94936
INSTANTDB_ADMIN_TOKEN=your-admin-token-here

# ================================
# Turso/LibSQL Configuration
# ================================
# Used for vector embeddings and semantic search
# Optional: If not provided, uses local SQLite database
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-turso-auth-token

# ================================
# Google AI Configuration
# ================================
# Used for generating text embeddings for semantic search
GOOGLE_GENERATIVE_AI_API_KEY=your-google-api-key

# ================================
# Groq Configuration
# ================================
# Used for LLM inference (fast, cost-effective)
GROQ_API_KEY=your-groq-api-key

# ================================
# VoltAgent Configuration
# ================================
# Optional: Used for monitoring and debugging in VoltOps Console
VOLTAGENT_PUBLIC_KEY=your-public-key
VOLTAGENT_SECRET_KEY=your-secret-key
```

## Getting API Keys

### InstantDB

1. **Sign up**: Visit [instantdb.com](https://www.instantdb.com) and create an account
2. **Create app**: Click "Create App" in the dashboard
3. **Get credentials**:
   - Copy the **App ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - Copy the **Admin Token** (long string starting with `eyJ...`)
4. **Add to .env**:
   ```env
   INSTANTDB_APP_ID=your-app-id
   INSTANTDB_ADMIN_TOKEN=your-admin-token
   ```

**Important**: Never commit your admin token to source control!

### Google AI

1. **Visit**: [Google AI Studio](https://aistudio.google.com/app/apikey)
2. **Sign in** with your Google account
3. **Create API key**: Click "Create API Key"
4. **Copy key** and add to .env:
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=AIzaSy...
   ```

**Free tier**: 60 requests per minute, sufficient for development

### Groq

1. **Sign up**: Visit [console.groq.com](https://console.groq.com)
2. **Create account** (email or GitHub)
3. **Generate API key**: Go to API Keys section
4. **Copy key** and add to .env:
   ```env
   GROQ_API_KEY=gsk_...
   ```

**Free tier**: Very generous limits, fast inference

### Turso (Optional)

Only needed if you want cloud-hosted vector storage. Otherwise, a local SQLite database is used.

1. **Install Turso CLI**:
   ```bash
   # macOS/Linux
   curl -sSfL https://get.tur.so/install.sh | bash

   # Windows (PowerShell)
   irm get.tur.so/install.ps1 | iex
   ```

2. **Sign up**:
   ```bash
   turso auth signup
   ```

3. **Create database**:
   ```bash
   turso db create commerce-vectors
   ```

4. **Get database URL**:
   ```bash
   turso db show commerce-vectors
   # Copy the URL (libsql://...)
   ```

5. **Create auth token**:
   ```bash
   turso db tokens create commerce-vectors
   ```

6. **Add to .env**:
   ```env
   TURSO_DATABASE_URL=libsql://commerce-vectors-yourname.turso.io
   TURSO_AUTH_TOKEN=eyJhb...
   ```

**Free tier**: 500MB storage, 1B row reads/month

### VoltAgent (Optional)

For monitoring in VoltOps Console:

1. **Sign up**: Visit [voltagent.dev](https://voltagent.dev)
2. **Get keys**: Copy public and secret keys from dashboard
3. **Add to .env**:
   ```env
   VOLTAGENT_PUBLIC_KEY=volt_pk_...
   VOLTAGENT_SECRET_KEY=volt_sk_...
   ```

**Note**: System works without these keys, just won't show in VoltOps Console

## Environment File Templates

### Minimal Setup (Local Development)

```env
# Required
INSTANTDB_APP_ID=your-app-id
INSTANTDB_ADMIN_TOKEN=your-admin-token
GOOGLE_GENERATIVE_AI_API_KEY=your-google-key
GROQ_API_KEY=your-groq-key
```

This uses local SQLite for vectors and skips VoltOps monitoring.

### Full Setup (Production)

```env
# InstantDB
INSTANTDB_APP_ID=your-app-id
INSTANTDB_ADMIN_TOKEN=your-admin-token

# Turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-turso-token

# Google AI
GOOGLE_GENERATIVE_AI_API_KEY=your-google-key

# Groq
GROQ_API_KEY=your-groq-key

# VoltAgent
VOLTAGENT_PUBLIC_KEY=your-public-key
VOLTAGENT_SECRET_KEY=your-secret-key
```

## Verifying Your Setup

### 1. Check .env File

```bash
# Make sure .env exists
ls -la .env

# Verify it has all required keys (don't cat it in public!)
grep -c "=" .env  # Should return at least 4
```

### 2. Test API Keys

```bash
# Install dependencies
npm install

# Start the server
npm run dev
```

You should see:
```
✅ InstantDB client initialized for CRUD operations
✅ LibSQL client initialized for vector embeddings
```

If you see errors, check the specific key mentioned in the error message.

### 3. Test InstantDB Connection

```bash
# Push schema to verify InstantDB connection
npx instant-cli@latest push schema --app <your-app-id> --yes
```

Should show schema creation progress.

### 4. Test Agent

Visit [console.voltagent.dev](https://console.voltagent.dev) and connect to `http://localhost:4310`.

Send a message: "Hello"

Agent should respond, confirming all systems are working.

## Troubleshooting

### Error: "Missing INSTANTDB_APP_ID"

✅ Solution:
1. Check .env file exists in project root
2. Verify the line is exactly: `INSTANTDB_APP_ID=your-actual-id`
3. No quotes, no spaces around `=`
4. Restart server after adding

### Error: "Failed to initialize InstantDB"

✅ Solution:
1. Verify admin token is correct
2. Check for extra spaces or newlines
3. Ensure token hasn't expired
4. Try regenerating token in InstantDB dashboard

### Error: "Google AI API error"

✅ Solution:
1. Verify API key is valid
2. Check you haven't exceeded free tier limits
3. Enable Generative AI API in Google Cloud Console

### Error: "Turso connection failed"

✅ Solution:
1. Verify database URL format: `libsql://...`
2. Check auth token is correct
3. Ensure database exists: `turso db list`
4. Or comment out Turso vars to use local SQLite

### Schema Not Pushing

✅ Solution:
```bash
# Login first
npx instant-cli@latest login

# Then push with explicit app ID
npx instant-cli@latest push schema --app <your-app-id> --yes
```

## Security Best Practices

1. **Never commit .env**: Already in `.gitignore`, but double-check
2. **Use environment-specific files**: `.env.development`, `.env.production`
3. **Rotate keys regularly**: Especially admin tokens
4. **Limit permissions**: Use least-privilege principle
5. **Monitor usage**: Check API usage dashboards regularly

## Local vs Production

### Local Development

```env
# Use local SQLite for vectors
TURSO_DATABASE_URL=file:./.voltagent/commerce.db
# No TURSO_AUTH_TOKEN needed

# Skip monitoring
# No VOLTAGENT keys needed
```

### Production

```env
# Use Turso for global distribution
TURSO_DATABASE_URL=libsql://commerce-prod.turso.io
TURSO_AUTH_TOKEN=prod-token

# Enable monitoring
VOLTAGENT_PUBLIC_KEY=prod-public-key
VOLTAGENT_SECRET_KEY=prod-secret-key
```

## Next Steps

- [Quick Start Guide](./quick-start.md)
- [Deployment Guide](./deployment.md)
- [Troubleshooting](./troubleshooting.md)

## Resources

- [InstantDB Docs](https://www.instantdb.com/docs)
- [Google AI Studio](https://aistudio.google.com)
- [Groq Console](https://console.groq.com)
- [Turso Docs](https://docs.turso.tech)
- [VoltAgent Docs](https://voltagent.dev/docs)
