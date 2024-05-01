import React, { useState } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Dialog,
  DialogTitle,
  DialogHeader,
  DialogContent,
  DialogDescription,
} from "@/components/ui/dialog";

type Props = {
  openModal: boolean;
  setOpenModal: React.Dispatch<React.SetStateAction<boolean>>;
  handleSubmit: () => void;
};

export default function AdminPermDialog({
  openModal,
  setOpenModal,
  handleSubmit,
}: Props) {
  const [password, setPassword] = useState("");
  const [authorized, setAuthorized] = useState(false);

  const handleLogin: React.FormEventHandler = (e) => {
    e.preventDefault();

    if (password === process.env.NEXT_PUBLIC_PASSWORD) {
      toast.success("Login successful");
      setAuthorized(true);
    } else {
      toast.error("Incorrect password");
    }
  };

  return (
    <Dialog open={openModal} onOpenChange={setOpenModal}>
      {!authorized ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Admin permission required</DialogTitle>
            <DialogDescription>
              This feature is currently on closed beta.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleLogin}>
            <div className="flex gap-3">
              <Input
                required
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit">Login</Button>
            </div>
          </form>
        </DialogContent>
      ) : (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Access Granted</DialogTitle>
            <DialogDescription>Continue with the operation?</DialogDescription>
          </DialogHeader>
          <Button
            onClick={() => {
              handleSubmit();
              setOpenModal(false);
            }}
          >
            Continue
          </Button>
        </DialogContent>
      )}
    </Dialog>
  );
}
