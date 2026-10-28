import { createFileRoute } from "@tanstack/react-router";
import { GithubIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { DEFAULT_REDIRECT, safeRedirect } from "@/lib/redirect";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string; error?: string } => ({
    redirect: search.redirect === undefined ? undefined : safeRedirect(search.redirect),
    // Set by Better Auth on OAuth failures (e.g. access_denied).
    error: typeof search.error === "string" ? search.error.slice(0, 80) : undefined,
  }),
  component: Login,
});

function Login() {
  const { redirect, error } = Route.useSearch();
  const callbackURL = redirect ?? DEFAULT_REDIRECT;

  return (
    <main className="container flex min-h-screen flex-col items-center gap-6 pt-40">
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Sign in to Certi</h1>
        <p className="mt-2 text-muted-foreground">
          Organizers sign in to create and manage events.
        </p>
        {error && (
          <p role="alert" className="mt-4 text-sm text-destructive">
            Sign-in failed ({error}). Please try again.
          </p>
        )}
      </div>
      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() =>
            authClient.signIn.social({
              provider: "google",
              callbackURL,
              errorCallbackURL: "/login",
            })
          }
        >
          Continue with Google
        </Button>
        <Button
          variant="outline"
          size="lg"
          onClick={() =>
            authClient.signIn.social({
              provider: "github",
              callbackURL,
              errorCallbackURL: "/login",
            })
          }
        >
          <GithubIcon />
          Continue with GitHub
        </Button>
      </div>
    </main>
  );
}
