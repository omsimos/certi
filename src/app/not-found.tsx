import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex h-screen flex-col items-center gap-5 pt-40 text-center">
      <div>
        <h1 className="text-6xl font-bold capitalize">Not Found</h1>
        <p className="mt-2 text-muted-foreground">
          Could not find requested resource
        </p>
      </div>
      <Button>
        <Link href="/">Return Home</Link>
      </Button>
    </main>
  );
}
