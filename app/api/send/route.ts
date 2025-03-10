import { EmailTemplate } from '@/components/EmailTemplate';
import { Resend } from 'resend';

// Check for API key and provide better error handling
const RESEND_API_KEY = process.env.RESEND_API_KEY;
if (!RESEND_API_KEY) {
  console.error('RESEND_API_KEY is not defined in the environment variables');
}

// Create the resend instance with proper key
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export async function POST(request: Request) {
  try {
    const { firstName, email } = await request.json();

    if (!firstName || !email) {
      return Response.json({ error: 'First name and email are required' }, { status: 400 });
    }

    // Check if resend is properly initialized
    if (!resend) {
      console.error('Resend client not initialized. Missing API key.');
      return Response.json({ 
        error: 'Email service not configured', 
        success: false 
      }, { status: 500 });
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