#!/usr/bin/env tsx

/**
 * Test agent startup with database initialization
 */

import "dotenv/config";

async function testAgentStart() {
  console.log("🚀 Testing agent startup...\n");

  try {
    // Test database initialization
    console.log("1️⃣ Initializing database...");
    const { initializeDatabase } = await import("./db/schema");
    const { commerceDb } = await import("./db");
    await initializeDatabase(commerceDb);
    console.log("✅ Database initialized");

    // Test agent creation
    console.log("\n2️⃣ Creating agent...");
    const { Agent } = await import("@voltagent/core");
    const { google } = await import("@ai-sdk/google");
    const { Memory } = await import("@voltagent/core");
    const { LibSQLMemoryAdapter } = await import("@voltagent/libsql");
    const { createPinoLogger } = await import("@voltagent/logger");

    const logger = createPinoLogger({
      name: "test",
      level: "info",
    });

    const memory = new Memory({
      storage: new LibSQLMemoryAdapter({
        url: "file:./.voltagent/test-memory.db",
        logger: logger.child({ component: "libsql" }),
      }),
    });

    const agent = new Agent({
      name: "test-commerce-agent",
      instructions: "Test agent for commerce operations",
      model: google("gemini-2.0-flash-exp"),
      tools: [],
      memory,
    });

    console.log("✅ Agent created successfully");

    // Test VoltAgent creation
    console.log("\n3️⃣ Creating VoltAgent...");
    const { VoltAgent } = await import("@voltagent/core");
    const { VoltOpsClient } = await import("@voltagent/core");

    const voltAgent = new VoltAgent({
      agents: {
        test: agent,
      },
      workflows: {},
      server: null, // No server for test
      logger,
      voltOpsClient: new VoltOpsClient({
        publicKey: process.env.VOLTAGENT_PUBLIC_KEY || "",
        secretKey: process.env.VOLTAGENT_SECRET_KEY || "",
      }),
    });

    console.log("✅ VoltAgent created successfully");

    console.log("\n🎉 Agent startup test passed!");
    console.log("The commerce AI system is ready to handle data creation operations.");

  } catch (error) {
    console.error("❌ Agent startup test failed:", error);
    process.exit(1);
  }
}

// Run test directly
testAgentStart().catch(console.error);

export { testAgentStart };
