# Google Play Store Submission - Complete Guide

**Date:** 2026-01-22

---

## YOUR QUESTIONS ANSWERED

### 1. App Access - Which do I choose?

**Choose: "All or some functionality in my app is restricted"**

Why? Your app requires:
- User login (email/password via Supabase)
- Subscription after 7-day trial

**What to provide:**
You need to give Google test credentials. See `TEST-CREDENTIALS.txt` in this folder.

In the Play Console, you'll enter:
- Username: (test email you create)
- Password: (test password)
- Instructions: "Use these credentials to log in. The test account has an active subscription."

---

### 2. Do we collect/share required user data types? Is it encrypted in transit?

**Yes, you collect data. Yes, it's encrypted.**

**Data Safety Form Answers:**

| Question | Answer |
|----------|--------|
| Does your app collect or share user data? | **Yes** |
| Is all collected data encrypted in transit? | **Yes** (uses HTTPS/TLS) |
| Do you provide a way to request data deletion? | **Yes** (see question 3) |

**Data Types Collected:**

| Data Type | Collected | Shared | Purpose |
|-----------|-----------|--------|---------|
| Name | Yes | No | Account profile |
| Email | Yes | No | Account login, notifications |
| Messages | Yes | No | Core app functionality |
| Device IDs | Yes | No | Push notifications |

**Security Practices to Select:**
- [x] Data is encrypted in transit
- [x] Data is encrypted at rest (Fernet encryption for messages)
- [x] Users can request data deletion

---

### 3. Do we have a link for account/data deletion?

**Yes! Created a self-service page:**

**Account/Data Deletion Page:** `https://filteredmessaging.com/delete-account.html`

Users can:
- Sign in with their credentials
- Choose to **delete data only** (keep account for fresh start) OR
- **Delete entire account** and all data permanently

**For Play Store submission, provide:**
- **Privacy Policy URL:** `https://filteredmessaging.com/privacy.html`
- **Data deletion mechanism:** `https://filteredmessaging.com/delete-account.html`

---

## FILES IN THIS FOLDER

| File | Size | Purpose |
|------|------|---------|
| `app-icon-512x512.png` | 512x512 | App icon for store listing |
| `feature-graphic-1024x500.png` | 1024x500 | Banner at top of store listing |
| `screenshots/01-conversation-filtered.png` | Phone | Shows filtered message view |
| `screenshots/02-tasks-dashboard.png` | Phone | Shows task tracking |
| `screenshots/03-messages-list.png` | Phone | Shows conversations list |
| `screenshots/04-filtering-preferences.png` | Phone | Shows customization |
| `screenshots/05-settings.png` | Phone | Shows settings/invite |

---

## STORE LISTING CONTENT (Copy/Paste)

### App Name (30 chars max)
```
Filtered: Co-Parent Messaging
```

### Short Description (80 chars max)
```
AI-powered co-parent communication. Filter hostility, keep the facts.
```

### Full Description
```
Protect your peace while staying connected with your co-parent.

Filtered uses AI to transform hostile, manipulative, or emotionally draining messages into calm, actionable summaries. You get the facts you need without the emotional toll.

HOW IT WORKS
━━━━━━━━━━━━
• Your co-parent sends messages through Filtered
• AI analyzes each message and removes hostility
• You see a summary with mood indicator, key points, and action items
• Original message is always available if needed
• AI suggests neutral response options

KEY FEATURES
━━━━━━━━━━━━
✓ AI Message Filtering - Automatically removes insults, blame, and manipulation
✓ Mood Indicators - Know the emotional tone before reading
✓ Action Item Extraction - Never miss important requests or deadlines
✓ Smart Response Suggestions - AI helps you respond calmly and effectively
✓ Custom Filtering Rules - Block topics like dating, finances, or guests
✓ Task Management - Track requests, questions, and proposals
✓ Court-Ready Documentation - All messages stored for 2 years with timestamps
✓ Emergency Detection - Urgent messages always get through

WHO IT'S FOR
━━━━━━━━━━━━
• Co-parents dealing with a high-conflict ex
• Anyone tired of hostile text messages
• Parents who want to focus on their children, not drama
• Those who need documentation for legal proceedings

PRIVACY & SECURITY
━━━━━━━━━━━━━━━━━━
• End-to-end encryption for all messages
• Original messages stored securely
• Export your data anytime
• GDPR and CCPA compliant

PRICING
━━━━━━━
• 7-day free trial
• $14.99/month or $119.99/year (save 33%)
• Your co-parent joins FREE when you invite them

Stop absorbing hostility. Start co-parenting peacefully.

Questions? Contact us at info@filteredmessaging.com

Website: https://filteredmessaging.com
Privacy Policy: https://filteredmessaging.com/privacy.html
Terms of Service: https://filteredmessaging.com/terms.html
```

### Category
```
Communication
```

### Tags
```
co-parenting, coparent, divorce, custody, parenting app, message filter, co-parent communication, parallel parenting, high conflict, family communication
```

---

## RELEASE NOTES (First Release)
```
Welcome to Filtered!

This is the first release of our AI-powered co-parent communication app.

Features:
• AI message filtering removes hostility automatically
• Mood indicators show emotional tone at a glance
• Smart response suggestions help you stay calm
• Custom filtering rules for topics you want to avoid
• Task tracking for requests and deadlines
• Court-ready message documentation

Start your 7-day free trial today.

Questions? info@filteredmessaging.com
```

---

## CONTENT RATING ANSWERS

| Question | Answer |
|----------|--------|
| Violence | None |
| Sexual Content | None |
| Profanity/Crude Humor | None (app filters it out) |
| Drugs/Alcohol | None |
| Simulated Gambling | None |
| User-Generated Content | Yes (messages) |
| Users Can Interact | Yes (messaging) |
| Shares Location | No |
| Contains Ads | No |
| In-App Purchases | Yes (subscription) |

**Expected Rating:** Everyone / PEGI 3

---

## DATA SAFETY FORM - COMPLETE ANSWERS

### Overview
- Does your app collect or share user data? **Yes**
- Is all collected data encrypted in transit? **Yes**
- Do you provide a way for users to request data deletion? **Yes**

### Data Types

**Personal Info:**
- Name: Collected, Not Shared, Required for app functionality
- Email: Collected, Not Shared, Required for account & notifications

**Messages:**
- Other in-app messages: Collected, Not Shared, Required for core functionality

**App Activity:**
- App interactions: Collected, Not Shared, Analytics & functionality

**Device or Other IDs:**
- Device identifiers: Collected, Not Shared, Push notifications

### Security Practices
- [x] Data is encrypted in transit (HTTPS/TLS)
- [x] You provide a way for users to request that their data is deleted
- [x] Data is transferred using a secure connection

---

## CHECKLIST

- [ ] Create test account (see TEST-CREDENTIALS.txt)
- [ ] Upload app icon (512x512)
- [ ] Upload feature graphic (1024x500)
- [ ] Upload screenshots (5 included)
- [ ] Fill in store listing (copy from above)
- [ ] Complete content rating questionnaire
- [ ] Complete data safety form
- [ ] Set up pricing (free trial + subscription)
- [ ] Add privacy policy URL
- [ ] Enter app access test credentials
- [ ] Upload AAB file
- [ ] Submit for review

---

*Generated by Claude Code on 2026-01-22*
