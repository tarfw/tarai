# Troubleshooting Guide

Common issues and solutions for the Universal Commerce AI System.

## Installation Issues

### npm install fails

**Symptoms:**
```
npm ERR! code ERESOLVE
npm ERR! ERESOLVE unable to resolve dependency tree
```

**Solutions:**
1. Clear npm cache:
   ```bash
   npm cache clean --force
   ```

2. Delete node_modules and package-lock.json:
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

3. Use legacy peer deps:
   ```bash
   npm install --legacy-peer-deps
   ```

---

## InstantDB Issues

### Error: "Missing INSTANTDB_APP_ID or INSTANTDB_ADMIN_TOKEN"

**Cause:** Environment variables not loaded.

**Solutions:**
1. Verify `.env` file exists in project root
2. Check format (no quotes, no spaces):
   ```env
   INSTANTDB_APP_ID=d2c4873f-988d-4a4d-977b-9b4746b94936
   INSTANTDB_ADMIN_TOKEN=eyJhb...
   ```
3. Restart the server after adding variables

### Error: "Validation failed for steps: Attributes are missing in your schema"

**Cause:** Schema not pushed to InstantDB.

**Solution:**
```bash
# Login to InstantDB CLI
npx instant-cli@latest login

# Push schema
npx instant-cli@latest push schema --app <your-app-id> --yes
```

### Error: "Invalid id for entity 'providers'. Expected a UUID"

**Cause:** Trying to use custom IDs instead of UUIDs.

**Solution:** This is fixed in the current code. If you see this:
1. Pull latest code from `main` branch
2. Verify you're using `id()` function from InstantDB:
   ```typescript
   import { id } from "@instantdb/admin";
   const providerId = id(); // ✅ Correct
   ```

### Error: "User is missing role collaborator"

**Cause:** Not logged in to InstantDB CLI or wrong account.

**Solution:**
```bash
# Logout and login again
npx instant-cli@latest logout
npx instant-cli@latest login

# Or use app ID explicitly
npx instant-cli@latest push schema --app <app-id> --yes
```

---

## Server Issues

### Error: "listen EADDRINUSE: address already in use 0.0.0.0:4310"

**Cause:** Port already in use by another process.

**Solutions:**

**Windows:**
```bash
# Find process using port 4310
netstat -ano | findstr :4310

# Kill process (replace PID with actual process ID)
taskkill /PID <PID> /F
```

**Mac/Linux:**
```bash
# Find and kill process using port 4310
lsof -ti:4310 | xargs kill -9
```

### Server starts but can't connect

**Symptoms:**
- Server logs show "started successfully"
- Can't access http://localhost:4310

**Solutions:**
1. Check firewall settings
2. Try accessing via IP: `http://127.0.0.1:4310`
3. Check if antivirus is blocking the port
4. Verify server is listening on correct port in logs

---

## Database Issues

### LibSQL/Turso connection fails

**Symptoms:**
```
Error: Failed to initialize database
```

**Solutions:**

1. **Using Local SQLite (no Turso):**
   ```env
   # Use local file instead
   TURSO_DATABASE_URL=file:./.voltagent/commerce.db
   # Remove or comment out TURSO_AUTH_TOKEN
   ```

2. **Using Turso:**
   - Verify database exists: `turso db list`
   - Check URL format: Must start with `libsql://`
   - Regenerate auth token: `turso db tokens create <db-name>`

### Embeddings table not created

**Symptoms:**
```
Error: no such table: embeddings
```

**Solution:**

Schema initialization should happen automatically. If it doesn't:

1. Check server startup logs for:
   ```
   ✅ Vector embeddings table initialized (LibSQL)
   ```

2. Manually verify (if using Turso):
   ```bash
   turso db shell <db-name>
   .tables  # Should show 'embeddings'
   ```

3. Restart server to trigger initialization

### Foreign Key Constraint Error

**Symptoms:**
```
Error: SQLITE_CONSTRAINT: SQLite error: FOREIGN KEY constraint failed
```

When trying to generate embeddings.

**Cause:** Old schema had foreign key constraint referencing products table that doesn't exist in LibSQL (products are in InstantDB).

**Solution:**

Run the reset script:

```bash
npx tsx reset-embeddings.ts
```

This will:
1. Drop old embeddings table with foreign key
2. Create new table without foreign key constraint
3. Create index for performance

Then restart server:

```bash
npm run dev
```

Now you can generate embeddings:

```
Generate embeddings for all products
```

---

## API & Agent Issues

### Agent not responding

**Symptoms:**
- Request to `/api/agents/commerce/messages` returns 500
- No response from agent

**Solutions:**

1. **Check API key configuration:**
   - Verify `GROQ_API_KEY` is set
   - Check Groq API quota: [console.groq.com](https://console.groq.com)

2. **Check server logs:**
   ```bash
   # Look for errors in terminal where server is running
   ```

3. **Test with simple message:**
   ```bash
   curl -X POST http://localhost:4310/api/agents/commerce/messages \
     -H "Content-Type: application/json" \
     -d '{"message": "hello", "userId": "test"}'
   ```

### Tool call validation errors

**Symptoms:**
```
Tool call validation failed: parameters for tool X did not match schema
```

**Solutions:**

1. **Check parameter types:**
   - Strings must be quoted: `"value"`
   - Numbers must be unquoted: `42`
   - Booleans: `true` or `false`

2. **Verify required parameters:**
   - Check tool reference for required vs optional params
   - See [Tool Reference](../api/tool-reference.md)

3. **Check tool implementation:**
   - Verify Zod schema matches execute function parameters

### Semantic search not working

**Symptoms:**
- Search returns no results
- Error: "Failed to generate embedding"

**Solutions:**

1. **Check Google AI API key:**
   ```env
   GOOGLE_GENERATIVE_AI_API_KEY=your-key
   ```

2. **Generate embeddings:**
   ```bash
   # Via agent
   "Generate embeddings for all products"

   # Or use generateEmbeddingsTool directly
   ```

3. **Verify embeddings exist:**
   ```bash
   # If using local SQLite
   sqlite3 .voltagent/commerce.db "SELECT COUNT(*) FROM embeddings;"

   # If using Turso
   turso db shell <db-name> "SELECT COUNT(*) FROM embeddings;"
   ```

---

## Development Issues

### TypeScript errors

**Symptoms:**
```
Type 'X' is not assignable to type 'Y'
```

**Solutions:**

1. **Check types match schema:**
   ```typescript
   // If using InstantDB
   import { instantDbSchema } from "./db/instantdb-schema";

   // Types should match schema definition
   ```

2. **Rebuild:**
   ```bash
   npm run build
   ```

3. **Update dependencies:**
   ```bash
   npm update
   ```

### Hot reload not working

**Symptoms:**
- Make code changes but server doesn't restart
- Changes not reflected

**Solutions:**

1. **Restart dev server:**
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. **Check file watcher:**
   - Verify file is saved
   - Check tsx watch is running
   - Look for errors in terminal

---

## Performance Issues

### Slow semantic search

**Causes:**
- Large number of products
- No embeddings generated
- Network latency (Turso)

**Solutions:**

1. **Generate embeddings:**
   ```
   "Generate embeddings for all products"
   ```

2. **Use local SQLite for development:**
   ```env
   TURSO_DATABASE_URL=file:./.voltagent/commerce.db
   ```

3. **Adjust similarity threshold:**
   ```json
   {
     "query": "coffee",
     "similarityThreshold": 0.5
   }
   ```

### Slow API responses

**Solutions:**

1. **Check network:**
   - Test latency to Turso
   - Check InstantDB dashboard for issues

2. **Use indexes:**
   - Verify indexed fields in schema:
     - `inventoryItems.price`
     - `inventoryItems.quantity`
     - `orders.userId`

3. **Limit results:**
   ```json
   {
     "query": "coffee",
     "limit": 10
   }
   ```

---

## Common Mistakes

### 1. Wrong providerId format

❌ Wrong:
```json
{
  "providerId": "brewbar-coffee"
}
```

✅ Correct:
```json
{
  "providerId": "550e8400-e29b-41d4-a716-446655440000"
}
```

Always use UUID generated by `id()` function.

### 2. Forgetting to push schema

After modifying `instant.schema.ts`:

```bash
npx instant-cli@latest push schema --yes
```

### 3. Not generating embeddings

After creating products:

```
"Generate embeddings for all products"
```

### 4. Wrong .env file location

.env must be in project root (same level as package.json):

```
tarai/
├── .env           ← Here
├── package.json
├── src/
└── docs/
```

Not in `src/` or `docs/`!

---

## Getting Help

If you're still stuck:

1. **Check logs:**
   - Server logs in terminal
   - Browser console (if using frontend)
   - VoltOps Console for agent traces

2. **Enable debug logging:**
   ```typescript
   // In src/index.ts
   const logger = createPinoLogger({
     name: "tarai",
     level: "debug", // Changed from "info"
   });
   ```

3. **Search documentation:**
   - [Architecture Overview](../architecture/system-overview.md)
   - [API Reference](../api/tool-reference.md)
   - [InstantDB Guide](../instantdb/getting-started.md)

4. **Community support:**
   - [VoltAgent Discord](https://discord.gg/voltagent)
   - [InstantDB Discord](https://discord.com/invite/VU53p7uQcE)
   - [GitHub Issues](https://github.com/your-repo/issues)

5. **Report bug:**
   - Include error message
   - Include relevant logs
   - Include steps to reproduce
   - Include environment details (OS, Node version)

---

## Debugging Checklist

Before asking for help, verify:

- [ ] `.env` file exists and has all required keys
- [ ] InstantDB schema has been pushed
- [ ] Server starts without errors
- [ ] Can access http://localhost:4310/health
- [ ] API keys are valid and not expired
- [ ] Turso database exists (if using Turso)
- [ ] Dependencies are installed (`node_modules` exists)
- [ ] Using correct Node.js version (18+)
- [ ] No firewall blocking ports 4310 or 3141
- [ ] Server logs show "started successfully"

---

## Next Steps

- [Quick Start Guide](./quick-start.md)
- [Environment Setup](./environment-setup.md)
- [API Reference](../api/tool-reference.md)
