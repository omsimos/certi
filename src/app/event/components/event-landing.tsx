"use client";

import { z } from "zod";
import { toast } from "sonner";
import { useState } from "react";
import { db } from "@/config/firebase";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icons } from "@/components/icons";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

export type EventDetails = {
  title: string;
  description: string;
};

type EventLandingProps = {
  eventDetails: EventDetails;
  eventCode?: string;
};

const formSchema = z.object({
  email: z
    .string()
    .min(1, {
      message: "This field has to be filled",
    })
    .email("This is not a valid email"),
});

export default function EventLanding({
  eventDetails,
  eventCode,
}: EventLandingProps) {
  const { push } = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "dale@ban.com",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);

    const q = query(
      collection(db, `${eventCode}/data/certificates`),
      where("email", "==", values.email),
      limit(1)
    );

    try {
      const querySnapshot = await getDocs(q);
      let message = "⚠️ Certificate Not Found";
      querySnapshot.forEach((doc) => {
        if (doc.data().email) {
          push(`/event/${eventCode}/cert?id=${doc.id}`);
          message = "✅ Certificate found!";
          return;
        }
      });
      toast(message);
      setLoading(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <main className="flex gap-20 lg:items-start pb-20 lg:pt-56 pt-36 container flex-col lg:flex-row justify-between items-center">
      <div className="md:text-center lg:text-left text-left">
        <h1 className="lg:text-7xl text-5xl md:text-6xl font-bold">
          {eventDetails.title}
        </h1>
        <p className="md:text-xl text-lg text-muted-foreground mt-3 w-full md:w-3/4 mx-auto lg:mx-0 break-words hyphens-auto">
          {eventDetails.description}
        </p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader className="text-2xl font-semibold">Enter Email</CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormMessage />
                    <FormControl>
                      <Input placeholder="shadcn" {...field} />
                    </FormControl>
                    <FormDescription>
                      Enter registered email address
                    </FormDescription>
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Icons.spinner /> : "Get Certificate"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
