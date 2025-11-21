
import ytdl from '@distube/ytdl-core';

const videoId = 'UVM_ONKaRit';

async function handler() {
    console.log(`Testing video: ${videoId}`);
    try {
        const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`);
        console.log('Info fetched successfully');
    } catch (error) {
        console.error('Caught error:', error);
        console.log('Error message:', error.message);
    }
}

handler();
