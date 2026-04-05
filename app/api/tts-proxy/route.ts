import { NextRequest, NextResponse } from 'next/server';

/**
 * Server-side proxy for Google Translate TTS
 *
 * Uses client=gtx (Google Translate Extension) which routes through
 * Google's modern neural TTS engine — gives identical clear voice
 * quality for all 12 Indian languages (same warmth as English).
 *
 * client=tw-ob (old Twitter-bot client) was causing echo / double-sound
 * artifacts on Devanagari and other Indian scripts.
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const text = searchParams.get('text');
        const language = searchParams.get('lang') || 'en';

        console.log('[TTS Proxy] Request received - text:', text?.substring(0, 50), 'lang:', language);

        if (!text || text.trim().length === 0) {
            console.error('[TTS Proxy] Missing or empty text parameter');
            return NextResponse.json({ error: 'Text parameter is required and cannot be empty' }, { status: 400 });
        }

        // Extract base language code (e.g., 'hi' from 'hi-IN')
        const langCode = language.split('-')[0];
        const encodedText = encodeURIComponent(text);

        // Headers that mimic a real Chrome browser request
        const browserHeaders = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://translate.google.com/',
            'Accept': 'audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,*/*;q=0.5',
            'Accept-Language': 'en-US,en;q=0.9',
        };

        // ── PRIMARY: client=gtx — Google's modern neural TTS.
        //   Produces consistent, clear voice tone for ALL languages.
        //   ttsspeed=1 locks rate to normal so Indian scripts aren't faster/slower than English.
        const gtxUrl = `https://translate.googleapis.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${langCode}&client=gtx&sl=${langCode}&ttsspeed=1`;

        console.log(`[TTS Proxy] Trying gtx for lang=${langCode}, chars=${text.length}`);
        let response = await fetch(gtxUrl, { headers: browserHeaders });

        // ── FALLBACK: client=tw-ob if gtx fails (e.g. rate-limit / 403)
        if (!response.ok) {
            console.warn(`[TTS Proxy] gtx failed (${response.status}), falling back to tw-ob`);
            const twObUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodedText}&tl=${langCode}&client=tw-ob`;
            response = await fetch(twObUrl, { headers: browserHeaders });
        }

        if (!response.ok) {
            console.error(`[TTS Proxy] Both TTS clients failed: status ${response.status}, lang=${langCode}`);

            if (response.status === 400 || response.status === 404) {
                return NextResponse.json({
                    error: 'Language not supported',
                    language: langCode,
                    status: response.status,
                    message: `Google TTS does not support language code: ${langCode}`
                }, { status: 400 });
            }

            return NextResponse.json({
                error: 'Failed to fetch audio from Google',
                status: response.status,
                statusText: response.statusText
            }, { status: response.status });
        }

        const audioBuffer = await response.arrayBuffer();
        console.log(`[TTS Proxy] OK — lang=${langCode}, bytes=${audioBuffer.byteLength}`);

        return new NextResponse(audioBuffer, {
            status: 200,
            headers: {
                'Content-Type': 'audio/mpeg',
                'Cache-Control': 'public, max-age=3600',
                'Access-Control-Allow-Origin': '*',
            },
        });

    } catch (error: any) {
        console.error('[TTS Proxy] Error:', error);
        return NextResponse.json({
            error: error.message || 'Internal server error',
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        }, { status: 500 });
    }
}
