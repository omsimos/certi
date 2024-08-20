import { Attendee } from "@/lib/types";
import { create } from "zustand";

type AttendeesState = {
  parsedAttendees: Attendee[];
  setParsedAttendees: (attendees: Attendee[]) => void;
};

export const useAttendeesStore = create<AttendeesState>()((set) => ({
  parsedAttendees: [] as Attendee[],
  setParsedAttendees: (attendees) =>
    set(() => ({
      parsedAttendees: attendees,
    })),
}));
