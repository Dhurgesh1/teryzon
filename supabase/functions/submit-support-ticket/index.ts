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
const cors = { 'Access-Control-Allow-Headers': 'authorization, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Origin': 'https://www.teryzon.com', Vary: 'Origin' };
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

    let emailSent = false;
    if (smtpHost && smtpPassword) {
      try {
        const transporter = nodemailer.createTransport({ host: smtpHost, port: smtpPort, secure: smtpPort === 465, auth: { user: smtpUser, pass: smtpPassword } });
        await transporter.sendMail({ from: fromEmail, to: payload.email.trim(), subject: `Teryzon support request ${ticket}`, text: `We received your support request: ${payload.subject.trim()}\n\nTicket ID: ${ticket}\nStatus: Open\n\nKeep this ticket ID for future communication.` });
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
