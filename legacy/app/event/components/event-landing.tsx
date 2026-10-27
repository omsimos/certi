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
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

  type: z.enum(["badge", "cert"]),
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
      type: "badge",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);

    const q = query(
      collection(db, `${eventCode}/data/certificates`),
      where("email", "==", values.email),
      limit(1),
    );

    try {
      const querySnapshot = await getDocs(q);
      let message = "⚠️ Certificate Not Found";
      querySnapshot.forEach((doc) => {
        if (doc.data().email) {
          push(`/event/${eventCode}/${values.type}?id=${doc.id}`);
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
    <main className="container flex flex-col items-center justify-between gap-20 pb-20 pt-36 lg:flex-row lg:items-start lg:pt-56">
      <div className="space-y-24 text-left lg:text-left">
        <h1 className="bg-zinc-800 from-foreground bg-clip-text text-left text-[10vw] font-extrabold leading-none tracking-tighter text-transparent dark:bg-gradient-to-b dark:to-zinc-400 md:text-7xl">
          {eventDetails.title}
        </h1>

        <div>
          <h3 className="bg-zinc-800 from-foreground bg-clip-text text-left text-xl font-extrabold leading-none tracking-tighter text-transparent dark:bg-gradient-to-b dark:to-zinc-400 md:text-3xl">
            About the Event
          </h3>
          <p className="mt-3 w-full hyphens-auto break-words text-lg text-muted-foreground md:w-3/4 md:text-xl">
            {eventDetails.description}
          </p>
        </div>
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
              <div className="space-y-1">
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Select type</FormLabel>
                      <Select onValueChange={field.onChange} {...field}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem className="cursor-pointer" value="badge">
                            Badge
                          </SelectItem>
                          <SelectItem className="cursor-pointer" value="cert">
                            Certificate
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  variant="secondary"
                  type="submit"
                  className="w-full font-medium"
                  disabled={loading}
                >
                  {loading ? <Icons.spinner /> : "Generate"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </main>
  );
}
