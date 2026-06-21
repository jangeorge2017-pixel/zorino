export default function CouponSection() {
  return (
    <section className="coupon-section">

      <h2
        style={{
          marginBottom:"25px",
          fontSize:"32px"
        }}
      >
        Top Coupons
      </h2>

      <div className="coupon-card">
        🎉 AMAZON10 - Save 10% on Amazon
      </div>

      <div className="coupon-card">
        👟 NIKE20 - Save 20% on Nike
      </div>

      <div className="coupon-card">
        🛒 AE50OFF - $50 Off AliExpress Orders
      </div>

    </section>
  );
}