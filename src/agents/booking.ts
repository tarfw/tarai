/**
 * Booking Agent - Customer bookings for services
 * Customer-scoped, conversational appointment booking
 */

import { Agent } from "@voltagent/core";
import { groq } from "@ai-sdk/groq";
import { createTool } from "@voltagent/core";
import { z } from "zod";
import { idb, id, tx } from "../db/instantdb-client";

// Booking-specific tool
const bookingTool = createTool({
	name: "booking",
	description:
		"Manage bookings. Actions: createBooking,updateBooking,cancelBooking,myBookings,getDetails",
	parameters: z
		.object({
			action: z.enum([
				"createBooking",
				"updateBooking",
				"cancelBooking",
				"myBookings",
				"getDetails",
			]),
			bookingId: z.string().optional(),
			contributorid: z.string().optional(),
			serviceId: z.string().optional(),
			nodeid: z.string().optional(),
			slotId: z.string().optional(),
			date: z.string().optional(),
			start: z.string().optional(),
			end: z.string().optional(),
			name: z.string().optional(),
			phone: z.string().optional(),
			email: z.string().optional(),
			notes: z.string().optional(),
			status: z
				.enum(["pending", "confirmed", "completed", "cancelled", "noshow"])
				.optional(),
			limit: z.number().optional(),
		})
		.strict(),
	execute: async ({ action, ...params }) => {
		try {
			switch (action) {
				case "createBooking": {
					const {
						contributorid,
						serviceId,
						nodeid,
						slotId,
						date,
						start,
						end,
						name,
						phone,
						email,
						notes,
					} = params;

					if (
						!contributorid ||
						!serviceId ||
						!nodeid ||
						!slotId ||
						!date ||
						!start ||
						!end ||
						!name ||
						!phone
					) {
						return {
							success: false,
							message:
								"Missing required: contributorid, serviceId, nodeid, slotId, date, start, end, name, phone",
						};
					}

					// Get service details
					const serviceResult = await idb.query({
						services: {
							$: { where: { id: serviceId } },
						},
					});

					const service = serviceResult.services?.[0];

					if (!service) {
						return { success: false, message: "Service not found" };
					}

					// Check slot availability
					const slotResult = await idb.query({
						slots: {
							$: { where: { id: slotId } },
						},
					});

					const slot = slotResult.slots?.[0];

					if (!slot) {
						return { success: false, message: "Slot not found" };
					}

					if (slot.booked >= slot.capacity) {
						return { success: false, message: "Slot is fully booked" };
					}

					// Create booking
					const bookingId = id();
					const bookingNum = `BKG-${Date.now().toString().slice(-6)}`;

					await idb.transact([
						tx.bookings[bookingId]
							.update({
								contributorid,
								serviceid: serviceId,
								nodeid,
								slotid: slotId,
								bookingnum: bookingNum,
								date,
								start,
								end,
								duration: service.duration,
								price: service.price,
								name,
								phone,
								email: email || "",
								notes: notes || "",
								status: service.needapproval ? "pending" : "confirmed",
								paystatus: "pending",
								createdat: Date.now(),
							})
							.link({
								contributor: contributorid,
								service: serviceId,
								node: nodeid,
								slot: slotId,
							}),
						// Update slot booked count
						tx.slots[slotId].update({
							booked: slot.booked + 1,
							status: slot.booked + 1 >= slot.capacity ? "booked" : "available",
						}),
					]);

					return {
						success: true,
						message: service.needapproval
							? "Booking pending approval"
							: "Booking confirmed",
						bookingId,
						bookingNum,
						status: service.needapproval ? "pending" : "confirmed",
					};
				}

				case "updateBooking": {
					const { bookingId, status } = params;

					if (!bookingId) {
						return { success: false, message: "bookingId required" };
					}

					const updates: any = {};

					if (status) {
						updates.status = status;
						if (status === "confirmed") {
							updates.confirmedat = Date.now();
						} else if (status === "completed") {
							updates.completedat = Date.now();
						}
					}

					await idb.transact([tx.bookings[bookingId].update(updates)]);

					return {
						success: true,
						message: `Booking status updated to ${status}`,
						bookingId,
					};
				}

				case "cancelBooking": {
					const { bookingId } = params;

					if (!bookingId) {
						return { success: false, message: "bookingId required" };
					}

					// Get booking to update slot
					const result = await idb.query({
						bookings: {
							$: { where: { id: bookingId } },
							slot: {},
						},
					});

					const booking = result.bookings?.[0];

					if (!booking) {
						return { success: false, message: "Booking not found" };
					}

					const slot = booking.slot;

					// Cancel booking and free slot
					await idb.transact([
						tx.bookings[bookingId].update({
							status: "cancelled",
						}),
						tx.slots[slot.id].update({
							booked: Math.max(0, slot.booked - 1),
							status: "available",
						}),
					]);

					return {
						success: true,
						message: "Booking cancelled successfully",
						bookingId,
					};
				}

				case "myBookings": {
					const { contributorid, limit = 20 } = params;

					if (!contributorid) {
						return { success: false, message: "contributorid required" };
					}

					const result = await idb.query({
						bookings: {
							$: { where: { contributorid }, limit },
							service: {},
							node: {},
						},
					});

					const bookings = (result.bookings || []).map((booking: any) => ({
						id: booking.id,
						bookingnum: booking.bookingnum,
						date: booking.date,
						start: booking.start,
						end: booking.end,
						price: booking.price,
						status: booking.status,
						paystatus: booking.paystatus,
						serviceName: booking.service?.name,
						nodeName: booking.node?.name,
					}));

					return {
						success: true,
						count: bookings.length,
						bookings,
					};
				}

				case "getDetails": {
					const { bookingId } = params;

					if (!bookingId) {
						return { success: false, message: "bookingId required" };
					}

					const result = await idb.query({
						bookings: {
							$: { where: { id: bookingId } },
							service: {},
							node: {},
							contributor: {},
						},
					});

					const booking = result.bookings?.[0];

					if (!booking) {
						return { success: false, message: "Booking not found" };
					}

					return {
						success: true,
						booking: {
							id: booking.id,
							bookingnum: booking.bookingnum,
							date: booking.date,
							start: booking.start,
							end: booking.end,
							duration: booking.duration,
							price: booking.price,
							status: booking.status,
							paystatus: booking.paystatus,
							name: booking.name,
							phone: booking.phone,
							email: booking.email,
							notes: booking.notes,
							service: booking.service,
							node: booking.node,
							contributor: booking.contributor,
							createdat: booking.createdat,
						},
					};
				}

				default:
					return { success: false, message: `Unknown action: ${action}` };
			}
		} catch (error) {
			console.error("Booking tool error:", error);
			return {
				success: false,
				message: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
			};
		}
	},
});

// Create Booking Agent
export const createBookingAgent = (contributorid: string) => {
	return new Agent({
		name: "booking-agent",
		instructions: `You help customer ${contributorid} book appointments.
Search available slots, create bookings, manage appointments.
Be helpful and confirm all details before booking.`,
		model: groq("openai/gpt-oss-20b"),
		tools: [bookingTool],
	});
};
