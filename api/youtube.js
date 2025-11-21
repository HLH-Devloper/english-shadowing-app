import { getSubtitles } from 'youtube-captions-scraper';

export default async function handler(req, res) {
    const { videoId, lang = 'en' } = req.query;

    console.log(`[YouTube API] Fetching for videoId: ${videoId}, lang: ${lang}`);

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
    }

    try {
        // 设置 9 秒超时，避免 Vercel 函数超时被强制终止导致 500
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out')), 9000)
        );

        const fetchPromise = (async () => {
            console.log(`[YouTube API] Calling getSubtitles for videoId=${videoId}, lang=${lang}`);

            // Use youtube-captions-scraper library
            const captions = await getSubtitles({
                videoID: videoId,
                lang: lang
            });

            console.log(`[YouTube API] Successfully fetched ${captions.length} captions`);

            // Transform to our format
            const formatted = captions.map((item, index) => ({
                id: index + 1,
                startTime: parseFloat(item.start),
                endTime: parseFloat(item.start) + parseFloat(item.dur),
                text: item.text,
                original: item.text,
                translation: null
            }));

            return formatted;
        })();

        // 竞态：获取字幕 vs 超时
        const result = await Promise.race([fetchPromise, timeoutPromise]);
        res.status(200).json(result);

    } catch (error) {
        console.error('[YouTube API] Error fetching subtitles:', error);

        // 确保返回 JSON 而不是让 Vercel 崩溃
        if (error.message === 'Request timed out') {
            return res.status(504).json({ error: 'Request timed out (Vercel limit)' });
        }
        if (error.message && (error.message.includes('Could not find captions') || error.message.includes('Transcript is disabled'))) {
            return res.status(404).json({ error: 'No captions available for this video', details: error.message });
        }
        if (error.message && error.message.includes('Video unavailable')) {
            return res.status(404).json({ error: 'Video unavailable', details: error.message });
        }
        if (error.statusCode === 403 || error.statusCode === 429) {
            return res.status(403).json({ error: 'YouTube access restricted (Rate limit or IP block)', details: error.message });
        }

        // 兜底错误
        res.status(500).json({ error: 'Failed to fetch subtitles', details: error.message || 'Unknown error', stack: error.stack });
    }
}
