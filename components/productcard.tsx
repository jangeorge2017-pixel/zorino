export default function ProductCard() {
  return (
    <div className="product-card">

      <div
        style={{
          background:"#7c3aed",
          color:"white",
          padding:"6px 12px",
          borderRadius:"10px",
          display:"inline-block",
          marginBottom:"15px",
          fontSize:"14px"
        }}
      >
        -15%
      </div>

      <div className="product-image">
        📱
      </div>

      <h3>iPhone 15 Pro Max</h3>

      <p
        style={{
          color:"#94a3b8",
          textDecoration:"line-through",
          marginTop:"10px"
        }}
      >
        $1,029
      </p>

      <p className="price">
        $899
      </p>

      <button>
        Compare Prices
      </button>

    </div>
  );
}