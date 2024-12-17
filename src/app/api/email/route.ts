import { NextRequest, NextResponse } from "next/server";
import { render } from "@react-email/render";
import Email from "@/components/devfest24-email";
import { handleSendEmail } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, email, firstName, lastName } = body;

    const htmlContent = await render(Email({ id, firstName, lastName }));

    await handleSendEmail({
      to: email,
      subject: "Certificate: Google DevFest 2024",
      html: htmlContent,
    });

    return NextResponse.json({ message: "Success" }, { status: 200 });
  } catch (err: any) {
    console.error("Error sending email:", err, process.env.NODEMAILER_PW);
    return NextResponse.json({ message: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json(
    { message: "GET request received" },
    { status: 200 },
  );
}
