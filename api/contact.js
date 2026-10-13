// Contact Form API Handler
const fs = require('fs');
const path = require('path');

// Load .env if present
const envFile = path.join(__dirname, '..', '.env');
if (fs.existsSync(envFile)) {
    try {
        const envContent = fs.readFileSync(envFile, 'utf8');
        envContent.split(/\r?\n/).forEach(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const idx = trimmed.indexOf('=');
                if (idx > 0) {
                    const key = trimmed.slice(0, idx).trim();
                    const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
                    if (!process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
        });
    } catch (e) {}
}

let nodemailer;
try {
    nodemailer = require('nodemailer');
} catch (e) {
    nodemailer = null;
}

// Ensure data directory exists for persistent message storage
const DATA_DIR = path.join(__dirname, '..', 'data');
const MESSAGES_FILE = path.join(DATA_DIR, 'contact_messages.json');

function saveMessageLocally(msgData) {
    try {
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }
        let list = [];
        if (fs.existsSync(MESSAGES_FILE)) {
            try {
                list = JSON.parse(fs.readFileSync(MESSAGES_FILE, 'utf8') || '[]');
            } catch (err) {
                list = [];
            }
        }
        list.unshift(msgData);
        fs.writeFileSync(MESSAGES_FILE, JSON.stringify(list, null, 2), 'utf8');
    } catch (err) {
        console.error('Failed to save message to contact_messages.json:', err.message);
    }
}

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
        const { name, email, subject, message, video_link, captchaAnswer, captchaExpected } = body;

        if (!name || !email || !message) {
            return res.status(400).json({
                success: false,
                error: 'Please fill in all required fields (Name, Email, Message).'
            });
        }

        // Validate Captcha
        if (captchaExpected !== undefined && captchaAnswer !== undefined) {
            if (String(captchaAnswer).trim() !== String(captchaExpected).trim()) {
                return res.status(400).json({
                    success: false,
                    error: 'Incorrect captcha answer. Please solve the security check again.'
                });
            }
        }

        const timestamp = new Date().toISOString();
        const msgRecord = {
            id: 'msg_' + Date.now(),
            timestamp,
            name: name.trim(),
            email: email.trim(),
            subject: (subject || 'General Inquiry').trim(),
            video_link: (video_link || '').trim(),
            message: message.trim(),
            emailDelivered: false
        };

        // Determine SMTP Credentials from environment variables or .env
        const smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER || process.env.GMAIL_USER || 'nimpataaaa@gmail.com').trim();
        const rawPass = process.env.SMTP_PASS || process.env.EMAIL_PASS || process.env.GMAIL_APP_PASS || 'xoeu cnhk yzly pmla';
        const smtpPass = rawPass.replace(/\s+/g, '');
        const targetRecipient = (process.env.CONTACT_RECEIVER_EMAIL || process.env.EMAIL_TO || smtpUser || 'nimpataaaa@gmail.com').trim();

        let emailSent = false;

        if (nodemailer && smtpUser && smtpPass) {
            try {
                const transporter = nodemailer.createTransport({
                    service: process.env.SMTP_SERVICE || (smtpUser.includes('gmail.com') ? 'gmail' : undefined),
                    host: process.env.SMTP_HOST || (!smtpUser.includes('gmail.com') ? 'smtp.gmail.com' : undefined),
                    port: parseInt(process.env.SMTP_PORT || '465', 10),
                    secure: process.env.SMTP_SECURE !== 'false',
                    auth: {
                        user: smtpUser,
                        pass: smtpPass
                    }
                });

                const htmlContent = `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                        <div style="background: #2c3e50; color: #ffffff; padding: 20px; text-align: center;">
                            <h2 style="margin: 0; font-size: 20px;">New Contact Inquiry - FBDock</h2>
                        </div>
                        <div style="padding: 24px; background: #ffffff;">
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b; width: 120px;"><strong>Sender Name:</strong></td>
                                    <td style="padding: 8px 0; color: #1e293b; font-weight: 600;">${name}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;"><strong>Sender Email:</strong></td>
                                    <td style="padding: 8px 0;"><a href="mailto:${email}" style="color: #0288d1; text-decoration: none;">${email}</a></td>
                                </tr>
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;"><strong>Subject:</strong></td>
                                    <td style="padding: 8px 0; color: #1e293b;">${subject || 'None'}</td>
                                </tr>
                                ${video_link ? `
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;"><strong>Video Link:</strong></td>
                                    <td style="padding: 8px 0;"><a href="${video_link}" target="_blank" style="color: #0288d1; text-decoration: none;">${video_link}</a></td>
                                </tr>` : ''}
                                <tr>
                                    <td style="padding: 8px 0; color: #64748b;"><strong>Received:</strong></td>
                                    <td style="padding: 8px 0; color: #475569;">${new Date().toLocaleString()}</td>
                                </tr>
                            </table>
                            <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border-left: 4px solid #0288d1; border-radius: 4px;">
                                <h4 style="margin: 0 0 8px 0; color: #334155; font-size: 14px;">Message Content:</h4>
                                <p style="margin: 0; color: #1e293b; line-height: 1.6; white-space: pre-wrap;">${message}</p>
                            </div>
                        </div>
                        <div style="background: #f1f5f9; padding: 12px; text-align: center; color: #94a3b8; font-size: 12px;">
                            This message was sent from the FBDock Contact Form. Reply directly to this email to contact the sender.
                        </div>
                    </div>
                `;

                await transporter.sendMail({
                    from: `"FBDock Contact" <${smtpUser}>`,
                    replyTo: email,
                    to: targetRecipient,
                    subject: `[FBDock] ${subject || 'New Contact Message from ' + name}`,
                    html: htmlContent
                });

                emailSent = true;
                msgRecord.emailDelivered = true;
                console.log(`[Email Delivered] Sent message from ${email} to ${targetRecipient}`);
            } catch (smtpErr) {
                console.error('[SMTP Error] Could not dispatch email via SMTP:', smtpErr.message);
                msgRecord.smtpError = smtpErr.message;
            }
        } else {
            console.log(`[Contact Form] Storing inquiry locally (SMTP not configured in .env).`);
            console.log(`From: ${name} <${email}> | Subject: ${subject || 'None'}`);
        }

        // Always save every message locally so no inquiry is ever lost
        saveMessageLocally(msgRecord);

        // Return a clean, professional response without exposing any email addresses!
        return res.status(200).json({
            success: true,
            emailDelivered: emailSent,
            message: 'Thank you! Your message has been sent successfully. Our support team has received your inquiry and will get back to you shortly.'
        });

    } catch (err) {
        console.error('Contact handler error:', err);
        return res.status(500).json({
            success: false,
            error: 'An unexpected error occurred while sending your message. Please try again shortly.'
        });
    }
};
