import { create } from "zustand";

type DialogState = {
  importDialog: boolean;
  setImportDialog: (state: boolean) => void;
};

export const useDialogStore = create<DialogState>()((set) => ({
  importDialog: false,
  setImportDialog: (state) => set(() => ({ importDialog: state })),
}));
