import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
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

const json = (body: unknown, status = 200, origin = 'https://www.teryzon.com') =>
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
return json({ error: 'Origin not allowed' }, 403);
}

if (request.method !== 'POST') {
return json({ error: 'Method not allowed' }, 405, origin);
}

if (!serviceRoleKey) {
return json({ error: 'Support service is not configured' }, 503, origin);
}

try {
const payload = await request.json();

const fields = ['name', 'email', 'category', 'subject', 'description', 'priority'];

if (
  fields.some(
    (field) =>
      typeof payload[field] !== 'string' ||
      !payload[field].trim()
  ) ||
  payload.description.length > 10000
) {
  return json({ error: 'Invalid support request' }, 400, origin);
}

const authHeader = request.headers.get('authorization');
const admin = createClient(supabaseUrl, serviceRoleKey);

let userId = null;

if (authHeader?.startsWith('Bearer ')) {
  const { data: userData } = await admin.auth.getUser(authHeader.slice(7));
  userId = userData.user?.id || null;
}

const { data: ticketRow, error } = await admin
  .from('support_tickets')
  .insert({
    name: payload.name.trim(),
    email: payload.email.trim(),
    phone: String(payload.phone || '').slice(0, 40),
    category: payload.category,
    subject: payload.subject.trim().slice(0, 200),
    description: payload.description.trim(),
    priority: payload.priority,
    user_id: userId
  })
  .select('ticket_number')
  .single();

if (error || !ticketRow) {
  return json({ error: 'Unable to submit support request' }, 500, origin);
}

const ticket = ticketRow.ticket_number;
const emailName = escapeHtml(payload.name.trim());
const emailSubject = escapeHtml(payload.subject.trim());

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

    await transporter.sendMail({
      from: fromEmail,
      to: payload.email.trim(),
      subject: `We received your Teryzon support request - ${ticket}`,

      text: `Hello ${payload.name.trim()},

Thank you for contacting Teryzon.

We received your support request and our team will review it shortly.

Ticket ID: ${ticket}
Subject: ${payload.subject.trim()}
Status: Open

Please keep your ticket ID for future communication.

Regards,
Teryzon Support
https://www.teryzon.com`,

      html: `

<!doctype html>

<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support request received | Teryzon</title>
</head>

<body style="margin:0;padding:0;background-color:#f5f5f3;font-family:Arial,Helvetica,sans-serif;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f5f5f3;">
<tr>
<td align="center" style="padding:48px 16px;">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

<tr>
<td align="center" style="padding:0 0 32px;">
<img src="https://www.teryzon.com/images/Horizons%20logo%20(1).png"
     width="180"
     alt="Teryzon"
     style="display:block;width:180px;max-width:100%;height:auto;">
</td>
</tr>

<tr>
<td style="background-color:#101010;border:1px solid #242424;border-radius:18px;padding:48px 40px;">

<p style="margin:0 0 18px;color:#af533b;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
Support Request
</p>

<h1 style="margin:0 0 24px;color:#ffffff;font-size:36px;font-weight:600;line-height:1.2;letter-spacing:-0.5px;">
We've received<br>your request
</h1>

<p style="margin:0 0 16px;color:#e8e8e8;font-size:16px;line-height:1.7;">
Hi ${emailName},
</p>

<p style="margin:0 0 32px;color:#a8a8a8;font-size:16px;line-height:1.7;">
Thank you for contacting Teryzon. Our team has received your support request and will review it as soon as possible.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
       style="background-color:#171717;border:1px solid #292929;border-radius:12px;">
<tr>
<td style="padding:22px;">

<p style="margin:0 0 8px;color:#af533b;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">
Ticket ID
</p>

<p style="margin:0 0 18px;color:#ffffff;font-size:22px;font-weight:bold;line-height:1.3;">
${ticket}
</p>

<p style="margin:0;color:#969696;font-size:14px;line-height:1.8;">
<strong style="color:#e0e0e0;">Subject:</strong> ${emailSubject}<br>
<strong style="color:#e0e0e0;">Status:</strong> Open
</p>

</td>
</tr>
</table>

<p style="margin:28px 0 0;color:#929292;font-size:14px;line-height:1.7;">
Please keep your ticket ID for future communication with Teryzon Support.
</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:36px 0 26px;">
<tr>
<td style="height:1px;background-color:#292929;font-size:1px;line-height:1px;">
&nbsp;
</td>
</tr>
</table>

<p style="margin:0;color:#707070;font-size:13px;line-height:1.7;">
We'll get back to you as soon as possible.
</p>

</td>
</tr>

<tr>
<td align="center" style="padding:32px 20px 0;">

<img src="https://www.teryzon.com/images/Horizons%20mini%20logo%20(1).png"
  width="30"
  alt="Teryzon"
  style="display:block;width:30px;height:auto;margin:0 auto 14px;">

<p style="margin:0;color:#5f5f5f;font-size:12px;line-height:1.7;">
Explore. Measure. Understand. Restore.
</p>

<p style="margin:8px 0 0;color:#888888;font-size:11px;line-height:1.6;">
© 2026 Teryzon. All rights reserved.
</p>

</td>
</tr>

</table>

</td>
</tr>
</table>

</body>
</html>
`
        });

    emailSent = true;
  } catch {
    emailSent = false;
  }
}

return json({ ticket, emailSent }, 200, origin);

} catch {
return json({ error: 'Unable to submit support request' }, 500, origin);
}
});
