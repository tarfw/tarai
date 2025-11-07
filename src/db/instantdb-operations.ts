/**
 * InstantDB CRUD Operations for Universal Commerce AI System
 * Handles all CRUD operations using InstantDB
 * Vector search operations remain in LibSQL (see db.ts)
 */

import { idb, id, tx } from "./instantdb-client";

export const InstantCommerceDB = {
	/**
	 * Create a new provider
	 */
	async createProvider(data: {
		name: string;
		description?: string;
		contactEmail?: string;
		contactPhone?: string;
		address?: string;
	}) {
		// Always use InstantDB's id() function to generate UUIDs
		const providerId = id();

		await idb.transact([
			tx.providers[providerId].update({
				name: data.name,
				description: data.description || "",
				contactEmail: data.contactEmail || "",
				contactPhone: data.contactPhone || "",
				address: data.address || "",
				active: true,
				verified: false,
				createdAt: Date.now(),
				updatedAt: Date.now(),
			}),
		]);

		return providerId;
	},

	/**
	 * Create a new product with inventory
	 */
	async createProduct(data: {
		providerId: string;
		name: string;
		description?: string;
		category: string;
		tags?: string[];
		price: number;
		quantity: number;
		variantName?: string;
	}) {
		const productId = id();
		const inventoryId = id();

		// Ensure provider exists
		const providerResult = await idb.query({
			providers: {
				$: { where: { id: data.providerId } },
			},
		});

		if (!providerResult.providers || providerResult.providers.length === 0) {
			// Create default provider with the providerId
			await idb.transact([
				tx.providers[data.providerId].update({
					name: "Default Provider",
					description: "Auto-created provider",
					contactEmail: "",
					contactPhone: "",
					address: "",
					active: true,
					verified: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				}),
			]);
		}

		await idb.transact([
			tx.products[productId]
				.update({
					name: data.name,
					description: data.description || "",
					category: data.category,
					tags: data.tags || [],
					images: [],
					available: true,
					featured: false,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				})
				.link({ provider: data.providerId }),

			tx.inventoryItems[inventoryId]
				.update({
					variantName: data.variantName || null,
					price: data.price,
					quantity: data.quantity,
					reserved: 0,
					inStock: data.quantity > 0,
					createdAt: Date.now(),
					updatedAt: Date.now(),
				})
				.link({ product: productId }),
		]);

		return { productId, inventoryId };
	},

	/**
	 * Search products by query (text-based)
	 */
	async searchProducts(query: string, providerId?: string, limit = 20) {
		const whereClause: any = {
			name: { $ilike: `%${query}%` },
		};

		// Provider filter
		if (providerId) {
			whereClause["provider.id"] = providerId;
		}

		const result = await idb.query({
			products: {
				$: {
					where: whereClause,
					limit,
				},
				provider: {},
				inventoryItems: {},
			},
		});

		return (result.products || []).map((product: any) => ({
			id: product.id,
			name: product.name,
			description: product.description,
			category: product.category,
			providerid: product.provider?.id,
			provider_name: product.provider?.name,
			price: product.inventoryItems?.[0]?.price || 0,
			quantity: product.inventoryItems?.[0]?.quantity || 0,
			instock: product.inventoryItems?.[0]?.inStock ? 1 : 0,
		}));
	},

	/**
	 * Get product details by ID
	 */
	async getProductDetails(productId: string) {
		const result = await idb.query({
			products: {
				$: { where: { id: productId } },
				provider: {},
				inventoryItems: {},
			},
		});

		const product = result.products?.[0];
		if (!product) return null;

		return {
			id: product.id,
			name: product.name,
			description: product.description,
			category: product.category,
			providerid: product.provider?.id,
			provider_name: product.provider?.name,
			price: product.inventoryItems?.[0]?.price || 0,
			quantity: product.inventoryItems?.[0]?.quantity || 0,
			instock: product.inventoryItems?.[0]?.inStock ? 1 : 0,
			created: product.createdAt,
			updated: product.updatedAt,
		};
	},

	/**
	 * Update product information
	 */
	async updateProduct(
		productId: string,
		updates: {
			name?: string;
			description?: string;
			category?: string;
			tags?: string[];
			available?: boolean;
		},
	) {
		const updateData: any = {
			updatedAt: Date.now(),
		};

		if (updates.name !== undefined) updateData.name = updates.name;
		if (updates.description !== undefined)
			updateData.description = updates.description;
		if (updates.category !== undefined) updateData.category = updates.category;
		if (updates.tags !== undefined) updateData.tags = updates.tags;
		if (updates.available !== undefined)
			updateData.available = updates.available;

		await idb.transact([tx.products[productId].update(updateData)]);
	},

	/**
	 * Get inventory for a product
	 */
	async getInventory(productId: string) {
		const result = await idb.query({
			inventoryItems: {
				$: { where: { "product.id": productId } },
			},
		});

		const inventory = result.inventoryItems?.[0];
		if (!inventory) return null;

		return {
			id: inventory.id,
			productid: productId,
			quantity: inventory.quantity,
			price: inventory.price,
			instock: inventory.inStock,
		};
	},

	/**
	 * Check if inventory is available
	 */
	async checkInventory(
		productId: string,
		requestedQuantity: number,
	): Promise<boolean> {
		const inventory = await this.getInventory(productId);
		return inventory ? inventory.quantity >= requestedQuantity : false;
	},

	/**
	 * Update inventory quantity
	 */
	async updateInventory(productId: string, quantityChange: number) {
		const inventory = await this.getInventory(productId);
		if (!inventory) {
			throw new Error(`No inventory found for product ${productId}`);
		}

		const newQuantity = Math.max(0, inventory.quantity + quantityChange);

		await idb.transact([
			tx.inventoryItems[inventory.id].update({
				quantity: newQuantity,
				inStock: newQuantity > 0,
				updatedAt: Date.now(),
			}),
		]);

		return newQuantity;
	},

	/**
	 * Create an order
	 */
	async createOrder(data: {
		ordernumber: string;
		userid: string;
		providerid: string;
		items: Array<{
			productId: string;
			productName: string;
			quantity: number;
			price: number;
		}>;
		total: number;
	}) {
		const orderId = id();

		// Calculate subtotal and tax (18%)
		const subtotal = data.total / 1.18;
		const tax = subtotal * 0.18;
		const discount = subtotal > 1000 ? subtotal * 0.05 : 0;

		await idb.transact([
			tx.orders[orderId]
				.update({
					orderNumber: data.ordernumber,
					userId: data.userid,
					items: data.items,
					subtotal,
					tax,
					discount,
					total: data.total,
					paid: false,
					completed: false,
					notes: "",
					createdAt: Date.now(),
					updatedAt: Date.now(),
				})
				.link({ provider: data.providerid }),
		]);

		return orderId;
	},

	/**
	 * Get order by order number
	 */
	async getOrder(orderNumber: string) {
		const result = await idb.query({
			orders: {
				$: { where: { orderNumber } },
				provider: {},
			},
		});

		return result.orders?.[0] || null;
	},

	/**
	 * Get all products (for embeddings generation)
	 */
	async getAllProducts(limit = 1000) {
		const result = await idb.query({
			products: {
				$: { limit },
				provider: {},
				inventoryItems: {},
			},
		});

		return (result.products || []).map((product: any) => ({
			id: product.id,
			name: product.name,
			description: product.description,
			category: product.category,
			providerid: product.provider?.id,
			provider_name: product.provider?.name,
			price: product.inventoryItems?.[0]?.price || 0,
			quantity: product.inventoryItems?.[0]?.quantity || 0,
			instock: product.inventoryItems?.[0]?.inStock ? 1 : 0,
		}));
	},

	/**
	 * Bulk create products
	 */
	async bulkCreateProducts(
		providerId: string,
		products: Array<{
			name: string;
			description?: string;
			category: string;
			tags?: string[];
			price: number;
			quantity: number;
			variantName?: string;
		}>,
	) {
		const results = [];

		for (const product of products) {
			try {
				const result = await this.createProduct({
					providerId,
					...product,
				});
				results.push({ success: true, ...result });
			} catch (error) {
				results.push({
					success: false,
					error: error instanceof Error ? error.message : "Unknown error",
					productName: product.name,
				});
			}
		}

		return results;
	},

	/**
	 * Get products by IDs (for hybrid search results)
	 */
	async getProductsByIds(productIds: string[]) {
		const result = await idb.query({
			products: {
				$: {
					where: {
						id: { $in: productIds },
					},
				},
				provider: {},
				inventoryItems: {},
			},
		});

		return (result.products || []).map((product: any) => ({
			id: product.id,
			name: product.name,
			description: product.description,
			category: product.category,
			providerId: product.provider?.id,
			providerName: product.provider?.name,
			price: product.inventoryItems?.[0]?.price || 0,
			quantity: product.inventoryItems?.[0]?.quantity || 0,
			inStock: product.inventoryItems?.[0]?.inStock || false,
		}));
	},
};

export type InstantCommerceDBType = typeof InstantCommerceDB;
