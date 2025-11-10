/**
 * Dynamic Agent Routing & Handoff Logic
 * Routes requests to appropriate specialized agents based on context
 */

import { Agent } from "@voltagent/core";
import {
	createProductAgent,
	createInstanceAgent,
	createOrderAgent,
	createDiscoveryAgent,
	createNodeAgent,
	createCustomerAgent,
	createServiceAgent,
	createBookingAgent,
	createAnalyticsAgent,
	createAdminAgent,
} from "./index";

// Agent type definitions
export type AgentType =
	| "discovery"
	| "product"
	| "instance"
	| "order"
	| "node"
	| "customer"
	| "service"
	| "booking"
	| "analytics"
	| "admin";

// User context for routing
export interface UserContext {
	userId?: string;
	nodeId?: string;
	role?: "customer" | "nodeowner" | "staff" | "admin";
	requestedAgent?: AgentType;
}

// Agent metadata for handoff suggestions
export const agentMetadata: Record<
	AgentType,
	{
		name: string;
		scope: "universal" | "node" | "customer" | "admin";
		description: string;
		suggestWhen: string[];
	}
> = {
	discovery: {
		name: "Discovery Agent",
		scope: "universal",
		description: "Search products, services, and stores across platform",
		suggestWhen: ["search", "find", "discover", "near me", "browse"],
	},
	product: {
		name: "Product Agent",
		scope: "node",
		description: "Manage products for your store",
		suggestWhen: ["product", "add product", "create product", "update product"],
	},
	instance: {
		name: "Instance Agent",
		scope: "node",
		description: "Manage inventory and product variants",
		suggestWhen: [
			"variant",
			"inventory",
			"stock",
			"quantity",
			"add variants",
		],
	},
	order: {
		name: "Order Agent",
		scope: "node",
		description: "View and manage orders",
		suggestWhen: ["order", "orders", "delivery", "status", "cancel order"],
	},
	node: {
		name: "Node Agent",
		scope: "node",
		description: "Manage store settings and information",
		suggestWhen: ["store", "settings", "hours", "commission", "update store"],
	},
	customer: {
		name: "Customer Agent",
		scope: "customer",
		description: "View your orders and bookings",
		suggestWhen: [
			"my orders",
			"my bookings",
			"track order",
			"order history",
		],
	},
	service: {
		name: "Service Agent",
		scope: "node",
		description: "Manage services and appointment slots",
		suggestWhen: [
			"service",
			"appointment",
			"slots",
			"create service",
			"time slots",
		],
	},
	booking: {
		name: "Booking Agent",
		scope: "customer",
		description: "Book appointments and services",
		suggestWhen: ["book", "appointment", "reserve", "booking", "schedule"],
	},
	analytics: {
		name: "Analytics Agent",
		scope: "node",
		description: "View business insights and metrics",
		suggestWhen: [
			"sales",
			"revenue",
			"analytics",
			"stats",
			"report",
			"metrics",
		],
	},
	admin: {
		name: "Admin Agent",
		scope: "admin",
		description: "Platform administration and management",
		suggestWhen: [
			"approve",
			"platform",
			"all nodes",
			"all stores",
			"admin",
		],
	},
};

/**
 * Create agent instance based on type and context
 */
export function createAgentInstance(
	type: AgentType,
	context: UserContext,
): Agent {
	switch (type) {
		case "discovery":
			return createDiscoveryAgent();

		case "product":
			if (!context.nodeId) {
				throw new Error("nodeId required for Product Agent");
			}
			return createProductAgent(context.nodeId);

		case "instance":
			if (!context.nodeId) {
				throw new Error("nodeId required for Instance Agent");
			}
			return createInstanceAgent(context.nodeId);

		case "order":
			if (!context.nodeId) {
				throw new Error("nodeId required for Order Agent");
			}
			return createOrderAgent(context.nodeId);

		case "node":
			if (!context.nodeId) {
				throw new Error("nodeId required for Node Agent");
			}
			return createNodeAgent(context.nodeId);

		case "customer":
			if (!context.userId) {
				throw new Error("userId required for Customer Agent");
			}
			return createCustomerAgent(context.userId);

		case "service":
			if (!context.nodeId) {
				throw new Error("nodeId required for Service Agent");
			}
			return createServiceAgent(context.nodeId);

		case "booking":
			if (!context.userId) {
				throw new Error("userId required for Booking Agent");
			}
			return createBookingAgent(context.userId);

		case "analytics":
			if (!context.nodeId) {
				throw new Error("nodeId required for Analytics Agent");
			}
			return createAnalyticsAgent(context.nodeId);

		case "admin":
			if (context.role !== "admin") {
				throw new Error("Admin role required for Admin Agent");
			}
			return createAdminAgent();

		default:
			throw new Error(`Unknown agent type: ${type}`);
	}
}

/**
 * Auto-route user to appropriate agent based on intent
 */
export function suggestAgent(userMessage: string): AgentType | null {
	const lowerMessage = userMessage.toLowerCase();

	// Check each agent's suggestion triggers
	for (const [agentType, metadata] of Object.entries(agentMetadata)) {
		for (const trigger of metadata.suggestWhen) {
			if (lowerMessage.includes(trigger.toLowerCase())) {
				return agentType as AgentType;
			}
		}
	}

	return null;
}

/**
 * Get available agents for user based on context
 */
export function getAvailableAgents(context: UserContext): AgentType[] {
	const available: AgentType[] = ["discovery"]; // Always available

	if (context.role === "admin") {
		available.push("admin");
	}

	if (context.nodeId && context.role === "nodeowner") {
		available.push(
			"product",
			"instance",
			"order",
			"node",
			"service",
			"analytics",
		);
	}

	if (context.userId) {
		available.push("customer", "booking");
	}

	return available;
}

/**
 * Agent handoff message generator
 */
export function generateHandoffMessage(
	fromAgent: AgentType,
	toAgent: AgentType,
): string {
	const from = agentMetadata[fromAgent];
	const to = agentMetadata[toAgent];

	return `I handle ${from.description.toLowerCase()}. For ${to.description.toLowerCase()}, please switch to the **${to.name}**. Would you like me to help you with that?`;
}

/**
 * Context preservation during handoff
 */
export interface HandoffContext {
	fromAgent: AgentType;
	toAgent: AgentType;
	conversationId: string;
	preservedData: Record<string, any>;
	timestamp: number;
}

export function createHandoff(
	fromAgent: AgentType,
	toAgent: AgentType,
	conversationId: string,
	data: Record<string, any> = {},
): HandoffContext {
	return {
		fromAgent,
		toAgent,
		conversationId,
		preservedData: data,
		timestamp: Date.now(),
	};
}
