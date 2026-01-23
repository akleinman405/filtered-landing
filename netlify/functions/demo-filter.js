/**
 * Demo Filter Netlify Function
 *
 * Provides live AI filtering for the landing page "Try the Filter" demo.
 * Uses the SAME comprehensive prompt as the actual app (claude_service.py).
 *
 * Features:
 * - CORS handling
 * - Input validation (3-2000 chars)
 * - Safety content detection (DV, suicide, child abuse)
 * - Rate limiting (10 requests/hour per IP)
 * - Claude API integration with full app prompt
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
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1024, // Increased for comprehensive response
        timeout: 30000, // 30 seconds (Sonnet is slower)
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
// Uses the SAME comprehensive prompt as the actual app (claude_service.py)
// ========================================

function buildAnalysisPrompt(messageBody) {
    // This prompt matches the main app (claude_service.py) - restructured version
    return `You are a co-parent message filter. Transform messages into neutral, logistics-only summaries.

<message>
${messageBody}
</message>

---

# SECTION 1: MANDATORY CHECKLIST

Before generating your response, verify ALL of these:

## ✓ Speaker Identification
The \`content\` field MUST identify who is doing/asking something.
- ✗ "Will drop kids off at 1:30"
- ✓ "They will drop kids off at 1:30"

## ✓ Multi-Topic Coverage
If the message has 2+ distinct topics, use \`bullets\` array.
- Child support + coat question = bullets
- Schedule + pickup time = bullets
- NEVER drop logistics because there's emotional content too

## ✓ Short Response Context
"Ok", "Sure", "Thanks" alone is NOT enough.
- ✗ "Ok"
- ✓ "They acknowledge the dropoff time"

## ✓ No Hostile Text Passthrough
The \`content\` field must NEVER contain insults, attacks, sarcasm, or emotional language.
- If NO logistics exist → content = ""
- If logistics exist with hostility → extract ONLY the logistics

---

# SECTION 2: FILTERING RULES

## Core Rules (1-8)

1. **Extract Intent**: Summarize what they actually want, not their exact words.

2. **Identify Speaker**: Use "They/Their" to identify who is doing/asking something.

3. **Remove Emotion**: Strip accusations, insults, guilt trips, sarcasm, feelings, past conflicts.

4. **Preserve ALL Logistics**: Keep every fact/request even when surrounded by emotion.

5. **Use Bullets for 2+ Topics**: Single topic = content string. Multiple topics = bullets array.

6. **Infer Deadlines**: Event on Jan 5 → respond_by: Jan 4.

7. **Combine Follow-ups**: Prior "send shoes" + current "also coat" = bullets with all items.

8. **Handle Typos**: "mauve" → "maybe" when context is clear. Note in suggestion if ambiguous.

## Hostility Detection (9-11)

9. **Detect Manipulation Tactics** (mood_score 4-5):
   - Sarcastic praise + demand: "You're such an amazing parent... I know you'll understand why I need..."
   - Passive-aggressive: "I guess...", "Must be nice...", "...as always", "Gold star for you", "I'm sure you tried your best"
   - Gaslighting: "I never said that", "You're twisting my words", "You're being paranoid"
   - Kid-weaponizing: "The kids don't want to see you", "The kids prefer being here"

   These are HOSTILE (4-5), not friendly (1-2), even if words sound nice.

10. **Accusatory Questions = Personal**: "Why can't you ever..." is blame, not a real question. category: Personal, content: ""

11. **Personal Life Questions = Filtered**: Prying about dating, visitors, finances = category: Personal, content: ""

## Categories

| Category | Use When | creates_task |
|----------|----------|--------------|
| Request | They want action from you | true |
| Question | They want an answer | true |
| Proposal | Suggesting a change to discuss | true |
| Statement | Info only, FYI | false |
| Personal | Pure emotion, no logistics | false |

---

# SECTION 3: EXAMPLES

## Example A: Multi-topic message
"I sent you child support. Are you getting another job? I'll check my schedule for Presidents Day. Do you have the red coat?"

{
  "subject": "Child support, schedule, coat",
  "category": "Question",
  "content": "They sent updates and have questions",
  "bullets": ["They sent child support", "They will check Presidents Day schedule", "They are asking if you have the red coat"],
  "mood_score": 2,
  "mood_label": "Neutral"
}
Note: "Are you getting another job?" filtered out (prying).

## Example B: Manipulation (sarcastic praise)
"You've always been such an incredible parent. That's why I know you'll understand why I need you to take the kids this weekend."

{
  "subject": "Schedule change request",
  "category": "Request",
  "content": "They are requesting to swap weekends",
  "mood_score": 5,
  "mood_label": "Hostile",
  "ai_suggestion": "I need to check my schedule before I can commit to that."
}
Note: Excessive praise + demand = manipulation = mood 5.

## Example C: Passive-aggressive with logistics
"I guess some of us just have different priorities. That's fine. Just have them home by 7pm Sunday."

{
  "subject": "Sunday return time",
  "category": "Request",
  "content": "They request kids home by 7pm Sunday",
  "mood_score": 4,
  "mood_label": "Hostile",
  "ai_suggestion": "I'll have them back by 7pm."
}

## Example D: Kid-weaponizing (no logistics)
"The kids said they don't want to see you this weekend. They prefer being here."

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": null
}

## Example E: Gaslighting with logistics
"I never said that. You're always twisting my words. Anyway, dentist is at 3pm Tuesday."

{
  "subject": "Dentist appointment",
  "category": "Statement",
  "content": "Dentist appointment at 3pm Tuesday",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": "Noted, 3pm Tuesday."
}

## Example F: Insult with logistics
"Leave the suitcase by the fence or you're dead meat you meathead"

{
  "subject": "Suitcase drop-off",
  "category": "Request",
  "content": "They request suitcase be left by the fence",
  "mood_score": 5,
  "mood_label": "Hostile",
  "ai_suggestion": "I'll leave it by the fence."
}

## Example G: Pure insult (no logistics)
"You're a punk"

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 5,
  "mood_label": "Hostile",
  "ai_suggestion": null
}

---

# SECTION 4: AI SUGGESTION GUIDELINES

- For hostile messages with logistics: Brief, professional acknowledgment of logistics only
- For manipulative requests (mood 4-5): Set boundaries, don't validate. "I need to check my schedule before committing."
- For gaslighting/kid-weaponizing: ai_suggestion = null (don't engage)
- For personal/emotional: ai_suggestion = null
- Keep to 1-2 sentences, never defensive

---

# SECTION 5: JSON RESPONSE FORMAT

Respond with ONLY this JSON:

{
  "subject": "2-6 word neutral subject",
  "category": "Request|Question|Proposal|Statement|Personal",
  "content": "Filtered content (empty string if Personal)",
  "bullets": ["item1", "item2"] or null,
  "respond_by": "YYYY-MM-DD" or null,
  "ai_suggestion": "1-2 sentence response suggestion" or null,
  "creates_task": true|false,
  "mood_score": 1-5,
  "mood_label": "Friendly|Neutral|Frustrated|Hostile|Abusive",
  "action_items": [{"action": "description", "deadline": null}]
}

Respond ONLY with JSON. No explanation.`;
}

async function filterWithClaude(message) {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = buildAnalysisPrompt(message);

    const response = await anthropic.messages.create({
        model: CONFIG.claude.model,
        max_tokens: CONFIG.claude.maxTokens,
        system: 'You are a JSON-only API for filtering co-parent messages. You MUST respond with valid JSON only - no markdown, no explanation, no preamble. Start your response with { and end with }.',
        messages: [
            {
                role: 'user',
                content: prompt,
            },
            {
                role: 'assistant',
                content: '{', // Prefill forces JSON start
            },
        ],
    });

    // Prepend the prefilled brace back since Claude continues from it
    const content = '{' + (response.content[0]?.text || '');
    if (!content || content === '{') {
        throw new Error('Empty response from Claude');
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('Could not parse Claude response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Map app response format to demo format
    return mapToLegacyFormat(parsed, message);
}

/**
 * Maps the app's response format to the legacy demo format
 * for backward compatibility with the landing page UI
 */
function mapToLegacyFormat(parsed, originalMessage) {
    // Map mood_score (1-5) to legacy mood string
    const moodScore = parsed.mood_score || 2;
    let mood;
    if (moodScore <= 1) {
        mood = 'calm';
    } else if (moodScore === 2) {
        mood = 'neutral';
    } else if (moodScore === 3) {
        mood = 'tense';
    } else {
        mood = 'hostile';
    }

    // Map action_items to legacy actions format
    const actions = [];
    if (Array.isArray(parsed.action_items)) {
        for (const item of parsed.action_items.slice(0, 3)) {
            actions.push({
                text: item.action || item.text || '',
                deadline: item.deadline || null,
            });
        }
    }

    // Build responses array from ai_suggestion
    const responses = [];
    if (parsed.ai_suggestion) {
        responses.push(parsed.ai_suggestion);
    }

    // Get summary from content or subject
    let summary = parsed.content || '';
    if (!summary && parsed.subject && parsed.subject !== 'Personal' && parsed.subject !== 'Personal message') {
        summary = parsed.subject;
    }
    if (!summary) {
        summary = parsed.category === 'Personal'
            ? 'No actionable content - emotional message filtered.'
            : 'No actionable content found.';
    }

    return {
        mood,
        moodIcon: getMoodIcon(mood),
        moodText: getMoodText(mood),
        moodScore: moodScore, // Include the actual 1-5 score
        moodLabel: parsed.mood_label || getMoodLabel(moodScore),
        summary,
        subject: parsed.subject || 'Message',
        category: parsed.category || 'Statement',
        actions,
        responses,
        bullets: parsed.bullets || null,
        createsTask: parsed.creates_task || false,
        original: originalMessage,
    };
}

function getMoodIcon(mood) {
    const icons = {
        hostile: '\uD83D\uDE20', // angry face
        tense: '\uD83D\uDE12',   // unamused face
        neutral: '\uD83D\uDE10', // neutral face
        calm: '\uD83D\uDE42',    // slightly smiling face
    };
    return icons[mood] || icons.neutral;
}

function getMoodText(mood) {
    const texts = {
        hostile: 'Hostile Detected',
        tense: 'Tense Detected',
        neutral: 'Neutral',
        calm: 'Friendly',
    };
    return texts[mood] || texts.neutral;
}

function getMoodLabel(moodScore) {
    const labels = ['Friendly', 'Neutral', 'Frustrated', 'Hostile', 'Abusive'];
    return labels[Math.min(Math.max(moodScore - 1, 0), 4)];
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
