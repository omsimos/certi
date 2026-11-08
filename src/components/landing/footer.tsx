export function Footer() {
  return (
    <footer className="foot">
      <div className="wrap foot-row">
        <a className="brand" href="#top">
          certi.
        </a>
        <p className="caption">
          Made by omsimos. Open source under the MIT License. Badge effect adapted from
          vercel-labs/vgpu (MIT).
        </p>
        <div className="foot-links">
          <a href="https://github.com/omsimos/certi">GitHub</a>
          <a href="https://github.com/omsimos/certi/blob/main/LICENSE">License</a>
        </div>
      </div>
      <p className="wordmark" aria-hidden="true">
        certi.
      </p>
    </footer>
  );
}
