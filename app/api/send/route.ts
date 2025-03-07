import { EmailTemplate } from '@/components/EmailTemplate';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { firstName, email } = await request.json();

    if (!firstName || !email) {
      return Response.json({ error: 'First name and email are required' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: 'XAutoDM <hi@xcolddm.com>',
      to: [email],
      subject: 'Welcome to XAutoDM!',
      react: EmailTemplate({ firstName }),
    });

    if (error) {
      console.error('Error sending email:', error);
      return Response.json({ error }, { status: 500 });
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('Error in email API route:', error);
    return Response.json({ error: 'Failed to send email' }, { status: 500 });
  }
} 