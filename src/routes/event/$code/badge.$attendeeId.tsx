import { ClientOnly, createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Component, lazy, Suspense, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getCertificateFn } from "@/server/fns";

// three, r3f and rapier stay out of the entry and route chunks: they load only when this renders.
const Badge3D = lazy(() => import("@/components/badge/badge-3d"));

export const Route = createFileRoute("/event/$code/badge/$attendeeId")({
  loader: async ({ params }) => {
    const cert = await getCertificateFn({
      data: { code: params.code, attendeeId: params.attendeeId },
    });
    if (!cert) throw notFound();
    return cert;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { attendee, event } = loaderData;
    return {
      meta: [{ title: `${attendee.firstName} ${attendee.lastName} | ${event.title} | Certi` }],
    };
  },
  component: BadgePage,
});

function BadgePage() {
  return (
    <ClientOnly fallback={<BadgeSkeleton />}>
      <BadgeViewer />
    </ClientOnly>
  );
}

function BadgeViewer() {
  const { attendee } = Route.useLoaderData();
  const { code, attendeeId } = Route.useParams();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (!isDesktop) {
    return (
      <BadgeFallback code={code} attendeeId={attendeeId}>
        Mobile version of 3D badge is{" "}
        <span className="font-medium text-foreground">under heavy development.</span> Changes and
        updates may happen frequently as we work to improve its functionality and features.
      </BadgeFallback>
    );
  }

  // The boundary wraps the whole page so the fallback replaces it instead of nesting inside.
  return (
    <BadgeErrorBoundary
      fallback={
        <BadgeFallback code={code} attendeeId={attendeeId}>
          The 3D badge could not be loaded on this device or browser.
        </BadgeFallback>
      }
    >
      <main className="h-screen">
        <div className="absolute inset-0 flex h-screen flex-col items-center pt-40">
          <h1 className="bg-zinc-800 from-foreground bg-clip-text text-center text-[10vw] font-bold tracking-tighter text-transparent md:text-8xl dark:bg-linear-to-b dark:to-zinc-400">
            omsimos.com
          </h1>
          <p className="max-w-2xl text-center text-muted-foreground md:text-xl">
            This project is{" "}
            <span className="font-medium text-foreground">under heavy development.</span> Changes
            and updates may happen frequently as we work to improve its functionality and features.
          </p>
        </div>
        <Suspense fallback={<BadgeSkeleton />}>
          <Badge3D attendee={attendee} />
        </Suspense>
      </main>
    </BadgeErrorBoundary>
  );
}

function BadgeFallback({
  code,
  attendeeId,
  children,
}: {
  code: string;
  attendeeId: string;
  children: ReactNode;
}) {
  return (
    <main className="container">
      <div className="h-screen pt-40">
        <h1 className="bg-zinc-800 from-foreground bg-clip-text text-[12vw] font-bold tracking-tighter text-transparent md:text-8xl dark:bg-linear-to-b dark:to-zinc-400">
          omsimos.com
        </h1>
        <p className="max-w-2xl text-muted-foreground md:text-xl">{children}</p>
        <Button
          className="mt-8"
          variant="outline"
          nativeButton={false}
          render={<Link to="/event/$code/cert/$attendeeId" params={{ code, attendeeId }} />}
        >
          View certificate
        </Button>
      </div>
    </main>
  );
}

// WebGPU/WebGL init failures and a failed lazy chunk load both land here, so the
// page degrades to the certificate link instead of a blank screen.
class BadgeErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("3D badge failed to render", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function BadgeSkeleton() {
  return (
    <main
      className="flex min-h-screen items-center justify-center"
      aria-busy="true"
      aria-label="Loading badge"
    >
      <div className="h-80 w-56 animate-pulse rounded-2xl bg-muted" />
    </main>
  );
}
