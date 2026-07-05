export type {
  AmazonPaApiItem,
  AmazonSearchItemsRequest,
  AmazonSearchItemsResponse,
} from "@/lib/sync/providers/amazon/paapi-types";

export type AmazonCredentials = {
  accessKey: string;
  secretKey: string;
  associateTag: string;
  marketplace: string;
  region: string;
};

export type AmazonValidationResult = {
  ok: boolean;
  message: string;
  testedAt: string;
};
