import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';

type Payload = {
  to: string;
  subject: string;
  html: string;
  attachments: Mail.Attachment[];
};

export async function POST(request: Request) {
  try {
    const data: Payload = await request.json();

    let transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.NODEMAILER_EMAIL,
        pass: process.env.NODEMAILER_PW,
      },
    });

    await new Promise((resolve, reject) => {
      transporter.sendMail(
        {
          from: process.env.NODEMAILER_EMAIL,
          ...data,
        },
        (error, info) => {
          if (error) {
            console.error('Error sending email:', error);
            reject(error);
          } else {
            console.log('Email sent:', info.response);
            resolve(info);
          }
        }
      );
    });

    return NextResponse.json({ message: 'Email sent successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error in route handler:', error);
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
  }
}

