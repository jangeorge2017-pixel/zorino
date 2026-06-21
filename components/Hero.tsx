export default function Hero() {
  return (
    <section className="hero-section">
      <div className="hero-content">
        <div className="badge">
          ✨ مدعوم بالذكاء الاصطناعي
        </div>

        <h1 className="hero-title">
          اعثر على <span>العروض</span>
          <br />
          بشكل أفضل وأسرع
        </h1>

        <p className="hero-text">
          قارن الأسعار عبر آلاف المتاجر واكتشف أفضل العروض في ثوانٍ.
        </p>

        <div className="hero-search">
          <input
            type="text"
            placeholder="ابحث عن المنتجات أو المتاجر..."
          />

          <button>
            استكشف
          </button>
        </div>
      </div>

      <div className="hero-logo">
        <div className="floating-card card-1">
          🎧
          <span>-25%</span>
        </div>

        <div className="floating-card card-2">
          💻
          <span>-18%</span>
        </div>

        <div className="floating-card card-3">
          📱
          <span>-12%</span>
        </div>

        <div className="floating-card card-4">
          🎮
          <span>-20%</span>
        </div>

        <div className="logo-box">
          <img
            src="/hero-z.svg"
            alt="Hero Logo"
            className="hero-z-image"
          />
        </div>
      </div>
    </section>
  );
}