import { getSubtitles } from 'youtube-captions-scraper';

import ytdl from '@distube/ytdl-core';
import https from 'https';
import { parse } from 'url';

export default async function handler(req, res) {
    const { videoId, lang = 'en' } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
    }

    try {
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
            // 尝试检查是否有自动生成的字幕或其他情况，或者直接返回错误
            // 对于某些受限视频，可能无法获取 captions
            console.warn(`No captions found for video: ${videoId}`);
            return res.status(404).json({ error: 'No captions found for this video' });
        }

        const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;

        if (!captionTracks || captionTracks.length === 0) {
            return res.status(404).json({ error: 'No caption tracks available' });
        }

        // 寻找匹配的语言
        // 优先完全匹配，然后尝试前缀匹配 (例如 'en' 匹配 'en-US')
        let track = captionTracks.find(t => t.languageCode === lang);
        if (!track) {
            track = captionTracks.find(t => t.languageCode.startsWith(lang));
        }
        // 如果还是没找到，且请求的是英语，尝试找 'en' 开头的任何轨道 (例如 auto-generated)
        if (!track && lang === 'en') {
            track = captionTracks.find(t => t.languageCode.startsWith('en'));
        }

        // 如果依然没有找到，默认使用第一个轨道 (或者返回错误，这里选择返回第一个作为兜底，但最好还是匹配语言)
        if (!track) {
            // 如果强制要求特定语言，这里应该返回 404
            // 但为了用户体验，如果请求英语没找到，可能返回空列表更好，或者返回第一个
            // 这里我们严格一点，没找到对应语言就返回 404，前端可以处理
            return res.status(404).json({ error: `No captions found for language: ${lang}` });
        }

        // 获取字幕 XML/JSON 内容
        // captionTracks 中的 baseUrl 是 xml 格式，我们需要 fetch 它并解析
        // 或者有些 track 带有 fmt=json3
        const trackUrl = track.baseUrl + '&fmt=json3'; // 尝试请求 JSON 格式

        const captionsData = await fetchCaptions(trackUrl);

        // 转换为应用内部格式
        // json3 格式通常是 { events: [ { tStartMs: 1000, dDurationMs: 2000, segs: [ { utf8: "text" } ] } ] }
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

        res.status(200).json(formatted);

    } catch (error) {
        console.error('Error fetching subtitles:', error);
        // 区分不同类型的错误
        if (error.message.includes('Video unavailable')) {
            return res.status(404).json({ error: 'Video unavailable' });
        }
        if (error.statusCode === 403 || error.statusCode === 429) {
            return res.status(403).json({ error: 'YouTube access restricted (Rate limit or IP block)' });
        }

        res.status(500).json({ error: 'Failed to fetch subtitles', details: error.message });
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
