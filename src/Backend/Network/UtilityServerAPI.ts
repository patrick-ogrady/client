import { EthAddress, SignedMessage } from '@darkforest_eth/types';
import * as EmailValidator from 'email-validator';
import timeout from 'p-timeout';
import { TerminalHandle } from '../../Frontend/Views/Terminal';

export const WEBSERVER_URL = process.env.WEBSERVER_URL as string;

type RegisterResponse = { inProgress: boolean; success?: boolean; txHash: string; error?: string };

async function sleep(timeoutMs: number) {
  return new Promise<void>((resolve) => {
    setTimeout(() => resolve(), timeoutMs);
  });
}

export const requestDevFaucet = async (address: EthAddress): Promise<boolean> => {
  // TODO: Provide own env variable for this feature
  if (process.env.NODE_ENV === 'production') {
    return false;
  }
  try {
    const { success } = await fetch(`${WEBSERVER_URL}/whitelist/faucet`, {
      method: 'POST',
      body: JSON.stringify({
        address,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    }).then((x) => x.json());

    return success;
  } catch (e) {
    console.error(`error when requesting drip: ${e}`);
    return false;
  }
};
