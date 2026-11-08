import "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    // Pages meant for attendees hide organizer chrome such as Sign in.
    attendeeFacing?: boolean;
    // Pages with their own navigation (the landing page) hide the global navbar.
    hideNavbar?: boolean;
  }
}
