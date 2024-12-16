import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Tailwind,
  Text,
} from "@react-email/components";
import * as React from "react";

type Props = {
  id: string;
  firstName: string;
  lastName: string;
};

export const CertificateEmail = ({ id, firstName, lastName }: Props) => {
  const previewText = "Claim Your Certificate!";

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="bg-white my-auto mx-auto font-sans">
          <Container className="border border-solid border-[#eaeaea] rounded my-[40px] mx-auto p-[20px] w-[465px]">
            <Heading className="text-black text-[24px] font-normal text-center p-0 my-[30px] mx-0">
              <strong>GDG Bacolod</strong>
            </Heading>
            <Text>
              Hello {firstName} {lastName},
            </Text>
            <Text className="text-black text-[14px] leading-[24px]">
              We&apos;re excited to let you know that your certificate for{" "}
              <strong>Google DevFest 2024</strong> is ready and waiting for you.
              🎉 To claim it, just click the button below or check out the
              attached image:
            </Text>
            <Section className="text-center mt-[32px] mb-[32px]">
              <Button
                className="bg-blue-600 rounded text-white text-[12px] font-semibold no-underline text-center"
                href={`https://devfest23.omsimos.com/cert/${id}`}
              >
                Claim Certificate
              </Button>
            </Section>
            <Hr className="border border-solid border-[#eaeaea] my-[26px] mx-0 w-full" />
            <Text className="text-[#666666] text-[12px] leading-[24px]">
              This certificate generator is powered by{" "}
              <span className="text-black">omsimos.com</span> — If you were not
              expecting this certificate, you can ignore this email.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default CertificateEmail;
