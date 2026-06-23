export default function Hero() {
  const floatingProducts = [
    { id: 1, position: "top-left", discount: "-25%" },
    { id: 2, position: "top-right", discount: "-12%" },
    { id: 3, position: "bottom-left", discount: "-18%" },
    { id: 4, position: "bottom-right", discount: "-20%" },
  ];

  return (
    <section className="hero">
      <div className="hero-logo">
        {floatingProducts.map((product) => (
          <div
            key={product.id}
            className={`floating-card ${product.position}`}
          >
            <span className="floating-discount">
              {product.discount}
            </span>
          </div>
        ))}

        <div className="hero-platform"></div>

        <div className="logo-box">
          <img
            src="/hero-z.png"
            alt="Zorino Hero Logo"
            className="hero-z-image"
          />
        </div>
      </div>
    </section>
  );
}