export default function PublicAccessNotice() {
  return (
    <section className="public-access" aria-labelledby="mobile-spike-title">
      <p className="public-access-status">Disposable architecture spike</p>
      <h2 id="mobile-spike-title">Capacitor iOS candidate</h2>
      <p className="public-access-summary">
        This shell proves that the responsive Marathoner web application can be
        packaged for iOS. Remote authentication and data writes are disabled.
      </p>

      <div className="trust-grid">
        <section aria-labelledby="mobile-spike-safety-title">
          <h3 id="mobile-spike-safety-title">Safe by default</h3>
          <p>
            This build replaces authentication and persistence at bundle time.
            It contains no Firebase project identifier or development secret.
          </p>
        </section>
        <section aria-labelledby="mobile-spike-scope-title">
          <h3 id="mobile-spike-scope-title">What this proves</h3>
          <p>
            Responsive rendering, a reproducible Swift Package Manager project,
            and the path to a physical-iPhone comparison under issue #84.
          </p>
        </section>
        <section aria-labelledby="mobile-spike-limit-title">
          <h3 id="mobile-spike-limit-title">Not a product build</h3>
          <p>
            No training guidance, user sign-in, stored records, or production
            service is available in this candidate. Issue #152.
          </p>
        </section>
      </div>
    </section>
  );
}
