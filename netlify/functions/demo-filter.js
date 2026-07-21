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
        // Keep in sync with `self.model` in src/services/claude_service.py.
        // claude-sonnet-4-20250514 was RETIRED 2026-06-15 (silently 404s) — see
        // that file's comment for the incident and why the request shape below
        // (no temperature, no assistant prefill, thinking disabled) matters for
        // Sonnet 5 specifically.
        model: 'claude-sonnet-5',
        maxTokens: 2048,
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
    // Mirrors src/services/claude_service.py's `_build_analysis_prompt` in the
    // no-context path (the demo never has a sender/recipient name to pass in).
    // Keep this in sync whenever that prompt changes — see CLAUDE.md notes on
    // the 2026-06-15 model retirement for why prompt/model drift here matters.
    return `You are a message filter. Transform messages into neutral, logistics-only summaries.

<message>
${messageBody}
</message>

---

# SECTION 1: MANDATORY CHECKLIST

Before generating your response, verify ALL of these:

## ✓ Speaker Identification
The \`content\` field MUST include the sender's name, and must name the recipient instead of "you" when a Recipient is given in context.
- ✗ "Will drop off the documents at 1:30"
- ✓ "[Sender] will drop off the documents at 1:30"
- ✗ "Asks if you can pick up the kids" (when Recipient is known)
- ✓ "[Sender] asks if [Recipient] can pick up the kids"

## ✓ Multi-Topic Coverage
If the message has 2+ distinct topics, use \`bullets\` array.
- Payment sent + meeting question = bullets
- Schedule + delivery time = bullets
- NEVER drop logistics because there's emotional content too

## ✓ Short Response Context
"Ok", "Sure", "Thanks" alone is NOT enough.
- ✗ "Ok"
- ✓ "[Sender] acknowledges the meeting time"

## ✓ No Hostile Text Passthrough
The \`content\` field must NEVER contain insults, attacks, sarcasm, or emotional language.
- If NO logistics exist → content = ""
- If logistics exist with hostility → extract ONLY the logistics

## ✓ Entity Specificity (WHO/WHAT/WHEN)

Every summary MUST preserve specific entities:

**WHO** - Name people mentioned:
- ✗ "Personal check-in"
- ✓ "Asks about your mother's health"

**WHAT** - Name specific items/actions:
- ✗ "Logistics updates"
- ✓ "Requests the signed agreement be sent"

**WHEN** - Include times if mentioned:
- ✗ "Schedule change"
- ✓ "Requests moving the meeting to Thursday at 4pm"

**Specificity Test:** If this summary could describe 10 different messages, it's too vague. Rewrite with specific entities.

---

# SECTION 2: FILTERING RULES

## Core Rules (1-8)

1. **Extract Intent**: Summarize what they actually want, not their exact words.

2. **Identify Speaker**: Always use sender's name in filtered content.

3. **Remove Emotion**: Strip accusations, insults, guilt trips, sarcasm, feelings, past conflicts.

4. **Preserve ALL Logistics**: Keep every fact/request even when surrounded by emotion.

5. **Use Bullets for 2+ Topics**: Single topic = content string. Multiple topics = bullets array.

6. **Infer Deadlines**: Event on Jan 5 → respond_by: Jan 4.

7. **Combine Follow-ups**: Prior "send the files" + current "also the invoice" = bullets with all items.

8. **Handle Typos**: "mauve" → "maybe" when context is clear. Note in suggestion if ambiguous.

8.5. **Reject Vague Summaries**: These patterns are FORBIDDEN:
   - "Personal check-in" → "Asks about [person]'s [topic]"
   - "Status inquiry" → "Asks for update on [specific situation]"
   - "Logistics updates" → "[Sender] informs about [specific item]"
   - "Schedule question" → "Asks to [specific change]"
   If writing a vague summary, identify WHO + WHAT and rewrite.

## Mood Scale (5-Point) - Tone/Attitude ONLY

| Score | Label | Description | Examples |
|-------|-------|-------------|----------|
| 1 | Friendly | Positive, cooperative | "Thanks!", "Sounds good", "Have a great day" |
| 2 | Neutral | Businesslike, factual | "Meeting at 3pm", "Appointment Tuesday" |
| 3 | Frustrated | Annoyed but not hostile | "This is frustrating", "How many times..." |
| 4 | Hostile | Aggressive, rude, manipulative | Name-calling, passive-aggressive, sarcasm |
| 5 | Abusive | Emotional abuse | Gaslighting, emotional manipulation, degradation, severe hostility |

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
   - Sarcastic praise + demand: "You've always been so helpful... I know you'll understand why I need..."
   - Passive-aggressive: "I guess...", "Must be nice...", "...as always", "Gold star for you", "I'm sure you tried your best"
   - Gaslighting: "I never said that", "You're twisting my words", "You're being paranoid"
   - Emotional manipulation: "Nobody wants to deal with you", "Everyone agrees you're the problem"

   These are ABUSIVE (5), not Hostile (4), as they constitute emotional abuse.

10. **Accusatory Questions = Personal**: "Why can't you ever..." is blame, not a real question. category: Personal, content: ""

11. **Personal Life Questions = Filtered**: Prying about dating, visitors, finances = category: Personal, content: ""

## Categories

| Category | Use When |
|----------|----------|
| Request | They want action from you |
| Question | They want an answer |
| Proposal | Suggesting a change to discuss |
| Statement | Info only, FYI |
| Personal | Pure emotion, no logistics |

---

# SECTION 3: EXAMPLES

## Example A: Multi-topic message
FROM Katrina: "I sent you the reimbursement. Are you even working? I'll check my schedule for the holiday. Do you have the red folder?"

{
  "subject": "Reimbursement, schedule, folder",
  "category": "Question",
  "content": "Katrina sent updates and has questions",
  "bullets": ["Katrina sent the reimbursement", "Katrina will check the holiday schedule", "Katrina is asking if you have the red folder"],
  "mood_score": 2,
  "mood_label": "Neutral"
}
Note: "Are you even working?" filtered out (prying).

## Example B: Simple FYI
FROM Katrina: "The carpet people are here right now FYI"

{
  "subject": "Home update",
  "category": "Statement",
  "content": "Katrina reports carpet installation happening now",
  "bullets": null,
  "mood_score": 1,
  "mood_label": "Friendly"
}

## Example C: Manipulation (sarcastic praise)
FROM Katrina: "You've always been such an incredible help. That's why I know you'll understand why I need you to handle this for me this weekend."

{
  "subject": "Weekend request",
  "category": "Request",
  "content": "Katrina is requesting help this weekend",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": "I need to check my schedule before I can commit to that."
}
Note: Excessive praise + demand = manipulation = Abusive (5).

## Example D: Passive-aggressive with logistics
FROM Katrina: "I guess some of us just have different priorities. That's fine. Just have everything ready by 7pm Sunday."

{
  "subject": "Sunday deadline",
  "category": "Request",
  "content": "Katrina requests everything ready by 7pm Sunday",
  "mood_score": 4,
  "mood_label": "Hostile",
  "ai_suggestion": "I'll have it ready by 7pm."
}

## Example E: Emotional manipulation (no logistics) - ABUSIVE
FROM Katrina: "Nobody wants to deal with you. Everyone prefers working with me."

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": null
}
Note: Emotional manipulation (isolating, degrading) is emotional abuse (Abusive = 5), not physical threat.

## Example F: Gaslighting with logistics - ABUSIVE (emotional manipulation)
FROM Katrina: "I never said that. You're always twisting my words. Anyway, the appointment is at 3pm Tuesday."

{
  "subject": "Appointment Tuesday",
  "category": "Statement",
  "content": "Appointment at 3pm Tuesday",
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": "Noted, 3pm Tuesday."
}
Note: Gaslighting is emotional abuse (Abusive = 5), not physical threat.

## Example G: Degradation with multiple logistics - ABUSIVE (emotional)
FROM Alec: "You're such a terrible person. Also, can you meet me at 3pm? I hope you're miserable. By the way, the appointment is Tuesday at 4pm."

{
  "subject": "Meeting and appointment",
  "category": "Request",
  "content": "Alec has logistics updates",
  "bullets": ["Alec is asking to meet at 3pm", "Appointment Tuesday at 4pm"],
  "mood_score": 5,
  "mood_label": "Abusive",
  "ai_suggestion": "I can do 3pm. Noted on the appointment."
}
Note: Degradation ("terrible person", wishing misery) is emotional abuse (Abusive = 5).

## Example H: Insult with logistics - HOSTILE (not physical threat)
FROM Katrina: "Leave the suitcase by the fence you meathead"

{
  "subject": "Suitcase drop-off",
  "category": "Request",
  "content": "Katrina requests suitcase be left by the fence",
  "mood_score": 4,
  "mood_label": "Hostile",
  "ai_suggestion": "I'll leave it by the fence."
}
Note: Name-calling without physical threat is Hostile (4), not Dangerous.

## Example I: Pure insult (no logistics) - HOSTILE
FROM Ronald: "You're a punk"

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 4,
  "mood_label": "Hostile",
  "ai_suggestion": null
}

## Example K: Physical threat (FLAGGED)
FROM Katrina: "I'm going to kill you"

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 5,
  "mood_label": "Abusive",
  "is_flagged": true,
  "ai_suggestion": null
}
Note: Death threats set is_flagged: true. Mood reflects the hostile tone (5).

## Example L: Physical threat with logistics (FLAGGED)
FROM Alec: "Leave the suitcase by the fence or you're dead. I have a gun."

{
  "subject": "Suitcase drop-off",
  "category": "Request",
  "content": "Alec requests suitcase be left by the fence",
  "mood_score": 5,
  "mood_label": "Abusive",
  "is_flagged": true,
  "ai_suggestion": null
}
Note: Weapon mention + violence = is_flagged: true. No suggestion for flagged messages.

## Example M: Stalking threat (FLAGGED)
FROM Ronald: "I know where you live. I'm coming to get you."

{
  "subject": "Personal",
  "category": "Personal",
  "content": "",
  "mood_score": 4,
  "mood_label": "Hostile",
  "is_flagged": true,
  "ai_suggestion": null
}
Note: Stalking + "coming to get you" = is_flagged: true. Mood reflects menacing tone (4).

## Example J: Friendly message
FROM Ronald: "I can pick up the files at 3 today"

{
  "subject": "Pickup confirmation",
  "category": "Statement",
  "content": "Ronald will pick up the files at 3 today",
  "mood_score": 1,
  "mood_label": "Friendly",
  "ai_suggestion": "Sounds good, I'll have them ready."
}

---

# SECTION 4: AI SUGGESTION GUIDELINES

- For hostile messages with logistics: Brief, professional acknowledgment of logistics only
- For manipulative requests (mood 4-5): Set boundaries, don't validate. "I need to check my schedule before committing."
- For gaslighting/emotional manipulation: ai_suggestion = null (don't engage)
- For personal/emotional: ai_suggestion = null
- Keep to 1-2 sentences, never defensive

---

# SECTION 5: EMERGENCY DETECTION

Set "is_emergency": true ONLY when the message contains a genuine time-sensitive emergency requiring immediate attention.

**Medical Emergencies (is_emergency: true):**
- Someone at the ER, hospital, or urgent care
- Injuries: "broke their arm", "fell and hit their head", "allergic reaction"
- Acute illness: "high fever" (103°F+), "vomiting repeatedly", "can't breathe"
- Accidents: car accident, someone injured

**Urgent Situations Due to External Events (is_emergency: true):**
- Location closed early due to emergency (gas leak, fire, weather)
- Transportation emergency: "car broke down on the way", "can't make it - accident"
- Safety concern at a location

**Safety Concerns (is_emergency: true):**
- Someone is lost or missing
- Natural disaster, evacuation
- Injury or medical emergency at a location

**NOT Emergencies (is_emergency: false):**
- Normal schedule changes, even with urgent language ("URGENT: can you do 2pm instead of 3pm?" → false)
- Personal inconveniences ("My work meeting ran late" → false)
- Mild symptoms ("runny nose", "slight fever" → false)
- CAPS LOCK, exclamation marks, or "ASAP"/"urgent" language alone do NOT make something an emergency
- Vague safety claims without specifics ("Something happened" → false, need details)

**CRITICAL: Urgency Language ≠ Emergency**
The words "urgent", "ASAP", "NOW", "immediately", CAPS, and exclamation marks are NOT sufficient to trigger is_emergency. There must be an actual medical, safety, or external event emergency described.

**Examples:**
- "Someone fell and broke their arm. We're at St. Mary's ER." → is_emergency: true
- "Building just announced early closure due to gas leak. Come now." → is_emergency: true
- "Having an allergic reaction, on way to hospital" → is_emergency: true
- "Car broke down. Need you to handle the delivery NOW." → is_emergency: true (transportation emergency)
- "Can you meet at 4 instead of 5?" → is_emergency: false (schedule change)
- "URGENT: Need you to handle this over the weekend instead!" → is_emergency: false (urgent language, but just scheduling)
- "Appointment moved to Tuesday" → is_emergency: false (routine scheduling)
- "Feeling under the weather with a slight fever" → is_emergency: false (mild symptoms)

**Key Distinction - is_flagged vs is_emergency:**
- **is_flagged=true:** Physical THREATS to the recipient (death threats, violence, stalking)
- **is_emergency=true:** Urgent SITUATIONS requiring immediate attention (medical, safety, external events)

A message can be BOTH flagged AND emergency (rare), just emergency (someone at ER), or just flagged (death threat with no emergency situation).

---

# SECTION 6: COMMUNICATION PATTERN DETECTION

Identify HOW the sender communicates (patterns), separate from WHAT they're saying (categories).
Only tag patterns you're highly confident about. Multiple patterns are allowed.

## Negative Patterns (tag when present)

| Pattern | Definition | Example |
|---------|------------|---------|
| accusation | Blaming statements, "you always/never" | "You always forget the important things" |
| personal_attack | Insults, name-calling, character attacks | "You're such a terrible person" |
| guilt_tripping | Leveraging guilt to manipulate | "After everything I've done for you..." |
| gaslighting | Making someone doubt their reality/memory | "I never said that. You're imagining things." |
| manipulation | Using flattery or emotional tactics for gain | "You're so great at this, I know you'll understand why I need..." |
| threats | Legal threats or intimidation | "Wait until the judge hears about this" |
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
  "content": "Filtered content with speaker name (empty string if Personal)",
  "bullets": ["item1", "item2"] or null,
  "respond_by": "YYYY-MM-DD" or null,
  "mood": "Positive|Neutral|Negative",
  "mood_confidence": "high|medium|low",
  "ai_suggestion": "1-2 sentence response suggestion" or null,
  "suggestion_confidence": "high|medium|low" or null,
  "mood_score": 1-5,
  "mood_label": "Friendly|Neutral|Frustrated|Hostile|Abusive",
  "urgency": "low|medium|high|emergency",
  "summary": "same as content",
  "is_emergency": false,
  "is_flagged": false,
  "communication_patterns": [{"pattern": "gaslighting", "confidence": "high"}] or []
}

Respond ONLY with JSON. No explanation.`;
}

async function filterWithClaude(message) {
    const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const prompt = buildAnalysisPrompt(message);

    // Sonnet 5 request surface (matches claude_service.py's _call_api): no
    // `temperature` override and no assistant-turn prefill — both 400 on
    // Sonnet 5. JSON is enforced via the system prompt instead. Thinking is
    // disabled so this stays a fast, cheap classifier call.
    const response = await anthropic.messages.create({
        model: CONFIG.claude.model,
        max_tokens: CONFIG.claude.maxTokens,
        thinking: { type: 'disabled' },
        system: 'You are a JSON-only API for filtering difficult communication. Respond with exactly one valid JSON object and nothing else - no markdown, no explanation, no preamble, and no leading or trailing characters outside the object.',
        messages: [
            {
                role: 'user',
                content: prompt,
            },
        ],
    });

    const content = response.content[0]?.text || '';
    if (!content) {
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
        responses,
        bullets: parsed.bullets || null,
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
