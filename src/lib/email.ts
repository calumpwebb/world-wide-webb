import nodemailer from 'nodemailer';
import { Resend } from 'resend';

const provider = process.env.EMAIL_PROVIDER || 'mailpit';

// Mailpit transporter (development)
const mailpitTransport = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: process.env.SMTP_SECURE === 'true',
  auth:
    process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
});

// Resend client (production)
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const fromEmail = process.env.EMAIL_FROM || 'World Wide Webb <wifi@worldwidewebb.co>';

export async function sendVerificationEmail(email: string, code: string, name: string) {
  const subject = 'Your verification code for World Wide Webb';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #000;
            color: #fff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 480px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          h1 {
            font-size: 24px;
            font-weight: 600;
            margin: 0 0 24px 0;
          }
          p {
            font-size: 16px;
            line-height: 1.5;
            margin: 0 0 16px 0;
            color: #a1a1aa;
          }
          .code {
            font-size: 36px;
            font-family: 'Courier New', Courier, monospace;
            letter-spacing: 8px;
            text-align: center;
            padding: 24px;
            background: #171717;
            color: #fff;
            border-radius: 12px;
            margin: 32px 0;
            border: 1px solid #27272a;
          }
          .footer {
            color: #52525b;
            font-size: 14px;
            margin-top: 40px;
            padding-top: 24px;
            border-top: 1px solid #27272a;
          }
          a {
            color: #a1a1aa;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Welcome to World Wide Webb</h1>
          <p>Hi ${name},</p>
          <p>Your verification code is:</p>
          <div class="code">${code}</div>
          <p>This code will expire in 10 minutes.</p>
          <p>If you didn't request this code, you can safely ignore this email.</p>
          <div class="footer">
            <p>World Wide Webb Guest WiFi</p>
          </div>
        </div>
      </body>
    </html>
  `;

  if (provider === 'resend' && resend) {
    return resend.emails.send({
      from: fromEmail,
      to: email,
      subject,
      html,
    });
  } else {
    return mailpitTransport.sendMail({
      from: fromEmail,
      to: email,
      subject,
      html,
    });
  }
}

export async function sendAdminNotification(guest: {
  name: string;
  email: string;
  macAddress: string;
  ipAddress?: string;
  authorizedAt: Date;
  expiresAt: Date;
}) {
  const subject = 'New guest connected to World Wide Webb';
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #000;
            color: #fff;
            margin: 0;
            padding: 0;
          }
          .container {
            max-width: 480px;
            margin: 0 auto;
            padding: 40px 20px;
          }
          h2 {
            font-size: 20px;
            font-weight: 600;
            margin: 0 0 24px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          td {
            padding: 12px 0;
            border-bottom: 1px solid #27272a;
          }
          td:first-child {
            color: #a1a1aa;
            width: 120px;
          }
          .mono {
            font-family: 'Courier New', Courier, monospace;
          }
          .button {
            display: inline-block;
            background: #fff;
            color: #000;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 500;
            margin-top: 24px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>New Guest Authorization</h2>
          <table>
            <tr>
              <td>Name</td>
              <td>${guest.name}</td>
            </tr>
            <tr>
              <td>Email</td>
              <td>${guest.email}</td>
            </tr>
            <tr>
              <td>MAC Address</td>
              <td class="mono">${guest.macAddress}</td>
            </tr>
            <tr>
              <td>IP Address</td>
              <td class="mono">${guest.ipAddress || 'N/A'}</td>
            </tr>
            <tr>
              <td>Authorized</td>
              <td>${guest.authorizedAt.toLocaleString()}</td>
            </tr>
            <tr>
              <td>Expires</td>
              <td>${guest.expiresAt.toLocaleString()}</td>
            </tr>
          </table>
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/admin/guests" class="button">
            View in Admin Panel
          </a>
        </div>
      </body>
    </html>
  `;

  const adminEmail = process.env.ADMIN_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;
  if (!adminEmail) {
    console.warn('No admin email configured for notifications');
    return;
  }

  if (provider === 'resend' && resend) {
    return resend.emails.send({
      from: fromEmail,
      to: adminEmail,
      subject,
      html,
    });
  } else {
    return mailpitTransport.sendMail({
      from: fromEmail,
      to: adminEmail,
      subject,
      html,
    });
  }
}

// Generate a 6-digit verification code
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
