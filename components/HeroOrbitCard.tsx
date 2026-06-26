import AssetImage from "@/components/AssetImage";
import type { FloatingProductCard } from "@/lib/types/entities";

type HeroOrbitCardProps = {
  product: FloatingProductCard;
};

export default function HeroOrbitCard({ product }: HeroOrbitCardProps) {
  return (
    <div
      className={`hero-orbit-card ${product.position}`}
      title={product.price ? `${product.price} · ${product.discount}` : undefined}
    >
      <div className="hero-orbit-card-glow" aria-hidden="true" />
      <div className="hero-orbit-card-ring" aria-hidden="true" />
      <div className="hero-orbit-card-inner">
        <div className="hero-orbit-image-frame">
          <AssetImage
            src={product.imageSrc}
            alt=""
            fill
            className="hero-orbit-img"
            sizes="120px"
            priority
          />
        </div>
      </div>
      {product.discount ? (
        <span className="hero-orbit-discount">{product.discount}</span>
      ) : null}
    </div>
  );
}
