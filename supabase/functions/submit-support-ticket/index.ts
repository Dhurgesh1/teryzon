import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const smtpHost = Deno.env.get('SMTP_HOST');
const smtpPort = Number(Deno.env.get('SMTP_PORT') || '465');
const smtpUser = Deno.env.get('SMTP_USER') || 'noreply@teryzon.com';
const smtpPassword = Deno.env.get('SMTP_PASSWORD');
const fromEmail = Deno.env.get('SUPPORT_FROM_EMAIL') || smtpUser;
const allowedOrigins = ['https://www.teryzon.com', 'https://teryzon.com'];
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
const cors = { 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': 'https://www.teryzon.com', Vary: 'Origin' };
const json = (body: unknown, status = 200, origin = 'https://www.teryzon.com') => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : cors['Access-Control-Allow-Origin'], 'Content-Type': 'application/json' } });

Deno.serve(async (request) => {
  const origin = request.headers.get('origin') || '';
  if (request.method === 'OPTIONS') return new Response('ok', { headers: { ...cors, 'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : cors['Access-Control-Allow-Origin'] } });
  if (!allowedOrigins.includes(origin)) return json({ error: 'Origin not allowed' }, 403);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405, origin);
  if (!serviceRoleKey) return json({ error: 'Support service is not configured' }, 503, origin);

  try {
    const payload = await request.json();
    const fields = ['name', 'email', 'category', 'subject', 'description', 'priority'];
    if (fields.some((field) => typeof payload[field] !== 'string' || !payload[field].trim()) || payload.description.length > 10000) return json({ error: 'Invalid support request' }, 400, origin);
    const authHeader = request.headers.get('authorization');
    const admin = createClient(supabaseUrl, serviceRoleKey);
    let userId = null;
    if (authHeader?.startsWith('Bearer ')) {
      const { data: userData } = await admin.auth.getUser(authHeader.slice(7));
      userId = userData.user?.id || null;
    }
    const { data: ticketRow, error } = await admin.from('support_tickets').insert({ name: payload.name.trim(), email: payload.email.trim(), phone: String(payload.phone || '').slice(0, 40), category: payload.category, subject: payload.subject.trim().slice(0, 200), description: payload.description.trim(), priority: payload.priority, user_id: userId }).select('ticket_number').single();
    if (error || !ticketRow) return json({ error: 'Unable to submit support request' }, 500, origin);
    const ticket = ticketRow.ticket_number;
    const emailName = escapeHtml(payload.name.trim());
    const emailSubject = escapeHtml(payload.subject.trim());

    let emailSent = false;
    if (smtpHost && smtpPassword) {
      try {
        const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPassword } });
        await transporter.sendMail({
          from: fromEmail,
          to: payload.email.trim(),
          subject: `We received your Teryzon support request - ${ticket}`,
          text: `Hello ${payload.name.trim()},\n\nThank you for contacting Teryzon. We received your support request and our team will review it shortly.\n\nTicket ID: ${ticket}\nSubject: ${payload.subject.trim()}\nStatus: Open\n\nPlease keep your ticket ID for future communication.\n\nRegards,\nTeryzon Support\nhttps://www.teryzon.com`,
          html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Support request received | Teryzon</title></head><body style="margin:0;padding:0;background-color:#000;color:#f4eee9;font-family:Arial,Helvetica,sans-serif"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#000"><tr><td align="center" style="padding:40px 16px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px"><tr><td align="center" style="padding:8px 0 34px"><img src="https://teryzon.com/images/Horizons%20logo%20(1).png" width="190" alt="Teryzon" style="display:block;height:auto;max-width:190px"></td></tr><tr><td style="border-top:1px solid #30221e;border-bottom:1px solid #30221e;padding:42px 34px 40px;background-color:#0b0807"><p style="margin:0 0 12px;color:#f4eee9;font-size:18px;line-height:1.7">Hi ${emailName}!</p><p style="margin:0 0 18px;color:#af533b;font-size:11px;font-weight:bold;letter-spacing:3px;text-transform:uppercase">Support request received</p><h1 style="margin:0 0 20px;color:#f4eee9;font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:normal;line-height:1.08">We have your request</h1><p style="margin:0 0 28px;color:#a89d96;font-size:16px;line-height:1.7">Thank you for contacting Teryzon. Our team will review your request and follow up as soon as possible.</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#120d0b;border-left:3px solid #af533b;margin:0 0 26px"><tr><td style="padding:18px 20px"><p style="margin:0 0 7px;color:#a89d96;font-size:11px;letter-spacing:3px;text-transform:uppercase">Ticket ID</p><p style="margin:0;color:#f4eee9;font-size:21px;font-weight:bold">${ticket}</p><p style="margin:14px 0 0;color:#a89d96;font-size:14px;line-height:1.7"><strong style="color:#f4eee9">Subject:</strong> ${emailSubject}<br><strong style="color:#f4eee9">Status:</strong> Open</p></td></tr></table><p style="margin:0;color:#a89d96;font-size:15px;line-height:1.7">Please keep your ticket ID for future communication.</p></td></tr><tr><td align="center" style="padding:26px 20px 0"><p style="margin:0;color:#756b65;font-size:12px;line-height:1.6">Robotics, sensors, and intelligence for healthier soil.</p><img src="https://teryzon.com/images/Horizons%20mini%20logo%20(1).png" width="28" alt="Teryzon" style="display:block;height:auto;margin:12px auto 0;width:28px"></td></tr></table></td></tr></table></body></html>`
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
