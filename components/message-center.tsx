'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Send, User, Shield, MessageSquare, Clock, ArrowLeft } from 'lucide-react';

interface Message {
    id: string;
    sender: 'user' | 'admin';
    content: string;
    timestamp: number;
}

interface MessageCenterProps {
    serviceId: number;
    serviceName: string;
    userEmail: string;
    senderRole: 'user' | 'admin';
    onClose: () => void;
}

export const MessageCenter = ({
    serviceId,
    serviceName,
    userEmail,
    senderRole,
    onClose
}: MessageCenterProps) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    const fetchMessages = async () => {
        try {
            const response = await fetch(`/api/messages?userEmail=${userEmail}&serviceId=${serviceId}`);
            const data = await response.json();
            if (data.success) {
                setMessages(data.messages);

                // Mark as read if there are unread messages from the other side
                const hasUnread = data.messages.some((m: any) => !m.read && m.sender !== senderRole);
                if (hasUnread) {
                    await fetch('/api/messages', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userEmail, serviceId, role: senderRole })
                    });
                }
            }
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [serviceId, userEmail]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const content = newMessage.trim();
        setNewMessage('');

        try {
            await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sender: senderRole,
                    content,
                    serviceId,
                    serviceName,
                    userEmail
                })
            });
            fetchMessages();
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    return (
        <Card className="flex flex-col h-[600px] max-h-[85vh] w-full max-w-lg bg-black shadow-2xl rounded-3xl overflow-hidden border border-neutral-800 animate-in zoom-in-95 duration-300 p-0 gap-0">
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-900 to-purple-900 p-5 text-white flex justify-between items-center shadow-lg shrink-0">
                <div className="flex items-center gap-4">
                    <Button onClick={onClose} variant="ghost" className="text-white hover:bg-white/10 h-10 w-10 p-0 rounded-full">
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                        <h3 className="font-black text-sm uppercase tracking-wider">{serviceName}</h3>
                        <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                            <p className="text-[10px] text-purple-200 font-bold uppercase tracking-[0.1em]">Verified Support Channel</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black bg-white/10 px-2 py-1 rounded-md uppercase border border-white/10 tracking-widest">
                        {senderRole === 'user' ? 'Citizen' : 'Admin'}
                    </span>
                </div>
            </div>

            {/* Messages Area */}
            <div
                ref={scrollRef}
                className="flex-grow overflow-y-auto p-6 space-y-6 bg-neutral-900 custom-scrollbar min-h-0"
            >
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-4 border-neutral-700 border-t-cyan-500 rounded-full animate-spin"></div>
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="w-20 h-20 bg-neutral-800 rounded-3xl shadow-sm border border-neutral-700 flex items-center justify-center mx-auto mb-6 transform rotate-3">
                            <MessageSquare className="w-10 h-10 text-cyan-400" />
                        </div>
                        <p className="text-sm font-black text-neutral-400 uppercase tracking-[0.2em] leading-relaxed">
                            New Secure Conversation<br />
                            <span className="text-[10px] font-bold text-neutral-500">Powered by Vaani Secure Channel</span>
                        </p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-6">
                        {messages.map((msg) => (
                            <div key={msg.id} className={`flex flex-col ${msg.sender === senderRole ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[80%] p-4 rounded-3xl text-sm shadow-sm transition-all ${msg.sender === senderRole
                                    ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white rounded-br-none'
                                    : 'bg-neutral-800 text-white border border-neutral-700 rounded-bl-none'
                                    }`}>
                                    {msg.content}
                                </div>
                                <div className="flex items-center gap-2 mt-2 px-1">
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">
                                        {msg.sender === 'user' ? 'You' : `${serviceName} Admin`}
                                    </span>
                                    <span className="text-[10px] font-black text-neutral-600 uppercase">•</span>
                                    <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-tighter">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Input Area */}
            <form onSubmit={handleSendMessage} className="p-5 bg-black border-t border-neutral-800 flex gap-3 items-center shrink-0 mt-auto">
                <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Ask your question here..."
                    className="h-12 bg-neutral-900 border-neutral-700 text-white rounded-2xl focus:ring-4 focus:ring-cyan-900/50 placeholder:text-neutral-500 font-bold text-sm px-6 transition-all"
                />
                <Button
                    type="submit"
                    disabled={!newMessage.trim()}
                    className="h-12 w-12 bg-gradient-to-r from-cyan-600 to-purple-600 hover:opacity-90 text-white rounded-2xl shadow-xl transition-all flex items-center justify-center p-0 active:scale-95"
                >
                    <Send className="w-5 h-5" />
                </Button>
            </form>

            <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 5px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #404040;
          border-radius: 10px;
        }
      `}</style>
        </Card>
    );
};
