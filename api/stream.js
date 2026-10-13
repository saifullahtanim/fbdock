// Stream proxy for forcing direct file download without opening new tabs

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const videoUrl = req.query?.url || '';
    let filename = req.query?.filename || 'facebook_video.mp4';
    if (!filename.endsWith('.mp4')) filename += '.mp4';

    if (!videoUrl) {
        res.statusCode = 400;
        res.end('Missing url parameter');
        return;
    }

    try {
        const fileRes = await fetch(videoUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!fileRes.ok) {
            res.statusCode = fileRes.status;
            res.end('Failed to fetch media file');
            return;
        }

        const contentLength = fileRes.headers.get('content-length');
        const contentType = filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }

        // Stream web ReadableStream to node response
        const { Readable } = require('stream');
        if (fileRes.body) {
            Readable.fromWeb(fileRes.body).pipe(res);
        } else {
            const buf = await fileRes.arrayBuffer();
            res.end(Buffer.from(buf));
        }
    } catch (err) {
        console.error('Stream proxy error:', err.message);
        if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Error streaming file');
        }
    }
};
