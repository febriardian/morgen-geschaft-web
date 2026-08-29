// ========== LOADING SKELETON (inline) ==========
const shimmerCSS = `@keyframes mgShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }`;


function Bone({ width = "100%", height = "16px", style = {}, borderRadius = "4px" }) {
  return <div style={{ width, height, borderRadius, background: "linear-gradient(90deg, #E8E3D5 25%, #F0EBE0 50%, #E8E3D5 75%)", backgroundSize: "200% 100%", animation: "mgShimmer 1.5s ease-in-out infinite", ...style }} />;
}


function ProductCardSkeleton() {
  return (
    <div style={{ background: "#fff", border: "1px solid #E3DCC9" }}>
      <style>{shimmerCSS}</style>
      <div style={{ paddingBottom: "75%", position: "relative" }}><Bone width="100%" height="100%" style={{ position: "absolute", inset: 0 }} borderRadius="0" /></div>
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "10px" }}>
        <Bone width="80%" height="18px" /><Bone width="100%" height="14px" /><Bone width="60%" height="14px" />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px" }}><Bone width="80px" height="18px" /><Bone width="100px" height="32px" borderRadius="2px" /></div>
      </div>
    </div>
  );
}


function ProductGridSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
      {Array.from({ length: count }).map((_, i) => <ProductCardSkeleton key={i} />)}
    </div>
  );
}



function BlogCardSkeleton() {
  return (
    <div style={{ background: "#fff", border: "1px solid #E3DCC9", borderRadius: "14px", overflow: "hidden", minHeight: "390px" }}>
      <div style={{ height: "205px", position: "relative", background: "#F0EBE0" }}>
        <Bone width="100%" height="100%" borderRadius="0" />
        <Bone width="88px" height="12px" style={{ position: "absolute", top: "22px", left: "22px" }} borderRadius="6px" />
        <Bone width="72%" height="24px" style={{ position: "absolute", left: "22px", bottom: "54px" }} borderRadius="7px" />
        <Bone width="54%" height="24px" style={{ position: "absolute", left: "22px", bottom: "22px" }} borderRadius="7px" />
      </div>
      <div style={{ padding: "20px 22px 22px", display: "flex", flexDirection: "column", gap: "11px" }}>
        <Bone width="42%" height="11px" borderRadius="6px" />
        <Bone width="100%" height="13px" borderRadius="6px" />
        <Bone width="92%" height="13px" borderRadius="6px" />
        <Bone width="68%" height="13px" borderRadius="6px" />
        <Bone width="112px" height="13px" style={{ marginTop: "14px" }} borderRadius="6px" />
      </div>
    </div>
  );
}



function BlogGridSkeleton({ count = 6 }) {
  return (
    <>
      <style>{shimmerCSS}</style>
      <div
        aria-label="Memuat daftar artikel"
        style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}
      >
        {Array.from({ length: count }).map((_, index) => <BlogCardSkeleton key={index} />)}
      </div>
    </>
  );
}



function BlogDetailSkeleton() {
  return (
    <div
      aria-label="Memuat artikel"
      aria-busy="true"
      style={{ fontFamily: "'Work Sans', sans-serif", background: "#F6F1E7", minHeight: "100vh" }}
    >
      <style>{shimmerCSS}</style>
      <header style={{ height: "65px", borderBottom: "1px solid #E3DCC9", background: "rgba(246,241,231,.96)", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Bone width="30px" height="30px" borderRadius="9px" />
          <Bone width="156px" height="16px" borderRadius="7px" />
        </div>
        <Bone width="92px" height="34px" borderRadius="9px" />
      </header>

      <main style={{ maxWidth: "820px", margin: "0 auto", padding: "54px 24px 80px" }}>
        <Bone width="126px" height="12px" borderRadius="6px" />
        <Bone width="92%" height="42px" style={{ marginTop: "18px" }} borderRadius="10px" />
        <Bone width="68%" height="42px" style={{ marginTop: "10px" }} borderRadius="10px" />
        <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
          <Bone width="102px" height="12px" borderRadius="6px" />
          <Bone width="74px" height="12px" borderRadius="6px" />
        </div>
        <Bone width="100%" height="310px" style={{ marginTop: "30px" }} borderRadius="14px" />

        <div style={{ marginTop: "34px", display: "flex", flexDirection: "column", gap: "13px" }}>
          <Bone width="100%" height="14px" borderRadius="7px" />
          <Bone width="96%" height="14px" borderRadius="7px" />
          <Bone width="88%" height="14px" borderRadius="7px" />
          <Bone width="100%" height="14px" style={{ marginTop: "12px" }} borderRadius="7px" />
          <Bone width="93%" height="14px" borderRadius="7px" />
          <Bone width="72%" height="14px" borderRadius="7px" />
        </div>
      </main>
    </div>
  );
}

export { shimmerCSS, Bone, ProductCardSkeleton, ProductGridSkeleton, BlogCardSkeleton, BlogGridSkeleton, BlogDetailSkeleton };

