

import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import axios from 'axios';
import * as cheerio from 'cheerio';


dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
// In-memory vector store
const vectorStore = [];

// Function to calculate cosine similarity
function cosineSimilarity(vecA, vecB) {
  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dotProduct / (magnitudeA * magnitudeB);
}

// Function to add content to in-memory vector store
function addToVectorStore(id, text, embedding) {
  vectorStore.push({ id, text, embedding });
  console.log(`Document "${id}" added to in-memory vector store.`);
}

// Function to retrieve the most similar documents
function retrieveFromVectorStore(queryEmbedding, topK = 3, similarityThreshold = 0.2) {
  const results = vectorStore
    .map((item) => ({
      ...item,
      similarity: cosineSimilarity(queryEmbedding, item.embedding),
    }))
    .filter((item) => item.similarity >= similarityThreshold) // Filter based on threshold
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return results;
}

// Function to truncate text to a specific token limit
function truncateText(text, maxTokens) {
  // Approximation: Assume 1 token is roughly 4 characters (adjust as needed)
  const maxLength = maxTokens * 4;
  return text.slice(0, maxLength);
}


async function fetchAndExtractText(url, maxTokens = 2000) {
  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    const html = response.data;

    // Use Cheerio to parse HTML and extract text
    const $ = cheerio.load(html);

     // Remove script, style, and other non-textual tags
     $('script, style, noscript, iframe, meta, link').remove();

    const text = $('body').text(); // Extract body text
    
    const cleanText = text.replace(/\s+/g, ' ').trim(); // Clean text

    // Truncate the text to the specified token limit
    // console.log("website data",  text.replace(/\s+/g, " ").trim());

    // console.log("truncateText data",  truncateText(cleanText, maxTokens));
    return truncateText(cleanText, maxTokens);
  } catch (error) {
    console.error('Error fetching the URL:', error.message);
    return null;
  }
}

// Function to generate embeddings for text
async function createEmbeddingForText(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error creating embedding:', error.message);
    return null;
  }
}

// Generate response using GPT
// Generate response using GPT
async function generateResponse(query, context) {
  const prompt = `
You are an AI assistant. Use the following context to answer the question.

Context: ${context}

Question: ${query}

Answer:
`;

console.log('####prompt####', prompt)
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: prompt },
      ],
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Error generating response:", error.message);
    return "An error occurred while generating the response.";
  }
}


// Main function: fetch URL content, process query, and generate response
async function processQueryFromURL(url, query) {
  // Step 1: Fetch and extract text from the URL
  const text = await fetchAndExtractText(url);
  if (!text) {
    console.error("Failed to extract text from URL.");
    return;
  }

  // Step 2: Generate embeddings for the extracted text
  const embedding = await createEmbeddingForText(text);
  if (!embedding) {
    console.error("Failed to create embedding for text.");
    return;
  }

  // Step 3: Add the content and embedding to the in-memory vector store
  const documentId = `doc_${Date.now()}`; // Unique ID based on timestamp
  addToVectorStore(documentId, text, embedding);

  // Step 4: Generate embedding for the query
  const queryEmbedding = await createEmbeddingForText(query);

  // Step 5: Retrieve relevant documents using query embedding
  const results = retrieveFromVectorStore(queryEmbedding);

  console.log('results', results)

  // Step 6: Generate a response using the retrieved context
  const context = results[0]?.text || "No relevant context found.";
  const response = await generateResponse(query, context);

  console.log("Final Answer:", response);
}

// Example usage
// const url = "https://playwright.dev/docs/release-notes"; // Replace with any URL
// const query = "What is the latest version of playwright?";
// processQueryFromURL(url, query);





const url = "https://www.moneycontrol.com/stocksmarketsindia/"
const query = "Zomato change value?";
processQueryFromURL(url, query);
