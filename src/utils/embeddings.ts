import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embed } from "ai";

/**
 * Embedding utilities for the Universal Commerce AI System
 * Handles generation and processing of vector embeddings for semantic search
 */

// Initialize Google client for embeddings
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
});

/**
 * Generate embeddings for text using Google's text-embedding-004 model
 */
export async function generateEmbedding(text: string): Promise<Float32Array> {
  try {
    if (!text || text.trim().length === 0) {
      throw new Error("Cannot generate embedding for empty text");
    }

    // Clean and prepare text
    const cleanText = text.trim().substring(0, 8000); // Limit text length

    const result = await embed({
      model: google.textEmbeddingModel("text-embedding-004"),
      value: cleanText,
    });

    // Convert to Float32Array for storage
    return new Float32Array(result.embedding);
  } catch (error) {
    console.error("Failed to generate embedding:", error);
    throw new Error(`Embedding generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddingsBatch(texts: string[]): Promise<Float32Array[]> {
  const embeddings: Float32Array[] = [];

  for (const text of texts) {
    try {
      const embedding = await generateEmbedding(text);
      embeddings.push(embedding);
    } catch (error) {
      console.error(`Failed to generate embedding for text: "${text.substring(0, 50)}..."`, error);
      // Use a zero vector as fallback
      embeddings.push(new Float32Array(768)); // text-embedding-004 dimension
    }
  }

  return embeddings;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error("Vectors must have the same length");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Find most similar embeddings using brute force (for small datasets)
 */
export function findSimilarEmbeddings(
  queryEmbedding: Float32Array,
  embeddings: Float32Array[],
  topK = 10,
  threshold = 0.7
): Array<{ index: number; similarity: number }> {
  const similarities: Array<{ index: number; similarity: number }> = [];

  for (let i = 0; i < embeddings.length; i++) {
    const similarity = cosineSimilarity(queryEmbedding, embeddings[i]);
    if (similarity >= threshold) {
      similarities.push({ index: i, similarity });
    }
  }

  // Sort by similarity (descending) and return top K
  return similarities
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

/**
 * Preprocess text for embedding generation
 */
export function preprocessText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // Remove extra whitespace
    .replace(/\s+/g, ' ')
    // Remove special characters but keep basic punctuation
    .replace(/[^\w\s.,!?-]/g, '')
    // Limit length
    .substring(0, 8000);
}

/**
 * Create searchable text from product data
 */
export function createProductSearchText(product: {
  name: string;
  description?: string;
  category?: string;
  tags?: string[];
}): string {
  const parts = [
    product.name,
    product.description,
    product.category,
    ...(product.tags || [])
  ].filter(Boolean);

  return preprocessText(parts.join(' '));
}

/**
 * Batch generate embeddings for products with progress tracking
 */
export async function generateProductEmbeddings(
  products: Array<{
    id: string;
    name: string;
    description?: string;
    category?: string;
    tags?: string[];
  }>,
  onProgress?: (completed: number, total: number, productName: string) => void
): Promise<Array<{ productId: string; embedding: Float32Array; searchText: string }>> {
  const results: Array<{ productId: string; embedding: Float32Array; searchText: string }> = [];

  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    const searchText = createProductSearchText(product);

    try {
      const embedding = await generateEmbedding(searchText);

      results.push({
        productId: product.id,
        embedding,
        searchText
      });

      if (onProgress) {
        onProgress(i + 1, products.length, product.name);
      }

      console.log(`✓ Generated embedding for: ${product.name}`);
    } catch (error) {
    console.error(`✗ Failed to generate embedding for ${product.name}:`, error);

        // Use zero vector as fallback
        results.push({
          productId: product.id,
          embedding: new Float32Array(768),
          searchText
        });
    }
  }

  return results;
}
