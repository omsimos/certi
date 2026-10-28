import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  ScriptOnce,
  Scripts,
} from "@tanstack/react-router";

import { BrowserWarn } from "@/components/browser-warn";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { themeScript } from "@/lib/theme";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Certi" },
      { name: "description", content: "Holographic badges for events" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400..800&display=swap",
      },
      { rel: "stylesheet", href: appCss },
    ],
  }),
  component: RootLayout,
  notFoundComponent: NotFound,
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ScriptOnce>{themeScript}</ScriptOnce>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootLayout() {
  return (
    <>
      <Navbar />
      <Outlet />
      <Toaster />
      <BrowserWarn />
    </>
  );
}

function NotFound() {
  return (
    <main className="flex h-screen flex-col items-center gap-5 pt-40 text-center">
      <div>
        <h1 className="text-6xl font-bold capitalize">Not Found</h1>
        <p className="mt-2 text-muted-foreground">Could not find requested resource</p>
      </div>
      <Button nativeButton={false} render={<Link to="/" />}>
        Return Home
      </Button>
    </main>
  );
}
