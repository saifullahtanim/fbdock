// Vercel Serverless Function & Local API Handler
// Handles Facebook Video extraction with ultra-fast parallel engine

function decodeHtmlEntities(str) {
    if (!str) return '';
    return str
        .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
        .replace(/&#([0-9]+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#039;/g, "'");
}

function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '00:30';
    const s = parseInt(seconds, 10);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return String(m).padStart(2, '0') + ':' + String(rem).padStart(2, '0');
}

// Fetch instant metadata using social crawler User-Agent (resolves in ~500ms)
async function fetchMetadata(videoUrl) {
    try {
        const res = await fetch(videoUrl, {
            headers: {
                'User-Agent': 'facebookexternalhit/1.1; Twitterbot/1.0',
                'Accept-Language': 'bn,en;q=0.9'
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(4500)
        });
        const html = await res.text();
        
        let title = '';
        let description = '';
        let author = '';
        
        // Page Title tag often contains full caption/description for reels/posts
        const pageTitleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
        if (pageTitleMatch) {
            const cleanTitle = decodeHtmlEntities(pageTitleMatch[1]).trim();
            if (cleanTitle && !cleanTitle.toLowerCase().includes('log in to facebook')) {
                description = cleanTitle;
            }
        }

        // og:title
        const titleMatch = html.match(/property="og:title" content="([^"]*)"/i)
                        || html.match(/name="twitter:title" content="([^"]*)"/i);
        if (titleMatch) {
            const rawTitle = decodeHtmlEntities(titleMatch[1]).trim();
            if (rawTitle.includes('Reel by ')) {
                author = rawTitle.split('Reel by ').pop().trim();
            } else if (rawTitle.includes('|')) {
                const parts = rawTitle.split('|').map(p => p.trim());
                author = parts[parts.length - 1];
            } else {
                author = rawTitle;
            }
            if (!description && rawTitle) {
                description = rawTitle;
            }
        }

        // og:description
        const descMatch = html.match(/property="og:description" content="([^"]*)"/i) 
                       || html.match(/name="twitter:description" content="([^"]*)"/i)
                       || html.match(/name="description" content="([^"]*)"/i);
        if (descMatch) {
            const d = decodeHtmlEntities(descMatch[1]).trim();
            if (d && !d.toLowerCase().includes('log in to facebook')) {
                description = d;
            }
        }

        // Clean up description trailer: remove " | <author> | Facebook" or " | Facebook"
        if (description) {
            if (author) {
                try {
                    const escapedAuthor = author.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                    const authorRegex = new RegExp(`\\s*\\|?\\s*${escapedAuthor}\\s*\\|?\\s*Facebook\\s*$`, 'i');
                    description = description.replace(authorRegex, '').trim();
                } catch (e) {}
            }
            description = description.replace(/\s*\|\s*Facebook\s*$/i, '').trim();
        }

        return { author, description, title: author || description };
    } catch (e) {
        return null;
    }
}

// Strategy 1: rahad-all-downloader-v2 (Ultra-fast GraphQL & direct extraction, ~1.2s)
async function extractViaAlldl(url) {
    try {
        const { alldl } = require('rahad-all-downloader-v2');
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('alldl timeout')), 6500));
        const res = await Promise.race([alldl(url), timeoutPromise]);
        
        if (res && res.data && res.data.download) {
            const hd = res.data.download.hd || null;
            const sd = res.data.download.sd || null;
            const thumbnail = res.data.thumbnail || '';
            
            // Extract exact duration from efg base64 payload if available
            let duration = '00:30';
            const sampleUrl = hd || sd || '';
            if (sampleUrl.includes('efg=')) {
                try {
                    const efgMatch = sampleUrl.match(/efg=([^&]+)/);
                    if (efgMatch) {
                        const decoded = JSON.parse(Buffer.from(decodeURIComponent(efgMatch[1]), 'base64').toString());
                        if (decoded.duration_s) {
                            duration = formatDuration(decoded.duration_s);
                        }
                    }
                } catch (e) {}
            }

            return {
                title: res.data.title || 'Facebook Video',
                author: res.data.title || 'Facebook Video',
                description: res.data.title || '',
                duration: duration,
                thumbnail: thumbnail,
                hd: hd,
                sd: sd
            };
        }
    } catch (e) {
        console.warn('alldl error:', e.message);
    }
    return null;
}

// Strategy 2: Direct Facebook Progressive Stream Extraction (Fallback)
async function extractDirect(url) {
    let finalUrl = url;
    try {
        const headRes = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(4500)
        });
        finalUrl = headRes.url || url;
    } catch (e) {}

    let mobileUrl = finalUrl;
    if (mobileUrl.includes('www.facebook.com')) {
        mobileUrl = mobileUrl.replace('www.facebook.com', 'm.facebook.com');
    } else if (mobileUrl.includes('web.facebook.com')) {
        mobileUrl = mobileUrl.replace('web.facebook.com', 'm.facebook.com');
    }

    const headers = {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Sec-Fetch-Mode': 'navigate'
    };

    const res = await fetch(mobileUrl, { headers, redirect: 'follow', signal: AbortSignal.timeout(4500) });
    const html = await res.text();

    let rawTitle = '';
    const titleMatch = html.match(/property="og:title" content="(.*?)"/i) || html.match(/<title>(.*?)<\/title>/i);
    if (titleMatch) {
        rawTitle = decodeHtmlEntities(titleMatch[1]).replace(/ - Facebook$/i, '').trim();
    }

    let description = '';
    const descMatch = html.match(/property="og:description" content="(.*?)"/i) || html.match(/name="description" content="(.*?)"/i);
    if (descMatch) {
        description = decodeHtmlEntities(descMatch[1]).trim();
    }

    let author = 'Facebook Video';
    let videoTitle = '';
    if (rawTitle.includes('|')) {
        const parts = rawTitle.split('|').map(p => p.trim()).filter(p => p && p.toLowerCase() !== 'facebook');
        if (parts.length >= 2) {
            author = parts[parts.length - 1];
            videoTitle = parts.slice(0, parts.length - 1).join(' - ');
        } else if (parts.length === 1) {
            author = parts[0];
            videoTitle = parts[0];
        }
    } else if (rawTitle) {
        author = rawTitle;
        videoTitle = rawTitle;
    }

    // If description has the full post caption, prioritize it as videoTitle if title is generic or author name
    if (description && description !== 'Facebook Video Download' && description !== 'No description available') {
        if (!videoTitle || videoTitle === author || videoTitle.toLowerCase() === 'facebook video') {
            videoTitle = description;
        }
    }

    if (!videoTitle) {
        videoTitle = description || author || 'Facebook Video';
    }

    let thumbnail = '';
    const thumbMatch = html.match(/property="og:image" content="(.*?)"/i) || html.match(/"image":\{"uri":"([^"]+)"\}/);
    if (thumbMatch) {
        thumbnail = thumbMatch[1]
            .replace(/&amp;/g, '&')
            .replace(/\\u00253A/g, ':')
            .replace(/\\u00252F/g, '/')
            .replace(/\\u0026/g, '&');
    }

    let duration = '00:30';
    const durMatch = html.match(/"duration_s":([0-9]+)/) || html.match(/duration_s%22%3A([0-9]+)/) || html.match(/"duration":([0-9]+)/);
    if (durMatch) {
        duration = formatDuration(durMatch[1]);
    }

    let hdUrl = null;
    let sdUrl = null;
    const hdRegex = /(?:browser_native_hd_url|playable_url_quality_hd|hd_src|hd_src_no_ratelimit)":"([^"]+)"/;
    const sdRegex = /(?:browser_native_sd_url|playable_url|sd_src|sd_src_no_ratelimit)":"([^"]+)"/;

    const hdMatch = html.match(hdRegex);
    if (hdMatch) {
        hdUrl = decodeURIComponent(hdMatch[1].replace(/\\u00253A/g, ':').replace(/\\u00252F/g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&'));
    }

    const sdMatch = html.match(sdRegex);
    if (sdMatch) {
        sdUrl = decodeURIComponent(sdMatch[1].replace(/\\u00253A/g, ':').replace(/\\u00252F/g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&'));
    }

    if (!sdUrl) {
        const allMp4Matches = html.match(/(https:\/\/[^"'\\]+?\.(mp4)[^"'\\]*)/gi);
        if (allMp4Matches && allMp4Matches.length > 0) {
            const uniqueUrls = [...new Set(allMp4Matches.map(u => {
                let c = u.replace(/\\u00253A/g, ':').replace(/\\u00252F/g, '/').replace(/\\u0026/g, '&').replace(/&amp;/g, '&');
                try { return decodeURIComponent(c); } catch { return c; }
            }))];
            sdUrl = uniqueUrls[0];
            if (uniqueUrls.length > 1 && !hdUrl) {
                hdUrl = uniqueUrls[1];
            }
        }
    }

    return {
        title: videoTitle,
        author: author || 'Facebook Video',
        description: description || videoTitle || 'No description available',
        duration: duration,
        thumbnail: thumbnail || '',
        sd: sdUrl || null,
        hd: hdUrl || null
    };
}

// Strategy 3: SnapSave (Secondary fallback with strict 4.5s timeout)
async function extractViaSnapSave(url) {
    try {
        const snapPromise = (async () => {
            const { snapsave } = await import('snapsave-media-downloader');
            return await snapsave(url);
        })();

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('SnapSave timeout')), 4500);
        });

        const res = await Promise.race([snapPromise, timeoutPromise]);
        if (res && res.success && res.data) {
            const data = res.data;
            let hdUrl = null;
            let sdUrl = null;
            let audioUrl = null;

            if (Array.isArray(data.media)) {
                for (const m of data.media) {
                    if (!m.url || m.shouldRender) continue;
                    const resStr = (m.resolution || '').toLowerCase();
                    if (resStr.includes('720') || resStr.includes('hd') || resStr.includes('1080')) {
                        if (!hdUrl) hdUrl = m.url;
                    } else if (resStr.includes('360') || resStr.includes('sd') || resStr.includes('480')) {
                        if (!sdUrl) sdUrl = m.url;
                    }
                }

                if (!hdUrl) {
                    const nonRender = data.media.find(m => m.url && !m.shouldRender);
                    if (nonRender) hdUrl = nonRender.url;
                }
                if (!sdUrl && data.media.length > 1) {
                    const lastNonRender = [...data.media].reverse().find(m => m.url && !m.shouldRender);
                    if (lastNonRender && lastNonRender.url !== hdUrl) {
                        sdUrl = lastNonRender.url;
                    }
                }

                for (const m of data.media) {
                    if (m.url && m.url.includes('token=')) {
                        try {
                            const token = m.url.split('token=')[1];
                            const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                            if (payload.audio_url) {
                                audioUrl = payload.audio_url;
                                break;
                            }
                        } catch (e) {}
                    }
                }
            }

            const desc = (data.description && data.description !== '...') ? data.description : '';
            return {
                title: desc ? desc.slice(0, 45) : '',
                author: '',
                description: desc,
                duration: '00:30',
                thumbnail: data.preview || '',
                sd: sdUrl || null,
                hd: hdUrl || null,
                audio: audioUrl || null
            };
        }
        if (res && res.message) {
            if (res.message.toLowerCase().includes('private')) {
                throw new Error('This video is private or restricted. Only public Facebook videos can be downloaded.');
            }
        }
    } catch (e) {
        if (e.message && e.message.includes('private')) throw e;
        console.error('SnapSave error:', e.message);
    }
    return null;
}

async function extractVideo(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') {
        throw new Error('Please provide a valid Facebook video URL');
    }

    let url = rawUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    // Step 1: Run ultra-fast Alldl + Social Metadata crawler in parallel (~1.2 - 1.5s)
    const [alldlPromise, metaPromise] = [
        extractViaAlldl(url).catch(() => null),
        fetchMetadata(url).catch(() => null)
    ];

    const [alldlData, metaData] = await Promise.all([alldlPromise, metaPromise]);

    if (alldlData && (alldlData.hd || alldlData.sd)) {
        const author = metaData?.author || alldlData.title || 'Facebook Video';
        let description = metaData?.description || alldlData.description || 'Facebook Video Download';
        let title = metaData?.title || description || alldlData.title || author;
        if ((!title || title === 'Facebook Video' || title === author) && description && description !== 'Facebook Video Download') {
            title = description;
        }
        const duration = alldlData.duration || '00:30';
        const thumbnail = alldlData.thumbnail || '';
        let hdLink = alldlData.hd || alldlData.sd;
        let sdLink = (alldlData.sd && alldlData.sd !== alldlData.hd) ? alldlData.sd : null;

        // If alldl only provided one quality, check SnapSave & Direct crawler to see if distinct streams exist
        if (!sdLink || hdLink === sdLink) {
            try {
                const [snapData, directData] = await Promise.all([
                    extractViaSnapSave(url).catch(() => null),
                    extractDirect(url).catch(() => null)
                ]);
                if (snapData?.hd && snapData?.sd && snapData.hd !== snapData.sd) {
                    hdLink = snapData.hd;
                    sdLink = snapData.sd;
                } else if (directData?.hd && directData?.sd && directData.hd !== directData.sd) {
                    hdLink = directData.hd;
                    sdLink = directData.sd;
                } else if (snapData?.sd && snapData.sd !== hdLink) {
                    sdLink = snapData.sd;
                } else if (directData?.sd && directData.sd !== hdLink) {
                    sdLink = directData.sd;
                }
            } catch (e) {}
        }

        if (!sdLink) {
            sdLink = hdLink;
        }

        return {
            title: title || author || 'Facebook Video',
            author: author,
            description: description,
            duration: duration,
            thumbnail: thumbnail,
            sd: sdLink,
            hd: hdLink,
            audio: null
        };
    }

    // Step 2: Fallback to Direct Progressive Stream & SnapSave if primary engine did not find media
    console.warn('Primary engine missed media, running secondary fallbacks...');
    const [snapRes, directRes] = await Promise.allSettled([
        extractViaSnapSave(url),
        extractDirect(url)
    ]);

    const snapData = snapRes.status === 'fulfilled' ? snapRes.value : null;
    const directData = directRes.status === 'fulfilled' ? directRes.value : null;

    if (snapRes.status === 'rejected' && snapRes.reason?.message?.includes('private')) {
        throw snapRes.reason;
    }

    const hdLink = (snapData && snapData.hd) || (directData && directData.hd) || (snapData ? snapData.sd : (directData ? directData.sd : null));
    let sdLink = (directData && directData.sd && directData.sd !== hdLink) ? directData.sd : ((snapData && snapData.sd && snapData.sd !== hdLink) ? snapData.sd : (directData ? directData.sd : (snapData ? snapData.sd : hdLink)));

    if (!hdLink && !sdLink) {
        throw new Error('Video could not be downloaded. It might be private, restricted, or deleted.');
    }

    const author = (metaData && metaData.author) || (directData && directData.author) || (snapData && snapData.title) || 'Facebook Video';
    const description = (metaData && metaData.description) || (directData && directData.description) || (snapData && snapData.description) || 'Facebook Video Download';
    let title = (metaData && metaData.title) || description || (directData && directData.title) || (snapData && snapData.title) || author;
    if ((!title || title === 'Facebook Video' || title === author) && description && description !== 'Facebook Video Download') {
        title = description;
    }
    const thumbnail = (directData && directData.thumbnail) || (snapData && snapData.thumbnail) || '';
    const duration = (directData && directData.duration) || '00:30';
    const audioLink = (snapData && snapData.audio) ? snapData.audio : null;

    return {
        title: title || author || 'Facebook Video',
        author: author,
        description: description,
        duration,
        thumbnail,
        sd: sdLink,
        hd: hdLink,
        audio: audioLink
    };
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        let videoUrl = '';
        if (req.method === 'POST') {
            const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
            videoUrl = body.url || body.URLz || '';
        }
        if (!videoUrl && req.query) {
            videoUrl = req.query.url || req.query.URLz || '';
        }

        if (!videoUrl) {
            return res.status(400).json({ success: false, error: 'Facebook video URL is required' });
        }

        const data = await extractVideo(videoUrl);
        return res.status(200).json({ success: true, ...data });
    } catch (err) {
        console.error('Download handler error:', err.message);
        return res.status(500).json({
            success: false,
            error: err.message || 'Failed to download video. Please check the URL and try again.'
        });
    }
};
