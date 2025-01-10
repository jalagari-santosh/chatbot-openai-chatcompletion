import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import axios from 'axios';
import * as cheerio from 'cheerio';

dotenv.config();

const app = express();
const port = 5000;

app.use(express.json());
app.use(cors());

// Initialize OpenAI API client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation state
let messages = [
    { role: 'system', content: 'You are a helpful assistant. Use the supplied tools to assist the user.' },
];

// Pinecone Configuration
const pinecone = new Pinecone({
    apiKey: process.env.PINE_CONE_API_KEY
});

const index = pinecone.Index("rag-demo-index", "https://rag-demo-index-1y6fjh1.svc.aped-4627-b74a.pinecone.io");

// Function to fetch and extract text from a URL
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


        const maxLength = maxTokens * 4;
        return cleanText.slice(0, maxLength);

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

// Add content to Pinecone database
async function addContentToPinecone(id, text, embedding) {
    try {
        await index.namespace('ns1').upsert([
            {
                id,
                values: embedding,
                metadata: { text },
            }])
        console.log(`Document "${id}" added to Pinecone.`);
    } catch (error) {
        console.error("Error adding to Pinecone:", error.message);
    }
}

// Retrieve relevant documents from Pinecone
async function retrieveRelevantDocuments(queryEmbedding, topK = 3) {
    try {
        const response = await index.namespace('ns1').query({
            vector: queryEmbedding,
            topK,
            includeMetadata: true,
            includeValues: true
        });

        return response.matches.map((match) => ({
            text: match.metadata.text,
            score: match.score,
        }));
    } catch (error) {
        console.error("Error querying Pinecone:", error.message);
        return [];
    }
}

// Generate response using GPT
async function generateResponse(query, context) {
    const prompt = `
  You are an AI assistant. Use the following context to answer the question.
  
  Context: ${context}
  
  Question: ${query}
  
  Answer:
  `;
    console.log('####prompt####', prompt)

    messages.push({ role: 'user', content: prompt });

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: messages
        });
    
        messages.push({ role: 'assistant', content:  response.choices[0].message.content });
        return response.choices[0].message.content;
    } catch (error) {
        console.error("Error generating response:", error.message);
        return "An error occurred while generating the response.";
    }
}

async function fetchAndAddContentToVector(urls) {
    await Promise.all(
        urls.map(async (url) => {
            try {
                // Step 1: Fetch and extract text from the URL
                const text = await fetchAndExtractText(url);
                if (!text) {
                    console.error(`Failed to extract text from URL: ${url}`);
                    return;
                }

                // Step 2: Generate embeddings for the extracted text
                const embedding = await createEmbeddingForText(text);
                if (!embedding) {
                    console.error(`Failed to create embedding for text from URL: ${url}`);
                    return;
                }

                // Step 3: Add the content and embedding to Pinecone
                const documentId = `doc_${Date.now()}`;
                await addContentToPinecone(documentId, text, embedding);

                console.log(`Content from ${url} successfully added to Pinecone.`);
            } catch (error) {
                console.error(`Error processing URL ${url}:`, error.message);
            }
        })
    );
}

async function processQuery(query) {

    // Step 4: Generate embedding for the query
    const queryEmbedding = await createEmbeddingForText(query);

    // Step 5: Retrieve relevant documents using query embedding
    const results = await retrieveRelevantDocuments(queryEmbedding);

    // Step 6: Generate a response using the retrieved context
    const context = results[0]?.text || "No relevant context found.";
    const response = await generateResponse( query, context);

    return response
}

// Chat endpoint
app.post('/chat', async (req, res) => {
    const { userMessage } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    try {
        const assistantReply =  await processQuery(userMessage)
       
        console.log(messages)

        res.json({ assistantReply });
    } catch (error) {
        console.error("Error communicating with OpenAI API:", error);
        res.status(500).json({ error: "Error communicating with OpenAI API" });
    }
});


const urls = ["https://www.moneycontrol.com/stocksmarketsindia/", "https://playwright.dev/docs/release-notes"]

fetchAndAddContentToVector(urls)
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
