"use client";

import { useSearchParams } from "next/navigation";
import { ManageEventForm } from "./manage-event-form";
import AddParticipants from "./add-participants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { JsonConvert } from "../components/json-convert";
import type { Event } from "@/lib/types";

export default function EventSetupTabs({ event }: { event: Event }) {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  function updateTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  return (
    <Tabs
      defaultValue={currentTab ?? "participants"}
      className="w-full max-w-md"
    >
      <TabsList className="mb-10 w-full [&>*]:w-full">
        <TabsTrigger
          onClick={() => updateTab("participants")}
          value="participants"
        >
          Participants
        </TabsTrigger>
        <TabsTrigger onClick={() => updateTab("details")} value="details">
          Details
        </TabsTrigger>
      </TabsList>
      <TabsContent value="participants" className="flex flex-col gap-16">
        <JsonConvert />
        <div className="flex items-center gap-3 text-center text-muted-foreground">
          <div className="h-px w-full bg-muted" />
          <span>or</span>
          <div className="h-px w-full bg-muted" />
        </div>
        <AddParticipants />
      </TabsContent>
      <TabsContent value="details">
        <ManageEventForm event={event} />
      </TabsContent>
    </Tabs>
  );
}
