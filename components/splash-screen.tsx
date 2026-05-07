'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { speakText } from '@/lib/voice-utils';

interface SplashScreenProps {
    onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
    // Logo finishes animating after ~2.8 s → show "Tap to continue"
    const [tapReady, setTapReady] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setTapReady(true), 2800);
        return () => clearTimeout(t);
    }, []);

    // Entire screen is clickable once logo has animated in
    const handleClick = () => {
        if (tapReady) {
            // Synchronously unlock browser autoplay policies
            const unlockAudio = new Audio("data:audio/mp3;base64,//OigAAAAAAQQPExQAAABgAA");
            unlockAudio.play().catch(() => {});

            // Instantly proceed to the Language Selector, where the 12-language audio loop will begin
            onComplete();
        }
    };

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key="splash"
                initial={{ opacity: 1 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 1.1, transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] } }}
                onClick={handleClick}
                className={`fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-b from-[#050505] to-[#0a0a0a] overflow-hidden select-none ${tapReady ? 'cursor-pointer' : 'cursor-default'}`}
            >
                {/* ── Logo ── */}
                <div className="relative flex items-center justify-center">
                    <motion.div
                        initial={{ scale: 0.4, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: -20 }}
                        transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
                        className="relative z-10 w-40 h-40 md:w-56 md:h-56 flex items-center justify-center pointer-events-none"
                    >
                        {/* Glow */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 2, delay: 0.8 }}
                            className="absolute inset-6 blur-[100px] bg-gradient-to-r from-blue-600/40 to-purple-600/40 rounded-full"
                        />
                        {/* Rotating ring */}
                        <motion.div
                            initial={{ rotate: 0, opacity: 0 }}
                            animate={{ rotate: 360, opacity: 1 }}
                            transition={{
                                rotate: { duration: 3, ease: 'linear', repeat: Infinity },
                                opacity: { duration: 1, delay: 1.2 },
                            }}
                            className="absolute inset-8 border border-blue-500/20 rounded-full"
                        />
                        <motion.img
                            src="/image-removebg-preview.png"
                            alt="Vaani AI Logo"
                            className="w-full h-full object-contain drop-shadow-[0_0_60px_rgba(59,130,246,0.8)] relative z-10"
                            initial={{ filter: 'brightness(0.7)' }}
                            animate={{ filter: 'brightness(1)' }}
                            transition={{ duration: 1.8, delay: 0.4 }}
                        />
                    </motion.div>
                </div>

                {/* ── Tap-to-continue prompt (replaces loading dots once logo is done) ── */}
                <AnimatePresence>
                    {tapReady ? (
                        <motion.div
                            key="tap"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.45 }}
                            className="absolute bottom-24 flex flex-col items-center gap-3 pointer-events-none"
                        >
                            <motion.p
                                animate={{ opacity: [0.45, 1, 0.45] }}
                                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                                className="text-blue-300/80 text-sm font-medium tracking-widest uppercase"
                            >
                                Tap anywhere to continue
                            </motion.p>
                            <motion.div
                                animate={{ scale: [1, 1.45, 1], opacity: [0.55, 1, 0.55] }}
                                transition={{ duration: 1.2, repeat: Infinity }}
                                className="w-2.5 h-2.5 rounded-full bg-blue-400"
                            />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="dots"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, delay: 1.5 }}
                            className="absolute bottom-20 flex gap-2 pointer-events-none"
                        >
                            {[0, 1, 2].map((i) => (
                                <motion.div
                                    key={i}
                                    className="w-2 h-2 bg-blue-500/60 rounded-full"
                                    animate={{ scale: [1, 1.5, 1], opacity: [0.4, 1, 0.4] }}
                                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2, ease: [0.16, 1, 0.3, 1] }}
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Background radial glow ── */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.15, scale: 1 }}
                    transition={{ duration: 2.5, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.3),rgba(147,51,234,0.2),transparent_70%)] pointer-events-none"
                />

                {/* ── Bottom progress line ── */}
                <motion.div
                    className="absolute bottom-0 left-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500/80 to-transparent"
                    initial={{ width: '0%', x: '-100%' }}
                    animate={{ width: '100%', x: '100%' }}
                    transition={{ duration: 2.8, ease: [0.16, 1, 0.3, 1] }}
                />

                {/* ── Rotating particle ring ── */}
                <motion.div
                    className="absolute top-1/2 left-1/2 w-96 h-96 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    initial={{ rotate: 0, opacity: 0 }}
                    animate={{ rotate: 360, opacity: 0.3 }}
                    transition={{ rotate: { duration: 20, ease: 'linear', repeat: Infinity }, opacity: { duration: 2, delay: 1 } }}
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent rounded-full" />
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
