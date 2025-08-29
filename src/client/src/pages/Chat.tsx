import React, { useState } from 'react';
import { PaperAirplaneIcon, ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline';

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      text: "Hello! I'm your financial assistant. I can help you understand your spending patterns, find specific transactions, or answer questions about your financial data. What would you like to know?",
      isUser: false,
      timestamp: new Date(),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sendMessage = async () => {
    if (!inputText.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    // Simulate AI response
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        text: generateAIResponse(inputText),
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiResponse]);
      setIsTyping(false);
    }, 1500);
  };

  const generateAIResponse = (userInput: string): string => {
    const input = userInput.toLowerCase();
    
    if (input.includes('spending') || input.includes('spent')) {
      return "Based on your data, you've spent $4,567.89 this month. Your top spending categories are Groceries ($1,234.56), Restaurants ($987.65), and Gas & Fuel ($543.21). Would you like me to break down any specific category?";
    }
    
    if (input.includes('budget') || input.includes('save')) {
      return "Looking at your spending patterns, I notice you spend about 27% of your budget on groceries and 22% on restaurants. You could potentially save $200-300 monthly by reducing restaurant visits and cooking more at home. Would you like specific recommendations?";
    }
    
    if (input.includes('anomaly') || input.includes('unusual')) {
      return "I've detected a few unusual transactions this month: a $450 charge at Best Buy (3x your average electronics spending) and a $280 restaurant bill (your typical restaurant expense is $45). These might be worth reviewing.";
    }
    
    if (input.includes('category') || input.includes('categorize')) {
      return "I can help categorize your transactions! Currently, 94% of your transactions are automatically categorized with high confidence. There are 8 transactions that need manual review. Would you like me to show them?";
    }
    
    return "I understand you're asking about your financial data. I can help you with spending analysis, budget recommendations, transaction categorization, or finding specific purchases. Could you be more specific about what you'd like to know?";
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">AI Financial Assistant</h1>
        <p className="text-gray-600">Ask questions about your spending, budgets, and financial patterns</p>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="flex flex-col h-full">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  {!message.isUser && (
                    <div className="flex items-center mb-1">
                      <ChatBubbleBottomCenterTextIcon className="h-4 w-4 mr-1" />
                      <span className="text-xs font-medium">AI Assistant</span>
                    </div>
                  )}
                  <p className="text-sm">{message.text}</p>
                  <p className="text-xs mt-1 opacity-75">
                    {message.timestamp.toLocaleTimeString([], { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </p>
                </div>
              </div>
            ))}
            
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-gray-100 text-gray-900 px-4 py-2 rounded-lg">
                  <div className="flex items-center">
                    <ChatBubbleBottomCenterTextIcon className="h-4 w-4 mr-1" />
                    <span className="text-xs font-medium mr-2">AI Assistant</span>
                    <div className="flex space-x-1">
                      <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce"></div>
                      <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-1 h-1 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex space-x-3">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Ask me anything about your finances..."
                className="flex-1 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                rows={2}
              />
              <button
                onClick={sendMessage}
                disabled={!inputText.trim() || isTyping}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                <PaperAirplaneIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Try asking: "How much did I spend on groceries?" or "What were my unusual transactions?"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}