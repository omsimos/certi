import { Link, useLoaderData, useMatches, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

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
  const initial = useLoaderData({ from: "__root__" });
  const { data: session, isPending } = authClient.useSession();
  const navigate = useNavigate();
  // The server-rendered session covers first paint; the client session takes over once loaded so sign-out updates immediately.
  const user = isPending ? initial?.user : session?.user;

  if (!user) {
    return (
      <Button variant="outline" nativeButton={false} render={<Link to="/login" />}>
        Sign in
      </Button>
    );
  }

  const letter = (user.name || user.email).charAt(0).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="icon" className="overflow-hidden rounded-full" />}
      >
        {user.image ? (
          <img src={user.image} alt="" referrerPolicy="no-referrer" className="size-full" />
        ) : (
          <span aria-hidden>{letter}</span>
        )}
        <span className="sr-only">Account menu</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuItem render={<Link to="/dashboard" />}>Dashboard</DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            const { error } = await authClient.signOut();
            if (error) {
              toast.error(error.message || "Could not sign out. Try again.");
              return;
            }
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
  const attendeeFacing = useMatches({
    select: (ms) => ms.some((m) => m.staticData?.attendeeFacing),
  });
  const hidden = useMatches({
    select: (ms) => ms.some((m) => m.staticData?.hideNavbar),
  });
  if (hidden) return null;
  return (
    <div className="absolute inset-x-0 top-0 z-10 container mx-auto flex items-center justify-between pt-10 font-mono text-sm">
      <Link to="/">
        Certi&nbsp;
        <code className="font-mono font-bold">by hyamero</code>
      </Link>
      <div className="flex items-center gap-2">
        <ToggleTheme />
        {!attendeeFacing && <AuthButton />}
      </div>
    </div>
  );
}
