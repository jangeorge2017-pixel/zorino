import ZorinoHomeProductSection from "@/components/zorino-home/ZorinoHomeProductSection";
import {
  ZH_HOME_PRODUCT_SECTIONS,
  type ZhHomeProductSection,
} from "@/lib/zorino-home/sections";
import type { HomepageSectionProducts } from "@/lib/data/homepage";

type ZorinoHomeProductSectionsProps = {
  sections: HomepageSectionProducts;
};

export default async function ZorinoHomeProductSections({
  sections,
}: ZorinoHomeProductSectionsProps) {
  return (
    <div className="zh-product-sections">
      {ZH_HOME_PRODUCT_SECTIONS.map((section: ZhHomeProductSection) => (
        <ZorinoHomeProductSection
          key={section.key}
          section={section}
          products={sections[section.key]}
        />
      ))}
    </div>
  );
}
