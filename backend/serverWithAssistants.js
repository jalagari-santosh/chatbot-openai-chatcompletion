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
let messageLog = []

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

const assistant = await openai.beta.assistants.create({
    name: "You are a helpful assistant",
    instructions: "You are a helpful assistant. Use the supplied tools to assist the user.",
    tools: tools,
    model: "gpt-4o-mini"
});

  const handleRequiresAction = async (openai, run, threadId) => {
    // Check if there are tools that require outputs
    if (
      run.required_action &&
      run.required_action.submit_tool_outputs &&
      run.required_action.submit_tool_outputs.tool_calls
    ) {
      messageLog.push(JSON.stringify(run.required_action.submit_tool_outputs))
      // Loop through each tool in the required action section
      const toolOutputs = await Promise.all(run.required_action.submit_tool_outputs.tool_calls.map(
        async (tool) => {
            console.log('tool', JSON.stringify(tool))
          if (tool.function.name === "getStockPrice") {
            const symbol = JSON.parse(tool.function.arguments)['symbol']
            return {
              tool_call_id: tool.id,
              output:await getStockPrice(symbol),
            };
          } else if (tool.function.name === "getGender") {
            const name = JSON.parse(tool.function.arguments)['name']
            return {
              tool_call_id: tool.id,
              output: await getGender(name),
            };
          }
        },
      ));
    
      console.log('toolOutputs', toolOutputs)

      // Submit all tool outputs at once after collecting them in a list
      if (toolOutputs.length > 0) {
        run = await openai.beta.threads.runs.submitToolOutputsAndPoll(
          threadId,
          run.id,
          { tool_outputs: toolOutputs },
        );
        console.log("Tool outputs submitted successfully.");
      } else {
        console.log("No tool outputs to submit.");
      }
    
      // Check status after submitting tool outputs
      return await handleRunStatus(openai, run, threadId);
    }
    };

  const handleRunStatus = async (openai, run, threadId) => {
    // Check if the run is completed
    console.log('run '+run.id+' status', run.status)
    if (run.status === "completed") {
      let messages = await openai.beta.threads.messages.list(threadId);
      messageLog.push(JSON.stringify(messages))
      console.log('message', JSON.stringify(messages.data));
      const content = messages.data[0].content[0].text.value;
      console.log('Assistant: ', content)
      return content
    } else if (run.status === "requires_action") {
      console.log(run.status);
      return await handleRequiresAction(openai, run, threadId);
    } else {
      console.error("Run did not complete:", run);
    }
    };  
// Chat endpoint
app.post('/chat', async (req, res) => {
    let { userMessage, threadId } = req.body;

    if (!userMessage) {
        return res.status(400).json({ error: 'Message is required' });
    }

    console.log('threadId',threadId)
    console.log('User:', userMessage)

    if (!threadId) { 
        const thread = await openai.beta.threads.create();
        threadId = thread.id
        console.log('thread id not found, creating new thread', threadId)
    }
    console.log('Current Runs',openai.beta.threads.runs.list)
    
    openai.beta.threads.messages.create(threadId, {
        role: "user",
        content:userMessage,
    });
    messageLog.push({
      role: "user",
      content:userMessage,
    })

    try {
        // Create and poll run
        let run = await openai.beta.threads.runs.createAndPoll(threadId, {
            assistant_id: assistant.id,
        });
        console.log('run id', run.id)
        const assistantReply = await handleRunStatus(openai, run, threadId);
        console.log('Assistant:', {assistantReply, threadId})
        console.log('messageLog', messageLog)
        res.json({ assistantReply, threadId });
    } catch (error) {
        console.error("Error communicating with OpenAI API:", error);
        res.status(500).json({ error: "Error communicating with OpenAI API" });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
