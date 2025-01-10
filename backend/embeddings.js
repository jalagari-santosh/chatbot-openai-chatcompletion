import { OpenAI } from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: "DOG",
});
console.log("Embedding", JSON.stringify(response.data[0].embedding));
console.log("Embedding", response.data[0].embedding.length);