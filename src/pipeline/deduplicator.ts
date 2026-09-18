import type { Article, EventCandidate, PrefilterResult } from "../domain/types.js";
import { jaccard, normalizeText, normalizeUrl, sha256, tokenize } from "../lib/text.js";

interface EvaluatedArticle { article: Article; prefilter: PrefilterResult }
export interface ExistingEventFingerprint { eventKey: string; title: string; prefilter: PrefilterResult }

function eventIdentity(item: EvaluatedArticle): string {
  const p = item.prefilter;
  const companies = [...p.piresCompanies, ...p.targetCompanies].map(normalizeText).sort().join("|");
  const signals = [...p.criticalSignals, ...p.projectSignals, ...p.earlySignals].map(normalizeText).sort().slice(0, 5).join("|");
  const titleTokens = [...tokenize(item.article.title)].sort().slice(0, 10).join("|");
  return `${companies}::${signals}::${titleTokens}`;
}

function related(left: EvaluatedArticle, right: EvaluatedArticle): boolean {
  if (normalizeUrl(left.article.url) === normalizeUrl(right.article.url)) return true;
  const leftCompanies = new Set([...left.prefilter.piresCompanies, ...left.prefilter.targetCompanies].map(normalizeText));
  const sharesCompany = [...right.prefilter.piresCompanies, ...right.prefilter.targetCompanies]
    .map(normalizeText).some((company) => leftCompanies.has(company));
  if (!sharesCompany) return false;
  const titleSimilarity = jaccard(left.article.title, right.article.title);
  const bodySimilarity = jaccard(
    `${left.article.title} ${left.article.content.slice(0, 1800)}`,
    `${right.article.title} ${right.article.content.slice(0, 1800)}`,
  );
  return titleSimilarity >= 0.42 || bodySimilarity >= 0.34;
}

function choosePrimary(items: EvaluatedArticle[]): EvaluatedArticle {
  return [...items].sort((a, b) => {
    const scoreDelta = b.prefilter.score - a.prefilter.score;
    if (scoreDelta) return scoreDelta;
    return b.article.content.length - a.article.content.length;
  })[0]!;
}

export class Deduplicator {
  reconcile(event: EventCandidate, existing: ExistingEventFingerprint[]): EventCandidate {
    const companies = new Set([...event.prefilter.piresCompanies, ...event.prefilter.targetCompanies].map(normalizeText));
    const match = existing.find((candidate) => {
      const sharesCompany = [...candidate.prefilter.piresCompanies, ...candidate.prefilter.targetCompanies]
        .map(normalizeText).some((company) => companies.has(company));
      return sharesCompany && jaccard(event.primaryArticle.title, candidate.title) >= 0.42;
    });
    return match ? { ...event, eventKey: match.eventKey } : event;
  }

  cluster(items: EvaluatedArticle[]): EventCandidate[] {
    const unique = new Map<string, EvaluatedArticle>();
    for (const item of items) {
      const key = normalizeUrl(item.article.url) || item.article.contentHash;
      const previous = unique.get(key);
      if (!previous || item.article.content.length > previous.article.content.length) unique.set(key, item);
    }

    const clusters: EvaluatedArticle[][] = [];
    for (const item of unique.values()) {
      const cluster = clusters.find((candidate) => candidate.some((existing) => related(item, existing)));
      if (cluster) cluster.push(item);
      else clusters.push([item]);
    }

    return clusters.map((cluster) => {
      const primary = choosePrimary(cluster);
      return {
        eventKey: `RP-${sha256(eventIdentity(primary)).slice(0, 24).toUpperCase()}`,
        primaryArticle: primary.article,
        articles: cluster.map((item) => item.article),
        prefilter: primary.prefilter,
      };
    });
  }
}
