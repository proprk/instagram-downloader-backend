const express = require('express');
const axios = require('axios');
const router = express.Router();
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');

// Helper function for waiting
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// More comprehensive user agents with real browser fingerprints
const getBrowserFingerprint = () => {
    const fingerprints = [
        {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1920, height: 1080 },
            platform: 'Win32'
        },
        {
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1440, height: 900 },
            platform: 'MacIntel'
        },
        {
            userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1366, height: 768 },
            platform: 'Linux x86_64'
        }
    ];
    return fingerprints[Math.floor(Math.random() * fingerprints.length)];
};

// Instagram's GraphQL endpoint approach
const tryGraphQLMethod = async (postId) => {
    try {
        console.log("Attempting GraphQL method...");
        
        // Try to get the shortcode media info
        const graphqlUrl = 'https://www.instagram.com/graphql/query/';
        const queryHash = '8c2a529969ee035a5063f2fc8602a0fd'; // This changes periodically
        
        const response = await axios.get(graphqlUrl, {
            params: {
                query_hash: queryHash,
                variables: JSON.stringify({
                    shortcode: postId,
                    include_reel: false,
                    include_logged_out: true
                })
            },
            headers: {
                'User-Agent': getBrowserFingerprint().userAgent,
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `https://www.instagram.com/p/${postId}/`,
            }
        });

        if (response.data && response.data.data && response.data.data.shortcode_media) {
            const media = response.data.data.shortcode_media;
            if (media.is_video && media.video_url) {
                return media.video_url;
            }
        }
    } catch (err) {
        console.log("GraphQL method failed:", err.message);
    }
    return null;
};

// Alternative: Try Instagram's internal API endpoints
const tryInternalAPI = async (postId) => {
    try {
        console.log("Attempting internal API method...");
        
        // Instagram sometimes exposes content through this endpoint
        const apiUrl = `https://www.instagram.com/api/v1/media/${postId}/info/`;
        
        const response = await axios.get(apiUrl, {
            headers: {
                'User-Agent': getBrowserFingerprint().userAgent,
                'X-Instagram-AJAX': '1',
                'X-Requested-With': 'XMLHttpRequest',
                'Referer': `https://www.instagram.com/p/${postId}/`,
                'Accept': 'application/json, text/plain, */*',
            }
        });

        if (response.data && response.data.items && response.data.items[0]) {
            const item = response.data.items[0];
            if (item.video_versions && item.video_versions[0]) {
                return item.video_versions[0].url;
            }
        }
    } catch (err) {
        console.log("Internal API method failed:", err.message);
    }
    return null;
};

// Enhanced Puppeteer with stealth techniques
const tryStealthPuppeteer = async (url) => {
    let browser;
    try {
        console.log("Launching stealth Puppeteer...");
        
        const fingerprint = getBrowserFingerprint();
        
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-blink-features=AutomationControlled',
                '--disable-features=VizDisplayCompositor',
                '--window-size=1920,1080',
                '--disable-web-security',
                '--disable-extensions',
                '--no-first-run',
                '--disable-client-side-phishing-detection',
                '--disable-component-extensions-with-background-pages',
                '--disable-default-apps',
                '--mute-audio',
                '--no-default-browser-check',
                '--autoplay-policy=user-gesture-required',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-features=TranslateUI',
                '--disable-ipc-flooding-protection'
            ]
        });

        const page = await browser.newPage();

        // Anti-detection measures
        await page.evaluateOnNewDocument(() => {
            // Remove webdriver property
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined,
            });

            // Mock languages and plugins
            Object.defineProperty(navigator, 'languages', {
                get: () => ['en-US', 'en'],
            });

            Object.defineProperty(navigator, 'plugins', {
                get: () => [1, 2, 3, 4, 5],
            });

            // Override the chrome property to mimic a real browser
            window.chrome = {
                runtime: {},
            };

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Cypress.minimist(process.argv.slice(2)).headed ? 'granted' : 'default' }) :
                    originalQuery(parameters)
            );
        });

        await page.setViewport(fingerprint.viewport);
        await page.setUserAgent(fingerprint.userAgent);

        // Set extra headers
        await page.setExtraHTTPHeaders({
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache',
            'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': `"${fingerprint.platform}"`,
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        });

        // Enhanced request interception
        await page.setRequestInterception(true);
        const capturedVideos = [];

        page.on('request', (request) => {
            const url = request.url();
            const resourceType = request.resourceType();

            // Allow essential requests only
            if (
                url.includes('instagram.com') ||
                url.includes('cdninstagram.com') ||
                url.includes('fbcdn.net') ||
                resourceType === 'document' ||
                resourceType === 'script' ||
                (resourceType === 'media' && url.includes('.mp4'))
            ) {
                request.continue();
            } else {
                request.abort();
            }
        });

        page.on('response', async (response) => {
            const responseUrl = response.url();
            if (response.status() === 200 && responseUrl.includes('.mp4') && responseUrl.includes('scontent')) {
                console.log(`Video URL captured: ${responseUrl.substring(0, 100)}...`);
                capturedVideos.push(responseUrl);
            }
        });

        // Navigate with realistic timing
        console.log("Navigating to Instagram...");
        await page.goto(url, { 
            waitUntil: 'networkidle0', 
            timeout: 45000 
        });

        // Simulate human-like behavior
        await wait(2000 + Math.random() * 3000);

        // Handle any modals/popups
        try {
            await page.keyboard.press('Escape');
            await wait(1000);

            // Try clicking close buttons
            const closeSelectors = [
                '[aria-label="Close"]',
                'button[aria-label="Close"]',
                '[role="dialog"] button',
                'svg[aria-label="Close"]'
            ];

            for (const selector of closeSelectors) {
                try {
                    await page.waitForSelector(selector, { timeout: 2000 });
                    await page.click(selector);
                    await wait(1000);
                    break;
                } catch (e) {
                    // Continue to next selector
                }
            }
        } catch (e) {
            console.log("No modals to handle");
        }

        // Wait for content to load
        await wait(5000);

        // Scroll and interact to trigger video loading
        await page.evaluate(() => {
            // Scroll to center
            window.scrollTo(0, document.body.scrollHeight / 2);
            
            // Find and click video elements
            const videos = document.querySelectorAll('video');
            const articles = document.querySelectorAll('article');
            
            videos.forEach(video => {
                video.scrollIntoView({ behavior: 'smooth', block: 'center' });
                if (video.load) video.load();
                // Try to play (will likely be blocked but might trigger loading)
                video.play().catch(() => {});
                
                // Click on parent elements
                const parent = video.closest('div');
                if (parent) parent.click();
            });

            // Click on article elements (Instagram post containers)
            articles.forEach(article => {
                const rect = article.getBoundingClientRect();
                if (rect.top >= 0 && rect.left >= 0) {
                    article.click();
                }
            });
        });

        // Give more time for video loading
        await wait(10000);

        // Try to extract video from DOM
        const domVideo = await page.evaluate(() => {
            const videos = document.querySelectorAll('video');
            for (const video of videos) {
                if (video.src && video.src.includes('.mp4')) {
                    return video.src;
                }
                if (video.currentSrc && video.currentSrc.includes('.mp4')) {
                    return video.currentSrc;
                }
            }
            return null;
        });

        await browser.close();

        return capturedVideos[0] || domVideo;

    } catch (error) {
        if (browser) await browser.close();
        console.log("Stealth Puppeteer failed:", error.message);
        return null;
    }
};

// Try external services as last resort
const tryExternalService = async (url) => {
    try {
        console.log("Attempting external service...");
        
        // You can integrate with services like:
        // - RapidAPI Instagram downloaders
        // - Third-party scraping services
        // This is just a placeholder for the concept
        
        const response = await axios.post('https://api.example-service.com/instagram', {
            url: url
        }, {
            headers: {
                'X-API-Key': process.env.EXTERNAL_API_KEY || 'your-api-key'
            },
            timeout: 15000
        });

        if (response.data && response.data.video_url) {
            return response.data.video_url;
        }
    } catch (error) {
        console.log("External service failed:", error.message);
    }
    return null;
};

router.post("/", async (req, res) => {
    const { url } = req.body;

    if (!url) {
        return res.status(400).json({ error: "Enter a URL" });
    }

    try {
        const parsedUrl = new URL(url);

        if (
            parsedUrl.hostname === "www.instagram.com" ||
            parsedUrl.hostname === "instagram.com" ||
            parsedUrl.hostname === "instagr.am"
        ) {
            let title, image, video;
            const methods = {
                directFetch: false,
                graphql: false,
                internalAPI: false,
                puppeteer: false,
                external: false
            };

            // Extract post ID
            const postIdMatch = url.match(/\/p\/([^\/\?]+)/);
            const postId = postIdMatch ? postIdMatch[1] : null;

            if (!postId) {
                return res.status(400).json({
                    success: false,
                    error: "Could not extract post ID from URL"
                });
            }

            console.log(`Processing Instagram post: ${postId}`);

            // Method 1: Direct fetch for basic metadata
            try {
                console.log("Fetching basic metadata...");
                const response = await axios.get(url, {
                    headers: {
                        'User-Agent': getBrowserFingerprint().userAgent,
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                        'Accept-Language': 'en-US,en;q=0.5',
                        'Cache-Control': 'no-cache',
                        'Pragma': 'no-cache'
                    },
                    timeout: 15000
                });

                const $ = cheerio.load(response.data);
                title = $('meta[property="og:title"]').attr("content") || $('title').text();
                image = $('meta[property="og:image"]').attr("content");
                video = $('meta[property="og:video"]').attr("content");

                methods.directFetch = true;
                console.log("Basic metadata extracted successfully");
            } catch (error) {
                console.log("Direct fetch failed:", error.message);
            }

            // Method 2: Try GraphQL if no video found
            if (!video) {
                video = await tryGraphQLMethod(postId);
                if (video) methods.graphql = true;
            }

            // Method 3: Try internal API
            if (!video) {
                video = await tryInternalAPI(postId);
                if (video) methods.internalAPI = true;
            }

            // Method 4: Stealth Puppeteer
            if (!video) {
                video = await tryStealthPuppeteer(url);
                if (video) methods.puppeteer = true;
            }

            // Method 5: External service (if configured)
            if (!video && process.env.EXTERNAL_API_KEY) {
                video = await tryExternalService(url);
                if (video) methods.external = true;
            }

            return res.json({
                success: true,
                data: {
                    title,
                    image,
                    video,
                    url,
                    postId
                },
                methods,
                message: video ? "Video extracted successfully" : "Video could not be extracted - Instagram may be blocking access"
            });

        } else {
            return res.status(400).json({
                success: false,
                error: "Enter a valid Instagram URL"
            });
        }

    } catch (err) {
        console.error('Main error:', err.message);
        return res.status(500).json({
            success: false,
            error: "Failed to process Instagram URL: " + err.message
        });
    }
});

module.exports = router;