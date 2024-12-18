import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
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
  eventName?: string;
};

export const CertificateEmail = ({
  id,
  firstName,
  lastName,
  eventName = "DevFest Bacolod 2024",
}: Props) => {
  const previewText = `Your ${eventName} Certificate is Ready!`;

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Tailwind>
        <Body className="mx-auto my-auto bg-gray-100 font-sans">
          <Container className="mx-auto my-[40px] w-[600px] rounded-lg bg-white p-[40px] shadow-lg">
            <Section className="text-center">
              <Img
                src="https://utfs.io/f/K2HIaQ8LhAUDkkIOjmX91ZWgOj8dDqEUPL56RSs2ra4foY0B"
                width="80"
                height="80"
                alt="GDG Bacolod Logo"
                className="mx-auto mb-4 object-contain"
              />
              <Heading className="m-0 mb-2 text-3xl font-bold text-gray-800">
                GDG Bacolod
              </Heading>
            </Section>
            <Section className="mb-8 text-center">
              <Img
                src="https://utfs.io/f/K2HIaQ8LhAUDxjZaTu0PmZioRV2GOf4tcMjsN1pS6LD9dQ0k"
                width="250"
                height="250"
                alt="Certificate Preview"
                className="mx-auto mb-4 object-contain"
              />
            </Section>
            <Text className="mb-4 text-base leading-6 text-gray-600">
              Dear {firstName} {lastName},
            </Text>
            <Text className="mb-6 text-base leading-6 text-gray-600">
              Congratulations! 🎉 Your certificate for{" "}
              <strong>{eventName}</strong> is now available. We&apos;re thrilled
              to recognize your participation and achievement.
            </Text>
            <Section className="mb-8 text-center">
              <Button
                className="rounded-full bg-blue-600 px-6 py-3 text-center text-base font-semibold text-white no-underline transition-all hover:bg-blue-700"
                href={`https://gdg.omsimos.com/event/devfest-24/cert?id=${id}`}
              >
                View Your Certificate
              </Button>
            </Section>
            <Text className="mb-6 text-base leading-6 text-gray-600">
              Don&apos;t forget to share your achievement on social media.
              It&apos;s a great way to showcase your involvement in the tech
              community!
            </Text>
            <Text className="mb-4 text-base leading-6 text-gray-600">
              We value your feedback! Please take a moment to share your
              thoughts about the event:
            </Text>
            <Section className="mb-8 text-center">
              <Link
                href="https://bit.ly/devfestbcd24_feedback"
                className="text-blue-600 underline"
              >
                Provide Feedback
              </Link>
            </Section>
            <Hr className="mx-0 my-6 w-full border border-solid border-gray-200" />
            <Text className="text-center text-sm leading-6 text-gray-500">
              This certificate is powered by{" "}
              <Link
                href="https://omsimos.com"
                className="text-blue-600 no-underline"
              >
                omsimos.com
              </Link>
            </Text>
            <Text className="text-center text-sm leading-6 text-gray-500">
              If you didn&apos;t participate in this event, please disregard
              this email.
            </Text>
            <Section className="mt-8 text-center">
              <Text className="mb-4 text-sm text-gray-500">
                Follow us on social media:
              </Text>
              <Link
                href="https://facebook.com/gdgbacolod"
                className="mx-2 text-blue-600 no-underline"
              >
                Facebook
              </Link>
              <Link
                href="https://linkedin.com/company/gdgbacolod"
                className="mx-2 text-blue-600 no-underline"
              >
                LinkedIn
              </Link>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default CertificateEmail;
