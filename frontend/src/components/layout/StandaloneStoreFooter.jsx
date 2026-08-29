function StandaloneStoreFooter() {
  return (
    <footer style={{ background: "#F1EADC", borderTop: "2px solid rgba(245,154,26,.24)", padding: "26px 20px", textAlign: "center" }}>
      <p style={{ fontFamily: "'Work Sans', sans-serif", fontSize: "12px", color: "#A39E8E" }}>
        © {new Date().getFullYear()} Morgen Geschäft. All rights reserved.
      </p>
    </footer>
  );
}

export { StandaloneStoreFooter };
