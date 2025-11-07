/**
 * Unified Database Interface
 * - InstantDB: CRUD operations (products, inventory, orders, providers)
 * - LibSQL/Turso: Vector embeddings and semantic search
 */

import { createClient } from "@libsql/client";
import { InstantCommerceDB } from "./db/instantdb-operations";

// LibSQL client for vector embeddings only
export const commerceDb = createClient({
	url: process.env.TURSO_DATABASE_URL || "file:./.voltagent/commerce.db",
	authToken: process.env.TURSO_AUTH_TOKEN,
});

console.log("✅ LibSQL client initialized for vector embeddings");

/**
 * Vector Embeddings Operations (LibSQL/Turso only)
 */
export class VectorDB {
	/**
	 * Store embedding for a product
	 */
	static async storeEmbedding(
		productId: string,
		embedding: Float32Array,
		content: string,
		contentType: "product" | "category" | "tag" = "product",
		model = "text-embedding-004",
	) {
		const embeddingId = `${productId}_${contentType}_${Date.now()}`;

		// Convert Float32Array to buffer for storage
		const embeddingBuffer = Buffer.from(
			embedding.buffer.slice(0, embedding.byteLength),
		);

		await commerceDb.execute({
			sql: `
        INSERT OR REPLACE INTO embeddings (
          id, productid, embedding, content, content_type, model, created
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
			args: [
				embeddingId,
				productId,
				embeddingBuffer,
				content,
				contentType,
				model,
				Date.now(),
			],
		});
	}

	/**
	 * Search products using vector similarity
	 */
	static async vectorSearchProducts(
		queryEmbedding: Float32Array,
		providerId?: string,
		limit = 20,
		similarityThreshold = 0.7,
	) {
		// Convert embedding to buffer for comparison
		const embeddingBuffer = Buffer.from(
			queryEmbedding.buffer.slice(0, queryEmbedding.byteLength),
		);

		let sql = `
      SELECT
        e.productid as id,
        e.content,
        vector_distance_cos(e.embedding, ?) as similarity
      FROM embeddings e
      WHERE e.content_type = 'product'
    `;

		const args: (Buffer | string | number)[] = [embeddingBuffer];

		sql += `
      ORDER BY similarity DESC
      LIMIT ?
    `;

		args.push(limit * 2); // Get more results to filter

		const results = await commerceDb.execute({
			sql,
			args,
		});

		// Filter by similarity threshold
		const filteredRows = results.rows.filter((row: any) => {
			const similarity = row.similarity;
			return similarity !== null && similarity > similarityThreshold;
		});

		// Get product IDs from vector search
		const productIds = filteredRows.map((row) => row.id as string);
		if (productIds.length === 0) return [];

		// Fetch full product details from InstantDB
		const products = await InstantCommerceDB.getProductsByIds(productIds);

		// Apply provider filter if specified
		const filteredProducts = providerId
			? products.filter((p) => p.providerId === providerId)
			: products;

		// Add similarity scores and sort
		return filteredProducts
			.map((product) => {
				const vectorRow = filteredRows.find((row) => row.id === product.id);
				return {
					...product,
					similarity: vectorRow?.similarity || 0,
				};
			})
			.sort((a, b) => b.similarity - a.similarity)
			.slice(0, limit);
	}

	/**
	 * Hybrid search combining text and vector similarity
	 */
	static async hybridSearchProducts(
		query: string,
		queryEmbedding: Float32Array,
		providerId?: string,
		limit = 20,
		textWeight = 0.4,
		vectorWeight = 0.6,
	) {
		// Get vector search results
		const vectorResults = await this.vectorSearchProducts(
			queryEmbedding,
			undefined,
			limit * 2,
			0.5, // Lower threshold for hybrid
		);

		// Get text search results from InstantDB
		const textResults = await InstantCommerceDB.searchProducts(
			query,
			providerId,
			limit * 2,
		);

		// Combine and score results
		const productScores = new Map<
			string,
			{
				product: any;
				vectorScore: number;
				textScore: number;
			}
		>();

		// Add vector results
		for (const result of vectorResults) {
			productScores.set(result.id, {
				product: result,
				vectorScore: result.similarity || 0,
				textScore: 0,
			});
		}

		// Add text results and calculate text scores
		for (const result of textResults) {
			const existing = productScores.get(result.id);
			const nameLower = result.name.toLowerCase();
			const queryLower = query.toLowerCase();

			// Calculate text score based on match quality
			let textScore = 0;
			if (nameLower.includes(queryLower)) {
				textScore = 0.8;
			} else if (
				result.description?.toLowerCase().includes(queryLower)
			) {
				textScore = 0.6;
			} else if (result.category?.toLowerCase().includes(queryLower)) {
				textScore = 0.4;
			} else {
				textScore = 0.2;
			}

			if (existing) {
				existing.textScore = textScore;
			} else {
				productScores.set(result.id, {
					product: result,
					vectorScore: 0,
					textScore,
				});
			}
		}

		// Calculate combined scores and sort
		const scoredProducts = Array.from(productScores.values())
			.map(({ product, vectorScore, textScore }) => ({
				...product,
				vectorSimilarity: vectorScore,
				textScore,
				combinedScore: vectorWeight * vectorScore + textWeight * textScore,
			}))
			.filter((p) => !providerId || p.providerId === providerId)
			.sort((a, b) => b.combinedScore - a.combinedScore)
			.slice(0, limit);

		return scoredProducts;
	}

	/**
	 * Get embeddings for a product
	 */
	static async getProductEmbeddings(productId: string) {
		const results = await commerceDb.execute({
			sql: `SELECT * FROM embeddings WHERE productid = ?`,
			args: [productId],
		});

		return results.rows.map((row) => ({
			id: row.id,
			content: row.content,
			contentType: row.content_type,
			model: row.model,
			embedding: new Float32Array(row.embedding as ArrayBuffer),
			created: row.created,
		}));
	}

	/**
	 * Generate embeddings for all products (batch operation)
	 */
	static async generateProductEmbeddings(
		embedFunction: (text: string) => Promise<Float32Array>,
	) {
		// Get all products from InstantDB
		const products = await InstantCommerceDB.getAllProducts();

		console.log(
			`Generating embeddings for ${products.length} products from InstantDB...`,
		);

		let generated = 0;
		let skipped = 0;

		for (const product of products) {
			try {
				// Check if embedding already exists
				const existing = await this.getProductEmbeddings(product.id as string);
				if (existing.length > 0) {
					skipped++;
					continue;
				}

				const content =
					`${product.name} ${product.description || ""} ${product.category || ""}`.trim();
				const embedding = await embedFunction(content);

				await this.storeEmbedding(
					product.id as string,
					embedding,
					content,
					"product",
				);

				generated++;
				console.log(`✓ Generated embedding for product: ${product.name}`);
			} catch (error) {
				console.error(
					`✗ Failed to generate embedding for product ${product.id}:`,
					error,
				);
			}
		}

		console.log(
			`Embedding generation complete: ${generated} generated, ${skipped} skipped`,
		);
	}
}

/**
 * Unified CommerceDB interface
 * Routes operations to appropriate database:
 * - CRUD operations → InstantDB
 * - Vector/Semantic search → LibSQL
 */
export class CommerceDB {
	// === CRUD Operations (InstantDB) ===

	static async createProvider(data: {
		name: string;
		description?: string;
		contactEmail?: string;
		contactPhone?: string;
		address?: string;
	}) {
		return InstantCommerceDB.createProvider(data);
	}

	static async createProduct(data: {
		providerId: string;
		name: string;
		description?: string;
		category: string;
		tags?: string[];
		price: number;
		quantity: number;
		variantName?: string;
	}) {
		return InstantCommerceDB.createProduct(data);
	}

	static async searchProducts(query: string, providerId?: string, limit = 20) {
		return InstantCommerceDB.searchProducts(query, providerId, limit);
	}

	static async getProductDetails(productId: string) {
		return InstantCommerceDB.getProductDetails(productId);
	}

	static async updateProduct(
		productId: string,
		updates: {
			name?: string;
			description?: string;
			category?: string;
			tags?: string[];
			available?: boolean;
		},
	) {
		return InstantCommerceDB.updateProduct(productId, updates);
	}

	static async getInventory(productId: string) {
		return InstantCommerceDB.getInventory(productId);
	}

	static async checkInventory(productId: string, quantity: number) {
		return InstantCommerceDB.checkInventory(productId, quantity);
	}

	static async updateInventory(productId: string, quantityChange: number) {
		return InstantCommerceDB.updateInventory(productId, quantityChange);
	}

	static async createOrder(orderData: {
		ordernumber: string;
		userid: string;
		providerid: string;
		items: any[];
		total: number;
	}) {
		return InstantCommerceDB.createOrder(orderData);
	}

	static async getOrder(orderNumber: string) {
		return InstantCommerceDB.getOrder(orderNumber);
	}

	static async getAllProducts(limit = 1000) {
		return InstantCommerceDB.getAllProducts(limit);
	}

	static async bulkCreateProducts(
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
		return InstantCommerceDB.bulkCreateProducts(providerId, products);
	}

	// === Vector Operations (LibSQL) ===

	static async storeEmbedding(
		productId: string,
		embedding: Float32Array,
		content: string,
		contentType: "product" | "category" | "tag" = "product",
		model = "text-embedding-004",
	) {
		return VectorDB.storeEmbedding(
			productId,
			embedding,
			content,
			contentType,
			model,
		);
	}

	static async vectorSearchProducts(
		queryEmbedding: Float32Array,
		providerId?: string,
		limit = 20,
		similarityThreshold = 0.7,
	) {
		return VectorDB.vectorSearchProducts(
			queryEmbedding,
			providerId,
			limit,
			similarityThreshold,
		);
	}

	static async hybridSearchProducts(
		query: string,
		queryEmbedding: Float32Array,
		providerId?: string,
		limit = 20,
		textWeight = 0.4,
		vectorWeight = 0.6,
	) {
		return VectorDB.hybridSearchProducts(
			query,
			queryEmbedding,
			providerId,
			limit,
			textWeight,
			vectorWeight,
		);
	}

	static async getProductEmbeddings(productId: string) {
		return VectorDB.getProductEmbeddings(productId);
	}

	static async generateProductEmbeddings(
		embedFunction: (text: string) => Promise<Float32Array>,
	) {
		return VectorDB.generateProductEmbeddings(embedFunction);
	}
}

// Export InstantCommerceDB (VectorDB and CommerceDB are already exported above)
export { InstantCommerceDB };
