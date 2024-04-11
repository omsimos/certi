import { Suspense } from "react";
import { Certificate } from "./components/certificate";

function Fallback() {
  return <></>;
}

export default function CertificatePage() {
  return (
    <div>
      <Suspense fallback={<Fallback />}>
        <Certificate />
      </Suspense>
    </div>
  );
}
