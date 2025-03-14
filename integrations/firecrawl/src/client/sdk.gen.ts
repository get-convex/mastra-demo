// This file is auto-generated by @hey-api/openapi-ts
import { createClient, createConfig  } from '@hey-api/client-fetch';
import type { Options } from '@hey-api/client-fetch';

import type {
  ScrapeAndExtractFromUrlData,
  ScrapeAndExtractFromUrlError,
  ScrapeAndExtractFromUrlResponse,
  GetCrawlStatusData,
  GetCrawlStatusError,
  GetCrawlStatusResponse,
  CancelCrawlData,
  CancelCrawlError,
  CancelCrawlResponse,
  CrawlUrlsData,
  CrawlUrlsError,
  CrawlUrlsResponse,
  MapUrlsData,
  MapUrlsError,
  MapUrlsResponse,
} from './types.gen';

export const client = createClient(createConfig());

/**
 * Scrape a single URL and optionally extract information using an LLM
 */
export const scrapeAndExtractFromUrl = <ThrowOnError extends boolean = false>(
  options: Options<ScrapeAndExtractFromUrlData, ThrowOnError>,
) => {
  return (options?.client ?? client).post<ScrapeAndExtractFromUrlResponse, ScrapeAndExtractFromUrlError, ThrowOnError>({
    ...options,
    url: '/scrape',
  });
};

/**
 * Get the status of a crawl job
 */
export const getCrawlStatus = <ThrowOnError extends boolean = false>(
  options: Options<GetCrawlStatusData, ThrowOnError>,
) => {
  return (options?.client ?? client).get<GetCrawlStatusResponse, GetCrawlStatusError, ThrowOnError>({
    ...options,
    url: '/crawl/{id}',
  });
};

/**
 * Cancel a crawl job
 */
export const cancelCrawl = <ThrowOnError extends boolean = false>(options: Options<CancelCrawlData, ThrowOnError>) => {
  return (options?.client ?? client).delete<CancelCrawlResponse, CancelCrawlError, ThrowOnError>({
    ...options,
    url: '/crawl/{id}',
  });
};

/**
 * Crawl multiple URLs based on options
 */
export const crawlUrls = <ThrowOnError extends boolean = false>(options: Options<CrawlUrlsData, ThrowOnError>) => {
  return (options?.client ?? client).post<CrawlUrlsResponse, CrawlUrlsError, ThrowOnError>({
    ...options,
    url: '/crawl',
  });
};

/**
 * Map multiple URLs based on options
 */
export const mapUrls = <ThrowOnError extends boolean = false>(options: Options<MapUrlsData, ThrowOnError>) => {
  return (options?.client ?? client).post<MapUrlsResponse, MapUrlsError, ThrowOnError>({
    ...options,
    url: '/map',
  });
};
