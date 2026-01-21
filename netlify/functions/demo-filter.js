/**
 * Demo Filter Netlify Function
 *
 * Provides live AI filtering for the landing page "Try the Filter" demo.
 * Uses Claude claude-3-5-haiku-20241022 for cost efficiency.
 *
 * Features:
 * - CORS handling
 * - Input validation (3-2000 chars)
 * - Safety content detection (DV, suicide, child abuse)
 * - Rate limiting (10 requests/hour per IP)
 * - Claude API integration
 */

const Anthropic = require('@anthropic-ai/sdk');
const { getStore } = require('@netlify/blobs');

// ========================================
// CONFIGURATION
// ========================================

const CONFIG = {
    maxMessageLength: 2000,
    minMessageLength: 3,
    rateLimit: {
        maxRequests: 10,
        windowMs: 60 * 60 * 1000, // 1 hour
    },
    claude: {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 500,
        timeout: 12000, // 12 seconds
    },
    allowedOrigins: [
        'https://filteredmessaging.com',
        'https://www.filteredmessaging.com',
    ],
};

// ========================================
// SAFETY PATTERNS (from content_safety.py)
// ========================================

const SAFETY_PATTERNS = {
    domesticViolence: [
        /i('ll| will)?\s*(hurt|kill|beat|punch|hit)\s*(you|her|him|them)/i,
        /you('ll| will)?\s*pay\s*for\s*this/i,
        /i('ll| will)?\s*make\s*you\s*(regret|sorry)/i,
        /you\s*can'?t\s*leave\s*me/i,
        /i('ll| will)?\s*find\s*(you|her|him)/i,
        /you\s*belong\s*to\s*me/i,
        /if\s*you\s*leave/i,
        /i('ll| will)?\s*(destroy|ruin)\s*(your|you)/i,
    ],
    suicideThreats: [
        /i('ll| will|'m going to)?\s*(kill|hurt)\s*myself/i,
        /suicide/i,
        /end\s*(my|it all|everything)/i,
        /don'?t\s*want\s*to\s*live/i,
        /better\s*off\s*dead/i,
        /no\s*point\s*in\s*living/i,
    ],
    childAbuse: [
        /i('ll| will)?\s*(hurt|beat|hit)\s*(the\s*)?(kids?|children|son|daughter)/i,
        /you('ll| will)?\s*never\s*see\s*(the\s*)?(kids?|children|them)\s*again/i,
        /i('ll| will)?\s*take\s*(the\s*)?(kids?|children)\s*(and|away)/i,
        /they('ll| will)?\s*(hate|never\s*love)\s*you/i,
    ],
};

const SAFETY_RESOURCES = {
    domesticViolence: {
        type: 'SAFETY_ALERT',
        category: 'domestic_violence',
        message: 'This message may indicate a dangerous situation.',
        resources: [
            { name: 'National DV Hotline', phone: '1-800-799-7233', url: 'https://www.thehotline.org' },
            { name: 'Crisis Text Line', text: 'Text HOME to 741741' },
        ],
    },
    suicideThreats: {
        type: 'SAFETY_ALERT',
        category: 'suicide_crisis',
        message: 'This message may indicate someone in crisis.',
        resources: [
            { name: '988 Suicide & Crisis Lifeline', phone: '988' },
            { name: 'Crisis Text Line', text: 'Text HOME to 741741' },
        ],
    },
    childAbuse: {
        type: 'SAFETY_ALERT',
        category: 'child_safety',
        message: 'This message may indicate concerns about child safety.',
        resources: [
            { name: 'Childhelp National Hotline', phone: '1-800-422-4453' },
            { name: 'Child Protective Services', note: 'Contact your local CPS agency' },
        ],
    },
};

// ========================================
// UTILITY FUNCTIONS
// ========================================

function getCorsHeaders(origin) {
    const allowedOrigin = CONFIG.allowedOrigins.includes(origin)
        ? origin
        : CONFIG.allowedOrigins[0];

    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json',
    };
}

function detectSafetyContent(message) {
    const lowerMessage = message.toLowerCase();

    for (const [category, patterns] of Object.entries(SAFETY_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(message)) {
                return { detected: true, category, ...SAFETY_RESOURCES[category] };
            }
        }
    }

    return { detected: false };
}

function validateMessage(message) {
    if (!message || typeof message !== 'string') {
        return { valid: false, error: 'Message is required' };
    }

    const trimmed = message.trim();

    if (trimmed.length < CONFIG.minMessageLength) {
        return { valid: false, error: `Message must be at least ${CONFIG.minMessageLength} characters` };
    }

    if (trimmed.length > CONFIG.maxMessageLength) {
        return { valid: false, error: `Message must be less than ${CONFIG.maxMessageLength} characters` };
    }

    return { valid: true, message: trimmed };
}

// ========================================
// RATE LIMITING
// ========================================

async function checkRateLimit(ip, context) {
    try {
        const store = getStore({ name: 'demo-rate-limits', siteID: context.site.id, token: context.token });
        const key = `rate:${ip}`;

        const data = await store.get(key, { type: 'json' });
        const now = Date.now();

        if (!data) {
            // First request
            await store.setJSON(key, { count: 1, resetAt: now + CONFIG.rateLimit.windowMs });
            return { allowed: true, remaining: CONFIG.rateLimit.maxRequests - 1 };
        }

        // Check if window has expired
        if (now > data.resetAt) {
            await store.setJSON(key, { count: 1, resetAt: now + CONFIG.rateLimit.windowMs });
            return { allowed: true, remaining: CONFIG.rateLimit.maxRequests - 1 };
        }

        // Check if limit exceeded
        if (data.count >= CONFIG.rateLimit.maxRequests) {
            const retryAfter = Math.ceil((data.resetAt - now) / 1000);
            return { allowed: false, remaining: 0, retryAfter };
        }

        // Increment counter
        await store.setJSON(key, { count: data.count + 1, resetAt: data.resetAt });
        return { allowed: true, remaining: CONFIG.rateLimit.maxRequests - data.count - 1 };
    } catch (error) {
        console.error('Rate limit error:', error);
        // On error, allow the request but log it
        return { allowed: true, remaining: CONFIG.rateLimit.maxRequests };
    }
}

// ========================================
// CLAUDE API INTEGRATION
// ========================================

const DEMO_PROMPT = `You are a message filter for a co-parenting app. Analyze this message and extract only the actionable information while removing hostile language.

Respond in JSON format:
{
  "mood": "hostile" | "tense" | "neutral" | "calm",
  "moodScore": 1-10 (10 = very hostile),
  "summary": "Brief factual summary of any requests, information, or action items (1-2 sentences)",
  "actions": [{"text": "action item", "deadline": "deadline if mentioned or null"}],
  "responses": ["suggested neutral response 1", "suggested neutral response 2", "suggested neutral response 3"]
}

Rules:
- Remove insults, blame, manipulation, and emotional attacks
- Focus only on facts: dates, times, locations, requests, questions
- If no actionable content, say so in the summary
- Keep responses brief, neutral, and focused on the children
- For actions, only include concrete to-dos`;

async function filterWithClaude(message) {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const response = await anthropic.messages.create({
        model: CONFIG.claude.model,
        max_tokens: CONFIG.claude.maxTokens,
        messages: [
            {
                role: 'user',
                content: `${DEMO_PROMPT}\n\nMessage to filter:\n"${message}"`,
            },
        ],
    });

    // Parse the response
    const content = response.content[0]?.text;
    if (!content) {
        throw new Error('Empty response from Claude');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Could not parse Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate and normalize response
    return {
        mood: parsed.mood || 'neutral',
        moodIcon: getMoodIcon(parsed.mood),
        moodText: getMoodText(parsed.mood),
        summary: parsed.summary || 'No actionable content found.',
        actions: Array.isArray(parsed.actions) ? parsed.actions.slice(0, 3) : [],
        responses: Array.isArray(parsed.responses) ? parsed.responses.slice(0, 3) : [],
        original: message,
    };
}

function getMoodIcon(mood) {
    const icons = {
        hostile: '\uD83D\uDE20', // 😠
        tense: '\uD83D\uDE12',   // 😒
        neutral: '\uD83D\uDE10', // 😐
        calm: '\uD83D\uDE42',    // 🙂
    };
    return icons[mood] || icons.neutral;
}

function getMoodText(mood) {
    const texts = {
        hostile: 'Hostile Detected',
        tense: 'Tense Detected',
        neutral: 'Neutral',
        calm: 'Calm',
    };
    return texts[mood] || texts.neutral;
}

// ========================================
// MAIN HANDLER
// ========================================

exports.handler = async (event, context) => {
    const origin = event.headers.origin || event.headers.Origin || '';
    const corsHeaders = getCorsHeaders(origin);

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 204,
            headers: corsHeaders,
            body: '',
        };
    }

    // Only allow POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Method not allowed' }),
        };
    }

    try {
        // Parse request body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
        } catch {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid JSON body' }),
            };
        }

        // Validate message
        const validation = validateMessage(body.message);
        if (!validation.valid) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: validation.error }),
            };
        }

        // Check rate limit
        const ip = event.headers['x-forwarded-for']?.split(',')[0].trim() ||
                   event.headers['client-ip'] ||
                   'unknown';

        const rateLimit = await checkRateLimit(ip, context);
        if (!rateLimit.allowed) {
            return {
                statusCode: 429,
                headers: {
                    ...corsHeaders,
                    'Retry-After': String(rateLimit.retryAfter),
                },
                body: JSON.stringify({
                    error: 'Rate limit exceeded',
                    retryAfter: rateLimit.retryAfter,
                }),
            };
        }

        // Check for safety content
        const safetyCheck = detectSafetyContent(validation.message);
        if (safetyCheck.detected) {
            return {
                statusCode: 200,
                headers: corsHeaders,
                body: JSON.stringify({
                    safety: true,
                    ...safetyCheck,
                }),
            };
        }

        // Call Claude API
        const result = await filterWithClaude(validation.message);

        return {
            statusCode: 200,
            headers: {
                ...corsHeaders,
                'X-Rate-Limit-Remaining': String(rateLimit.remaining),
            },
            body: JSON.stringify({
                success: true,
                ...result,
            }),
        };

    } catch (error) {
        console.error('Demo filter error:', error);

        // Don't expose internal errors to clients
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({
                error: 'Failed to process message. Please try again.',
            }),
        };
    }
};
