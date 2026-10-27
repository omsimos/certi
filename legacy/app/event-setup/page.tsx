import { Separator } from "@/components/ui/separator";
import { ManageEventForm } from "./components/manage-event-form";

export default function EventSetup() {
  return (
    <main className="container flex min-h-screen flex-col gap-5 pb-20 pt-36 sm:items-center">
      <div className="w-full max-w-md space-y-6">
        <div>
          <h3 className="text-lg font-medium">Setup Event</h3>
          <p className="text-sm text-muted-foreground">
            Generate a certificate generator for your event.
          </p>
        </div>
        <Separator />
        <ManageEventForm />
      </div>
    </main>
  );
}
