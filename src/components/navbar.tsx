import { Link } from "@tanstack/react-router";

import { ToggleTheme } from "./toggle-theme";

export function Navbar() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 container mx-auto flex items-center justify-between pt-10 font-mono text-sm">
      <Link to="/">
        Certi&nbsp;
        <code className="font-mono font-bold">by hyamero</code>
      </Link>
      <div className="flex items-center gap-2">
        <ToggleTheme />
        {/* Auth button slot, wired in Task 4. */}
        <div data-slot="navbar-auth" />
      </div>
    </div>
  );
}
