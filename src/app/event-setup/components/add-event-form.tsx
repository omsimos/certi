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
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/config/firebase";

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

// This can come from your database or API.
const defaultValues: Partial<EventFormValues> = {};

export function AddEventForm() {
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
      }
    } catch (err: any) {
      toast.error(err.message);
    }
  }
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");

  const handleLogin: React.FormEventHandler = (e) => {
    e.preventDefault();

    if (password === process.env.NEXT_PUBLIC_PASSWORD) {
      setAuthorized(true);
      toast.success("Login successful");
    } else {
      toast.error("Incorrect password");
    }
  };

  if (!authorized) {
    return (
      <form onSubmit={handleLogin}>
        <div className="flex gap-3">
          <Input
            required
            type="password"
            placeholder="Enter password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className=""
          />
          <Button type="submit">Login</Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          This service is currently on closed beta.
        </p>
      </form>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
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
        <Button type="submit">Add Event</Button>
      </form>
    </Form>
  );
}
