import nodemailer from 'nodemailer';

export interface SendEmailContent {
  title?: string;
  subtitle?: string;
  description?: string;
  buttonLabel?: string;
  buttonUrl?: string;
}

export interface SendEmailProps {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  content?: SendEmailContent;
}

export async function sendEmail({
  to,
  subject,
  text,
  html,
  content = {},
}: SendEmailProps) {
  const { title, subtitle, description, buttonLabel, buttonUrl } = content;

  // DEV MODE: Log verification URL to console instead of sending email
  if (buttonUrl && buttonUrl.includes('verify-email')) {
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📧 EMAIL VERIFICATION LINK (Development Mode)');
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Title: ${title}`);
    console.log(`Subtitle: ${subtitle}`);
    console.log(`\n🔗 Verification Link:`);
    console.log(buttonUrl);
    console.log('═══════════════════════════════════════════════════════════\n');
    return;
  }

  // For other emails, still try to send (will fail if SMTP not configured)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true, // true for port 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: `${process.env.SMTP_SENDER} <${process.env.SMTP_FROM}>`,
    to,
    subject,
    text,
    html: html || emailHtml,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email sent to ${to}`);
  } catch (error) {
    console.error(`Error sending email: ${error}`);
  }
}
