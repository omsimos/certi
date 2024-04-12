import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="h-screen flex text-center items-center pt-40 gap-5 flex-col">
      <div>
        <h1 className="capitalize font-bold text-6xl">Not Found</h1>
        <p className="text-muted-foreground mt-2">
          Could not find requested resource
        </p>
      </div>
      <Button>
        <Link href="/">Return Home</Link>
      </Button>
    </main>
  );
}
