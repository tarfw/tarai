import { createClient } from "@libsql/client";
import { initializeDatabase } from "./db/schema";

// Commerce database connection (Turso)
export const commerceDb = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./.voltagent/commerce.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Database initialization will be handled by the application startup

// Helper functions for commerce operations
export class CommerceDB {
  static async searchProducts(query: string, providerId?: string, limit = 20) {
    // For discovery mode - cloud search
    if (!providerId) {
      const results = await commerceDb.execute({
        sql: `
          SELECT p.*, pr.name as provider_name, i.price, i.quantity, i.instock
          FROM products p
          JOIN providers pr ON pr.id = p.providerid
          LEFT JOIN inventoryitems i ON i.productid = p.id
          WHERE p.available = 1 AND p.name LIKE ?
          ORDER BY p.name
          LIMIT ?
        `,
        args: [`%${query}%`, limit]
      });
      return results.rows;
    }

    // For POS mode - local provider search
    const results = await commerceDb.execute({
      sql: `
        SELECT p.*, i.price, i.quantity, i.instock
        FROM products p
        LEFT JOIN inventoryitems i ON i.productid = p.id
        WHERE p.providerid = ? AND p.available = 1 AND p.name LIKE ?
        ORDER BY p.name
        LIMIT ?
      `,
      args: [providerId, `%${query}%`, limit]
    });
    return results.rows;
  }

  static async getProductDetails(productId: string) {
    const result = await commerceDb.execute({
      sql: `
        SELECT p.*, pr.name as provider_name, i.price, i.quantity, i.instock
        FROM products p
        JOIN providers pr ON pr.id = p.providerid
        LEFT JOIN inventoryitems i ON i.productid = p.id
        WHERE p.id = ?
      `,
      args: [productId]
    });
    return result.rows[0];
  }

  static async checkInventory(productId: string, quantity: number) {
    const result = await commerceDb.execute({
      sql: `
        SELECT quantity, instock FROM inventoryitems
        WHERE productid = ? AND instock = 1
      `,
      args: [productId]
    });

    if (result.rows.length === 0) return false;

    const available = result.rows[0].quantity as number;
    return available >= quantity;
  }

  static async getInventory(productId: string) {
    const result = await commerceDb.execute({
      sql: `SELECT * FROM inventoryitems WHERE productid = ?`,
      args: [productId]
    });
    return result.rows[0];
  }

  static async createOrder(orderData: {
    ordernumber: string;
    userid: string;
    providerid: string;
    items: any[];
    total: number;
  }) {
    const { ordernumber, userid, providerid, items, total } = orderData;

    const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const tax = subtotal * 0.18; // 18% tax
    const discount = 0;

    await commerceDb.execute({
      sql: `
        INSERT INTO orders (
          id, ordernumber, userid, providerid, items,
          subtotal, tax, discount, total, paid, completed,
          created, updated
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)
      `,
      args: [
        `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ordernumber,
        userid,
        providerid,
        JSON.stringify(items),
        subtotal,
        tax,
        discount,
        total,
        Date.now(),
        Date.now()
      ]
    });
  }

  static async updateInventory(productId: string, quantityChange: number) {
    await commerceDb.execute({
      sql: `
        UPDATE inventoryitems
        SET quantity = quantity + ?, updated = ?
        WHERE productid = ?
      `,
      args: [quantityChange, Date.now(), productId]
    });
  }

  // Vector Operations

  /**
   * Store embedding for a product
   */
  static async storeEmbedding(
    productId: string,
    embedding: Float32Array,
    content: string,
    contentType: 'product' | 'category' | 'tag' = 'product',
    model = 'text-embedding-004'
  ) {
    const embeddingId = `${productId}_${contentType}_${Date.now()}`;

    // Convert Float32Array to buffer for storage
    const embeddingBuffer = Buffer.from(embedding.buffer.slice(0, embedding.byteLength));

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
        Date.now()
      ]
    });

    // Note: FTS table removed to avoid Turso web interface issues
  }

  /**
   * Search products using vector similarity
   */
  static async vectorSearchProducts(
    queryEmbedding: Float32Array,
    providerId?: string,
    limit = 20,
    similarityThreshold = 0.7
  ) {
    // Convert embedding to buffer for comparison
    const embeddingBuffer = Buffer.from(queryEmbedding.buffer.slice(0, queryEmbedding.byteLength));

    let sql = `
      SELECT
        p.*,
        pr.name as provider_name,
        i.price,
        i.quantity,
        i.instock,
        vector_distance_cos(e.embedding, ?) as similarity
      FROM products p
      JOIN providers pr ON pr.id = p.providerid
      JOIN inventoryitems i ON i.productid = p.id
      JOIN embeddings e ON e.productid = p.id
      WHERE p.available = 1 AND e.content_type = 'product'
    `;

    const args: (Buffer | string | number)[] = [embeddingBuffer];

    if (providerId) {
      sql += ` AND p.providerid = ?`;
      args.push(providerId);
    }

    sql += `
    ORDER BY similarity DESC
    LIMIT ?
    `;

    args.push(limit);

    // Execute query and filter results in JavaScript
    const results = await commerceDb.execute({
      sql,
      args
    });

    // Filter by similarity threshold in JavaScript
    const filteredRows = results.rows.filter((row: any) => {
      const similarity = row.similarity;
      return similarity !== null && similarity > similarityThreshold;
    });

    return filteredRows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      providerId: row.providerid,
      providerName: row.provider_name,
      price: row.price,
      quantity: row.quantity,
      inStock: row.instock === 1,
      similarity: row.similarity,
    }));
  }

  /**
   * Hybrid search combining text and vector similarity
   * Simplified version without FTS virtual table
   */
  static async hybridSearchProducts(
    query: string,
    queryEmbedding: Float32Array,
    providerId?: string,
    limit = 20,
    textWeight = 0.3,
    vectorWeight = 0.7
  ) {
    const embeddingBuffer = Buffer.from(queryEmbedding.buffer.slice(0, queryEmbedding.byteLength));

    let sql = `
      SELECT
        p.*,
        pr.name as provider_name,
        i.price,
        i.quantity,
        i.instock,
        vector_distance_cos(e.embedding, ?) as vector_similarity,
        CASE
          WHEN LOWER(p.name) LIKE LOWER(?) THEN 0.8
          WHEN LOWER(p.description) LIKE LOWER(?) THEN 0.6
          WHEN LOWER(p.category) LIKE LOWER(?) THEN 0.4
          ELSE 0.1
        END as text_score
      FROM products p
      JOIN providers pr ON pr.id = p.providerid
      JOIN inventoryitems i ON i.productid = p.id
      JOIN embeddings e ON e.productid = p.id
      WHERE p.available = 1 AND e.content_type = 'product'
    `;

    const searchPattern = `%${query}%`;
    const args: (Buffer | string | number)[] = [embeddingBuffer, searchPattern, searchPattern, searchPattern];

    if (providerId) {
      sql += ` AND p.providerid = ?`;
      args.push(providerId);
    }

    sql += `
      ORDER BY (? * (1 - vector_similarity) + ? * text_score) DESC
      LIMIT ?
    `;

    args.push(vectorWeight, textWeight, limit);

    const results = await commerceDb.execute({
      sql,
      args
    });

    return results.rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      providerId: row.providerid,
      providerName: row.provider_name,
      price: row.price,
      quantity: row.quantity,
      inStock: row.instock === 1,
      vectorSimilarity: row.vector_similarity,
      textScore: row.text_score,
      combinedScore: vectorWeight * (1 - (row.vector_similarity as number)) + textWeight * (row.text_score as number),
    }));
  }

  /**
   * Get embeddings for a product
   */
  static async getProductEmbeddings(productId: string) {
    const results = await commerceDb.execute({
      sql: `SELECT * FROM embeddings WHERE productid = ?`,
      args: [productId]
    });

    return results.rows.map(row => ({
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
    embedFunction: (text: string) => Promise<Float32Array>
  ) {
    const products = await commerceDb.execute(`
      SELECT p.id, p.name, p.description, p.category
      FROM products p
      LEFT JOIN embeddings e ON e.productid = p.id AND e.content_type = 'product'
      WHERE e.id IS NULL AND p.available = 1
    `);

    console.log(`Generating embeddings for ${products.rows.length} products...`);

    for (const product of products.rows) {
      try {
        const content = `${product.name} ${product.description || ''} ${product.category || ''}`.trim();
        const embedding = await embedFunction(content);

        await this.storeEmbedding(
          product.id as string,
          embedding,
          content,
          'product'
        );

        console.log(`✓ Generated embedding for product: ${product.name}`);
      } catch (error) {
        console.error(`✗ Failed to generate embedding for product ${product.id}:`, error);
      }
    }

    console.log('Embedding generation complete');
  }

  /**
   * Create sample data for testing
   */
  static async createSampleData() {
    const sampleProducts = [
      {
        id: 'prod-001',
        providerId: 'provider-001',
        name: 'Artisan Sourdough Bread',
        description: 'Freshly baked sourdough bread made with organic flour and traditional methods',
        category: 'Bakery',
        price: 8.99,
        quantity: 25
      },
      {
        id: 'prod-002',
        providerId: 'provider-001',
        name: 'Organic Free-Range Eggs',
        description: 'Farm fresh eggs from free-range chickens, organic feed',
        category: 'Dairy & Eggs',
        price: 6.49,
        quantity: 50
      },
      {
        id: 'prod-003',
        providerId: 'provider-002',
        name: 'Cold Brew Coffee',
        description: 'Smooth, rich cold brew coffee made from single-origin beans',
        category: 'Beverages',
        price: 4.99,
        quantity: 30
      }
    ];

    // Insert sample provider
    await commerceDb.execute({
      sql: `
        INSERT OR IGNORE INTO providers (id, name, description, created, updated)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: ['provider-001', 'Local Bakery Co.', 'Artisan bakery specializing in sourdough', Date.now(), Date.now()]
    });

    await commerceDb.execute({
      sql: `
        INSERT OR IGNORE INTO providers (id, name, description, created, updated)
        VALUES (?, ?, ?, ?, ?)
      `,
      args: ['provider-002', 'Coffee Corner', 'Specialty coffee roaster', Date.now(), Date.now()]
    });

    // Insert sample products
    for (const product of sampleProducts) {
      await commerceDb.execute({
        sql: `
          INSERT OR IGNORE INTO products (id, providerid, name, description, category, available, created, updated)
          VALUES (?, ?, ?, ?, ?, 1, ?, ?)
        `,
        args: [product.id, product.providerId, product.name, product.description, product.category, Date.now(), Date.now()]
      });

      // Insert inventory
      await commerceDb.execute({
        sql: `
          INSERT OR IGNORE INTO inventoryitems (id, productid, price, quantity, instock, created, updated)
          VALUES (?, ?, ?, ?, 1, ?, ?)
        `,
        args: [`inv-${product.id}`, product.id, product.price, product.quantity, Date.now(), Date.now()]
      });
    }

    console.log('Sample data created successfully');
  }
}
