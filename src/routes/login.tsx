import { createFileRoute } from "@tanstack/react-router";
import { GithubIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { DEFAULT_REDIRECT, safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: search.redirect === undefined ? undefined : safeRedirect(search.redirect),
  }),
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const callbackURL = redirect ?? DEFAULT_REDIRECT;

  return (
    <main className="container flex min-h-screen flex-col items-center gap-6 pt-40">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Sign in to Certi</h1>
        <p className="mt-2 text-muted-foreground">
          Organizers sign in to create and manage events.
        </p>
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => authClient.signIn.social({ provider: "google", callbackURL })}
        >
          Continue with Google
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() => authClient.signIn.social({ provider: "github", callbackURL })}
        >
          <GithubIcon />
          Continue with GitHub
        </Button>
      </div>
    </main>
  );
}
