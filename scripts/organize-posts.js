#!/usr/bin/env node
/**
 * Organize posts into day/post folders with images and captions
 */

const fs = require('fs');
const path = require('path');

const BASE = '/Users/aleckleinman/Documents/Filtered - Coparent Communication App/filtered-landing/social-media-assets';
const GENERATED = path.join(BASE, 'generated/month-1');
const SCHEDULING = path.join(BASE, 'scheduling');

// Post definitions with captions
const posts = [
  // DAY 1
  {
    day: 1, post: 1, name: 'carousel-intro',
    images: 'carousel-01',
    caption: `That moment when their name appears on your phone and your stomach drops? You're not alone.

Millions of co-parents experience the same anxiety every time a message arrives. Not because they can't handle hard conversations—but because the message often comes wrapped in frustration, accusations, or passive-aggressive comments.

Here's the thing: You need to co-parent. You need to coordinate schedules, make decisions, share information about your kids.

But you don't need to absorb their hostility to do that.

Filtered shows you the actionable information—what they're asking for, any deadlines, any decisions needed—without the emotional charge.

The original is always there for documentation. But now you have a choice about when and how to engage with it.

What would change for you if you could see just the facts first?

—
📱 Link in bio to learn more about Filtered.

#coparenting #coparentingapp #peacefulcoparenting #coparentingtips #divorcedparents`
  },
  {
    day: 1, post: 2, name: 'static-coparent-quote',
    images: 'static/static-01-coparent-anger.png',
    caption: `This is the difference that changes everything.

Co-parenting requires communication. It requires coordination. It requires sharing information about the people you love most.

But it doesn't require absorbing hostility. It doesn't require decoding passive-aggression. It doesn't require bracing for impact every time their name appears on your phone.

The information and the delivery are two different things.

You deserve to receive one without being hurt by the other.

Save this for a hard day.

—
📱 Link in bio to learn about Filtered.

#coparenting #peacefulcoparenting #coparentingtips #boundaries #divorcedparents`
  },
  {
    day: 1, post: 3, name: 'carousel-dads',
    images: 'carousel-01b',
    caption: `To the dads in this community: this one's for you.

Co-parenting resources often assume the audience is exclusively moms. But dads are navigating the same anxiety, the same difficult texts, the same sleepless nights wondering if they said the right thing.

You don't have to explain:
• Why you want to be involved
• Why your parenting looks different
• Why this is hard for you too
• Why you need boundaries
• Why you need support

Different perspectives on parenting can coexist. Your kids benefit from knowing both their parents, both their homes, both their ways of doing things.

What would you add to this list? 👇

—
📱 Filtered works for all co-parents. Link in bio.

#coparenting #coparentingdads #fatherhood #divorceddads #singleparents #peacefulcoparenting`
  },
  {
    day: 1, post: 4, name: 'static-biff-quote',
    images: 'static/static-02-biff.png',
    caption: `Four words. One framework. A complete shift in how you communicate.

BIFF isn't about being a pushover. It's about being strategic with your energy.

Brief = Don't give them 5 paragraphs to argue with.
Informative = Facts, not feelings.
Friendly = Professional warmth.
Firm = End the conversation.

Credit where it's due: This comes from Bill Eddy at the High Conflict Institute. Worth looking into.

Save this for your next difficult exchange.

—
#BIFF #coparenting #peacefulcoparenting #coparentingtips`
  },
  {
    day: 1, post: 5, name: 'carousel-biff-method',
    images: 'carousel-02',
    caption: `If there's one framework that changes co-parent communication, it's BIFF.

Brief. Informative. Friendly. Firm.

Created by Bill Eddy at the High Conflict Institute, BIFF is designed for exactly these situations—when you need to communicate with someone who makes communication difficult.

Here's what many co-parents learn:

• Brief: Long explanations invite debate. They see your 5 paragraphs as 5 opportunities to argue. One sentence gives them nothing to fight.

• Informative: Facts only. The moment you add emotions or opinions, you've handed them ammunition.

• Friendly: Professional warmth. Not cold, not over-the-top. Like you'd email a difficult colleague.

• Firm: End the conversation. No questions that invite more back-and-forth.

The hardest part? Letting go of the need to be understood.

Their 3-paragraph accusation doesn't require 3 paragraphs back. Your BIFF response isn't about changing their mind. It's about giving them the information and protecting your peace.

What part of BIFF do you find hardest? 👇

—
📱 Filtered suggests BIFF-style responses automatically. Link in bio.

Credit: Bill Eddy, High Conflict Institute.

#coparenting #BIFF #coparentingtips #peacefulcoparenting #parallelparenting`
  },

  // DAY 2
  {
    day: 2, post: 1, name: 'static-boundaries-quote',
    images: 'static/static-03-boundaries.png',
    caption: `This reframe changes everything.

When you stop seeing boundaries as something you're doing TO your co-parent and start seeing them as something you're doing FOR yourself...

It gets easier to set them. Easier to keep them. Easier to let go of the guilt.

Boundaries don't have to be aggressive. "I'll respond by tomorrow" isn't punishment. It's pacing.

"I'm not discussing that via text" isn't rejection. It's structure.

"Let's keep this about the kids" isn't cold. It's focused.

You're not punishing them. You're protecting yourself. There's a difference.

Save this for when the guilt creeps in.

—
#coparenting #boundaries #peacefulcoparenting`
  },
  {
    day: 2, post: 2, name: 'carousel-boundaries',
    images: 'carousel-03',
    caption: `"I need an answer NOW."

The demand feels urgent. Your body responds like it's urgent. But is it actually urgent?

Here's the boundary that changes everything:

"I'll review this and respond by [time/date]."

That's it. One sentence. No justification, no apology, no explanation.

What many co-parents learn:
• Their urgency is often manufactured
• Non-emergencies can wait 24 hours
• Responding reactively usually makes things worse
• A thoughtful response beats a fast one

The only exception? Actual emergencies involving your children's safety.

"What should I pack for soccer?" is not an emergency.
"Child has a high fever and needs a medical decision" might be.

Know the difference. Set your timeline. Protect your peace.

What boundary has helped you most? 👇

—
📱 Filtered gives you a pause button before responding. Link in bio.

#coparenting #boundaries #coparentingtips #peacefulcoparenting`
  },
  {
    day: 2, post: 3, name: 'static-everything-right',
    images: 'static/static-03b-everything-right.png',
    caption: `This one's important.

You can set perfect boundaries. You can use BIFF every time. You can respond thoughtfully, document carefully, protect your peace at every turn.

And sometimes... they still don't change.

Their behavior might not improve. The anxiety might not fully disappear. The co-parenting relationship might never become easy.

That's not your failure.

You can only control your own responses. Their behavior is outside your control.

What you've done:
• Protected your nervous system
• Modeled healthy communication for your kids
• Given yourself the gift of thoughtful responses
• Created consistency for yourself

That's not nothing. That's everything you CAN do.

If you're doing your best and it still feels hard—you're not alone. And you're not failing.

—
#coparenting #peacefulcoparenting #coparentingtips`
  },
  {
    day: 2, post: 4, name: 'static-nervous-system',
    images: 'static/static-04-nervous-system.png',
    caption: `Please hear this: Your anxiety response is not a character flaw.

When your stomach drops at their name on your phone, that's your nervous system using past data to predict the future. It's trying to protect you.

The work isn't to "stop being anxious." (That's not how nervous systems work.)

The work is to:
• Recognize the response
• Create space before engaging
• Let your body regulate
• Then choose your next move

You can't control the initial response. You can control what you do next.

—
#coparenting #nervoussystem #peacefulcoparenting`
  },

  // DAY 3
  {
    day: 3, post: 1, name: 'carousel-nervous-system',
    images: 'carousel-04',
    caption: `You know that feeling when their name appears and your stomach drops before you even read the message?

That's not weakness. That's your nervous system doing its job.

Here's what's actually happening:

Your brain has learned (through experience) that messages from your co-parent sometimes mean conflict. So your body starts responding to the notification itself as a potential threat.

This is fight-or-flight. And it happens in milliseconds—before you've even opened the message.

Here's why it matters:

When you're in fight-or-flight, your thinking brain takes a backseat. Stress hormones are running the show. That's why texts drafted at 2am in an emotional state feel reasonable then but cringe-worthy later.

What helps:

1. Recognize it ("That's just my nervous system activating")
2. Create space ("I don't have to open this right now")
3. Wait for regulation (Let the stress response pass)
4. Then respond (From a clearer state)

The goal isn't to never feel the anxiety. It's to recognize it and choose when to engage.

Your body is trying to protect you. That's not weakness—that's wisdom.

—
📱 Filtered gives you a built-in pause. Link in bio.

#coparenting #nervoussystem #peacefulcoparenting`
  },
  {
    day: 3, post: 2, name: 'carousel-self-reflection',
    images: 'carousel-04b',
    caption: `This is the uncomfortable one.

We talk a lot about protecting your peace, setting boundaries, and responding to difficult behavior. All of that matters.

But sometimes the honest question is: "Am I contributing to this?"

Not blaming yourself. Not excusing their behavior. Just... honest reflection.

Questions worth asking:
• Do I over-explain when one sentence would do?
• Do I match their energy instead of choosing my own?
• Do I respond when silence would be more effective?
• Do I sometimes want to "win" the exchange?
• Have I made this harder by not setting boundaries earlier?

You can be dealing with genuinely difficult behavior AND have patterns worth examining.

Both things can be true.

Self-awareness isn't weakness. It's part of the growth.

What pattern have you noticed in yourself? 👇

—
#coparenting #selfawareness #peacefulcoparenting #coparentingtips`
  },
  {
    day: 3, post: 3, name: 'reshare-static-coparent',
    images: 'static/static-01-coparent-anger.png',
    caption: `Save this for a hard day. 💙

You need to co-parent.
You don't need to absorb their anger.

—
📱 Link in bio

#coparenting #peacefulcoparenting #coparentingtips`
  },
  {
    day: 3, post: 4, name: 'reshare-static-biff',
    images: 'static/static-02-biff.png',
    caption: `The framework that changes everything.

Brief. Informative. Friendly. Firm.

Save this for your next difficult exchange.

—
Credit: Bill Eddy, High Conflict Institute

#BIFF #coparenting #coparentingtips`
  },

  // DAY 4
  {
    day: 4, post: 1, name: 'teaser-carousel-intro',
    images: 'carousel-01/carousel-01-slide-01.png',
    caption: `What if you could read your co-parent's messages without the anxiety?

That's exactly what Filtered does.

Check out our pinned post to learn more, or tap the link in bio.

#coparenting #coparentingapp #peacefulcoparenting`
  },
  {
    day: 4, post: 2, name: 'reshare-static-boundaries',
    images: 'static/static-03-boundaries.png',
    caption: `Boundaries aren't about them. They're about you.

They're not punishment—they're protection.

Save this for when the guilt creeps in.

#boundaries #coparenting #peacefulcoparenting`
  },
  {
    day: 4, post: 3, name: 'biff-letter-b',
    images: 'carousel-02/carousel-02-slide-03.png',
    caption: `B = Brief

The first letter of BIFF.

Keep responses short. One paragraph max—often one sentence is better.

Long explanations invite debate. Short responses end conversations.

✗ "I understand you're frustrated, and I want to explain..."
✓ "I can do 5pm pickup."

—
Credit: Bill Eddy, High Conflict Institute

#BIFF #coparenting #coparentingtips`
  },
  {
    day: 4, post: 4, name: 'reshare-static-nervous',
    images: 'static/static-04-nervous-system.png',
    caption: `Your anxiety response is valid.

It's not weakness—it's your nervous system doing its job.

The goal isn't to stop feeling it. It's to recognize it and choose what comes next.

#nervoussystem #coparenting #peacefulcoparenting`
  },

  // DAY 5
  {
    day: 5, post: 1, name: 'biff-letter-i',
    images: 'carousel-02/carousel-02-slide-04.png',
    caption: `I = Informative

The second letter of BIFF.

Stick to facts. No opinions, no emotions, no defensiveness.

Just the relevant information.

✗ "You always do this, but fine, I GUESS I can change my plans..."
✓ "I can adjust the pickup time to 5pm on Saturday."

—
Credit: Bill Eddy, High Conflict Institute

#BIFF #coparenting #coparentingtips`
  },
  {
    day: 5, post: 2, name: 'biff-letter-f1',
    images: 'carousel-02/carousel-02-slide-05.png',
    caption: `F = Friendly

The third letter of BIFF.

Neutral tone. Not aggressive, not overly warm.

Professional warmth—like you'd use with a colleague.

✗ "Whatever you want." (passive-aggressive)
✗ "Of course, sweetie! Anything!" (over-accommodating)
✓ "Thanks for letting me know."

—
Credit: Bill Eddy, High Conflict Institute

#BIFF #coparenting #coparentingtips`
  },
  {
    day: 5, post: 3, name: 'biff-letter-f2',
    images: 'carousel-02/carousel-02-slide-06.png',
    caption: `F = Firm

The fourth letter of BIFF.

End the conversation. Don't leave room for debate.

No questions that invite argument. No openings for continued conflict.

✗ "Does that work for you? What do you think?"
✓ "See you Saturday at 5pm."

—
Credit: Bill Eddy, High Conflict Institute

#BIFF #coparenting #coparentingtips`
  },
  {
    day: 5, post: 4, name: 'reshare-everything-right',
    images: 'static/static-03b-everything-right.png',
    caption: `Sometimes you do everything right and they still don't change.

That's not your failure.

You can only control your own responses.

—
#coparenting #peacefulcoparenting #selfcare`
  }
];

// Create folders and copy files
function organize() {
  console.log('Organizing posts into scheduling folders...\n');

  posts.forEach(post => {
    const folderName = `day-${post.day}-post-${post.post}-${post.name}`;
    const folderPath = path.join(SCHEDULING, `day-${post.day}`, folderName);

    // Create folder
    fs.mkdirSync(folderPath, { recursive: true });

    // Copy images
    if (post.images.includes('/')) {
      // Single file path
      const srcPath = path.join(GENERATED, post.images);
      const destPath = path.join(folderPath, '01-image.png');
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    } else {
      // Directory of images (carousel)
      const srcDir = path.join(GENERATED, post.images);
      if (fs.existsSync(srcDir)) {
        const files = fs.readdirSync(srcDir)
          .filter(f => f.endsWith('.png'))
          .sort();
        files.forEach((file, idx) => {
          const num = String(idx + 1).padStart(2, '0');
          fs.copyFileSync(
            path.join(srcDir, file),
            path.join(folderPath, `${num}-${file}`)
          );
        });
      }
    }

    // Write caption
    fs.writeFileSync(path.join(folderPath, 'caption.txt'), post.caption);

    console.log(`  ✓ ${folderName}`);
  });

  console.log(`\nOrganized ${posts.length} posts into ${SCHEDULING}`);
}

organize();
