import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

type Payload = {
  to: string;
  subject: string;
  html: string;
  attachments?: Mail.Attachment[];
};

export const handleSendEmail = async (data: Payload) => {
  let transporter = nodemailer.createTransport({
    host: "smtp.hostinger.com",
    port: 465,
    secure: true,
    debug: process.env.NODE_ENV === "development",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PW,
    },
  });

  return (
    await transporter.sendMail({
      from: "no-reply@omsimos.com",
      ...data,
    }),
    function (error: string, _info: string) {
      if (error) {
        console.log("Your Email", process.env.NODEMAILER_EMAIL);
        throw new Error(error);
      } else {
        console.log("Email Sent");
        return true;
      }
    }
  );
};
