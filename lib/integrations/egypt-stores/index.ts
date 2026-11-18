import { btechAdapter } from "@/lib/integrations/egypt-stores/adapters/btech";
import { carrefourAdapter } from "@/lib/integrations/egypt-stores/adapters/carrefour";
import { dubaiphoneAdapter } from "@/lib/integrations/egypt-stores/adapters/dubaiphone";
import { eldokanAdapter } from "@/lib/integrations/egypt-stores/adapters/eldokan";
import { jumiaAdapter } from "@/lib/integrations/egypt-stores/adapters/jumia";
import { noonAdapter } from "@/lib/integrations/egypt-stores/adapters/noon";
import { raneenAdapter } from "@/lib/integrations/egypt-stores/adapters/raneen";
import { temuAdapter } from "@/lib/integrations/egypt-stores/adapters/temu";
import { twobAdapter } from "@/lib/integrations/egypt-stores/adapters/twob";
import type { StoreSearchAdapter } from "@/lib/integrations/egypt-stores/types";

export const EGYPT_STORE_ADAPTERS: readonly StoreSearchAdapter[] = [
  jumiaAdapter,
  noonAdapter,
  temuAdapter,
  carrefourAdapter,
  btechAdapter,
  twobAdapter,
  dubaiphoneAdapter,
  raneenAdapter,
  eldokanAdapter,
];

export { btechAdapter, carrefourAdapter, dubaiphoneAdapter, eldokanAdapter, jumiaAdapter, noonAdapter, raneenAdapter, temuAdapter, twobAdapter };
