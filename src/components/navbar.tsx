import { ToggleTheme } from "./toggle-theme";

export function Navbar() {
  return (
    <div className="container absolute left-0 right-0 top-0 z-10 mx-auto flex items-center justify-between pt-10 font-mono text-sm">
      <p>
        Certificate Generator&nbsp;
        <code className="font-mono font-bold">by hyamero</code>
      </p>
      <ToggleTheme />
    </div>
  );
}
