import { Icons } from "@/components/icons";

export default function Loading() {
  return (
    <main className="flex h-screen flex-col items-center justify-center gap-10">
      <Icons.spinner />
    </main>
  );
}
