/**
 * Test script to verify batch instance creation works
 */

import { idb, id, tx } from "./src/db/instantdb-client";

const testProductId = "109ce0d0-b973-438e-9cb8-a916da34dd10";
const testNodeId = "27701d28-7ca6-4aae-85fc-f0624e486b98";

const testInstances = [
	{
		name: "Small - Black",
		instanceType: "variant" as const,
		qty: 10,
		attrs: { size: "S", color: "Black" },
		priceadd: 0,
	},
	{
		name: "Medium - Black",
		instanceType: "variant" as const,
		qty: 15,
		attrs: { size: "M", color: "Black" },
		priceadd: 0,
	},
	{
		name: "Large - Black",
		instanceType: "variant" as const,
		qty: 12,
		attrs: { size: "L", color: "Black" },
		priceadd: 50,
	},
	{
		name: "Small - White",
		instanceType: "variant" as const,
		qty: 8,
		attrs: { size: "S", color: "White" },
		priceadd: 0,
	},
	{
		name: "Medium - White",
		instanceType: "variant" as const,
		qty: 20,
		attrs: { size: "M", color: "White" },
		priceadd: 0,
	},
	{
		name: "Large - White",
		instanceType: "variant" as const,
		qty: 10,
		attrs: { size: "L", color: "White" },
		priceadd: 50,
	},
];

async function testBatchCreation() {
	console.log("🧪 Testing batch instance creation...");
	console.log(`Product ID: ${testProductId}`);
	console.log(`Node ID: ${testNodeId}`);
	console.log(`Creating ${testInstances.length} instances...`);

	try {
		// Create all instances in a single transaction
		const instanceIds: string[] = [];
		const instanceTransactions = testInstances.map((instance) => {
			const instanceId = id();
			instanceIds.push(instanceId);
			console.log(`  - Creating instance: ${instance.name} (ID: ${instanceId})`);
			return tx.instances[instanceId]
				.update({
					productid: testProductId,
					nodeid: testNodeId,
					name: instance.name,
					instancetype: instance.instanceType,
					qty: instance.qty || 0,
					available: instance.qty || 0,
					reserved: 0,
					attrs: instance.attrs || {},
					priceadd: instance.priceadd || 0,
					status: "available",
					active: true,
					createdat: Date.now(),
					updatedat: Date.now(),
				})
				.link({ product: testProductId, node: testNodeId });
		});

		console.log("\n📤 Sending transaction to InstantDB...");
		await idb.transact(instanceTransactions);
		console.log("✅ Transaction completed");

		// Verify instances were created
		console.log("\n🔍 Verifying instances in database...");
		const verifyResult = await idb.query({
			instances: {
				$: {
					where: {
						"product.id": testProductId,
					},
				},
			},
		});

		const verifiedCount = verifyResult.instances?.length || 0;
		console.log(
			`✅ Verified: ${verifiedCount} instances found in database`,
		);

		if (verifiedCount === testInstances.length) {
			console.log(
				"\n🎉 SUCCESS! All instances were created and verified.",
			);
			console.log("\nCreated instances:");
			verifyResult.instances?.forEach((inst: any) => {
				console.log(
					`  - ${inst.name} (ID: ${inst.id}, Qty: ${inst.qty}, Price add: ${inst.priceadd})`,
				);
			});
		} else {
			console.log(
				`\n⚠️  WARNING: Expected ${testInstances.length} instances but found ${verifiedCount}`,
			);
		}
	} catch (error) {
		console.error("\n❌ ERROR:", error);
		if (error instanceof Error) {
			console.error("Message:", error.message);
			console.error("Stack:", error.stack);
		}
	}
}

// Run the test
testBatchCreation()
	.then(() => {
		console.log("\n✅ Test completed");
		process.exit(0);
	})
	.catch((error) => {
		console.error("\n❌ Test failed:", error);
		process.exit(1);
	});
