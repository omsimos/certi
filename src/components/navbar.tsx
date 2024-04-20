import { ToggleTheme } from "./toggle-theme";

export function Navbar() {
  return (
    <div className="z-10 mx-auto absolute left-0 right-0 top-0 pt-10 container items-center justify-between font-mono text-sm flex">
      <p>
        Certificate Generator&nbsp;
        <code className="font-mono font-bold">by hyamero</code>
      </p>
      <ToggleTheme />
    </div>
  );
}
