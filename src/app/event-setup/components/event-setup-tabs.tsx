"use client";

import { useSearchParams } from "next/navigation";
import { AddEventForm } from "./add-event-form";
import AddParticipants from "./add-participants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EventSetupTabs() {
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");

  function updateTab(tab: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    window.history.pushState(null, "", `?${params.toString()}`);
  }

  return (
    <Tabs defaultValue={currentTab!} className="w-full max-w-md">
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
      <TabsContent value="participants">
        <AddParticipants />
      </TabsContent>
      <TabsContent value="details">
        <AddEventForm />
      </TabsContent>
    </Tabs>
  );
}
