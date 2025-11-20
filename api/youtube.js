import { getSubtitles } from 'youtube-captions-scraper';

export default async function handler(req, res) {
    const { videoId, lang = 'en' } = req.query;

    if (!videoId) {
        return res.status(400).json({ error: 'Missing videoId' });
    }

    try {
        // 尝试获取字幕
        // youtube-captions-scraper 会自动处理自动生成的字幕
        const captions = await getSubtitles({
            videoID: videoId,
            lang: lang,
        });

        // 转换为应用内部格式
        const formatted = captions.map((cap, index) => ({
            id: index + 1,
            startTime: parseFloat(cap.start),
            endTime: parseFloat(cap.start) + parseFloat(cap.dur),
            text: cap.text,
            original: cap.text,
            translation: null
        }));

        res.status(200).json(formatted);
    } catch (error) {
        console.error('Error fetching subtitles:', error);
        res.status(500).json({ error: 'Failed to fetch subtitles', details: error.message });
    }
}
