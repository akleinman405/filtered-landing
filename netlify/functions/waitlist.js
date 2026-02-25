// Netlify Function: Handle waitlist form submissions
// Sends confirmation email via Resend and logs to Google Sheets

const { google } = require('googleapis');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    // Parse form data
    let email;
    let promoCode = '';
    const contentType = event.headers['content-type'] || '';

    if (contentType.includes('application/json')) {
      const body = JSON.parse(event.body);
      email = body.email;
      promoCode = (body.promo_code || '').trim().toUpperCase();
    } else {
      // URL encoded form data
      const params = new URLSearchParams(event.body);
      email = params.get('email');
      promoCode = (params.get('promo_code') || '').trim().toUpperCase();
    }

    if (!email || !email.includes('@')) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Valid email required' })
      };
    }

    // Validate promo code format (DR + letters/numbers, 4-20 chars)
    let promoValid = promoCode ? /^DR[A-Z0-9]{2,18}$/.test(promoCode) : false;

    // Deadline enforcement: promo codes expire after Feb 28, 2026 EST
    let promoExpired = false;
    if (promoValid) {
      const deadline = new Date('2026-03-01T04:59:59Z'); // Feb 28 23:59:59 EST
      if (new Date() > deadline) {
        promoValid = false;
        promoExpired = true;
      }
    }

    const timestamp = new Date().toISOString();
    const submission = { email, timestamp, source: 'website', promo_code: promoCode || null };

    // Log the submission (Netlify Functions logs are viewable in dashboard)
    console.log('New waitlist signup:', JSON.stringify(submission));
    if (promoCode) {
      console.log('Promo code submitted:', promoCode, 'Valid format:', promoValid);
    }

    // Log to Google Sheets if configured
    const GOOGLE_SHEETS_CREDENTIALS = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;

    console.log('GOOGLE_SHEET_ID exists:', !!GOOGLE_SHEET_ID);
    console.log('GOOGLE_SHEETS_CREDENTIALS exists:', !!GOOGLE_SHEETS_CREDENTIALS);
    console.log('GOOGLE_SHEETS_CREDENTIALS length:', GOOGLE_SHEETS_CREDENTIALS ? GOOGLE_SHEETS_CREDENTIALS.length : 0);

    // Track sheet write status for notification email
    let sheetWriteStatus = { success: false, error: null };

    if (GOOGLE_SHEETS_CREDENTIALS && GOOGLE_SHEET_ID) {
      try {
        console.log('Parsing credentials...');
        const credentials = JSON.parse(GOOGLE_SHEETS_CREDENTIALS);
        console.log('Credentials parsed, client_email:', credentials.client_email);

        const auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ['https://www.googleapis.com/auth/spreadsheets']
        });
        const sheets = google.sheets({ version: 'v4', auth });

        console.log('Appending to sheet:', GOOGLE_SHEET_ID);
        const result = await sheets.spreadsheets.values.append({
          spreadsheetId: GOOGLE_SHEET_ID,
          range: 'Sheet1!A:D',
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[email, timestamp, 'website', promoCode || '']]
          }
        });
        console.log('Added to Google Sheet:', email, 'Result:', JSON.stringify(result.data));
        sheetWriteStatus = { success: true, error: null };
      } catch (sheetError) {
        console.error('Google Sheets error:', sheetError.message);
        console.error('Full error:', JSON.stringify(sheetError, Object.getOwnPropertyNames(sheetError)));
        sheetWriteStatus = { success: false, error: sheetError.message };
      }
    } else {
      console.log('Skipping Google Sheets - credentials or sheet ID missing');
      sheetWriteStatus = { success: false, error: 'Missing credentials or sheet ID' };
    }

    // Send confirmation email via Resend if configured
    const RESEND_API_KEY = process.env.RESEND_API_KEY;

    if (RESEND_API_KEY) {
      try {
        const subject = promoValid
          ? "You're on the list — 6 months half off, locked in!"
          : "You're on the Filtered waitlist!";
        const emailHtml = promoValid
          ? getPromoEmailTemplate(promoCode)
          : getEmailTemplate();

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Filtered <hello@filteredmessaging.com>',
            to: [email],
            subject,
            html: emailHtml,
            headers: {
              'List-Unsubscribe': '<mailto:hello@filteredmessaging.com?subject=Unsubscribe>',
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
          })
        });

        if (!emailResponse.ok) {
          console.error('Resend error:', await emailResponse.text());
        } else {
          console.log('Confirmation email sent to:', email);
        }
      } catch (emailError) {
        console.error('Email send error:', emailError);
      }
    }

    // Notify you of new signups
    if (RESEND_API_KEY) {
      try {
        const sheetStatusHtml = sheetWriteStatus.success
          ? '<p style="color: green;">✅ <strong>Google Sheet:</strong> Successfully added</p>'
          : `<p style="color: red;">❌ <strong>Google Sheet:</strong> FAILED - ${sheetWriteStatus.error || 'Unknown error'}</p>`;

        const promoHtml = promoCode
          ? `<p><strong>Promo Code:</strong> ${promoCode} ${promoValid ? '✅ Valid' : '⚠️ Invalid format'}</p>`
          : '';

        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Filtered Waitlist <hello@filteredmessaging.com>',
            to: ['alec.m.kleinman@gmail.com'],
            subject: `${sheetWriteStatus.success ? '✅' : '❌'} New Waitlist Signup: ${email}${promoCode ? ' [PROMO: ' + promoCode + ']' : ''}`,
            html: `<p>New signup at ${timestamp}</p><p><strong>Email:</strong> ${email}</p>${promoHtml}${sheetStatusHtml}`,
            headers: {
              'List-Unsubscribe': '<mailto:hello@filteredmessaging.com?subject=Unsubscribe>',
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
            }
          })
        });
      } catch (e) {
        console.error('Notification email error:', e);
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        message: 'Thanks for joining the waitlist!',
        email,
        promo_valid: promoValid,
        promo_expired: promoExpired,
        promo_code: promoCode || null
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    };
  }
};

function getEmailTemplate() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9FAFB;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); padding: 40px 40px 32px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">You're on the list!</h1>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Thanks for joining the Filtered waitlist. We're building something special for people who deserve peaceful communication.
                            </p>
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                <strong>What is Filtered?</strong><br>
                                An AI-powered app that strips hostility out of messages, so you only see the information that matters — without the emotional toll.
                            </p>
                            <table role="presentation" style="width: 100%; background-color: #F0FDFA; border-radius: 12px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 12px; color: #0F766E; font-size: 14px; font-weight: 600; text-transform: uppercase;">Launching March 1st</p>
                                        <ul style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 15px; line-height: 1.8;">
                                            <li>AI-filtered messages that remove hostility</li>
                                            <li>Emergency alerts you'll never miss</li>
                                            <li>Smart response suggestions</li>
                                            <li>Full message history for legal records</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0; color: #6B7280; font-size: 14px;">
                                We'll email you on March 1st with download instructions. Take care of yourself!
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0; color: #6B7280; font-size: 13px; text-align: center;">
                                <strong style="color: #374151;">Filtered</strong> — Peaceful communication, filtered
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}

function getPromoEmailTemplate(promoCode) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #F9FAFB;">
    <table role="presentation" style="width: 100%; border-collapse: collapse;">
        <tr>
            <td style="padding: 40px 20px;">
                <table role="presentation" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);">
                    <tr>
                        <td style="background: linear-gradient(135deg, #0D9488 0%, #0F766E 100%); padding: 40px 40px 32px; text-align: center;">
                            <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">You're on the list!</h1>
                            <p style="margin: 12px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">6 months half off — locked in.</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <table role="presentation" style="width: 100%; background-color: #ECFDF5; border: 2px solid #6EE7B7; border-radius: 12px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 20px; text-align: center;">
                                        <p style="margin: 0 0 4px; color: #065F46; font-size: 13px; font-weight: 600; text-transform: uppercase;">Your Promo Code</p>
                                        <p style="margin: 0; color: #065F46; font-size: 28px; font-weight: 700; letter-spacing: 2px;">${promoCode}</p>
                                        <p style="margin: 8px 0 0; color: #047857; font-size: 14px; font-weight: 600;">6 months half off — save $44.97</p>
                                        <p style="margin: 4px 0 0; color: #6B7280; font-size: 12px;">Valid through March 1, 2026</p>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 20px; color: #374151; font-size: 16px; line-height: 1.6;">
                                Thanks for joining the Filtered waitlist. Your promo code is saved to your account — no need to remember it. When we launch on <strong>March 1st</strong>, your discount will be applied automatically.
                            </p>
                            <p style="margin: 0 0 24px; color: #374151; font-size: 16px; line-height: 1.6;">
                                <strong>What is Filtered?</strong><br>
                                An AI-powered app that strips hostility out of messages, so you only see the information that matters — without the emotional toll.
                            </p>
                            <table role="presentation" style="width: 100%; background-color: #F0FDFA; border-radius: 12px; margin-bottom: 24px;">
                                <tr>
                                    <td style="padding: 24px;">
                                        <p style="margin: 0 0 12px; color: #0F766E; font-size: 14px; font-weight: 600; text-transform: uppercase;">Launching March 1st</p>
                                        <ul style="margin: 0; padding: 0 0 0 20px; color: #374151; font-size: 15px; line-height: 1.8;">
                                            <li>AI-filtered messages that remove hostility</li>
                                            <li>Emergency alerts you'll never miss</li>
                                            <li>Smart response suggestions</li>
                                            <li>Full message history for legal records</li>
                                        </ul>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0; color: #6B7280; font-size: 14px;">
                                We'll email you on March 1st with download instructions. Take care of yourself!
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #F9FAFB; padding: 24px 40px; border-top: 1px solid #E5E7EB;">
                            <p style="margin: 0; color: #6B7280; font-size: 13px; text-align: center;">
                                <strong style="color: #374151;">Filtered</strong> — Peaceful communication, filtered
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>`;
}
