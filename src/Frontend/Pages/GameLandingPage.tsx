import { EthConnection, neverResolves, weiToEth } from '@darkforest_eth/network';
import { address } from '@darkforest_eth/serde';
import { utils, Wallet } from 'ethers';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import GameManager from '../../Backend/GameLogic/GameManager';
import GameUIManager, { GameUIManagerEvent } from '../../Backend/GameLogic/GameUIManager';
import TutorialManager, { TutorialState } from '../../Backend/GameLogic/TutorialManager';
import { addAccount, getAccounts } from '../../Backend/Network/AccountManager';
import { getEthConnection } from '../../Backend/Network/Blockchain';
import {
  requestDevFaucet,
} from '../../Backend/Network/UtilityServerAPI';
import {
  GameWindowWrapper,
  TerminalToggler,
  TerminalWrapper,
  Wrapper,
} from '../Components/GameLandingPageComponents';
import { MythicLabelText } from '../Components/Labels/MythicLabel';
import { TextPreview } from '../Components/TextPreview';
import { TopLevelDivProvider, UIManagerProvider } from '../Utils/AppHooks';
import { Incompatibility, unsupportedFeatures } from '../Utils/BrowserChecks';
import { TerminalTextStyle } from '../Utils/TerminalTypes';
import UIEmitter, { UIEmitterEvent } from '../Utils/UIEmitter';
import { GameWindowLayout } from '../Views/GameWindowLayout';
import { Terminal, TerminalHandle } from '../Views/Terminal';

const enum TerminalPromptStep {
  NONE,
  COMPATIBILITY_CHECKS_PASSED,
  DISPLAY_ACCOUNTS,
  GENERATE_ACCOUNT,
  IMPORT_ACCOUNT,
  ACCOUNT_SET,
  FETCHING_ETH_DATA,
  ASK_ADD_ACCOUNT,
  ADD_ACCOUNT,
  NO_HOME_PLANET,
  SEARCHING_FOR_HOME_PLANET,
  ALL_CHECKS_PASS,
  COMPLETE,
  TERMINATED,
  ERROR,
}

export const enum InitRenderState {
  NONE,
  LOADING,
  COMPLETE,
}

export function GameLandingPage() {
  const history = useHistory();
  const terminalHandle = useRef<TerminalHandle>();
  const gameUIManagerRef = useRef<GameUIManager | undefined>();
  const topLevelContainer = useRef<HTMLDivElement | null>(null);

  const [gameManager, setGameManager] = useState<GameManager | undefined>();
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [initRenderState, setInitRenderState] = useState(InitRenderState.NONE);
  const [ethConnection, setEthConnection] = useState<EthConnection | undefined>();
  const [step, setStep] = useState(TerminalPromptStep.NONE);

  useEffect(() => {
    getEthConnection()
      .then((ethConnection) => setEthConnection(ethConnection))
      .catch((e) => {
        alert('error connecting to blockchain');
        console.log(e);
      });
  }, []);

  const isProd = process.env.NODE_ENV === 'production';

  const advanceStateFromNone = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const issues = await unsupportedFeatures();

      if (issues.includes(Incompatibility.MobileOrTablet)) {
        terminal.current?.println(
          'ERROR: Mobile or tablet device detected. Please use desktop.',
          TerminalTextStyle.Red
        );
      }

      if (issues.includes(Incompatibility.NoIDB)) {
        terminal.current?.println(
          'ERROR: IndexedDB not found. Try using a different browser.',
          TerminalTextStyle.Red
        );
      }

      if (issues.includes(Incompatibility.UnsupportedBrowser)) {
        terminal.current?.println(
          'ERROR: Browser unsupported. Try Brave, Firefox, or Chrome.',
          TerminalTextStyle.Red
        );
      }

      if (issues.length > 0) {
        terminal.current?.print(
          `${issues.length.toString()} errors found. `,
          TerminalTextStyle.Red
        );
        terminal.current?.println('Please resolve them and refresh the page.');
        setStep(TerminalPromptStep.TERMINATED);
      } else {
        setStep(TerminalPromptStep.COMPATIBILITY_CHECKS_PASSED);
      }
    },
    []
  );

  const advanceStateFromCompatibilityPassed = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.newline();
      terminal.current?.newline();
      terminal.current?.printElement(<MythicLabelText text={`                 Dark Forest`} />);
      terminal.current?.newline();
      terminal.current?.println(`This instance of Dark Forest (WAGMI Round 1) is a fork of https://zkga.me. Much love to the original authors for their inspiring work.`, TerminalTextStyle.Blue);
      terminal.current?.newline();

      const accounts = getAccounts();
      terminal.current?.println(`Found ${accounts.length} accounts on this device.`);
      terminal.current?.println(``);

      if (accounts.length > 0) {
        terminal.current?.print('(a) ', TerminalTextStyle.Sub);
        terminal.current?.println('Login with existing account.');
      }

      terminal.current?.print('(n) ', TerminalTextStyle.Sub);
      terminal.current?.println(`Generate new burner wallet account.`);
      terminal.current?.print('(i) ', TerminalTextStyle.Sub);
      terminal.current?.println(`Import private key.`);
      terminal.current?.println(``);
      terminal.current?.println(`Select an option:`, TerminalTextStyle.Text);

      const userInput = await terminal.current?.getInput();
      if (userInput === 'a' && accounts.length > 0) {
        setStep(TerminalPromptStep.DISPLAY_ACCOUNTS);
      } else if (userInput === 'n') {
        setStep(TerminalPromptStep.GENERATE_ACCOUNT);
      } else if (userInput === 'i') {
        setStep(TerminalPromptStep.IMPORT_ACCOUNT);
      } else {
        terminal.current?.println('Unrecognized input. Please try again.');
        await advanceStateFromCompatibilityPassed(terminal);
      }
    },
    []
  );

  const advanceStateFromDisplayAccounts = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.println(``);
      const accounts = getAccounts();
      for (let i = 0; i < accounts.length; i += 1) {
        terminal.current?.print(`(${i + 1}): `, TerminalTextStyle.Sub);
        terminal.current?.println(`${accounts[i].address}`);
      }
      terminal.current?.println(``);
      terminal.current?.println(`Select an account:`, TerminalTextStyle.Text);

      const selection = +((await terminal.current?.getInput()) || '');
      if (isNaN(selection) || selection > accounts.length) {
        terminal.current?.println('Unrecognized input. Please try again.');
        await advanceStateFromDisplayAccounts(terminal);
      } else {
        const account = accounts[selection - 1];
        try {
          await ethConnection?.setAccount(account.privateKey);
          setStep(TerminalPromptStep.ACCOUNT_SET);
        } catch (e) {
          terminal.current?.println(
            'An unknown error occurred. please try again.',
            TerminalTextStyle.Red
          );
        }
      }
    },
    [ethConnection]
  );

  const advanceStateFromGenerateAccount = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const newWallet = Wallet.createRandom();
      const newSKey = newWallet.privateKey;
      const newAddr = address(newWallet.address);
      try {
        addAccount(newSKey);
        ethConnection?.setAccount(newSKey);

        terminal.current?.println(``);
        terminal.current?.print(`Created new burner wallet with address `);
        terminal.current?.printElement(<TextPreview text={newAddr} unFocusedWidth={'100px'} />);
        terminal.current?.println(``);
        terminal.current?.println('');
        terminal.current?.println(
          'Note: Burner wallets are stored in local storage.',
          TerminalTextStyle.Text
        );
        terminal.current?.println('They are relatively insecure and you should avoid ');
        terminal.current?.println('storing substantial funds in them.');
        terminal.current?.println('');
        terminal.current?.println('Also, clearing browser local storage/cache will render your');
        terminal.current?.println(
          'burner wallets inaccessible, unless you export your private keys.'
        );
        terminal.current?.println('');
        terminal.current?.println('Press any key to continue:', TerminalTextStyle.Text);

        await terminal.current?.getInput();
        setStep(TerminalPromptStep.ACCOUNT_SET);
      } catch (e) {
        terminal.current?.println(
          'An unknown error occurred. please try again.',
          TerminalTextStyle.Red
        );
      }
    },
    [ethConnection]
  );

  const advanceStateFromImportAccount = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.println(
        'Enter the 0x-prefixed private key of the account you wish to import',
        TerminalTextStyle.Text
      );
      terminal.current?.println(
        "NOTE: THIS WILL STORE THE PRIVATE KEY IN YOUR BROWSER'S LOCAL STORAGE",
        TerminalTextStyle.Text
      );
      terminal.current?.println(
        'Local storage is relatively insecure. We recommend only importing accounts with zero-to-no funds.'
      );
      const newSKey = (await terminal.current?.getInput()) || '';
      try {
        const newAddr = address(utils.computeAddress(newSKey));

        addAccount(newSKey);

        ethConnection?.setAccount(newSKey);
        terminal.current?.println(`Imported account with address ${newAddr}.`);
        setStep(TerminalPromptStep.ACCOUNT_SET);
      } catch (e) {
        terminal.current?.println(
          'An unknown error occurred. please try again.',
          TerminalTextStyle.Red
        );
      }
    },
    [ethConnection]
  );

  const advanceStateFromAccountSet = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      try {
        const address = ethConnection?.getAddress();
        if (!address || !ethConnection) throw new Error('not logged in');
        terminal.current?.println(`Welcome, player ${address}.`, TerminalTextStyle.Green);
        if (!isProd) {
          // in development, automatically get some ether from faucet
          const balance = weiToEth(await ethConnection?.loadBalance(address));
          if (balance === 0) {
            await requestDevFaucet(address);
          }
        } else {
          terminal.current?.println(`In WAGMI Round 1, there is no whitelist. You can start playing as soon as you send your address (${address}) WGM!`, TerminalTextStyle.Blue);
          terminal.current?.println('If you forget to send your address WGM, you will see "low balance" errors.', TerminalTextStyle.Red);
        }
        setStep(TerminalPromptStep.FETCHING_ETH_DATA);
      } catch (e) {
        console.error(`error connecting to address: ${e}`);
        setStep(TerminalPromptStep.TERMINATED);
      }
    },
    [ethConnection, isProd]
  );

  const advanceStateFromFetchingEthData = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      let newGameManager: GameManager;

      try {
        if (!ethConnection) throw new Error('no eth connection');

        newGameManager = await GameManager.create(ethConnection, terminal);
      } catch (e) {
        console.error(e);

        setStep(TerminalPromptStep.ERROR);

        terminal.current?.print(
          'Network under heavy load. Please refresh the page, and check ',
          TerminalTextStyle.Red
        );

        terminal.current?.println('');

        return;
      }

      setGameManager(newGameManager);

      window.df = newGameManager;

      const newGameUIManager = await GameUIManager.create(newGameManager, terminal);

      window.ui = newGameUIManager;

      terminal.current?.newline();
      terminal.current?.println('Connected to Dark Forest Contract');
      gameUIManagerRef.current = newGameUIManager;

      if (!newGameManager.hasJoinedGame()) {
        setStep(TerminalPromptStep.NO_HOME_PLANET);
      } else {
        const browserHasData = !!newGameManager.getHomeCoords();
        if (!browserHasData) {
          terminal.current?.println(
            'ERROR: Home coords not found on this browser.',
            TerminalTextStyle.Red
          );
          setStep(TerminalPromptStep.ASK_ADD_ACCOUNT);
          return;
        }
        terminal.current?.println('Validated Local Data...');
        setStep(TerminalPromptStep.ALL_CHECKS_PASS);
      }
    },
    [ethConnection]
  );

  const advanceStateFromAskAddAccount = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.println('Import account home coordinates? (y/n)', TerminalTextStyle.Text);
      terminal.current?.println(
        "If you're importing an account, make sure you know what you're doing."
      );
      const userInput = await terminal.current?.getInput();
      if (userInput === 'y') {
        setStep(TerminalPromptStep.ADD_ACCOUNT);
      } else if (userInput === 'n') {
        terminal.current?.println('Try using a different account and reload.');
        setStep(TerminalPromptStep.TERMINATED);
      } else {
        terminal.current?.println('Unrecognized input. Please try again.');
        await advanceStateFromAskAddAccount(terminal);
      }
    },
    []
  );

  const advanceStateFromAddAccount = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const gameUIManager = gameUIManagerRef.current;

      if (gameUIManager) {
        try {
          terminal.current?.println('x: ', TerminalTextStyle.Blue);
          const x = parseInt((await terminal.current?.getInput()) || '');
          terminal.current?.println('y: ', TerminalTextStyle.Blue);
          const y = parseInt((await terminal.current?.getInput()) || '');
          if (
            Number.isNaN(x) ||
            Number.isNaN(y) ||
            Math.abs(x) > 2 ** 32 ||
            Math.abs(y) > 2 ** 32
          ) {
            throw 'Invalid home coordinates.';
          }
          if (await gameUIManager.addAccount({ x, y })) {
            terminal.current?.println('Successfully added account.');
            terminal.current?.println('Initializing game...');
            setStep(TerminalPromptStep.ALL_CHECKS_PASS);
          } else {
            throw 'Invalid home coordinates.';
          }
        } catch (e) {
          terminal.current?.println(`ERROR: ${e}`, TerminalTextStyle.Red);
          terminal.current?.println('Please try again.');
        }
      } else {
        terminal.current?.println('ERROR: Game UI Manager not found. Terminating session.');
        setStep(TerminalPromptStep.TERMINATED);
      }
    },
    []
  );

  const advanceStateFromNoHomePlanet = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.println('Welcome to DARK FOREST.');

      const gameUIManager = gameUIManagerRef.current;
      if (!gameUIManager) {
        terminal.current?.println('ERROR: Game UI Manager not found. Terminating session.');
        setStep(TerminalPromptStep.TERMINATED);
        return;
      }

      if (Date.now() / 1000 > gameUIManager.getEndTimeSeconds()) {
        terminal.current?.println('ERROR: This game has ended. Terminating session.');
        setStep(TerminalPromptStep.TERMINATED);
        return;
      }

      terminal.current?.newline();

      terminal.current?.println('Press ENTER to find a home planet. This may take up to 120s.');
      terminal.current?.println('This will consume a lot of CPU.');

      await terminal.current?.getInput();

      const success = await new Promise(async (resolve) => {
        gameUIManager
          // TODO: remove beforeRetry: (e: Error) => Promise<boolean>
          .joinGame(async (e) => {
            console.error(e);

            terminal.current?.println('Error Joining Game:');
            terminal.current?.println('');
            terminal.current?.println(e.message, TerminalTextStyle.Red);
            terminal.current?.println('');
            terminal.current?.println('Press Enter to Try Again:');

            await terminal.current?.getInput();
            return true;
          })
          .once(GameUIManagerEvent.InitializedPlayer, () => {
            resolve(true);
          })
          .once(GameUIManagerEvent.InitializedPlayerError, (error: Error) => {
            terminal.current?.println(
              `[ERROR] An error occurred: ${error.toString().slice(0, 10000)}`,
              TerminalTextStyle.Red
            );
          });
      });

      if (success) {
        terminal.current?.println('Initializing game...');
        setStep(TerminalPromptStep.ALL_CHECKS_PASS);
      }
    },
    []
  );

  const advanceStateFromAllChecksPass = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      terminal.current?.println('');
      terminal.current?.println('Press ENTER to begin:');
      await terminal.current?.getInput();
      setStep(TerminalPromptStep.COMPLETE);
      setInitRenderState(InitRenderState.COMPLETE);
      terminal.current?.clear();

      terminal.current?.println('Welcome to the Dark Forest.', TerminalTextStyle.Green);
      terminal.current?.println('');
      terminal.current?.println(
        "This is the Dark Forest interactive JavaScript terminal. Only use this if you know exactly what you're doing."
      );
      terminal.current?.println('');
      terminal.current?.println('Try running: df.getAccount()');
      terminal.current?.println('');
    },
    []
  );

  const advanceStateFromComplete = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      const input = (await terminal.current?.getInput()) || '';
      let res = '';
      try {
        // indrect eval call: http://perfectionkills.com/global-eval-what-are-the-options/
        res = (1, eval)(input);
        if (res !== undefined) {
          terminal.current?.println(res.toString(), TerminalTextStyle.Text);
        }
      } catch (e) {
        res = e.message;
        terminal.current?.println(`ERROR: ${res}`, TerminalTextStyle.Red);
      }
      advanceStateFromComplete(terminal);
    },
    []
  );

  const advanceStateFromError = useCallback(async () => {
    await neverResolves();
  }, []);

  const advanceState = useCallback(
    async (terminal: React.MutableRefObject<TerminalHandle | undefined>) => {
      if (step === TerminalPromptStep.NONE && ethConnection) {
        await advanceStateFromNone(terminal);
      } else if (step === TerminalPromptStep.COMPATIBILITY_CHECKS_PASSED) {
        await advanceStateFromCompatibilityPassed(terminal);
      } else if (step === TerminalPromptStep.DISPLAY_ACCOUNTS) {
        await advanceStateFromDisplayAccounts(terminal);
      } else if (step === TerminalPromptStep.GENERATE_ACCOUNT) {
        await advanceStateFromGenerateAccount(terminal);
      } else if (step === TerminalPromptStep.IMPORT_ACCOUNT) {
        await advanceStateFromImportAccount(terminal);
      } else if (step === TerminalPromptStep.ACCOUNT_SET) {
        await advanceStateFromAccountSet(terminal);
      } else if (step === TerminalPromptStep.FETCHING_ETH_DATA) {
        await advanceStateFromFetchingEthData(terminal);
      } else if (step === TerminalPromptStep.ASK_ADD_ACCOUNT) {
        await advanceStateFromAskAddAccount(terminal);
      } else if (step === TerminalPromptStep.ADD_ACCOUNT) {
        await advanceStateFromAddAccount(terminal);
      } else if (step === TerminalPromptStep.NO_HOME_PLANET) {
        await advanceStateFromNoHomePlanet(terminal);
      } else if (step === TerminalPromptStep.ALL_CHECKS_PASS) {
        await advanceStateFromAllChecksPass(terminal);
      } else if (step === TerminalPromptStep.COMPLETE) {
        await advanceStateFromComplete(terminal);
      } else if (step === TerminalPromptStep.ERROR) {
        await advanceStateFromError();
      }
    },
    [
      step,
      advanceStateFromAccountSet,
      advanceStateFromAddAccount,
      advanceStateFromAllChecksPass,
      advanceStateFromAskAddAccount,
      advanceStateFromCompatibilityPassed,
      advanceStateFromComplete,
      advanceStateFromDisplayAccounts,
      advanceStateFromError,
      advanceStateFromFetchingEthData,
      advanceStateFromGenerateAccount,
      advanceStateFromImportAccount,
      advanceStateFromNoHomePlanet,
      advanceStateFromNone,
      ethConnection,
    ]
  );

  useEffect(() => {
    const uiEmitter = UIEmitter.getInstance();
    uiEmitter.emit(UIEmitterEvent.UIChange);
  }, [initRenderState]);

  useEffect(() => {
    if (!terminalVisible) {
      const tutorialManager = TutorialManager.getInstance();
      tutorialManager.acceptInput(TutorialState.Terminal);
    }
  }, [terminalVisible]);

  useEffect(() => {
    if (terminalHandle.current && topLevelContainer.current) {
      advanceState(terminalHandle);
    }
  }, [terminalHandle, topLevelContainer, advanceState]);

  return (
    <Wrapper initRender={initRenderState} terminalEnabled={terminalVisible}>
      <GameWindowWrapper initRender={initRenderState} terminalEnabled={terminalVisible}>
        {gameUIManagerRef.current && topLevelContainer.current && gameManager && (
          <TopLevelDivProvider value={topLevelContainer.current}>
            <UIManagerProvider value={gameUIManagerRef.current}>
              <GameWindowLayout
                terminalVisible={terminalVisible}
                setTerminalVisible={setTerminalVisible}
              />
            </UIManagerProvider>
          </TopLevelDivProvider>
        )}
        <TerminalToggler
          terminalEnabled={terminalVisible}
          setTerminalEnabled={setTerminalVisible}
        />
      </GameWindowWrapper>
      <TerminalWrapper initRender={initRenderState} terminalEnabled={terminalVisible}>
        <Terminal ref={terminalHandle} promptCharacter={'$'} />
      </TerminalWrapper>
      <div ref={topLevelContainer}></div>
    </Wrapper>
  );
}
