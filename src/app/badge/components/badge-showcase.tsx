"use client";

import useMediaQuery from "@/hooks/use-media-query";
import Badge3D from "./badge-3d";

export default function BadgeShowcase() {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  return (
    <>
      {isDesktop ? (
        <Badge3D />
      ) : (
        <div>
          <h1 className="mt-40 text-center text-2xl font-semibold">Badge 2D</h1>
        </div>
      )}
    </>
  );
}
