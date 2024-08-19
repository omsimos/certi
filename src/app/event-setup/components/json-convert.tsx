"use client";

import * as xlsx from "xlsx";
import { ChangeEvent } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

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
    <form className="grid w-full max-w-md items-center gap-5">
      <div>
        <h3 className="text-lg font-medium">
          Import Participants via .xlsx file
        </h3>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-destructive">Strict:</span> Make
          sure to follow the same Excel Format
        </p>
      </div>

      <Separator />

      <p className="text-sm text-muted-foreground">Sample Excel</p>
      <TableDemo />
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

const placeholder = [
  {
    firstName: "John",
    lastName: "Doe",
    email: "john@doe.com",
  },
  {
    firstName: "Sally",
    lastName: "Smith",
    email: "sally@smith.com",
  },
];

export function TableDemo() {
  return (
    <Table className="border">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[100px]">firstName</TableHead>
          <TableHead>lastName</TableHead>
          <TableHead>email</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {placeholder.map((data) => (
          <TableRow key={data.email}>
            <TableCell>{data.firstName}</TableCell>
            <TableCell>{data.lastName}</TableCell>
            <TableCell>{data.email}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
