import Link from "next/link";
import { ToggleTheme } from "./toggle-theme";
import ManageEventDialog from "./manage-event-dialog";

export function Navbar() {
  return (
    <div className="container absolute left-0 right-0 top-0 z-10 mx-auto flex items-center justify-between pt-10 font-mono text-sm">
      <div className="flex items-center">
        <Link href="/">Certi by&nbsp;</Link>
        <Link
          href="https://www.facebook.com/omsimos.official"
          target="_blank"
          rel="noreferrer noopener"
        >
          <code className="font-mono font-bold">Omsimos</code>
        </Link>
      </div>
      <div className="space-x-2">
        <ToggleTheme />
        <ManageEventDialog />
      </div>
    </div>
  );
}
