const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');
const downloadHandler = require('./api/download');
const contactHandler = require('./api/contact');

// Load .env variables natively if .env file exists
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
    try {
        const envContent = fs.readFileSync(envFile, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const idx = trimmed.indexOf('=');
                if (idx > 0) {
                    const key = trimmed.slice(0, idx).trim();
                    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        });
    } catch (e) {
        console.error('Error reading .env file:', e.message);
    }
}

const DEFAULT_PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = __dirname;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject'
};

const server = http.createServer(async (req, res) => {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Redirect legacy index-2.html to home
    if (pathname === '/index-2.html') {
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return;
    }

    // Stream endpoint: enables instant attachment download for IDM and browser downloaders
    if (pathname === '/api/stream') {
        const videoUrl = parsedUrl.query.url;
        let filename = parsedUrl.query.filename;
        if (!filename) {
            const title = parsedUrl.query.title || 'FBDock_Video';
            const quality = (parsedUrl.query.quality || 'video').toUpperCase();
            filename = `${title.replace(/[/\\?%*:|"<>]/g, '_').trim().slice(0, 180)}_${quality}.mp4`;
        }
        if (!filename.endsWith('.mp4') && !filename.endsWith('.mp3')) {
            filename += '.mp4';
        }

        const makeDisposition = (name) => {
            const encoded = encodeURIComponent(name);
            const asciiSafe = name.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '');
            return `attachment; filename="${asciiSafe}"; filename*=UTF-8''${encoded}`;
        };

        if (!videoUrl) {
            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing URL');
            return;
        }

        const isAudio = filename.toLowerCase().endsWith('.mp3') ||
                        parsedUrl.query.format === 'mp3' ||
                        parsedUrl.query.audio === 'true' ||
                        parsedUrl.query.type === 'audio';

        // Genuine MP3 Audio conversion via FFmpeg
        if (isAudio) {
            if (!filename.toLowerCase().endsWith('.mp3')) {
                filename = filename.replace(/\.[^/.]+$/, "") + '.mp3';
            }
            try {
                const { spawn } = require('child_process');
                const ffmpegPath = require('ffmpeg-static');

                res.writeHead(200, {
                    'Content-Type': 'audio/mpeg',
                    'Content-Disposition': makeDisposition(filename),
                    'Access-Control-Allow-Origin': '*'
                });

                const ffmpeg = spawn(ffmpegPath, [
                    '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
                    '-i', videoUrl,
                    '-vn',
                    '-c:a', 'libmp3lame',
                    '-b:a', '128k',
                    '-ar', '44100',
                    '-f', 'mp3',
                    'pipe:1'
                ]);

                ffmpeg.stdout.pipe(res);

                ffmpeg.stderr.on('data', () => {});

                ffmpeg.on('error', (err) => {
                    console.error('FFmpeg process error:', err.message);
                    if (!res.headersSent) {
                        res.writeHead(500, { 'Content-Type': 'text/plain' });
                        res.end('Audio conversion failed');
                    }
                });

                req.on('close', () => {
                    try { ffmpeg.kill(); } catch (e) {}
                });
                return;
            } catch (err) {
                console.error('MP3 streaming error:', err.message);
                if (!res.headersSent) {
                    res.writeHead(500, { 'Content-Type': 'text/plain' });
                    res.end('Server MP3 error');
                }
                return;
            }
        }

        // If downscaling to true SD 480p Normal Quality is requested
        if (parsedUrl.query.downscale === 'true') {
            try {
                const { spawn } = require('child_process');
                const ffmpegPath = require('ffmpeg-static');

                res.writeHead(200, {
                    'Content-Type': 'video/mp4',
                    'Content-Disposition': makeDisposition(filename),
                    'Access-Control-Allow-Origin': '*'
                });

                const ffmpeg = spawn(ffmpegPath, [
                    '-headers', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\n',
                    '-i', videoUrl,
                    '-vf', 'scale=-2:480',
                    '-c:v', 'libx264',
                    '-crf', '26',
                    '-preset', 'ultrafast',
                    '-c:a', 'copy',
                    '-f', 'mp4',
                    '-movflags', 'frag_keyframe+empty_moov',
                    'pipe:1'
                ]);

                ffmpeg.stdout.pipe(res);

                ffmpeg.on('error', (err) => {
                    console.error('FFmpeg downscale error:', err.message);
                });

                req.on('close', () => {
                    try { ffmpeg.kill(); } catch (e) {}
                });
                return;
            } catch (err) {
                console.error('Downscale error:', err.message);
            }
        }

        try {
            const fileRes = await fetch(videoUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (!fileRes.ok) {
                res.writeHead(fileRes.status, { 'Content-Type': 'text/plain' });
                res.end('Failed to fetch media upstream');
                return;
            }

            const contentLength = fileRes.headers.get('content-length');
            const headers = {
                'Content-Type': 'video/mp4',
                'Content-Disposition': makeDisposition(filename),
                'Access-Control-Allow-Origin': '*'
            };
            if (contentLength) {
                headers['Content-Length'] = contentLength;
            }

            res.writeHead(200, headers);
            const { Readable } = require('stream');
            if (fileRes.body) {
                Readable.fromWeb(fileRes.body).pipe(res);
            } else {
                const buf = await fileRes.arrayBuffer();
                res.end(Buffer.from(buf));
            }
        } catch (err) {
            console.error('Stream error:', err.message);
            res.writeHead(302, { 'Location': videoUrl });
            res.end();
        }
        return;
    }

    // Handle API endpoints
    if (pathname === '/api/download' || pathname === '/api/contact' || pathname === '/inc/contact.html') {
        console.log(`[API Request] ${req.method} ${pathname}`);
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });

        req.on('end', async () => {
            let parsedBody = {};
            try {
                if (req.headers['content-type']?.includes('application/json')) {
                    parsedBody = JSON.parse(body || '{}');
                } else {
                    parsedBody = Object.fromEntries(new URLSearchParams(body));
                }
            } catch (e) {
                try {
                    parsedBody = Object.fromEntries(new URLSearchParams(body));
                } catch {
                    parsedBody = {};
                }
            }

            req.body = parsedBody;
            req.query = parsedUrl.query;

            res.status = (code) => {
                res.statusCode = code;
                return res;
            };
            res.json = (data) => {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.end(JSON.stringify(data));
                return res;
            };

            try {
                if (pathname === '/api/contact' || pathname === '/inc/contact.html') {
                    await contactHandler(req, res);
                } else {
                    await downloadHandler(req, res);
                }
            } catch (err) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ success: false, error: err.message }));
            }
        });
        return;
    }

    // Serve static files
    let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
    if (safePath === '/' || safePath === '\\') {
        safePath = '/index.html';
    } else if (safePath === '/favicon.ico') {
        safePath = '/logo/logo1.png';
    }

    const filePath = path.join(PUBLIC_DIR, safePath);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            if (stats && stats.isDirectory()) {
                const indexPath = path.join(filePath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                    return fs.createReadStream(indexPath).pipe(res);
                }
            }
            res.writeHead(404, { 'Content-Type': 'text/html' });
            res.end('<h1>404 Not Found</h1>');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        const isStaticAsset = !['.html', '.json'].includes(ext);
        const headers = {
            'Content-Type': contentType
        };

        if (isStaticAsset) {
            // For fonts and images: enable Vercel Edge CDN global caching for instant 0ms delivery
            if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(ext)) {
                headers['Cache-Control'] = 'public, max-age=31536000, s-maxage=31536000, immutable';
            } else if (['.js', '.css'].includes(ext)) {
                headers['Cache-Control'] = 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400';
            } else {
                headers['Cache-Control'] = 'public, max-age=86400';
            }
            headers['Last-Modified'] = stats.mtime.toUTCString();

            if (req.headers['if-modified-since']) {
                const reqModDate = new Date(req.headers['if-modified-since']);
                if (stats.mtime <= reqModDate) {
                    res.writeHead(304, headers);
                    res.end();
                    return;
                }
            }
        } else {
            headers['Cache-Control'] = 'no-cache, must-revalidate';
        }

        res.writeHead(200, headers);
        fs.createReadStream(filePath).pipe(res);
    });
});

function startServer(port) {
    server.listen(port, () => {
        console.log(`\n========================================`);
        console.log(`Server running at http://localhost:${port}`);
        console.log(`Open your browser and paste Facebook links!`);
        console.log(`========================================\n`);
    });

    server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
            console.log(`Port ${port} in use, trying port ${port + 1}...`);
            startServer(port + 1);
        } else {
            console.error(err);
        }
    });
}

if (!process.env.VERCEL) {
    startServer(DEFAULT_PORT);
}

module.exports = server;
