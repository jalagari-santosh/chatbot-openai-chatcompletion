import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';
import {getGender, getStockPrice} from './functions.js';

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
let conversation = [
    { role: 'system', content: 'You are a helpful assistant. Use the supplied tools to assist the user.' },
];

const tools = [
    {
        type: "function",
        function: {
            name: "getGender",
            description: "Get gender by name",
            parameters: {
                type: "object",
                properties: {
                    name: {
                        type: 'string',
                        description: 'The name of the person',
                    },
                },
                required: ["name"],
                additionalProperties: false,
            },
        },
    },
    {
        type: "function",
        function: {
            name: "getStockPrice",
            description: "Get stock price of by symbol, if user provides the name of the company provide the symbol of same as input",
            parameters: {
                type: "object",
                properties: {
                    symbol: {
                        type: 'string',
                        description: 'Symbol of the company if user provides the name convert to symbol and send',
                    },
                },
                required: ["symbol"],
                additionalProperties: false,
            },
        },
    },
];

// Chat endpoint
app.post('/chat', async (req, res) => {
    const { userMessage } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    conversation.push({ role: 'user', content: userMessage });

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4',
            messages: conversation,
            tools: tools,
        });

        let assistantReply = response.choices[0].message.content;
        const toolCalls = response.choices[0].message.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
            console.log('function',toolCalls[0].function)
            const { name, arguments: toolArgs } = toolCalls[0].function;
            let toolResponseContent;

            try {
                if (name === 'getGender') {
                    const { name: personName } = JSON.parse(toolArgs);
                    toolResponseContent = await getGender(personName);
                    console.log("tool response: ", toolResponseContent)
                } else if (name === 'getStockPrice') {
                    const {  symbol } = JSON.parse(toolArgs);
                    toolResponseContent = await getStockPrice(symbol);
                    console.log("tool response: ", toolResponseContent)
                } 
                else {
                    toolResponseContent = "Sorry, this tool is not implemented.";
                }
            } catch (toolError) {
                toolResponseContent = "Error executing the tool.";
            }

            const toolResponseMessage = {
                role: 'tool',
                content: toolResponseContent,
                tool_call_id: toolCalls[0].id,
            };

            conversation.push(response.choices[0].message);
            conversation.push(toolResponseMessage);

            const finalResponse = await openai.chat.completions.create({
                model: 'gpt-4',
                messages: conversation,
            });

            assistantReply = finalResponse.choices[0].message.content;
        }

        // conversation.push({ role: 'assistant', content: assistantReply });
        console.log(conversation)
        res.json({ assistantReply });
    } catch (error) {
        console.error("Error communicating with OpenAI API:", error);
        res.status(500).json({ error: "Error communicating with OpenAI API" });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
