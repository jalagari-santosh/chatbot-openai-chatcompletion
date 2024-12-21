import React, { useState } from 'react';
import axios from 'axios';

const App = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [threadId, setThreadId] = useState('');

    const sendMessage = async () => {
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input.trim() };
        setInput('');

        setMessages([...messages, userMessage]);
       
        try {
            const response = await axios.post('http://localhost:5000/chat', {
                userMessage: input.trim(),
                threadId: localStorage.getItem('threadId') || threadId 
            });

            const assistantMessage = {
                role: 'assistant',
                content: response.data.assistantReply,
            };

            setMessages((prev) => [...prev, assistantMessage]);
            if (!threadId) {
                setThreadId(response.data.threadId)
                localStorage.setItem('threadId', response.data.threadId)
            }
        } catch (error) {
            console.error('Error communicating with the server:', error);
        }

       
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    };

    return (
        <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
            <h2>Chat with Assistant</h2>
            <div
                style={{
                    border: '1px solid #ccc',
                    padding: '10px',
                    height: '400px',
                    overflowY: 'scroll',
                    marginBottom: '10px',
                }}
            >
                {messages.map((msg, index) => (
                 <div
                 key={index}
                 style={{
                     display: 'flex',
                     alignItems: 'center', // Align icon and message in line
                     justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', // Align user messages to the right
                     marginBottom: '10px',
                 }}
             >
                 {/* Profile Image */}
                 {msg.role !== 'user' && <div
                     style={{
                         flexShrink: 0,
                         width: '30px',
                         height: '30px',
                         borderRadius: '50%',
                         backgroundColor: msg.role === 'user' ? '#007bff' : '#6c757d',
                         color: 'white',
                         display: 'flex',
                         justifyContent: 'center',
                         alignItems: 'center',
                         fontSize: '12px',
                         fontWeight: 'bold',
                         marginRight: msg.role === 'user' ? '10px' : '10px', // Add spacing for assistant
                         marginLeft: msg.role === 'user' ? '10px' : '10px', // Add spacing for user
                     }}
                 >A
                 </div>}
             
                 {/* Message Bubble */}
                 <div
                     style={{
                         display: 'inline-block',
                         padding: '8px 12px',
                         borderRadius: '12px',
                         backgroundColor: msg.role === 'user' ? '#daf8e3' : '#f1f1f1',
                         maxWidth: '70%',
                         wordWrap: 'break-word',
                         textAlign: 'left',
                     }}
                 >
                     {msg.content}
                 </div>
             </div>
             
                ))}
            </div>
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your message..."
                style={{
                    width: '80%',
                    padding: '8px',
                    fontSize: '16px',
                }}
            />
            <button
                onClick={sendMessage}
                style={{
                    padding: '8px 12px',
                    marginLeft: '8px',
                    fontSize: '16px',
                }}
            >
                Send
            </button>
        </div>
    );
};

export default App;
