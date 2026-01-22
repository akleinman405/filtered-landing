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
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 1024, // Increased for comprehensive response
        timeout: 15000, // 15 seconds
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
    return `You are a co-parent message filter. Transform incoming messages into neutral, logistics-only summaries that:
1. Remove all emotional content, accusations, and hostility
2. Preserve all actionable information (requests, questions, proposals, logistics)
3. Present information in a consistent, scannable format
4. Protect the recipient's emotional wellbeing while enabling effective co-parenting

<message>
${messageBody}
</message>

## CRITICAL RULE: NEVER PASS THROUGH HOSTILE TEXT

The content field must NEVER contain:
- Insults ("you're a punk", "meathead", "you're lame")
- Attacks or accusations
- Hostile/emotional language
- Sarcasm or mockery

If a message has NO actionable logistics, content MUST be empty string "".
If a message has logistics buried in hostility, content should ONLY contain the logistics - never the insults.

## FILTERING PRINCIPLES

1. **Extract Intent, Not Words**: Summarize what they *actually want*, not what they said. Look for the core request buried in emotional language.

2. **Convert First-Person to Third-Person** (for mood_score 2+): Convert "I" and "my" to "They/Their" for clarity when the message is Neutral or more hostile.
   - WRONG: "Will pick up kids at 3" (ambiguous - who?)
   - RIGHT: "They will pick up kids at 3" (clear)

3. **Remove ALL Emotional Content**: Strip out accusations ("you always...", "you never..."), insults, guilt trips, sarcasm ("oh that's just perfect!"), expressions of hurt, justifications for feelings, and references to past conflicts. The content field should contain NONE of this.

4. **Consolidate to Core Point**: When someone gives detailed instructions, summarize the *intent* concisely.

5. **Infer Reasonable Deadlines**:
   - If message mentions a specific date/event, set respond_by to the day before
   - Example: "drop off on Jan 2" -> respond_by: "Jan 1"
   - No date mentioned -> respond_by: null

6. **Sarcasm/Venting != Real Proposals**: Distinguish genuine proposals from sarcastic suggestions.
   - SARCASTIC (not real): "Why don't you just move to DC and see the kids once a month! Perfect!" -> category: Personal, creates_task: false
   - GENUINE: "Would you consider moving to DC? I could help you find a job." -> category: Question, creates_task: true

7. **"Personal" is the Catch-All for Pure Emotion**: When a message is entirely emotional with zero logistics, use category: "Personal".

8. **Never Include Feelings in Filtered View**: Don't mention how they're feeling, why they want something, or their emotional state.

9. **Detect Hostile Tone**: Messages may not contain explicit threats but still be hostile through:
    - Sarcasm and mockery ("oh that's just perfect!", "yeah right")
    - Accusatory language ("you always...", "you never...")
    - Contemptuous/dismissive responses ("whatever", "sure")
    - Exasperation combined with demands
    Set mood_score to 4+ and mood_label to "Hostile" for these patterns.

10. **CRITICAL: Detect Sarcastic Praise (Manipulation)**: Over-the-top compliments followed by demands are HOSTILE, not friendly:
    - "You've always been such an incredible/amazing/wonderful parent..." -> mood_score: 5 (Hostile)
    - "The kids are so lucky to have a parent who puts them first like you..." -> mood_score: 5
    **Pattern to detect:** Excessive praise + "I know you'll understand/agree" + demand = MANIPULATION

11. **Detect Passive-Aggressive Phrases**: These indicate hostility even without explicit insults:
    - "I guess..." (dismissive) -> mood_score: 4
    - "Must be nice to..." (resentment) -> mood_score: 4
    - "...as always" when negative (criticism) -> mood_score: 4-5
    - "I'm sure you tried your best" (backhanded) -> mood_score: 5
    - "No worries, I'll just handle it myself" (martyrdom) -> mood_score: 4
    - "Gold star for you" / "How refreshing" (mockery) -> mood_score: 4
    - "Classic you" / "That tracks" (dismissive contempt) -> mood_score: 4

12. **CRITICAL: Detect Gaslighting and Reality Denial**: These are forms of emotional abuse:
    - "I never said/did that" (denying documented events) -> mood_score: 5
    - "That never happened" / "You're making things up" -> mood_score: 5
    - "You're being crazy/paranoid/dramatic/sensitive/emotional" -> mood_score: 5
    - "You always exaggerate/overreact" -> mood_score: 4

13. **Detect Kid-Weaponizing**: Using children as leverage or messengers is hostile:
    - "The kids don't want to see you" -> mood_score: 5
    - "The kids said they prefer being here" -> mood_score: 5
    - "Tell daddy/mommy that..." (using child as messenger for conflict) -> mood_score: 5

14. **Accusatory Questions are NOT Legitimate Questions**: Questions that are really accusations in disguise should be:
    - category: "Personal" (NOT "Question")
    - content: "" (empty - no action needed)
    - Examples: "Why can't you ever just do what you said?", "How could you forget something so important?"

15. **Personal Life Questions Should Be Filtered Out**: Questions prying into the other parent's personal life are:
    - category: "Personal" (NOT "Question")
    - content: "" (empty - boundary violation, no response needed)
    - Examples: "Who are you seeing?", "Who was at your house last night?"

## MOOD-BASED FILTERING INTENSITY

Match filtering intensity to hostility level:

### Low Hostility (mood_score 1, Friendly):
- Use LIGHTER transformation - don't over-filter friendly messages
- Preserve natural conversational flow

### Neutral (mood_score 2):
- Standard transformation with third-person conversion
- Maintain clarity while preserving conversational tone

### Medium Hostility (mood_score 3, Frustrated):
- Standard filtering - remove emotional language but preserve logistics

### High Hostility (mood_score 4-5, Hostile/Abusive):
- Full filtering - extract ONLY actionable logistics
- Always use third-person for emotional distance
- Strip all accusations, insults, hostility completely

## EXAMPLES

**Example 1 - Logistics buried in hostility:**
Original: "I'm extremely hurt and I feel lied to and manipulated. Don't respond please. And when I drop off the kids, please stay in the car with the window up."
Filtered:
- subject: "Drop-off procedure request"
- category: "Request"
- content: "Stay in car with window up at drop-offs"
- mood_score: 4
- mood_label: "Hostile"
- ai_suggestion: "Understood. I'll stay in the car at drop-offs."

**Example 2 - Sarcastic (NOT a real proposal):**
Original: "You know this could actually be great...Why don't you move by yourself to DC, then you can date properly!"
Filtered:
- subject: "Personal"
- category: "Personal"
- content: ""
- mood_score: 4
- mood_label: "Hostile"
- creates_task: false

**Example 3 - Pure venting (no action):**
Original: "I just didn't expect it to be so fast. You were clearly revving to go. That hurts. I still cry all the time."
Filtered:
- subject: "Personal"
- category: "Personal"
- content: ""
- creates_task: false

**Example 4 - Hostile tone without explicit threat:**
Original: "Ugh seriously? You always do this. Whatever, just forget it."
Filtered:
- subject: "Personal"
- category: "Personal"
- content: ""
- mood_score: 4
- mood_label: "Hostile"
- creates_task: false

**Example 5 - SARCASTIC PRAISE (manipulation):**
Original: "You've always been such an incredible, devoted parent. That's exactly why I know you'll understand why I need you to take the kids this weekend instead of next."
Filtered:
- subject: "Schedule change request"
- category: "Request"
- content: "Requesting to swap weekends - take kids this weekend instead of next"
- mood_score: 5
- mood_label: "Hostile"
- creates_task: true
- ai_suggestion: "I need to check my schedule. What's the reason for the change?"

**Example 6 - PASSIVE-AGGRESSIVE (guilt-tripping):**
Original: "No worries, I'll just handle it like I always do. You never show up anyway. The school conference is at 5pm Wednesday."
Filtered:
- subject: "School conference info"
- category: "Statement"
- content: "School conference at 5pm Wednesday"
- mood_score: 4
- mood_label: "Hostile"
- ai_suggestion: "Thanks for the info. I'll be there at 5pm."

**Example 7 - GASLIGHTING:**
Original: "I never said that. You're always twisting my words. The kids can confirm it."
Filtered:
- subject: "Personal"
- category: "Personal"
- content: ""
- mood_score: 5
- mood_label: "Abusive"
- creates_task: false
- ai_suggestion: null

**Example 8 - Pure insult (NO logistics):**
Original: "You're a punk" or "you can go eat a baloney sandwich"
Filtered:
- subject: "Personal message"
- category: "Personal"
- content: ""
- mood_score: 5
- mood_label: "Hostile"
- creates_task: false
- ai_suggestion: null

**Example 9 - Hostility WITH logistics (extract only the logistics):**
Original: "Leave the suitcase by the fence or you're dead meat you meathead"
Filtered:
- subject: "Suitcase drop-off location"
- category: "Request"
- content: "Leave suitcase by the fence"
- mood_score: 5
- mood_label: "Hostile"
- ai_suggestion: "I'll leave it by the fence."

**Example 10 - Accusatory question (NOT a real question):**
Original: "Why did you wait til tomorrow for me to take her instead of you taking her today?"
Filtered:
- subject: "Personal"
- category: "Personal"
- content: ""
- mood_score: 4
- mood_label: "Frustrated"
- creates_task: false
- ai_suggestion: null

## CATEGORIES

| Category | When to Use | creates_task |
|----------|-------------|--------------|
| Request | They want you to do something | true |
| Question | They want an answer | true |
| Proposal | They're suggesting a change to discuss | true |
| Statement | Info only, no action needed | false |
| Personal | Emotional content, venting, no logistics | false |

## SUBJECT LINE GUIDELINES

Keep subject lines 2-6 words, neutral, descriptive:
- GOOD: "Drop-off procedure request", "Schedule change proposal", "Wednesday exchange request"
- BAD: "She's angry about drop-offs", "Another complaint", "Rude message"

## AI SUGGESTION GUIDELINES

Generate contextually appropriate suggestions that the RECIPIENT would send back.

### For Hostile Messages with Logistics:
Brief, professional acknowledgment focused ONLY on logistics:
- "I'll have the suitcase by the fence."
- "Understood, I'll stay in the car."

### For Manipulative Requests (mood_score 4-5):
DO NOT agree or validate the manipulation. Set boundaries:
- WRONG: "Sure, I can do that." (validates manipulation)
- RIGHT: "I need to check my schedule before committing."
- RIGHT: "Can you explain the reason for this change?"

### For Personal/Emotional Messages:
Set ai_suggestion to null - no response needed for venting.

### General Rules:
- Keep to 1-2 sentences max
- Never defensive or argumentative
- Never apologize unnecessarily

## RESPONSE FORMAT

Respond ONLY with this JSON object:
{
  "subject": "2-6 word neutral subject line",
  "category": "Request|Question|Proposal|Statement|Personal",
  "content": "The filtered content - MUST be empty string '' if Personal/no-logistics, NEVER include insults/hostility",
  "bullets": ["item 1", "item 2"] or null,
  "respond_by": "YYYY-MM-DD" or null,
  "ai_suggestion": "Brief suggested response (1-2 sentences)" or null,
  "creates_task": true|false,
  "mood_score": 1-5,
  "mood_label": "Friendly|Neutral|Frustrated|Hostile|Abusive",
  "action_items": [{"action": "specific action needed", "deadline": "YYYY-MM-DD or null"}]
}

Respond ONLY with the JSON object, no other text.`;
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
