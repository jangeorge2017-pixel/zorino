import { categories } from "@/data/home";

export default function CategoryGrid() {
  return (
    <section className="categories-section">
      <div className="categories">
        {categories.map((category) => (
          <button
            key={category.label}
            type="button"
            className={`category-card ${category.active ? "category-card-active" : ""}`}
          >
            <span className="category-icon">{category.icon}</span>
            <span className="category-label">{category.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
