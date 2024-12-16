import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

type Payload = {
  to: string;
  subject: string;
  html: string;
  attachments: Mail.Attachment[];
};

export const handleSendEmail = async (data: Payload) => {
  let transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.NODEMAILER_EMAIL,
      pass: process.env.NODEMAILER_PW,
    },
  });

  return (
    await transporter.sendMail({
      from: process.env.NODEMAILER_EMAIL,
      ...data,
    }),
    function (error: string, _info: string) {
      if (error) {
        throw new Error(error);
      } else {
        console.log("Email Sent");
        return true;
      }
    }
  );
};
