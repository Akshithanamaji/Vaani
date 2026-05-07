import React from "react"
import type { Metadata } from 'next'
import { Plus_Jakarta_Sans } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { LanguageProvider } from '@/contexts/LanguageContext'
import { VoiceSettingsProvider } from '@/contexts/VoiceSettingsContext'
import './globals.css'

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: '--font-plus-jakarta-sans',
});

export const metadata: Metadata = {
  title: 'Vaani Ai - Voice-Powered Government Forms',
  description: 'Access 45+ government services using your voice. No typing needed. Just speak in your local language. High-speed, secure, and accessible.',
  generator: 'Vaani Ai',
  icons: {
    icon: [
      {
        url: '/logo.jpeg',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/logo.jpeg',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/logo.jpeg',
        type: 'image/jpeg',
      },
    ],
    apple: '/logo.jpeg',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable} font-sans antialiased`}>
        <LanguageProvider>
          <VoiceSettingsProvider>
            {children}
          </VoiceSettingsProvider>
        </LanguageProvider>
        <Analytics />
      </body>
    </html>
  )
}
