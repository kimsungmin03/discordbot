import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPath(filename) {
  let fullPath = path.resolve(__dirname, filename);
  if (fs.existsSync(fullPath)) return fullPath;
  fullPath = path.resolve(__dirname, '..', filename);
  if (fs.existsSync(fullPath)) return fullPath;
  return path.resolve(process.cwd(), filename);
}

dotenv.config({ path: getPath('.env') });

const TIER_KO_MAP = {
  IRON: '아이언',
  BRONZE: '브론즈',
  SILVER: '실버',
  GOLD: '골드',
  PLATINUM: '플레',
  EMERALD: '에메',
  DIAMOND: '다이아',
  MASTER: '마스터',
  GRANDMASTER: '그랜드마스터',
  CHALLENGER: '챌린저',
};

const RANK_NUM_MAP = {
  I: '1',
  II: '2',
  III: '3',
  IV: '4',
};

const TIER_SORT_BASE = {
  CHALLENGER: 1,
  GRANDMASTER: 2,
  MASTER: 3,
  DIAMOND: 4,
  EMERALD: 8,
  PLATINUM: 12,
  GOLD: 16,
  SILVER: 20,
  BRONZE: 24,
  IRON: 28,
};

export function calculateTierSort(tier, rank) {
  if (!tier || tier === '언랭') return 35;
  const base = TIER_SORT_BASE[tier.toUpperCase()] || 30;
  const rankOffset = rank === 'I' ? 0 : rank === 'II' ? 1 : rank === 'III' ? 2 : rank === 'IV' ? 3 : 0;
  return base + rankOffset;
}

export function formatTier(tier, rank) {
  if (!tier) return '언랭';
  const koTier = TIER_KO_MAP[tier.toUpperCase()] || tier;
  if (['MASTER', 'GRANDMASTER', 'CHALLENGER'].includes(tier.toUpperCase())) {
    return koTier;
  }
  const numRank = RANK_NUM_MAP[rank] || rank || '';
  return numRank ? `${koTier}${numRank}` : koTier;
}

function getApiKey() {
  const key = process.env.RIOT_API_KEY;
  if (!key) {
    throw new Error('RIOT_API_KEY가 .env 파일에 설정되어 있지 않습니다.');
  }
  return key.trim();
}

/**
 * Fetch Account Info by Riot ID (gameName#tagLine)
 */
export async function getAccountByRiotId(gameName, tagLine) {
  const apiKey = getApiKey();
  const url = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;

  const res = await fetch(url, {
    headers: { 'X-Riot-Token': apiKey }
  });

  if (!res.ok) {
    if (res.status === 404) {
      throw new Error(`존재하지 않는 롤 소환사(Riot ID)입니다: ${gameName}#${tagLine}`);
    } else if (res.status === 401 || res.status === 403) {
      throw new Error('라이엇 API 키가 만료되었거나 유효하지 않습니다.');
    } else if (res.status === 429) {
      throw new Error('라이엇 API 호출 한도를 초과했습니다. 잠시 후 다시 시도해주세요.');
    }
    throw new Error(`라이엇 API 오류 (${res.status}): ${res.statusText}`);
  }

  return await res.json();
}

/**
 * Fetch latest Riot ID (gameName#tagLine) by PUUID
 */
export async function getAccountByPuuid(puuid) {
  const apiKey = getApiKey();
  const url = `https://asia.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(puuid)}`;

  const res = await fetch(url, {
    headers: { 'X-Riot-Token': apiKey }
  });

  if (!res.ok) {
    throw new Error(`PUUID 조회 실패 (${res.status})`);
  }

  return await res.json();
}

/**
 * Fetch Summoner Data & Solo Rank Tier by PUUID
 */
export async function getTierByPuuid(puuid) {
  const apiKey = getApiKey();

  const leagueUrl = `https://kr.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
  const leagueRes = await fetch(leagueUrl, {
    headers: { 'X-Riot-Token': apiKey }
  });

  if (!leagueRes.ok) {
    if (leagueRes.status === 404) {
      return {
        currentTier: '언랭',
        tierRaw: '',
        rankRaw: '',
        lp: 0,
        wins: 0,
        losses: 0,
        maxTierSort: 35
      };
    }
    throw new Error(`리그 정보 조회 오류 (${leagueRes.status})`);
  }

  const leagueEntries = await leagueRes.json();
  const soloRank = Array.isArray(leagueEntries)
    ? leagueEntries.find(entry => entry.queueType === 'RANKED_SOLO_5x5')
    : null;

  if (!soloRank) {
    return {
      currentTier: '언랭',
      tierRaw: '',
      rankRaw: '',
      lp: 0,
      wins: 0,
      losses: 0,
      maxTierSort: 35
    };
  }

  const formatted = formatTier(soloRank.tier, soloRank.rank);
  const sortVal = calculateTierSort(soloRank.tier, soloRank.rank);

  return {
    currentTier: formatted,
    tierRaw: soloRank.tier,
    rankRaw: soloRank.rank,
    lp: soloRank.leaguePoints,
    wins: soloRank.wins,
    losses: soloRank.losses,
    maxTierSort: sortVal,
  };
}

/**
 * Convenient all-in-one helper for a Riot ID string (e.g. "Hide on bush#KR1")
 */
export async function fetchFullRiotInfo(riotIdStr) {
  if (!riotIdStr.includes('#')) {
    throw new Error('소환사명과 태그를 "#"으로 구분하여 입력해주세요. (예: Hide on bush#KR1)');
  }

  const parts = riotIdStr.split('#');
  const gameName = parts[0].trim();
  const tagLine = parts.slice(1).join('#').trim();

  const account = await getAccountByRiotId(gameName, tagLine);
  const tierInfo = await getTierByPuuid(account.puuid);

  return {
    puuid: account.puuid,
    fullName: `${account.gameName}#${account.tagLine}`,
    gameName: account.gameName,
    tagLine: account.tagLine,
    ...tierInfo,
  };
}

/**
 * Clean tier string: remove slashes/backslashes and fix unwanted whitespace
 */
export function sanitizeTier(val) {
  if (!val) return '';
  let s = String(val).trim();
  if (s === '\\' || s === '/' || s === '-') return '';
  if (!s.startsWith('마스터')) {
    s = s.replace(/\s+/g, '');
  } else {
    s = s.replace(/\s+/g, ' ');
  }
  return s;
}

