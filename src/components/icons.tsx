type Props = React.HTMLAttributes<SVGElement>;

export const Icons = {
  spinner: (props: Props) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      {...props}
    >
      <rect width="6" height="14" x="1" y="4" fill="currentColor">
        <animate
          id="svgSpinnersBarsScaleFade0"
          fill="freeze"
          attributeName="y"
          begin="0;svgSpinnersBarsScaleFade1.end-0.25s"
          dur="0.75s"
          values="1;5"
        ></animate>
        <animate
          fill="freeze"
          attributeName="height"
          begin="0;svgSpinnersBarsScaleFade1.end-0.25s"
          dur="0.75s"
          values="22;14"
        ></animate>
        <animate
          fill="freeze"
          attributeName="opacity"
          begin="0;svgSpinnersBarsScaleFade1.end-0.25s"
          dur="0.75s"
          values="1;.2"
        ></animate>
      </rect>
      <rect width="6" height="14" x="9" y="4" fill="currentColor" opacity=".4">
        <animate
          fill="freeze"
          attributeName="y"
          begin="svgSpinnersBarsScaleFade0.begin+0.15s"
          dur="0.75s"
          values="1;5"
        ></animate>
        <animate
          fill="freeze"
          attributeName="height"
          begin="svgSpinnersBarsScaleFade0.begin+0.15s"
          dur="0.75s"
          values="22;14"
        ></animate>
        <animate
          fill="freeze"
          attributeName="opacity"
          begin="svgSpinnersBarsScaleFade0.begin+0.15s"
          dur="0.75s"
          values="1;.2"
        ></animate>
      </rect>
      <rect width="6" height="14" x="17" y="4" fill="currentColor" opacity=".3">
        <animate
          id="svgSpinnersBarsScaleFade1"
          fill="freeze"
          attributeName="y"
          begin="svgSpinnersBarsScaleFade0.begin+0.3s"
          dur="0.75s"
          values="1;5"
        ></animate>
        <animate
          fill="freeze"
          attributeName="height"
          begin="svgSpinnersBarsScaleFade0.begin+0.3s"
          dur="0.75s"
          values="22;14"
        ></animate>
        <animate
          fill="freeze"
          attributeName="opacity"
          begin="svgSpinnersBarsScaleFade0.begin+0.3s"
          dur="0.75s"
          values="1;.2"
        ></animate>
      </rect>
    </svg>
  ),
};
