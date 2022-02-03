import { Leaderboard } from '@darkforest_eth/types';

const LEADERBOARD_API = process.env.LEADERBOARD_API as string;

function leaderboardQuery() {
  return `
{
  entries: players(orderBy:"score", orderDirection:desc, where:{score_gt:0}, first:50) {
    ethAddress: id
    score
  }
}
  `;
}

export async function loadLeaderboard(): Promise<Leaderboard> {
  const address = `${LEADERBOARD_API}`;
  const res = await fetch(address, {
    method: 'POST',
    body:JSON.stringify({query: leaderboardQuery()}),
    headers: {
			'Content-Type': 'application/json',
			Accept: 'application/json',
		},
  });

  const rep = await res.json();

  if (rep.error) {
    throw new Error(rep.error);
  }

  return rep.data;
}
