// One span per word so the scroll animation can light them in turn; `it` words are set in italic.
const WORDS: { w: string; it?: boolean; join?: boolean }[] = [
  ..."The badge is the one thing every guest takes home. Certi makes it"
    .split(" ")
    .map((w) => ({ w })),
  { w: "worth", it: true },
  { w: "keeping", it: true },
  { w: ":", join: true },
  ..."a dark, matte card that turns to".split(" ").map((w) => ({ w })),
  { w: "shimmering", it: true },
  { w: "foil", it: true },
  ..."wherever the light falls.".split(" ").map((w) => ({ w })),
];

export function Manifesto() {
  return (
    <section className="manifesto js-manifesto" aria-label="Why Certi">
      <div className="wrap">
        <p className="manifesto-text">
          {WORDS.map(({ w, it, join }, i) => (
            <span key={i}>
              {i > 0 && !join && " "}
              <span className={it ? "js-word it" : "js-word"}>{w}</span>
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}
