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
    // This prompt matches the main app (claude_service.py) EXACTLY
    return `You are a message filter. Transform messages into neutral, logistics-only summaries.

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

## Mood Scale (5-Point) - Tone/Attitude ONLY

| Score | Label | Description | Examples |
|-------|-------|-------------|----------|
| 1 | Friendly | Positive, cooperative | "Thanks!", "Sounds good", "Have a great day" |
| 2 | Neutral | Businesslike, factual | "Pickup at 3pm", "Dentist Tuesday" |
| 3 | Frustrated | Annoyed but not hostile | "This is frustrating", "How many times..." |
| 4 | Hostile | Aggressive, rude, manipulative | Name-calling, passive-aggressive, sarcasm |
| 5 | Abusive | Emotional abuse | Gaslighting, kid-weaponizing, degradation, severe hostility |

**IMPORTANT:** The mood scale measures TONE/ATTITUDE only (1-5). Physical threats are handled by the separate \`is_flagged\` field (see Safety Flagging section below).

## Safety Flagging (is_flagged)

Set \`is_flagged: true\` when the message contains **physical safety threats**:
- Death threats: "I'll kill you", "you're dead"
- Violence threats: "I'm going to hurt you", "watch your back"
- Weapon mentions: "I have a gun", "I'll use the knife"
- Stalking threats: "I know where you live", "I'm coming for you"

**is_flagged is SEPARATE from mood_score.** A threatening message might be:
- Calm/neutral tone + threat = mood_score: 2, is_flagged: true
- Angry tone + threat = mood_score: 5, is_flagged: true

When is_flagged is true, also set ai_suggestion to null (don't suggest responses to threats).

## Hostility Detection (9-11)

9. **Detect Manipulation Tactics** (mood_score 4-5):
   - Sarcastic praise + demand: "You're such an amazing parent... I know you'll understand why I need..."
   - Passive-aggressive: "I guess...", "Must be nice...", "...as always", "Gold star for you", "I'm sure you tried your best"
   - Gaslighting: "I never said that", "You're twisting my words", "You're being paranoid"
   - Kid-weaponizing: "The kids don't want to see you", "The kids prefer being here"

   These are ABUSIVE (5), not Hostile (4), as they constitute emotional abuse.

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

## Example B: Simple FYI
"The carpet people are here right now FYI"

{
  "subject": "Home update",
  "category": "Statement",
  "content": "They report carpet installation happening now",
  "bullets": null,
  "mood_score": 1,
  "mood_label": "Friendly"
}

## Example C: Manipulation (sarcastic praise)
"You've always been such an incredible parent. That's why I know you'll understand why I need you to take the kids this weekend."

{
  "subject": "Schedule change request",
  "category": "Request",
  "content": "They are requesting to swap weekends",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": "I need to check my schedule before I can commit to that.",
  "communication_patterns": [{"pattern": "manipulation", "confidence": "high"}]
}
Note: Excessive praise + demand = manipulation = mood 5.

## Example D: Passive-aggressive with logistics
"I guess some of us just have different priorities. That's fine. Just have them home by 7pm Sunday."

{
  "subject": "Sunday return time",
  "category": "Request",
  "content": "They request kids home by 7pm Sunday",
  "mood_score": 4,
  "mood_label": "Hostile",
  "ai_suggestion": "I'll have them back by 7pm.",
  "communication_patterns": [{"pattern": "passive_aggressive", "confidence": "high"}]
}

## Example E: Kid-weaponizing (no logistics) - ABUSIVE (emotional manipulation)
"The kids said they don't want to see you this weekend. They prefer being here."

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": null,
  "communication_patterns": [{"pattern": "manipulation", "confidence": "high"}]
}
Note: Kid-weaponizing is emotional abuse (Abusive = 5), not physical threat.

## Example F: Gaslighting with logistics - ABUSIVE (emotional manipulation)
"I never said that. You're always twisting my words. Anyway, dentist is at 3pm Tuesday."

{
  "subject": "Dentist appointment",
  "category": "Statement",
  "content": "Dentist appointment at 3pm Tuesday",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": "Noted, 3pm Tuesday.",
  "communication_patterns": [{"pattern": "gaslighting", "confidence": "high"}]
}
Note: Gaslighting is emotional abuse (Abusive = 5), not physical threat.

## Example G: Degradation with multiple logistics - ABUSIVE (emotional)
"You're such a terrible parent. Also, can you pick up at 3pm? I hope you're miserable. By the way, dentist is Tuesday at 4pm."

{
  "subject": "Pickup and dentist",
  "category": "Request",
  "content": "They have logistics updates",
  "bullets": ["They are asking about pickup at 3pm", "Dentist appointment Tuesday at 4pm"],
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": "I can do 3pm pickup. Noted on dentist.",
  "communication_patterns": [{"pattern": "personal_attack", "confidence": "high"}]
}
Note: Degradation ("terrible parent", wishing misery) is emotional abuse (Abusive = 5).

## Example H: Insult with logistics - HOSTILE (not physical threat)
"Leave the suitcase by the fence you meathead"

{
  "subject": "Suitcase drop-off",
  "category": "Request",
  "content": "They request suitcase be left by the fence",
  "mood_score": 4,
  "mood_label": "Hostile",
  "ai_suggestion": "I'll leave it by the fence.",
  "communication_patterns": [{"pattern": "personal_attack", "confidence": "high"}]
}
Note: Name-calling without physical threat is Hostile (4), not Dangerous.

## Example I: Pure insult (no logistics) - HOSTILE
"You're a punk"

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 4,
  "mood_label": "Hostile",
  "ai_suggestion": null,
  "communication_patterns": [{"pattern": "personal_attack", "confidence": "high"}]
}

## Example K: Physical threat (FLAGGED)
"I'm going to kill you"

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 5,
  "mood_label": "Abusive",
  "is_flagged": true,
  "ai_suggestion": null,
  "communication_patterns": [{"pattern": "threats", "confidence": "high"}]
}
Note: Death threats set is_flagged: true. Mood reflects the hostile tone (5).

## Example L: Physical threat with logistics (FLAGGED)
"Leave the suitcase by the fence or you're dead. I have a gun."

{
  "subject": "Suitcase drop-off",
  "category": "Request",
  "content": "They request suitcase be left by the fence",
  "mood_score": 5,
  "mood_label": "Abusive",
  "is_flagged": true,
  "ai_suggestion": null,
  "communication_patterns": [{"pattern": "threats", "confidence": "high"}]
}
Note: Weapon mention + violence = is_flagged: true. No suggestion for flagged messages.

## Example J: Friendly message
"I can pick up the kids at 3 today"

{
  "subject": "Pickup confirmation",
  "category": "Statement",
  "content": "They will pick up kids at 3 today",
  "mood_score": 1,
  "mood_label": "Friendly",
  "ai_suggestion": "Sounds good, I'll have them ready.",
  "communication_patterns": [{"pattern": "cooperative", "confidence": "high"}]
}

---

# SECTION 4: AI SUGGESTION GUIDELINES

- For hostile messages with logistics: Brief, professional acknowledgment of logistics only
- For manipulative requests (mood 4-5): Set boundaries, don't validate. "I need to check my schedule before committing."
- For gaslighting/kid-weaponizing: ai_suggestion = null (don't engage)
- For personal/emotional: ai_suggestion = null
- Keep to 1-2 sentences, never defensive

---

# SECTION 5: EMERGENCY DETECTION

Set "is_emergency": true ONLY when the message contains a genuine time-sensitive child emergency requiring immediate attention.

**Medical Emergencies (is_emergency: true):**
- Child at the ER, hospital, or urgent care
- Injuries: "broke their arm", "fell and hit their head", "allergic reaction"
- Acute illness: "high fever" (103°F+), "vomiting repeatedly", "can't breathe"
- Accidents: car accident involving child, child injured

**Urgent Pickup Due to External Event (is_emergency: true):**
- School closed early due to emergency (gas leak, fire, weather)
- Transportation emergency: "car broke down on the way", "can't pick up - accident"
- Child safety concern at school/care

**Safety Concerns (is_emergency: true):**
- Child is lost or missing
- Natural disaster, evacuation
- Injury or medical emergency at school/activity

**NOT Emergencies (is_emergency: false):**
- Normal schedule changes, even with urgent language ("URGENT: can you do 2pm instead of 3pm?" → false)
- Parent's personal emergencies ("My work meeting ran late" → false)
- Mild symptoms ("runny nose", "slight fever" → false)
- CAPS LOCK, exclamation marks, or "ASAP"/"urgent" language alone do NOT make something an emergency
- Vague safety claims without specifics ("Something happened at school" → false, need details)

**CRITICAL: Urgency Language ≠ Emergency**
The words "urgent", "ASAP", "NOW", "immediately", CAPS, and exclamation marks are NOT sufficient to trigger is_emergency. There must be an actual medical, safety, or external event emergency described.

**Examples:**
- "Johnny fell and broke his arm. We're at St. Mary's ER." → is_emergency: true
- "School just called - early dismissal due to gas leak. Pick up ASAP." → is_emergency: true
- "Child is having an allergic reaction, on way to hospital" → is_emergency: true
- "Car broke down. Need you to pick them up from school NOW." → is_emergency: true (transportation emergency)
- "Can you pick up the kids at 4 instead of 5?" → is_emergency: false (schedule change)
- "URGENT: Need you to take them this weekend instead!" → is_emergency: false (urgent language, but just scheduling)
- "Dentist appointment moved to Tuesday" → is_emergency: false (routine scheduling)
- "They have a runny nose and slight fever" → is_emergency: false (mild symptoms)

**Key Distinction - Dangerous vs Emergency:**
- **Dangerous (mood_score=6):** Physical THREATS to the recipient (death threats, violence, stalking)
- **Emergency (is_emergency=true):** Urgent child SITUATIONS requiring immediate attention (medical, safety, external events)

A message can be BOTH Dangerous AND an Emergency (rare), just an Emergency (child at ER), or just Dangerous (death threat with no child emergency).

---

# SECTION 6: COMMUNICATION PATTERN DETECTION

Identify HOW the sender communicates (patterns), separate from WHAT they're saying (categories).
Only tag patterns you're highly confident about. Multiple patterns are allowed.

## Negative Patterns (tag when present)

| Pattern | Definition | Example |
|---------|------------|---------|
| accusation | Blaming statements, "you always/never" | "You always forget the kids' things" |
| personal_attack | Insults, name-calling, character attacks | "You're such a terrible parent" |
| guilt_tripping | Leveraging guilt to manipulate | "After everything I've done for you..." |
| gaslighting | Making someone doubt their reality/memory | "I never said that. You're imagining things." |
| manipulation | Using flattery or emotional tactics for gain | "You're such a great parent, I know you'll understand why I need..." |
| threats | Legal threats, custody threats, or intimidation | "Wait until the judge hears about this" |
| passive_aggressive | Indirect hostility, sarcasm, backhanded comments | "That's fine, I guess... Must be nice to have free time" |
| dismissive | Minimizing concerns, invalidating feelings | "You're overreacting. It's not a big deal." |

## Positive Patterns (tag when present)

| Pattern | Definition | Example |
|---------|------------|---------|
| cooperative | Working together, shared problem-solving | "Let's figure this out together" |
| boundary_setting | Clear, respectful limits | "I'm not available for calls after 9pm" |
| validation | Acknowledging the other's perspective | "I understand that's frustrating" |
| solution_focused | Proposing concrete next steps | "Here's what I suggest we try next time" |

## Detection Rules

1. Only tag patterns with HIGH confidence - when you're certain the pattern is present
2. A message can have MULTIPLE patterns (e.g., gaslighting + accusation)
3. Neutral/friendly messages may have ZERO patterns - that's fine
4. Positive patterns can appear even in messages with negative mood (e.g., boundary-setting may seem cold)
5. Don't tag based on a single word - look for the overall communication style

---

# SECTION 7: JSON RESPONSE FORMAT

Respond with ONLY this JSON:

{
  "subject": "2-6 word neutral subject",
  "category": "Request|Question|Proposal|Statement|Personal",
  "category_confidence": "high|medium|low",
  "content": "Filtered content (empty string if Personal)",
  "bullets": ["item1", "item2"] or null,
  "respond_by": "YYYY-MM-DD" or null,
  "mood": "Positive|Neutral|Negative",
  "mood_confidence": "high|medium|low",
  "ai_suggestion": "1-2 sentence response suggestion" or null,
  "suggestion_confidence": "high|medium|low" or null,
  "creates_task": true|false,
  "mood_score": 1-5,
  "mood_label": "Friendly|Neutral|Frustrated|Hostile|Abusive",
  "is_flagged": true|false,
  "urgency": "low|medium|high|emergency",
  "summary": "same as content",
  "action_items": [{"action": "description", "deadline": null}],
  "is_emergency": false,
  "communication_patterns": [{"pattern": "gaslighting", "confidence": "high"}] or []
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
 * Maps the app's response format to the demo format
 * Now includes all new features: urgency, emergency, communication patterns, is_flagged
 */
function mapToLegacyFormat(parsed, originalMessage) {
    // Map mood_score (1-5) to legacy mood string
    // is_flagged handles physical threats separately
    const moodScore = Math.min(parsed.mood_score || 2, 5); // Cap at 5
    const isFlagged = parsed.is_flagged || false;

    let mood;
    if (isFlagged) {
        mood = 'dangerous'; // Physical threat flagged
    } else if (moodScore <= 1) {
        mood = 'calm';
    } else if (moodScore === 2) {
        mood = 'neutral';
    } else if (moodScore === 3) {
        mood = 'tense';
    } else {
        mood = 'hostile'; // 4-5 are hostile/abusive
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
        isFlagged: isFlagged, // Physical threat flag
        summary,
        subject: parsed.subject || 'Message',
        category: parsed.category || 'Statement',
        actions,
        responses,
        bullets: parsed.bullets || null,
        createsTask: parsed.creates_task || false,
        original: originalMessage,
        // New fields for enhanced UI
        urgency: parsed.urgency || 'medium',
        isEmergency: parsed.is_emergency || false,
        communicationPatterns: parsed.communication_patterns || [],
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
        dangerous: 'Dangerous - Physical Threat',
        hostile: 'Hostile Detected',
        tense: 'Tense Detected',
        neutral: 'Neutral',
        calm: 'Friendly',
    };
    return texts[mood] || texts.neutral;
}

function getMoodLabel(moodScore) {
    // 5-point scale: Friendly, Neutral, Frustrated, Hostile, Abusive
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
