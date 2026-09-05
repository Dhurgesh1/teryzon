import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceRoleKey = Deno.env.get('SERVICE_ROLE_KEY')!;
const smtpHost = Deno.env.get('SMTP_HOST');
const smtpPort = Number(Deno.env.get('SMTP_PORT') || '465');
const smtpUser = Deno.env.get('SMTP_USER') || 'noreply@teryzon.com';
const smtpPassword = Deno.env.get('SMTP_PASSWORD');
const fromEmail = Deno.env.get('SUPPORT_FROM_EMAIL') || smtpUser;

const allowedOrigins = ['https://www.teryzon.com', 'https://teryzon.com'];

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (character) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character
  );

const cors = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': 'https://www.teryzon.com',
  Vary: 'Origin'
};

const json = (body: unknown, status = 200, origin = '') =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin)
        ? origin
        : cors['Access-Control-Allow-Origin'],
      'Content-Type': 'application/json'
    }
  });

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';

  if (request.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        ...cors,
        'Access-Control-Allow-Origin': allowedOrigins.includes(origin)
          ? origin
          : cors['Access-Control-Allow-Origin']
      }
    });
  }

  if (!allowedOrigins.includes(origin)) {
    return json({ error: 'Origin not allowed' }, 403, origin);
  }

  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin);
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return json({ error: 'Authentication required' }, 401, origin);
  }

  if (!serviceRoleKey || !anonKey) {
    return json({ error: 'Account deletion service is not configured' }, 503, origin);
  }

  try {
    const accessToken = authHeader.slice(7);
    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    const user = userData.user;

    if (userError || !user?.email) {
      return json({ error: 'Unable to verify the account' }, 401, origin);
    }

    const fullName = user.user_metadata?.full_name || user.user_metadata?.name || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    const { error: deletionError } = await userClient.rpc('delete_my_account');

    if (deletionError) {
      return json({ error: 'Unable to delete your account' }, 500, origin);
    }

    let emailSent = false;

    if (smtpHost && smtpPassword) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: {
            user: smtpUser,
            pass: smtpPassword
          }
        });

        const emailName = escapeHtml(String(fullName).trim() || 'there');

        await transporter.sendMail({
          from: fromEmail,
          to: user.email,
          subject: 'Your Teryzon account has been deleted',
          text: `Hi ${String(fullName).trim() || 'there'},

Your Teryzon account has been successfully deleted as requested.

Your account data and access have been removed according to Teryzon's account deletion process.

If you did not request this deletion, please contact Teryzon Support immediately.

Teryzon
Explore. Measure. Understand. Restore.
https://www.teryzon.com`,
          html: `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account deleted | Teryzon</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f3;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f3;">
<tr><td align="center" style="padding:48px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
<tr><td align="center" style="padding:0 0 32px;">
<img src="https://www.teryzon.com/images/Horizons%20logo%20(1).png" width="180" alt="Teryzon" style="display:block;width:180px;max-width:100%;height:auto;">
</td></tr>
<tr><td style="background-color:#101010;border:1px solid #242424;border-radius:18px;padding:48px 40px;">
<p style="margin:0 0 18px;color:#af533b;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Account Notice</p>
<h1 style="margin:0 0 24px;color:#ffffff;font-size:36px;font-weight:600;line-height:1.2;">Your account<br>has been deleted</h1>
<p style="margin:0 0 16px;color:#e8e8e8;font-size:16px;line-height:1.7;">Hi ${emailName},</p>
<p style="margin:0 0 18px;color:#a8a8a8;font-size:16px;line-height:1.7;">Your Teryzon account has been successfully deleted as requested.</p>
<p style="margin:0;color:#a8a8a8;font-size:16px;line-height:1.7;">Your account data and access have been removed according to Teryzon's account deletion process.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:32px;background-color:#171717;border:1px solid #292929;border-radius:12px;"><tr><td style="padding:22px;">
<p style="margin:0 0 8px;color:#af533b;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Security Note</p>
<p style="margin:0;color:#d0d0d0;font-size:14px;line-height:1.8;">If you did not request this deletion, please contact Teryzon Support immediately.</p>
</td></tr></table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 26px;"><tr><td style="height:1px;background-color:#292929;font-size:1px;line-height:1px;">&nbsp;</td></tr></table>
<p style="margin:0;color:#707070;font-size:13px;line-height:1.7;">Teryzon</p>
</td></tr>
<tr><td align="center" style="padding:32px 20px 0;">
<img src="https://www.teryzon.com/images/Horizons%20mini%20logo%20(1).png" width="30" alt="Teryzon" style="display:block;width:30px;height:auto;margin:0 auto 14px;">
<p style="margin:0;color:#5f5f5f;font-size:12px;line-height:1.7;">Explore. Measure. Understand. Restore.</p>
<p style="margin:8px 0 0;color:#888888;font-size:11px;line-height:1.6;">© 2026 Teryzon. All rights reserved.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
        });
        emailSent = true;
      } catch (error) {
        console.error('Account deletion confirmation email failed', error);
      }
    } else {
      console.error('Account deletion confirmation email skipped: SMTP is not configured');
    }

    return json({ success: true, emailSent }, 200, origin);
  } catch (error) {
    console.error('Account deletion failed', error);
    return json({ error: 'Unable to delete your account' }, 500, origin);
  }
});
