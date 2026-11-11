const FACTS = [
  {
    title: "Free hosting",
    text: "The app, its database and its file storage all run on Cloudflare’s free plan.",
  },
  {
    title: "100 emails a day",
    text: "That’s what Resend’s free plan allows, so bigger lists are scheduled for you, up to 30 days ahead.",
  },
  {
    title: "Made on your device",
    text: "Email pictures and downloads are drawn in the organizer’s or guest’s browser. The server never draws a thing.",
  },
  {
    title: "Simple sign-in",
    text: "Sign in with Google or GitHub. Each event belongs to the person who created it.",
  },
];

export function OpenSource() {
  return (
    <section className="open" id="open">
      <div className="open-fractal" aria-hidden="true" />
      <div className="wrap open-grid">
        <div className="open-copy">
          <div className="head">
            <p className="kicker">Open source</p>
            <h2 className="h2">
              Free to run. <span className="it">Open to read.</span>
            </h2>
          </div>
          <p className="lede">
            Certi is open source under the MIT License, and it’s built to fit inside free plans,
            from the server to the inbox.
          </p>
          <a
            className="holo-btn holo-btn-holo holo-btn-md open-btn"
            href="https://github.com/omsimos/certi"
          >
            View on GitHub
          </a>
        </div>
        <ul className="facts">
          {FACTS.map((f) => (
            <li key={f.title} className="fact js-reveal">
              <h3 className="h4">{f.title}</h3>
              <p className="fact-text">{f.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
