"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  FormControl,
  FormField,
  FormItem,
  Form,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { db } from "@/config/firebase";
import type { Event } from "@/lib/types";
import AdminPermDialog from "./admin-perm-dialog";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";

const eventFormSchema = z.object({
  eventCode: z
    .string()
    .min(2, {
      message: "Event code must be at least 5 characters.",
    })
    .max(16, {
      message: "Event code must not be longer than 16 characters.",
    })
    .refine((s) => !s.includes(" "), "No Spaces!"),
  title: z
    .string()
    .min(2, {
      message: "Title must be at least 2 characters.",
    })
    .max(30, {
      message: "Title must not be longer than 30 characters.",
    }),
  description: z
    .string()
    .min(25, {
      message: "Description must be at least 25 characters.",
    })
    .max(250, {
      message: "Description must not be longer than 250 characters.",
    }),
  organizer: z
    .string()
    .min(2, {
      message: "Organizer must be at least 2 characters.",
    })
    .max(30, {
      message: "Organizer must not be longer than 30 characters.",
    }),
});

type EventFormValues = z.infer<typeof eventFormSchema>;

export function ManageEventForm({ event }: { event?: Event }) {
  const { push } = useRouter();
  const params = useParams<{ name: string }>();
  const [openAdminModal, setAdminModal] = useState(false);

  const defaultValues: Partial<EventFormValues> = {
    eventCode: params.name,
    ...event,
  };

  const form = useForm<EventFormValues>({
    resolver: zodResolver(eventFormSchema),
    defaultValues,
    mode: "onChange",
  });

  async function onSubmit(data: EventFormValues) {
    const { title, description, organizer, eventCode } = data;

    const docSnap = await getDoc(doc(db, eventCode, "data"));

    try {
      if (docSnap.exists()) {
        return toast.error("Event code already exists");
      } else {
        await setDoc(doc(db, `${eventCode}/data`), {
          title,
          description,
          organizer,
        });

        toast("You submitted the following values", {
          description: JSON.stringify(data, null, 2),
        });

        push(`/event-setup/${eventCode}`);
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <Form {...form}>
      <AdminPermDialog
        openAdminModal={openAdminModal}
        setAdminModal={setAdminModal}
        handleSubmit={form.handleSubmit(onSubmit)}
      />

      <form className="space-y-8">
        <FormField
          control={form.control}
          name="eventCode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Event Code</FormLabel>
              <FormControl>
                <Input placeholder="omsimos-os" {...field} />
              </FormControl>
              <FormDescription>
                Event code used to search for an event
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input placeholder="Omsimos: The Collective OS" {...field} />
              </FormControl>
              <FormDescription>Title of the event</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell us about it!"
                  className="resize-none"
                  {...field}
                />
              </FormControl>
              <FormDescription>Description of the event</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="organizer"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organizer</FormLabel>
              <FormControl>
                <Input placeholder="omsimos" {...field} />
              </FormControl>
              <FormDescription>Event organizer</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button
          onClick={(e) => {
            e.preventDefault();
            setAdminModal(!openAdminModal);
          }}
        >
          {event ? "Update Event" : "Create Event"}
        </Button>
      </form>
    </Form>
  );
}
