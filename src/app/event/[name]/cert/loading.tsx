import { Icons } from "@/components/icons";

export default function Loading() {
  return (
    <main className="h-screen flex items-center justify-center gap-10 flex-col">
      <Icons.spinner />
    </main>
  );
}
