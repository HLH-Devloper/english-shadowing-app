import { getSubtitles } from 'youtube-captions-scraper'; // Keep this if needed, or remove if fully replaced. Actually I'll remove it to be clean.
import ytdl from '@distube/ytdl-core';
import https from 'https';
import { parse } from 'url';

export default async function handler(req, res) {
    const { videoId, lang = 'en' } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
    }

    try {
        // 设置 9 秒超时，避免 Vercel 函数超时被强制终止导致 500
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 9000)
        );

        const fetchPromise = (async () => {
            const agentOptions = {};
            if (process.env.YOUTUBE_COOKIES) {
                try {
                    const cookies = JSON.parse(process.env.YOUTUBE_COOKIES);
                    const agent = ytdl.createAgent(cookies);
                    agentOptions.agent = agent;
                } catch (e) {
                    console.warn('Failed to parse YOUTUBE_COOKIES:', e);
                }
            }

            const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, agentOptions);
            const playerResponse = info.player_response;

            if (!playerResponse || !playerResponse.captions) {
                console.warn(`No captions found for video: ${videoId}`);
                throw new Error('No captions found for this video');
            }

            const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;

            if (!captionTracks || captionTracks.length === 0) {
                throw new Error('No caption tracks available');
            }

            // 寻找匹配的语言
            let track = captionTracks.find(t => t.languageCode === lang);
            if (!track) {
                track = captionTracks.find(t => t.languageCode.startsWith(lang));
            }
            if (!track && lang === 'en') {
                track = captionTracks.find(t => t.languageCode.startsWith('en'));
            }

            if (!track) {
                throw new Error(`No captions found for language: ${lang}`);
            }

            const trackUrl = track.baseUrl + '&fmt=json3';
            const captionsData = await fetchCaptions(trackUrl);

            const formatted = [];
            if (captionsData && captionsData.events) {
                let idCounter = 1;
                captionsData.events.forEach(event => {
                    if (event.segs && event.segs.length > 0) {
                        const text = event.segs.map(seg => seg.utf8).join('').trim();
                        if (text) {
                            formatted.push({
                                id: idCounter++,
                                startTime: event.tStartMs / 1000,
                                endTime: (event.tStartMs + (event.dDurationMs || 0)) / 1000,
                                text: text,
                                original: text,
                                translation: null
                            });
                        }
                    }
                });
            }
            return formatted;
        })();

        // 竞态：获取字幕 vs 超时
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error fetching subtitles:', error);

        // 确保返回 JSON 而不是让 Vercel 崩溃
        if (error.message === 'Request timed out') {
            return res.status(504).json({ error: 'Request timed out' });
        }
        if (error.message.includes('Video unavailable')) {
            return res.status(404).json({ error: 'Video unavailable (Cookies required)' });
        }
        if (error.statusCode === 403 || error.statusCode === 429) {
            return res.status(403).json({ error: 'YouTube access restricted (Rate limit or IP block)' });
        }

        // 兜底错误
        res.status(500).json({ error: 'Failed to fetch subtitles', details: error.message || 'Unknown error' });
    }
}

// 辅助函数：获取并解析字幕数据
async function fetchCaptions(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error('Failed to parse caption JSON'));
                }
            });
        }).on('error', (err) => reject(err));
    });
}
