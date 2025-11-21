import fs from 'fs';
import handler from './api/youtube.js';

// Capture console output
const logStream = fs.createWriteStream('repro_log.txt');
const originalLog = console.log;
const originalError = console.error;

console.log = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    logStream.write(msg + '\n');
    originalLog(...args);
};
console.error = (...args) => {
    const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ');
    logStream.write(msg + '\n');
    originalError(...args);
};

// Mock Request and Response
const videoId = 'jNQXAC9IVRw'; // "Me at the zoo" - first YouTube video, has captions
// const videoId = 'dQw4w9WgXcQ'; // Rick Roll
// const videoId = 'UF8uR6Z6KLc'; // TED talk

const req = {
    query: {
        videoId: videoId,
        lang: 'en'
    }
};

const res = {
    statusCode: 200,
    status: function (code) {
        this.statusCode = code;
        console.log(`Response Status: ${code}`);
        return this;
    },
    json: function (data) {
        console.log('Response Body:', JSON.stringify(data, null, 2));
        return this;
    }
};

// Mock Environment Variables (User Cookies)
delete process.env.YOUTUBE_COOKIES;

console.log('Running handler test...');
handler(req, res)
    .then(() => {
        console.log('Handler finished execution.');
        logStream.end();
    })
    .catch(err => {
        console.error('Handler crashed:', err);
        logStream.end();
    });
