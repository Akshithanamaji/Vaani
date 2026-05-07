'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    User,
    LogOut,
    FileText,
    ChevronRight,
    History,
    Mail,
    UserCircle,
    Bell,
    AlertTriangle,
    ShieldCheck,
    Languages,
    Volume2,
    Zap,
    Power,
    Play
} from 'lucide-react';
import { useVoiceSettings } from '@/contexts/VoiceSettingsContext';
import { speakText, stopSpeaking } from '@/lib/voice-utils';
import { getAllActiveSubmissions } from '@/lib/qr-utils';
import type { SubmittedService } from '@/lib/government-services';
import { GOVERNMENT_SERVICES, getTranslatedService } from '@/lib/government-services';
import { MessageCenter } from '@/components/message-center';
import { translations } from '@/lib/translations';
import { useLanguage, AVAILABLE_LANGUAGES } from '@/contexts/LanguageContext';

interface UserSidebarProps {
    userEmail: string;
    onLogout: () => void;
    onGoToProfile: () => void;
    onViewForm: (submission: SubmittedService) => void;
    language?: any;
}

export const UserSidebar = ({
    userEmail,
    onLogout,
    onGoToProfile,
    onViewForm,
    language
}: UserSidebarProps) => {
    const router = useRouter();
    const { selectedLanguage, setSelectedLanguage } = useLanguage();
    const { settings, setSpeed, setVolume, setRepeatInstructions } = useVoiceSettings();
    const langCode = selectedLanguage?.code.split('-')[0] || 'en';
    const t = translations[langCode] || translations['en'];
    const [submissions, setSubmissions] = useState<SubmittedService[]>([]);
    const [showForms, setShowForms] = useState(false);
    const [showMessages, setShowMessages] = useState(false);
    const [showNotifications, setShowNotifications] = useState(false);
    const [showLanguages, setShowLanguages] = useState(false);
    const [showVoiceSettings, setShowVoiceSettings] = useState(false);
    const [activeChatService, setActiveChatService] = useState<{ id: number; name: string } | null>(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [allMessages, setAllMessages] = useState<any[]>([]);
    const [notifications, setNotifications] = useState<any[]>([]);
    const [isCollapsed, setIsCollapsed] = useState(false);

    useEffect(() => {
        if (isCollapsed) {
            setShowForms(false);
            setShowMessages(false);
            setShowNotifications(false);
            setShowLanguages(false);
        }
    }, [isCollapsed]);

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const fetchUserData = async () => {
            try {
                // Normalize email for consistent matching
                const normalizedEmail = userEmail.trim().toLowerCase();
                console.log('[UserSidebar] Fetching data for email:', normalizedEmail);

                // Fetch unread messages
                const msgRes = await fetch(`/api/messages?userEmail=${encodeURIComponent(normalizedEmail)}`, {
                    signal: controller.signal
                });
                if (!isMounted) return;
                const msgData = await msgRes.json();
                if (msgData.success) {
                    setAllMessages(msgData.messages);
                    const unread = msgData.messages.filter((m: any) => !m.read && m.sender === 'admin').length;
                    setUnreadCount(unread);
                }

                // Fetch notifications
                const notifRes = await fetch(`/api/notifications?userEmail=${encodeURIComponent(normalizedEmail)}`, {
                    signal: controller.signal
                });
                if (!isMounted) return;
                const notifData = await notifRes.json();
                console.log('[UserSidebar] Notifications fetched:', {
                    userEmail: normalizedEmail,
                    count: notifData.notifications?.length || 0,
                    success: notifData.success,
                    notifications: notifData.notifications
                });
                if (notifData.success) {
                    setNotifications(notifData.notifications);
                }
            } catch (error: any) {
                // Silently ignore network suspension/abort errors
                if (error.name === 'AbortError' || error.message?.includes('network') || error.message?.includes('suspended')) {
                    return;
                }
                // Only log unexpected errors
                if (isMounted) {
                    console.error('Error fetching user data:', error);
                }
            }
        };
        fetchUserData();
        const interval = setInterval(fetchUserData, 5000);
        return () => {
            isMounted = false;
            controller.abort();
            clearInterval(interval);
        };
    }, [userEmail]);

    const clearNotifications = async () => {
        try {
            await fetch('/api/notifications', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userEmail, action: 'clearAll' })
            });
            setNotifications([]);
        } catch (error) {
            console.error('Error clearing notifications:', error);
        }
    };

    useEffect(() => {
        let isMounted = true;
        const controller = new AbortController();

        const loadData = async () => {
            try {
                const response = await fetch(`/api/submissions/user?email=${userEmail}`, {
                    signal: controller.signal
                });
                if (!isMounted) return;
                const data = await response.json();
                if (data.success) {
                    setSubmissions(data.submissions);
                }
            } catch (error: any) {
                // Silently ignore network suspension/abort errors
                if (error.name === 'AbortError' || error.message?.includes('network') || error.message?.includes('suspended')) {
                    return;
                }
                if (isMounted) {
                    console.error('Error loading user submissions:', error);
                }
            }
        };
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => {
            isMounted = false;
            controller.abort();
            clearInterval(interval);
        };
    }, [userEmail]);

    const [displayName, setDisplayName] = useState('User');

    useEffect(() => {
        const normalizedEmail = userEmail.trim().toLowerCase();
        const storedName = localStorage.getItem(`profile_name_${normalizedEmail}`);
        if (storedName) {
            setDisplayName(storedName);
        } else {
            setDisplayName(userEmail.split('@')[0] || 'User');
        }
    }, [userEmail]);
    
    const playTestVoice = () => {
        stopSpeaking();
        const textToTest = langCode === 'hi' ? "नमस्ते, मैं आपकी आवाज़ हूँ।" : "Hello, this is your selected voice.";
        speakText(textToTest, selectedLanguage?.code || 'en-IN');
    };


    return (
        <>
            <div className={`${isCollapsed ? 'w-24' : 'w-80'} h-full flex flex-col bg-black border-r border-neutral-800 shadow-2xl relative transition-all duration-300 ease-in-out`}>

                {/* Inner Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col">

                    {/* User Info Header */}
                    <div
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        className={`p-6 pb-5 bg-neutral-900 border-b border-neutral-800 cursor-pointer hover:bg-neutral-800 transition-colors ${isCollapsed ? 'flex justify-center px-0' : ''}`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="shrink-0 w-10 h-10 bg-gradient-to-br from-cyan-500 to-purple-600 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-cyan-500/20">
                                {displayName[0].toUpperCase()}
                            </div>
                            <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                                <p className="font-black text-white text-lg leading-tight uppercase tracking-tight truncate">{displayName}</p>
                            </div>

                        </div>
                    </div>

                    <div className="py-3">
                        {/* My Account */}
                        <button
                            onClick={() => { onGoToProfile(); }}
                            className={`w-full flex items-center gap-4 py-4 text-white hover:bg-neutral-800 transition-all text-left font-bold group ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}
                        >
                            <UserCircle className="shrink-0 h-5 w-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                            <span className={`text-sm transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.myAccount}</span>
                        </button>

                        {/* Language Selection */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (isCollapsed) setIsCollapsed(false);
                                    setShowLanguages(!showLanguages); setShowForms(false); setShowMessages(false); setShowNotifications(false); setShowVoiceSettings(false);
                                }}
                                className={`w-full flex items-center justify-between py-4 text-white hover:bg-neutral-800 transition-all text-left font-bold group ${showLanguages ? 'bg-neutral-800' : ''} ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <Languages className="shrink-0 h-5 w-5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
                                    <span className={`text-sm transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.languageSelection || 'Language'}</span>
                                </div>
                                <div className={`flex items-center gap-2 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                                    <span className="text-lg">{selectedLanguage?.flag || '🇮🇳'}</span>
                                    <ChevronRight className={`h-4 w-4 text-neutral-500 transition-transform duration-300 ${showLanguages ? 'rotate-90' : ''}`} />
                                </div>
                            </button>

                            {showLanguages && (
                                <div className="bg-neutral-900 border-y border-neutral-800 max-h-60 overflow-y-auto custom-scrollbar">
                                    <div className="py-2 space-y-1">
                                        {AVAILABLE_LANGUAGES.map((lang) => (
                                            <button
                                                key={lang.code}
                                                onClick={() => {
                                                    setSelectedLanguage(lang);
                                                    setShowLanguages(false);
                                                    // Provide audible feedback in the new language
                                                    setTimeout(() => {
                                                        const text = lang.code === 'hi' ? "नमस्ते, मैं आपकी आवाज़ हूँ।" : 
                                                                    lang.code === 'te' ? "నమస్కారం, ఇది మీ వాయిస్." :
                                                                    lang.code === 'ta' ? "வணக்கம், இது உங்கள் குரல்." :
                                                                    lang.code === 'kn' ? "ನಮಸ್ಕಾರ, ಇದು ನಿಮ್ಮ ಧ್ವನಿ." :
                                                                    lang.code === 'ml' ? "നമസ്കാരം, ഇത് നിങ്ങളുടെ ശബ്ദം." :
                                                                    "Hello, this is your selected voice.";
                                                        speakText(text, lang.code);
                                                    }, 100);
                                                }}
                                                className={`w-full flex items-center justify-between px-6 py-3 transition-all ${selectedLanguage?.code === lang.code
                                                    ? 'bg-gradient-to-r from-cyan-500/20 to-purple-600/20 text-white border-l-4 border-cyan-400'
                                                    : 'text-neutral-300 hover:bg-neutral-800 hover:text-white'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg">{lang.flag}</span>
                                                    <span className="text-sm font-bold">{lang.name}</span>
                                                </div>
                                                {selectedLanguage?.code === lang.code && (
                                                    <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse"></div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Voice Settings Selection */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (isCollapsed) setIsCollapsed(false);
                                    setShowVoiceSettings(!showVoiceSettings);
                                    setShowForms(false);
                                    setShowMessages(false);
                                    setShowNotifications(false);
                                    setShowLanguages(false);
                                }}
                                className={`w-full flex items-center justify-between py-4 text-white hover:bg-neutral-800 transition-all text-left font-bold group ${showVoiceSettings ? 'bg-neutral-800' : ''} ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <Volume2 className="shrink-0 h-5 w-5 text-emerald-400 group-hover:text-emerald-300 transition-colors" />
                                    <span className={`text-sm transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.voiceSettings || 'Voice Settings'}</span>
                                </div>
                                <ChevronRight className={`h-4 w-4 text-neutral-500 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'} ${showVoiceSettings ? 'rotate-90' : ''}`} />
                            </button>

                            {showVoiceSettings && (
                                <div className="bg-neutral-900 border-y border-neutral-800 p-6 space-y-6">
                                    {/* Voice Speed */}
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Zap className="h-4 w-4 text-neutral-400" />
                                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{t.voiceSpeed || 'Voice speed'}</p>
                                        </div>
                                        <div className="flex bg-black/50 p-1 rounded-xl gap-1">
                                            {(['slow', 'normal', 'fast'] as const).map((speed) => (
                                                <button
                                                    key={speed}
                                                    onClick={() => {
                                                        setSpeed(speed);
                                                        setTimeout(playTestVoice, 50);
                                                    }}
                                                    className={`flex-1 py-2 px-2 rounded-lg text-[10px] font-black uppercase tracking-tighter transition-all ${settings.speed === speed
                                                        ? 'bg-emerald-500 text-white shadow-lg'
                                                        : 'text-neutral-500 hover:text-white hover:bg-neutral-800'
                                                        }`}
                                                >
                                                    {speed === 'normal' ? (t.normal || 'Normal') : speed === 'slow' ? (t.slow || 'Slow') : (t.fast || 'Fast')}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Volume Control */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Volume2 className="h-4 w-4 text-neutral-400" />
                                                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{t.volumeControl || 'Volume control'}</p>
                                            </div>
                                            <span className="text-[10px] font-black text-emerald-400">{Math.round(settings.volume * 100)}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.1"
                                            value={settings.volume}
                                            onChange={(e) => setVolume(parseFloat(e.target.value))}
                                            onMouseUp={() => setTimeout(playTestVoice, 50)}
                                            onTouchEnd={() => setTimeout(playTestVoice, 50)}
                                            className="w-full h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                    </div>

                                    {/* Repeat Instructions */}
                                    <div className="flex items-center justify-between pt-2">
                                        <div className="flex items-center gap-2">
                                            <Power className="h-4 w-4 text-neutral-400" />
                                            <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{t.repeatInstructions || 'Repeat instructions'}</p>
                                        </div>
                                        <button
                                            onClick={() => setRepeatInstructions(!settings.repeatInstructions)}
                                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${settings.repeatInstructions ? 'bg-emerald-500' : 'bg-neutral-700'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${settings.repeatInstructions ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                    </div>
                                    
                                    {/* Test Button */}
                                    <Button 
                                        onClick={playTestVoice}
                                        variant="outline" 
                                        size="sm" 
                                        className="w-full border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500 transition-all font-bold gap-2 py-5"
                                    >
                                        <Play className="h-3 w-3 fill-current" />
                                        Test Audio
                                    </Button>
                                </div>
                            )}
                        </div>

                        {/* My Forms */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (isCollapsed) setIsCollapsed(false);
                                    setShowForms(!showForms); setShowMessages(false); setShowNotifications(false); setShowLanguages(false);
                                }}
                                className={`w-full flex items-center justify-between py-4 text-white hover:bg-neutral-800 transition-all text-left font-bold group ${showForms ? 'bg-neutral-800' : ''} ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <FileText className="shrink-0 h-5 w-5 text-purple-400 group-hover:text-purple-300 transition-colors" />
                                    <span className={`text-sm transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.activeForms}</span>
                                </div>
                                <ChevronRight className={`h-4 w-4 text-neutral-500 transition-transform duration-300 ${showForms ? 'rotate-90' : ''} ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`} />
                            </button>

                            {/* Inline Form List */}
                            {showForms && (
                                <div className="bg-neutral-900 border-y border-neutral-800 max-h-56 overflow-y-auto custom-scrollbar">
                                    {submissions.length === 0 ? (
                                        <div className="px-10 py-6 text-center">
                                            <p className="text-[10px] text-neutral-400 font-black uppercase tracking-[0.2em] italic">{t.noActiveApplications}</p>
                                        </div>
                                    ) : (
                                        <div className="divide-y divide-neutral-800">
                                            {submissions.map((sub) => {
                                                const serviceDef = GOVERNMENT_SERVICES.find(s => s.id === sub.serviceId);
                                                const serviceName = serviceDef ? getTranslatedService(serviceDef, langCode).name : sub.serviceName;
                                                const isExpired = sub.isExpired || ['ready_for_collection', 'collected', 'rejected'].includes(sub.status || '');

                                                return (
                                                    <div key={sub.id} className={`flex items-center justify-between px-6 py-4 transition-all group ${isExpired ? 'bg-neutral-800/50 opacity-75' : 'hover:bg-neutral-800'}`}>
                                                        <button
                                                            onClick={() => {
                                                                onViewForm(sub);
                                                            }}
                                                            className="flex-1 text-left"
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <p className={`text-xs font-black truncate uppercase tracking-tight ${isExpired ? 'text-neutral-500 line-through' : 'text-white group-hover:text-cyan-400'} transition-colors`}>{serviceName}</p>
                                                                {isExpired && (
                                                                    <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-black rounded-full whitespace-nowrap">
                                                                        EXPIRED
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className={`text-[10px] font-bold tracking-wider ${isExpired ? 'text-neutral-600' : 'text-neutral-400'}`}>{new Date(sub.submittedAt).toLocaleDateString()}</p>
                                                        </button>
                                                        {!isExpired && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveChatService({ id: sub.serviceId, name: sub.serviceName });
                                                                }}
                                                                className="p-2.5 text-cyan-400 hover:text-white hover:bg-cyan-600 rounded-xl transition-all shadow-sm"
                                                                title="Message Admin"
                                                            >
                                                                <Mail className="h-4 w-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Notifications section */}
                        <div className="relative border-b border-neutral-800">
                            <button
                                onClick={() => {
                                    if (isCollapsed) setIsCollapsed(false);
                                    setShowNotifications(!showNotifications); setShowForms(false); setShowMessages(false); setShowLanguages(false);
                                }}
                                className={`w-full flex items-center justify-between py-4 text-white hover:bg-neutral-800 transition-all text-left font-bold group ${showNotifications ? 'bg-neutral-800' : ''} ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className={`shrink-0 p-2 rounded-xl transition-all ${showNotifications ? 'bg-orange-500 text-white' : 'bg-neutral-800 text-orange-400 group-hover:bg-neutral-700'}`}>
                                        <Bell className="h-5 w-5" />
                                    </div>
                                    <span className={`text-sm transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.notifications}</span>
                                </div>
                                <div className={`flex items-center gap-2 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                                    {notifications.filter(n => !n.read).length > 0 && (
                                        <div className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-black">
                                            {notifications.filter(n => !n.read).length}
                                        </div>
                                    )}
                                    <ChevronRight className={`h-4 w-4 text-neutral-500 transition-transform duration-300 ${showNotifications ? 'rotate-90' : ''}`} />
                                </div>
                            </button>

                            {showNotifications && (
                                <div className="bg-neutral-900 p-3 space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar">
                                    {notifications.length === 0 ? (
                                        <div className="py-10 text-center">
                                            <div className="w-12 h-12 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3 opacity-50">
                                                <Bell className="w-6 h-6 text-neutral-400" />
                                            </div>
                                            <p className="text-[10px] text-neutral-400 font-black uppercase tracking-widest">{t.noAlerts}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between items-center px-1 mb-2">
                                                <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">{t.recentActivity}</p>
                                                <button onClick={clearNotifications} className="text-[9px] font-black text-cyan-400 uppercase hover:text-cyan-300 hover:underline transition-all">{t.clearAll}</button>
                                            </div>
                                            <div className="space-y-2">
                                                {notifications.map((notif) => (
                                                    <div key={notif.id} className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] ${notif.type === 'warning' ? 'bg-orange-900/30 border-orange-800' : 'bg-neutral-800 border-neutral-700'} shadow-sm`}>
                                                        <div className="flex items-start gap-4">
                                                            <div className={`mt-0.5 w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${notif.type === 'warning' ? 'bg-orange-900/50 text-orange-400' : 'bg-emerald-900/50 text-emerald-400'}`}>
                                                                {notif.type === 'warning' ? <AlertTriangle className="w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-xs font-black text-white leading-tight mb-1 truncate">{notif.title}</p>
                                                                <p className="text-[11px] text-neutral-400 font-medium leading-relaxed mb-2 opacity-80">{notif.message}</p>
                                                                <div className="flex justify-between items-center">
                                                                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-tighter ${notif.type === 'warning' ? 'bg-orange-900/50 text-orange-300' : 'bg-emerald-900/50 text-emerald-300'}`}>
                                                                        {notif.serviceName}
                                                                    </span>
                                                                    <p className="text-[9px] font-black text-neutral-500 uppercase tracking-tighter">
                                                                        {new Date(notif.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Contact  */}
                        <div className="relative">
                            <button
                                onClick={() => {
                                    if (isCollapsed) setIsCollapsed(false);
                                    setShowMessages(!showMessages); setShowForms(false); setShowNotifications(false); setShowLanguages(false);
                                }}
                                className={`w-full flex items-center justify-between py-4 text-white hover:bg-neutral-800 transition-all text-left font-bold group ${showMessages ? 'bg-neutral-800' : ''} ${isCollapsed ? 'px-0 justify-center' : 'px-6'}`}
                            >
                                <div className="flex items-center gap-4">
                                    <Mail className="shrink-0 h-5 w-5 text-purple-400 group-hover:text-purple-300 transition-colors" />
                                    <span className={`text-sm transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.contact}</span>
                                </div>
                                <div className={`flex items-center gap-2 transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>
                                    {unreadCount > 0 ? (
                                        <div className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-black">
                                            {unreadCount}
                                        </div>
                                    ) : (
                                        <div className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse"></div>
                                    )}
                                    <ChevronRight className={`h-4 w-4 text-neutral-500 transition-transform duration-300 ${showMessages ? 'rotate-90' : ''}`} />
                                </div>
                            </button>

                            {showMessages && (
                                <div className="bg-neutral-900 border-y border-neutral-800 p-4 space-y-3">
                                    <p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-2">{t.selectDepartment}</p>
                                    <div className="space-y-1 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                                        {GOVERNMENT_SERVICES.map((service) => {
                                            const hasUnread = allMessages.some(m => m.serviceId === service.id && !m.read && m.sender === 'admin');
                                            const translatedService = getTranslatedService(service, langCode);
                                            return (
                                                <button
                                                    key={service.id}
                                                    onClick={() => setActiveChatService({ id: service.id, name: service.name })}
                                                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition-all group"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="relative">
                                                            <span className="text-sm grayscale group-hover:grayscale-0 transition-all">{service.icon}</span>
                                                            {hasUnread && (
                                                                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full ring-1 ring-black"></span>
                                                            )}
                                                        </div>
                                                        <span className="text-[11px] font-bold text-neutral-300 group-hover:text-white truncate max-w-[160px]">{translatedService.name}</span>
                                                    </div>
                                                    <ChevronRight className={`h-3 w-3 ${hasUnread ? 'text-red-400' : 'text-neutral-500'} group-hover:text-cyan-400`} />
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Logout Footer */}
                    <div className="mt-auto border-t border-neutral-800 p-2">
                        <button
                            onClick={() => { onLogout(); }}
                            className={`w-full flex items-center gap-4 py-4 text-red-400 hover:bg-red-900/30 rounded-2xl transition-all text-left font-bold group ${isCollapsed ? 'px-0 justify-center' : 'px-4'}`}
                        >
                            <LogOut className="shrink-0 h-5 w-5 transition-transform group-hover:-translate-x-1" />
                            <span className={`text-sm transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0 hidden' : 'opacity-100'}`}>{t.logout}</span>
                        </button>
                    </div>
                </div>

            </div>

            {/* Global Chat Overlay */}
            {activeChatService && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
                    <MessageCenter
                        serviceId={activeChatService.id}
                        serviceName={activeChatService.name}
                        userEmail={userEmail}
                        senderRole="user"
                        onClose={() => setActiveChatService(null)}
                    />
                </div>,
                document.body
            )}

            <style jsx>{`
                .custom-scrollbar {
                    -ms-overflow-style: none; /* IE and Edge */
                    scrollbar-width: none; /* Firefox */
                }
                .custom-scrollbar::-webkit-scrollbar {
                    display: none; /* Chrome, Safari and Opera */
                }
            `}</style>
        </>
    );
};
