export type {
  AmazonCreatorsItem,
  AmazonSearchItemsRequest,
  AmazonSearchItemsResponse,
  AmazonCreatorsConfig,
} from "@/lib/sync/providers/amazon/paapi-types";

export type AmazonCredentials = {
  clientId: string;
  clientSecret: string;
  associateTag: string;
  marketplace: string;
  version: string;
};

export type AmazonValidationResult = {
  ok: boolean;
  message: string;
  testedAt: string;
};
