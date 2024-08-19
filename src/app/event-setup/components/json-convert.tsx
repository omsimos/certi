"use client";

import * as xlsx from "xlsx";
import { ChangeEvent } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function JsonConvert() {
  const readUploadFile = (e: ChangeEvent<HTMLInputElement>) => {
    if (!e) return;

    e.preventDefault();
    if (e.target.files) {
      const reader = new FileReader();

      reader.onload = (e) => {
        const data = e.target!.result;
        const workbook = xlsx.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(worksheet);
        console.log(json);
      };
      reader.readAsArrayBuffer(e.target.files[0]);
    }
  };

  return (
    <form className="grid w-full max-w-md items-center gap-1.5">
      <h3 className="text-lg font-medium">
        Import Participants via .xlsx file
      </h3>
      <p className="text-sm text-muted-foreground">
        Make sure to follow the same JSON Format
      </p>
      <div className="flex gap-2">
        <Input
          id="picture"
          type="file"
          className="w-full"
          onChange={(e) => readUploadFile(e)}
        />
        <Button>Parse Data</Button>
      </div>
    </form>
  );
}
