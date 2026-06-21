export default function Navbar() {
  return (
    <nav className="navbar">

      <div className="logo">

        <img
  src="/zorino-logo.svg"
  alt="Zorino Logo"
  className="navbar-logo"
/>

        <div>
          <h2>ZORINO</h2>
          <p>Find Better Deals Faster</p>
        </div>

      </div>

      <div className="nav-links">
        <a href="#">Deals</a>
        <a href="#">Coupons</a>
        <a href="#">Compare</a>
        <a href="#">Categories</a>
        <a href="#">Stores</a>
        <a href="#">Blog</a>
      </div>

      <div className="nav-actions">

        <button className="icon-btn">
          🔍
        </button>

        <button className="theme-btn">
          Dark 🌙 Light
        </button>

        <button className="icon-btn">
          ♡
        </button>

        <button className="icon-btn">
          🔔
        </button>

        <div className="profile-box">

          <img
            src="https://i.pravatar.cc/40"
            alt="Profile"
          />

          <div>
            <strong>Hi, Ahmed</strong>
            <p>Premium</p>
          </div>

        </div>

      </div>

    </nav>
  );
}