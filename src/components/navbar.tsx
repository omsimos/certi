import { Link, useNavigate } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { ToggleTheme } from "./toggle-theme";

function AuthButton() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();
  const user = session?.user;

  // Also the SSR and loading state: the session is only known on the client.
  if (!user) {
    return (
      <Button variant="outline" nativeButton={false} render={<Link to="/login" />}>
        Sign in
      </Button>
    );
  }

  const initial = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" className="overflow-hidden rounded-full" />}
      >
        {user.image ? (
          <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-full" />
        ) : (
          <span aria-hidden>{initial}</span>
        )}
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem render={<Link to="/dashboard" />}>Dashboard</DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await authClient.signOut();
            await navigate({ to: "/" });
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navbar() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 container mx-auto flex items-center justify-between pt-10 font-mono text-sm">
      <Link to="/">
        Certi&nbsp;
        <code className="font-mono font-bold">by hyamero</code>
      </Link>
      <div className="flex items-center gap-2">
        <ToggleTheme />
        <AuthButton />
      </div>
    </div>
  );
}
