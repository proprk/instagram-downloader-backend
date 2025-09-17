const express = require('express');
const axios = require('axios');
const router = express.Router();

// Third-party service configurations
const services = {
    // RapidAPI Instagram Downloader
    rapidAPI: {
        url: 'https://instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com/get-info-rapidapi',
        headers: {
            'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
            'X-RapidAPI-Host': 'instagram-downloader-download-instagram-videos-stories1.p.rapidapi.com'
        }
    },
    
    // Alternative service 1
    instaloader: {
        url: 'https://api.instaloader.org/post',
        headers: {
            'User-Agent': 'Instagram-Downloader-Bot/1.0'
        }
    },
    
    // Alternative service 2 (example)
    downloadGram: {
        url: 'https://downloadgram.org/api/instagram/media',
        headers: {
            'Content-Type': 'application/json'
        }
    }
};

// Service 1: RapidAPI Instagram Downloader
const tryRapidAPI = async (url) => {
    try {
        if (!process.env.RAPIDAPI_KEY) {
            console.log("RapidAPI key not configured");
            return null;
        }

        console.log("Trying RapidAPI Instagram Downloader...");
        
        const response = await axios.get(services.rapidAPI.url, {
            params: {
                url: url
            },
            headers: services.rapidAPI.headers,
            timeout: 30000
        });

        if (response.data && response.data.status === 'success') {
            const data = response.data.result;
            return {
                title: data.title || data.caption,
                image: data.thumbnail || data.image_url,
                video: data.video_url || data.download_url,
                service: 'RapidAPI'
            };
        }
    } catch (error) {
        console.log("RapidAPI failed:", error.message);
    }
    return null;
};

// Service 2: Generic API approach
const tryGenericAPI = async (url, serviceName, serviceConfig) => {
    try {
        console.log(`Trying ${serviceName}...`);
        
        const requestData = {
            url: url,
            format: 'json'
        };

        const response = await axios.post(serviceConfig.url, requestData, {
            headers: serviceConfig.headers,
            timeout: 25000
        });

        if (response.data && response.data.success) {
            return {
                title: response.data.title,
                image: response.data.thumbnail,
                video: response.data.video_url,
                service: serviceName
            };
        }
    } catch (error) {
        console.log(`${serviceName} failed:`, error.message);
    }
    return null;
};

// Service 3: Instagram video download using yt-dlp (server-side)
const tryYTDLP = async (url) => {
    try {
        console.log("Trying yt-dlp method...");
        
        const { spawn } = require('child_process');
        
        return new Promise((resolve, reject) => {
            const ytdlp = spawn('yt-dlp', [
                '--dump-json',
                '--no-download',
                '--format', 'best[ext=mp4]',
                url
            ]);

            let output = '';
            let errorOutput = '';

            ytdlp.stdout.on('data', (data) => {
                output += data.toString();
            });

            ytdlp.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            ytdlp.on('close', (code) => {
                if (code === 0) {
                    try {
                        const info = JSON.parse(output);
                        resolve({
                            title: info.title || info.description,
                            image: info.thumbnail,
                            video: info.url,
                            service: 'yt-dlp'
                        });
                    } catch (parseError) {
                        reject(new Error('Failed to parse yt-dlp output'));
                    }
                } else {
                    reject(new Error(`yt-dlp failed with code ${code}: ${errorOutput}`));
                }
            });

            // Timeout after 30 seconds
            setTimeout(() => {
                ytdlp.kill();
                reject(new Error('yt-dlp timeout'));
            }, 30000);
        });
    } catch (error) {
        console.log("yt-dlp failed:", error.message);
        return null;
    }
};

// Service 4: Web scraping service
const tryWebScrapingService = async (url) => {
    try {
        console.log("Trying web scraping service...");
        
        // This would be a custom service you set up
        const response = await axios.post('https://your-scraping-service.com/api/instagram', {
            url: url,
            options: {
                headless: true,
                stealth: true,
                timeout: 30000
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.SCRAPING_SERVICE_TOKEN}`,
                'Content-Type': 'application/json'
            },
            timeout: 35000
        });

        if (response.data && response.data.success) {
            return {
                title: response.data.title,
                image: response.data.image,
                video: response.data.video,
                service: 'Custom Scraping Service'
            };
        }
    } catch (error) {
        console.log("Web scraping service failed:", error.message);
    }
    return null;
};

// Service 5: Public Instagram API alternatives
const tryPublicAPIs = async (url) => {
    const postId = url.match(/\/p\/([^\/\?]+)/)?.[1];
    if (!postId) return null;

    const publicAPIs = [
        {
            name: 'Instagram Basic Display',
            url: `https://graph.instagram.com/${postId}`,
            params: {
                fields: 'id,media_type,media_url,permalink,thumbnail_url,timestamp',
                access_token: process.env.INSTAGRAM_ACCESS_TOKEN
            }
        }
    ];

    for (const api of publicAPIs) {
        try {
            if (!process.env.INSTAGRAM_ACCESS_TOKEN) continue;
            
            console.log(`Trying ${api.name}...`);
            
            const response = await axios.get(api.url, {
                params: api.params,
                timeout: 15000
            });

            if (response.data && response.data.media_url) {
                return {
                    title: null,
                    image: response.data.thumbnail_url,
                    video: response.data.media_type === 'VIDEO' ? response.data.media_url : null,
                    service: api.name
                };
            }
        } catch (error) {
            console.log(`${api.name} failed:`, error.message);
        }
    }
    return null;
};

// Main route handler for third-party services
router.post("/", async (req, res) => {
    const { url, preferredService } = req.body;

    if (!url) {
        return res.status(400).json({ error: "URL is required" });
    }

    try {
        const parsedUrl = new URL(url);
        
        if (!['www.instagram.com', 'instagram.com', 'instagr.am'].includes(parsedUrl.hostname)) {
            return res.status(400).json({
                success: false,
                error: "Please provide a valid Instagram URL"
            });
        }

        console.log(`\n=== Processing Instagram URL with Third-Party Services ===`);
        console.log(`URL: ${url}`);

        let result = null;
        const attempts = [];

        // Define service order (you can customize this)
        const serviceOrder = preferredService ? 
            [preferredService, ...Object.keys(services).filter(s => s !== preferredService)] :
            ['rapidAPI', 'ytdlp', 'webScraping', 'publicAPIs'];

        // Try each service in order
        for (const serviceName of serviceOrder) {
            console.log(`\nTrying service: ${serviceName}`);
            
            let serviceResult = null;
            const startTime = Date.now();
            
            try {
                switch (serviceName) {
                    case 'rapidAPI':
                        serviceResult = await tryRapidAPI(url);
                        break;
                    case 'ytdlp':
                        serviceResult = await tryYTDLP(url);
                        break;
                    case 'webScraping':
                        serviceResult = await tryWebScrapingService(url);
                        break;
                    case 'publicAPIs':
                        serviceResult = await tryPublicAPIs(url);
                        break;
                    default:
                        if (services[serviceName]) {
                            serviceResult = await tryGenericAPI(url, serviceName, services[serviceName]);
                        }
                        break;
                }
            } catch (error) {
                console.log(`Service ${serviceName} error:`, error.message);
            }

            const duration = Date.now() - startTime;
            
            attempts.push({
                service: serviceName,
                success: !!serviceResult,
                duration: duration,
                result: serviceResult ? 'Found video' : 'No video found'
            });

            if (serviceResult && serviceResult.video) {
                result = serviceResult;
                console.log(`✓ Success with ${serviceName} (${duration}ms)`);
                break;
            } else {
                console.log(`✗ Failed with ${serviceName} (${duration}ms)`);
            }
        }

        // If no service worked, provide detailed feedback
        if (!result) {
            console.log('\n=== All services failed ===');
            attempts.forEach(attempt => {
                console.log(`${attempt.service}: ${attempt.result} (${attempt.duration}ms)`);
            });

            return res.json({
                success: false,
                message: "Could not extract video from any available service",
                data: {
                    url: url,
                    title: null,
                    image: null,
                    video: null
                },
                attempts: attempts,
                suggestions: [
                    "Try a different Instagram post",
                    "Check if the post actually contains a video",
                    "Verify your API keys are configured correctly",
                    "The post might be private or restricted"
                ]
            });
        }

        console.log(`\n=== Success! ===`);
        console.log(`Service used: ${result.service}`);
        console.log(`Title: ${result.title ? 'Found' : 'Not found'}`);
        console.log(`Video: ${result.video ? 'Found' : 'Not found'}`);

        return res.json({
            success: true,
            data: {
                title: result.title,
                image: result.image,
                video: result.video,
                url: url
            },
            serviceUsed: result.service,
            attempts: attempts,
            message: `Video successfully extracted using ${result.service}`
        });

    } catch (error) {
        console.error('Main error:', error.message);
        return res.status(500).json({
            success: false,
            error: `Failed to process Instagram URL: ${error.message}`,
            attempts: attempts || []
        });
    }
});

// Health check endpoint for services
router.get("/health", async (req, res) => {
    const healthChecks = {};

    // Check RapidAPI
    healthChecks.rapidAPI = {
        configured: !!process.env.RAPIDAPI_KEY,
        status: process.env.RAPIDAPI_KEY ? 'ready' : 'missing API key'
    };

    // Check yt-dlp installation
    try {
        const { execSync } = require('child_process');
        execSync('yt-dlp --version', { stdio: 'ignore' });
        healthChecks.ytdlp = { configured: true, status: 'installed' };
    } catch (error) {
        healthChecks.ytdlp = { configured: false, status: 'not installed' };
    }

    // Check custom scraping service
    healthChecks.webScraping = {
        configured: !!process.env.SCRAPING_SERVICE_TOKEN,
        status: process.env.SCRAPING_SERVICE_TOKEN ? 'ready' : 'missing token'
    };

    // Check Instagram API
    healthChecks.instagramAPI = {
        configured: !!process.env.INSTAGRAM_ACCESS_TOKEN,
        status: process.env.INSTAGRAM_ACCESS_TOKEN ? 'ready' : 'missing access token'
    };

    const readyServices = Object.values(healthChecks).filter(check => check.configured).length;

    res.json({
        status: readyServices > 0 ? 'operational' : 'no services configured',
        readyServices: readyServices,
        totalServices: Object.keys(healthChecks).length,
        services: healthChecks,
        recommendations: readyServices === 0 ? [
            "Configure at least one service for video extraction",
            "Set up RapidAPI key for quickest setup",
            "Install yt-dlp for best success rate",
            "Consider setting up a custom scraping service"
        ] : []
    });
});

module.exports = router;