export default function SearchBar() {
  return (
    <div className="search-wrapper">

      <div className="hero-search">

        <input
          type="text"
          placeholder="Search for products, brands or categories..."
        />

        <button>
          Search
        </button>

      </div>

      <div className="search-suggestions">

        <span>iPhone 15 Pro Max</span>

        <span>MacBook Air M3</span>

        <span>PlayStation 5</span>

        <span>Nike Air Jordan</span>

      </div>

    </div>
  );
}