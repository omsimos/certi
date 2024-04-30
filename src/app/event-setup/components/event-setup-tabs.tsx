"use client";

import { AddEventForm } from "./add-event-form";
import AddParticipants from "./add-participants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function EventSetupTabs() {
  return (
    <Tabs defaultValue="participants" className="w-full max-w-md">
      <TabsList className="mb-10 w-full [&>*]:w-full">
        <TabsTrigger value="participants">Participants</TabsTrigger>
        <TabsTrigger value="details">Details</TabsTrigger>
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
