// Facebook Video Downloader Client Controller
// Handles fast extraction, dual-quality downloads without opening blank tabs or reloading

let currentVideoData = null;

async function handleDownload(e) {
    if (e) {
        if (e.preventDefault) e.preventDefault();
        if (e.stopPropagation) e.stopPropagation();
    }
    const input = document.getElementById('downloadinput');
    const button = document.getElementById('downloadbtn');
    const progress = document.getElementById('progress');
    const progressBar = document.getElementById('progressbar');
    const errorContainer = document.getElementById('error-container');

    const url = input ? input.value.trim() : '';
    if (!url) {
        showError('Please paste a valid Facebook video link.');
        return false;
    }

    if (errorContainer) errorContainer.style.display = 'none';

    if (button) {
        button.disabled = true;
        button.innerHTML = '<span class="glyphicon glyphicon-refresh" style="display:inline-block;animation:spin 1s infinite linear;"></span> Processing...';
    }
    if (progress) progress.style.width = '100%';
    if (progressBar) progressBar.style.width = '45%';

    let progressInterval = setInterval(() => {
        if (progressBar) {
            let cur = parseFloat(progressBar.style.width) || 45;
            if (cur < 92) progressBar.style.width = (cur + 10) + '%';
        }
    }, 150);

    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 40000);

    try {
        const response = await fetch('/api/download?url=' + encodeURIComponent(url), {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: abortCtrl.signal
        });
        clearTimeout(timeoutId);

        const data = await response.json();
        clearInterval(progressInterval);

        if (progressBar) progressBar.style.width = '100%';

        setTimeout(() => {
            if (progress) progress.style.width = '0%';
            if (progressBar) progressBar.style.width = '0%';
            if (button) {
                button.disabled = false;
                button.innerHTML = '<strong><span class="glyphicon glyphicon-arrow-down" aria-hidden="true"></span> Download</strong>';
            }

            if (data.success) {
                showResult(data);
            } else {
                showError(data.error || 'Could not download video. Please make sure the post is public.');
            }
        }, 120);
    } catch (err) {
        clearTimeout(timeoutId);
        clearInterval(progressInterval);
        if (progress) progress.style.width = '0%';
        if (progressBar) progressBar.style.width = '0%';
        if (button) {
            button.disabled = false;
            button.innerHTML = '<strong><span class="glyphicon glyphicon-arrow-down" aria-hidden="true"></span> Download</strong>';
        }
        showError(err.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Network error or server unavailable. Please try again.');
    }
    return false;
}

function showResult(data) {
    try {
        currentVideoData = data;

        const homeView = document.getElementById('home-view');
        const resultView = document.getElementById('result-view');
        const cardThumbnail = document.getElementById('card-thumbnail');
        const cardAuthor = document.getElementById('card-author');
        const cardDescription = document.getElementById('card-description');
        const cardDuration = document.getElementById('card-duration');

        if (!resultView) return;

        // Switch Views immediately
        if (homeView) homeView.style.display = 'none';
        resultView.style.display = 'block';

        // Set Thumbnail
        if (cardThumbnail && data.thumbnail) {
            cardThumbnail.src = data.thumbnail;
        }

        // Set Author / Title
        if (cardAuthor) {
            cardAuthor.textContent = data.author || data.title || 'Facebook Video';
        }

        // Set Description
        if (cardDescription) {
            cardDescription.textContent = data.description || 'Facebook Video Download';
        }

        // Set Duration
        if (cardDuration) {
            cardDuration.textContent = data.duration || '00:30';
        }
        const cardDurationText = document.getElementById('card-duration-text');
        if (cardDurationText) {
            cardDurationText.textContent = data.duration || '00:30';
        }

        // Scroll smoothly to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
        console.error('Error in showResult:', e);
    }
}

// In-page download trigger: Zero blank tabs, Zero page reloads!
// Keeps button UI unchanged (Image 2 style) and starts download instantly for IDM and browser downloaders
function triggerDownload(quality, event) {
    if (event) {
        // Prevent default form submission or anchor jumps
        event.preventDefault();
    }

    if (!currentVideoData) {
        showError('No active video found. Please download again.');
        return;
    }

    const isHd = quality === 'hd';
    const hdUrl = currentVideoData.hd;
    const sdUrl = currentVideoData.sd;
    const areDistinct = Boolean(hdUrl && sdUrl && hdUrl !== sdUrl);

    let url;
    let shouldDownscale = false;

    if (isHd) {
        // HD Quality: always download in original highest resolution available
        url = hdUrl || sdUrl;
    } else {
        // Normal Quality (SD):
        if (areDistinct) {
            // Upstream already has distinct SD stream (e.g. 360p)
            url = sdUrl;
        } else {
            // Upstream only has 1 stream -> use stream and downscale to true 480p SD
            url = sdUrl || hdUrl;
            shouldDownscale = true;
        }
    }

    if (!url || url === '#') {
        showError('Download link not available for this resolution.');
        return;
    }

    // Build clean, full video filename ending in _HD or _SD
    const filename = getDownloadFilename(quality);

    // Stream URL with Content-Disposition: attachment for IDM & native browser downloaders
    const streamUrl = `/api/stream?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}&quality=${quality}${shouldDownscale ? '&downscale=true' : ''}`;

    // Note: Button text remains completely unchanged (Image 2 style - no "Downloading..." text change)

    // Trigger exactly ONE download via standard hidden anchor click (avoiding duplicate downloads)
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = streamUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        if (a.parentNode) document.body.removeChild(a);
    }, 1500);
}

// Helper to generate full video filename ending in _HD.mp4 or _SD.mp4
function getDownloadFilename(quality) {
    if (!currentVideoData) return `Facebook_Video_${quality.toUpperCase()}.mp4`;

    let rawName = currentVideoData.title;
    if ((!rawName || rawName === 'Facebook Video' || rawName === currentVideoData.author) && currentVideoData.description && currentVideoData.description !== 'Facebook Video Download') {
        rawName = currentVideoData.description;
    }
    if (!rawName || rawName === 'Facebook Video') {
        rawName = currentVideoData.author || 'Facebook_Video';
    }

    // Join lines cleanly to keep the entire video name/caption
    let cleanName = rawName
        .replace(/[\r\n]+/g, ' ')
        .replace(/[/\\?%*:|"<>]/g, '_')
        .replace(/\s+/g, ' ')
        .trim();

    // Respect OS filename length (120 chars) to prevent Windows path limits
    if (cleanName.length > 120) {
        cleanName = cleanName.slice(0, 120).trim();
    }

    if (!cleanName) cleanName = 'Facebook_Video';
    const suffix = quality.toUpperCase();
    return `${cleanName}_${suffix}.mp4`;
}



function resetToHome() {
    const homeView = document.getElementById('home-view');
    const resultView = document.getElementById('result-view');
    const input = document.getElementById('downloadinput');
    const errorContainer = document.getElementById('error-container');

    if (resultView) resultView.style.display = 'none';
    if (errorContainer) errorContainer.style.display = 'none';
    if (homeView) homeView.style.display = 'block';

    if (input) {
        input.value = '';
        input.focus();
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // Reset more options dropdown
    const dropdown = document.getElementById('more-options-dropdown');
    const arrow = document.getElementById('options-arrow');
    const btn = document.getElementById('toggle-options-btn');
    if (dropdown) dropdown.style.display = 'none';
    if (arrow) arrow.textContent = '▼';
    if (btn) btn.style.border = 'none';

    homeView.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function toggleMoreOptions() {
    const dropdown = document.getElementById('more-options-dropdown');
    const arrow = document.getElementById('options-arrow');
    const btn = document.getElementById('toggle-options-btn');
    if (!dropdown) return;

    if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
        if (arrow) arrow.textContent = '▲';
        if (btn) btn.style.border = '2px solid #1e394f';
    } else {
        dropdown.style.display = 'none';
        if (arrow) arrow.textContent = '▼';
        if (btn) btn.style.border = 'none';
    }
}

function showError(msg) {
    const errorContainer = document.getElementById('error-container');
    if (!errorContainer) return;
    errorContainer.innerHTML = `
        <div class="alert alert-danger alert-dismissible" role="alert" style="border-radius: 6px; font-weight: 500; text-align: left; margin-top: 15px;">
            <button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button>
            <span class="glyphicon glyphicon-exclamation-sign" aria-hidden="true"></span> <strong>Error:</strong> ${msg}
        </div>
    `;
    errorContainer.style.display = 'block';
}

// Paste and trash buttons
document.addEventListener('DOMContentLoaded', function () {
    const input = document.getElementById('downloadinput');
    const pbutton = document.getElementById('paste-button');
    const icon = document.getElementById('paste-icon');

    function updateButton() {
        if (!input || !icon || !pbutton) return;
        if (input.value !== '') {
            icon.className = 'glyphicon glyphicon-trash';
            pbutton.style.setProperty('font-size', '2rem', 'important');
            pbutton.style.setProperty('padding-top', '0.5rem', 'important');
        } else {
            icon.className = 'glyphicon glyphicon-paste';
            pbutton.style.setProperty('font-size', '2.2rem', 'important');
            pbutton.style.removeProperty('padding-top');
        }
    }

    if (pbutton && input) {
        pbutton.addEventListener('click', function () {
            if (input.value !== '') {
                input.value = '';
                updateButton();
                input.focus();
                return;
            }
            if (navigator.clipboard && navigator.clipboard.readText) {
                navigator.clipboard.readText().then(text => {
                    input.value = text;
                    updateButton();
                    input.focus();
                }).catch(err => {
                    console.error('Clipboard access error:', err);
                });
            }
        });
        input.addEventListener('input', updateButton);
        updateButton();
    }
});

// How to Use FBDock Modal Step Navigation
window.stepHowTo = function (type, dir) {
    if (!window.jQuery) return;
    var carouselId = '#carousel-' + type;
    var $carousel = $(carouselId);
    var $items = $carousel.find('.carousel-inner .item');
    var total = $items.length;
    var current = $carousel.find('.carousel-inner .item.active').index();
    if (current === -1) current = 0;

    var nextIndex;
    if (dir === 'next') {
        if (current === total - 1) {
            $('#fbdock_howto').modal('hide');
            return;
        }
        nextIndex = current + 1;
    } else if (dir === 'prev') {
        if (current === 0) return;
        nextIndex = current - 1;
    } else {
        nextIndex = parseInt(dir, 10);
    }

    $carousel.carousel(nextIndex);
};

window.updateHowToUI = function (type, index) {
    if (!window.jQuery) return;
    var total = 3;
    $('#' + type + '-step-num').text(index + 1);

    // Update dots
    for (var i = 0; i < total; i++) {
        var $dot = $('#' + type + '-dot-' + i);
        if (i === index) {
            $dot.addClass('active');
        } else {
            $dot.removeClass('active');
        }
    }

    // Update Prev button
    var $prevBtn = $('#' + type + '-prev-btn');
    $prevBtn.prop('disabled', index === 0);

    // Update Next button
    var $nextBtn = $('#' + type + '-next-btn');
    if (index === total - 1) {
        $nextBtn.html('Finish <span class="glyphicon glyphicon-ok" style="font-size:11px;margin-left:2px;"></span>');
        $nextBtn.removeClass('next-btn').addClass('finish-btn');
    } else {
        $nextBtn.html('Next <span class="glyphicon glyphicon-chevron-right" style="font-size:10px;margin-left:2px;"></span>');
        $nextBtn.removeClass('finish-btn').addClass('next-btn');
    }
};

$(document).ready(function () {
    if (!window.jQuery) return;
    $('#carousel-pcmac').on('slid.bs.carousel', function () {
        var idx = $(this).find('.carousel-inner .item.active').index();
        if (idx !== -1) window.updateHowToUI('pcmac', idx);
    });
    $('#carousel-ios').on('slid.bs.carousel', function () {
        var idx = $(this).find('.carousel-inner .item.active').index();
        if (idx !== -1) window.updateHowToUI('ios', idx);
    });

    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        var target = $(e.target).attr('href');
        if (target === '#pcmac' || target === '#ios') {
            var type = target.replace('#', '');
            var $carousel = $('#carousel-' + type);
            $carousel.carousel(0);
            window.updateHowToUI(type, 0);
        }
    });
});
