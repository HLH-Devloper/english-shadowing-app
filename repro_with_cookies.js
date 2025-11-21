
import ytdl from '@distube/ytdl-core';
import https from 'https';

// User provided cookies
const cookies = [
    {
        "domain": ".youtube.com",
        "expirationDate": 1798765845,
        "hostOnly": false,
        "httpOnly": true,
        "name": "LOGIN_INFO",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "AFmmF2swRQIgP8oHKz_Kp4sQM6SJ9lYx9Wyc8tf0Sz6XhzLgc1W7-9ACIQDYt3viY_72x3haBsAhaCPcjL_0idnXG6FlyJShXvk-lA:QUQ3MjNmelN1THhKYkFSRGZvMnNnSmlQbVVUVmRSN3NsakdxMjlYLXdrMFFZQ1hMalozNHhqQjlnR3RKNjZoLWhXRFFoRGxyNVhQbElqdGsxaHQ1RmhfRkRHSXN3eG55NnFlRWtQeV9sRVh1OGg0NElwdU9PTHIwX1hubUJJaHgzMDdzdWM3LXYtdGlvU0VCWlc3ekM0TzJ4X1J3TnUxT0J3"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1798765845,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-3PSID",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "g.a0003wipTI449kyDWStqjP5pDJM-DVimnqfeKqRhBfiHM0iU2g_dEtfRCaoJnjfZKEVfS_5ZGwACgYKARESARQSFQHGX2MizzvZ6nhvw_pmwol4PwBsXRoVAUF8yKre67FANoFRWTN36l3emF5P0076"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1798765845,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-1PSID",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "g.a0003wipTI449kyDWStqjP5pDJM-DVimnqfeKqRhBfiHM0iU2g_dGUF0hXn6J1_LKOGu1KoxvgACgYKATsSARQSFQHGX2Mir8BUy9XSEFZEFQ6HTEIYyRoVAUF8yKrkT8UnuSycUuxzUIiD1bsY0076"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1798765845,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-3PAPISID",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "iyolxyLLk8en5utc/A7t_ri9yETKMQmO1D"
    },
    {
        "domain": ".youtube.com",
        "expirationDate": 1798765845,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__Secure-1PAPISID",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": "0",
        "value": "iyolxyLLk8en5utc/A7t_ri9yETKMQmO1D"
    }
];

// const videoId = 'pN0ZUlURcEU'; // Video from latest user report
const videoId = 'dQw4w9WgXcQ'; // Rick Roll

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

async function run() {
    console.log('Starting test with cookies...');
    try {
        const agent = ytdl.createAgent(cookies);
        const agentOptions = { agent };

        console.log(`Fetching info for ${videoId}...`);
        const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${videoId}`, agentOptions);
        const playerResponse = info.player_response;

        if (!playerResponse || !playerResponse.captions) {
            console.log('No captions found.');
            return;
        }

        console.log('Captions found!');
        const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer.captionTracks;
        console.log(`Found ${captionTracks.length} tracks.`);

        const enTrack = captionTracks.find(t => t.languageCode.startsWith('en'));
        if (enTrack) {
            console.log('English track found:', enTrack.name.simpleText);
            // Try fetching content
            // const content = await fetchCaptions(enTrack.baseUrl + '&fmt=json3');
            // console.log('Content fetched, events:', content.events?.length);
        } else {
            console.log('No English track found.');
        }

    } catch (error) {
        console.error('Caught error:', error);
    }
}

run();
