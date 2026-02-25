// Netlify Function: Triggered automatically when a form is submitted
// Sends confirmation email via Resend API

exports.handler = async (event) => {
  // Parse the form submission data
  const payload = JSON.parse(event.body);
  const { form_name, data } = payload;

  // Only process waitlist form submissions
  if (form_name !== 'waitlist') {
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Not a waitlist submission, skipping' })
    };
  }

  const subscriberEmail = data.email;

  if (!subscriberEmail) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'No email address provided' })
    };
  }

  // Check for Resend API key
  const RESEND_API_KEY = process.env.RESEND_API_KEY;

  if (!RESEND_API_KEY) {
    console.error('RESEND_API_KEY not configured');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Email service not configured' })
    };
  }

  // Email HTML template
  const emailHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Filtered</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9FAFB;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); padding: 40px 40px 32px; text-align: center;">
                            <!-- Logo -->
                            <div style="width: 56px; height: 56px; background-color: rgba(255,255,255,0.2); border-radius: 14px; display: inline-block; margin-bottom: 16px;">
                                <table role="presentation" style="width: 100%; height: 56px;">
                                    <tr>
                                        <td style="text-align: center; vertical-align: middle;">
                                            <span style="font-size: 28px;">&#128737;</span>
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">You're on the list!</h1>
                        </td>
                    </tr>

                    <!-- Body -->
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Thanks for joining the Filtered waitlist. We're building something special for people who deserve peaceful communication.
                            </p>

                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                <strong>What is Filtered?</strong><br>
                                An AI-powered app that filters hostile messages before you see them, so you only get the information that matters — without the emotional toll.
                            </p>

                            <!-- Features Box -->
                            <table role="presentation" style="width: 100%; background-color: #F0FDFA; border-radius: 12px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 12px; color: #0F766E; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Coming Soon</p>
                                        <ul style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 15px; line-height: 1.8;">
                                            <li>AI-filtered messages that remove hostility</li>
                                            <li>Emergency alerts you'll never miss</li>
                                            <li>Smart response suggestions</li>
                                            <li>Full message history for legal records</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                We'll email you as soon as Filtered is ready. You'll get <strong>early access</strong> and a special launch discount as a thank you for being an early supporter.
                            </p>

                            <!-- CTA Button -->
                            <table role="presentation" style="width: 100%;">
                                <tr>
                                    <td style="text-align: center; padding: 8px 0 24px;">
                                        <a href="https://filteredmessaging.com" style="display: inline-block; background-color: #0D9488; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">Visit Our Website</a>
                                    </td>
                                </tr>
                            </table>

                            <p style="margin: 0; color: #6B7280; font-size: 14px; line-height: 1.6;">
                                In the meantime, take care of yourself. You're doing great.
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0 0 8px; color: #6B7280; font-size: 13px; text-align: center;">
                                <strong style="color: #374151;">Filtered</strong> — Peaceful communication, filtered
                            </p>
                            <p style="margin: 0; color: #9CA3AF; font-size: 12px; text-align: center;">
                                You're receiving this because you signed up at filteredmessaging.com<br>
                                <a href="mailto:hello@filteredmessaging.com" style="color: #0D9488;">Contact us</a> if you have any questions
                            </p>
                        </td>
                    </tr>
                </table>

                <!-- Unsubscribe -->
                <p style="margin: 24px 0 0; color: #9CA3AF; font-size: 11px; text-align: center;">
                    Don't want these emails? <a href="mailto:hello@filteredmessaging.com?subject=Unsubscribe%20from%20Filtered%20waitlist" style="color: #9CA3AF;">Unsubscribe</a>
                </p>
            </td>
        </tr>
    </table>
</body>
</html>`;

  try {
    // Send email via Resend API
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: 'Filtered <hello@filteredmessaging.com>',
        to: [subscriberEmail],
        subject: "You're on the Filtered waitlist!",
        html: emailHtml,
        headers: {
          'List-Unsubscribe': '<mailto:hello@filteredmessaging.com?subject=Unsubscribe>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Resend API error:', result);
      return {
        statusCode: response.status,
        body: JSON.stringify({ error: 'Failed to send email', details: result })
      };
    }

    console.log('Email sent successfully to:', subscriberEmail);
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Confirmation email sent',
        email: subscriberEmail,
        resendId: result.id
      })
    };

  } catch (error) {
    console.error('Error sending email:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send email', message: error.message })
    };
  }
};
