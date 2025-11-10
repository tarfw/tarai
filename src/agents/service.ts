/**
 * Service Agent - Manages services and slots
 * Node-scoped, conversational service management
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, id, tx } from "../db/instantdb-client";

// Service-specific tool
const serviceTool = createTool({
	name: "service",
	description:
		"Manage services & slots. Actions: createService,updateService,createSlots,getAvailableSlots,listServices",
	parameters: z
		.object({
			action: z.enum([
				"createService",
				"updateService",
				"createSlots",
				"getAvailableSlots",
				"listServices",
			]),
			serviceId: z.string().optional(),
			nodeid: z.string().optional(),
			name: z.string().optional(),
			desc: z.string().optional(),
			category: z.string().optional(),
			price: z.number().optional(),
			currency: z.string().optional(),
			pricetype: z.enum(["fixed", "hourly"]).optional(),
			duration: z.number().optional(),
			needapproval: z.boolean().optional(),
			maxperslot: z.number().optional(),
			// Slots
			date: z.string().optional(),
			start: z.string().optional(),
			end: z.string().optional(),
			capacity: z.number().optional(),
			// Slot generation
			startTime: z.string().optional(),
			endTime: z.string().optional(),
			slotDuration: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "createService": {
					const {
						nodeid,
						name,
						desc,
						category,
						price,
						currency,
						pricetype,
						duration,
						needapproval,
						maxperslot,
					} = params;

					if (!nodeid || !name || !category || !price || !duration) {
						return {
							success: false,
							message:
								"Missing required: nodeid, name, category, price, duration",
						};
					}

					const serviceId = id();
					await idb.transact([
						tx.services[serviceId]
							.update({
								nodeid,
								name,
								desc: desc || "",
								category,
								price,
								currency: currency || "INR",
								pricetype: pricetype || "fixed",
								duration,
								needapproval: needapproval || false,
								maxperslot: maxperslot || 1,
								active: true,
								createdat: Date.now(),
								updatedat: Date.now(),
							})
							.link({ node: nodeid }),
					]);

					return {
						success: true,
						message: `Service "${name}" created`,
						serviceId,
					};
				}

				case "updateService": {
					const { serviceId, ...updateFields } = params;

					if (!serviceId) {
						return { success: false, message: "serviceId required" };
					}

					const updates: any = { updatedat: Date.now() };

					if (updateFields.name) updates.name = updateFields.name;
					if (updateFields.desc) updates.desc = updateFields.desc;
					if (updateFields.price) updates.price = updateFields.price;
					if (updateFields.duration) updates.duration = updateFields.duration;
					if (updateFields.needapproval !== undefined)
						updates.needapproval = updateFields.needapproval;
					if (updateFields.maxperslot)
						updates.maxperslot = updateFields.maxperslot;

					await idb.transact([tx.services[serviceId].update(updates)]);

					return {
						success: true,
						message: "Service updated",
						serviceId,
					};
				}

				case "createSlots": {
					const {
						serviceId,
						nodeid,
						date,
						startTime,
						endTime,
						slotDuration,
						capacity,
					} = params;

					if (
						!serviceId ||
						!nodeid ||
						!date ||
						!startTime ||
						!endTime ||
						!slotDuration
					) {
						return {
							success: false,
							message:
								"Missing required: serviceId, nodeid, date, startTime, endTime, slotDuration",
						};
					}

					// Generate slots
					const slots: any[] = [];
					let currentTime = startTime;

					while (currentTime < endTime) {
						const [hours, minutes] = currentTime.split(":").map(Number);
						const nextMinutes = minutes + slotDuration;
						const nextHours = hours + Math.floor(nextMinutes / 60);
						const endMinutes = nextMinutes % 60;

						if (nextHours >= 24) break;

						const slotEnd = `${String(nextHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;

						if (slotEnd > endTime) break;

						const slotId = id();
						slots.push(
							tx.slots[slotId]
								.update({
									serviceid: serviceId,
									nodeid,
									date,
									start: currentTime,
									end: slotEnd,
									status: "available",
									capacity: capacity || 1,
									booked: 0,
									createdat: Date.now(),
								})
								.link({ service: serviceId, node: nodeid }),
						);

						currentTime = slotEnd;
					}

					await idb.transact(slots);

					return {
						success: true,
						message: `Created ${slots.length} slots for ${date}`,
						count: slots.length,
					};
				}

				case "getAvailableSlots": {
					const { serviceId, date } = params;

					if (!serviceId) {
						return { success: false, message: "serviceId required" };
					}

					const whereClause: any = {
						serviceid: serviceId,
						status: "available",
					};

					if (date) {
						whereClause.date = date;
					}

					const result = await idb.query({
						slots: {
							$: { where: whereClause },
							service: {},
						},
					});

					const slots = (result.slots || []).map((slot: any) => ({
						id: slot.id,
						date: slot.date,
						start: slot.start,
						end: slot.end,
						capacity: slot.capacity,
						booked: slot.booked,
						available: slot.capacity - slot.booked,
						serviceName: slot.service?.name,
					}));

					return {
						success: true,
						count: slots.length,
						slots,
					};
				}

				case "listServices": {
					const { nodeid } = params;

					if (!nodeid) {
						return { success: false, message: "nodeid required" };
					}

					const result = await idb.query({
						services: {
							$: { where: { nodeid } },
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
						active: s.active,
					}));

					return {
						success: true,
						count: services.length,
						services,
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Service tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Service Agent
export const createServiceAgent = (nodeid: string) => {
	return new Agent({
		name: "service-agent",
		instructions: `You manage services and appointment slots for node ${nodeid}.
Help create services, generate time slots, view availability.
Always use nodeid: ${nodeid} for operations.
Be concise and helpful.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [serviceTool],
	});
};
