/**
 * Discovery Agent - Universal search across platform
 * Public, cross-node search and discovery
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb } from "../db/instantdb-client";

// Discovery-specific tool
const discoveryTool = createTool({
	name: "discovery",
	description:
		"Search products/services/nodes. Actions: searchProducts,searchNodes,searchServices,nearMe",
	parameters: z
		.object({
			action: z.enum([
				"searchProducts",
				"searchNodes",
				"searchServices",
				"nearMe",
			]),
			query: z.string().optional(),
			category: z.string().optional(),
			lat: z.number().optional(),
			lng: z.number().optional(),
			radius: z.number().optional(),
			limit: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "searchProducts": {
					const { query, category, limit = 20 } = params;

					const whereClause: any = { active: true };

					if (query) {
						whereClause.name = { $ilike: `%${query}%` };
					}
					if (category) {
						whereClause.category = category;
					}

					const result = await idb.query({
						products: {
							$: { where: whereClause, limit },
							node: {},
						},
					});

					const products = (result.products || []).map((p: any) => ({
						id: p.id,
						name: p.name,
						desc: p.desc,
						category: p.category,
						price: p.price,
						currency: p.currency,
						instock: p.instock,
						nodeName: p.node?.name,
						nodeAddress: p.node?.address,
						nodeCity: p.node?.city,
					}));

					return {
						success: true,
						count: products.length,
						products,
					};
				}

				case "searchNodes": {
					const { query, category, limit = 20 } = params;

					const whereClause: any = { active: true };

					if (query) {
						whereClause.name = { $ilike: `%${query}%` };
					}
					if (category) {
						whereClause.type = category;
					}

					const result = await idb.query({
						nodes: {
							$: { where: whereClause, limit },
						},
					});

					const nodes = (result.nodes || []).map((n: any) => ({
						id: n.id,
						name: n.name,
						type: n.type,
						address: n.address,
						city: n.city,
						phone: n.phone,
						rating: n.rating,
						isopen: n.isopen,
					}));

					return {
						success: true,
						count: nodes.length,
						nodes,
					};
				}

				case "searchServices": {
					const { query, category, limit = 20 } = params;

					const whereClause: any = { active: true };

					if (query) {
						whereClause.name = { $ilike: `%${query}%` };
					}
					if (category) {
						whereClause.category = category;
					}

					const result = await idb.query({
						services: {
							$: { where: whereClause, limit },
							node: {},
						},
					});

					const services = (result.services || []).map((s: any) => ({
						id: s.id,
						name: s.name,
						desc: s.desc,
						category: s.category,
						price: s.price,
						duration: s.duration,
						pricetype: s.pricetype,
						nodeName: s.node?.name,
						nodeAddress: s.node?.address,
					}));

					return {
						success: true,
						count: services.length,
						services,
					};
				}

				case "nearMe": {
					const { lat, lng, radius = 5, limit = 20 } = params;

					if (!lat || !lng) {
						return {
							success: false,
							message: "lat and lng required for nearMe search",
						};
					}

					// Simple bounding box search (for production, use proper geospatial)
					const latDelta = radius / 111; // ~111km per degree
					const lngDelta = radius / (111 * Math.cos((lat * Math.PI) / 180));

					const result = await idb.query({
						nodes: {
							$: {
								where: {
									active: true,
									lat: { $gte: lat - latDelta, $lte: lat + latDelta },
									lng: { $gte: lng - lngDelta, $lte: lng + lngDelta },
								},
								limit,
							},
						},
					});

					const nodes = (result.nodes || []).map((n: any) => ({
						id: n.id,
						name: n.name,
						type: n.type,
						address: n.address,
						city: n.city,
						lat: n.lat,
						lng: n.lng,
						rating: n.rating,
						distance: Math.sqrt(
							Math.pow((n.lat - lat) * 111, 2) +
								Math.pow((n.lng - lng) * 111 * Math.cos((lat * Math.PI) / 180), 2),
						).toFixed(2),
					}));

					// Sort by distance
					nodes.sort((a: any, b: any) => a.distance - b.distance);

					return {
						success: true,
						count: nodes.length,
						nodes,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Discovery tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Discovery Agent
export const createDiscoveryAgent = () => {
	return new Agent({
		name: "discovery-agent",
		instructions: `You help discover products, services, and stores across Chennai.
Search by name, category, location.
Provide relevant results with details.
Be helpful and conversational.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [discoveryTool],
	});
};
