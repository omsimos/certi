import { EventForm } from "@/components/event-form";
import { ToggleTheme } from "@/components/toggle-theme";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-start gap-40 p-24">
      <div>
        <h3 className="text-lg mb-2 font-semibold">Search Event</h3>
        <EventForm />
      </div>
    </main>
  );
}
